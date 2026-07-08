"use client";

/** Unifica Pulso y Palco en el hero de la landing: en vez de una card estática
 *  y un teaser aparte, esto es un solo componente vivo que:
 *   1. Muestra el ranking de hoy en vivo (mismo poll de 45s y wow-effects de /pulso).
 *   2. Deja buscar / tocar un chip sin navegar — la ficha (histórico + share of
 *      voice + citas) aparece ahí mismo, debajo, con @/components/entity-ficha
 *      (el mismo componente que usa /explorar).
 *  `children` es el texto de marketing del hero, server-rendered desde page.tsx —
 *  se pasa como children para no perder ese SSR solo por vivir acá adentro. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import bundledEntitiesRaw from "@/data/palco_entities.json";
import bundledCatalogRaw from "@/data/palco_catalog.json";
import { fetchDatasets } from "@/lib/supabase";
import { matchesQuery } from "@/lib/palco-watchlist";
import { rankNombresHoy, type NombreHoyRow } from "@/lib/pulso";
import { EntityFicha } from "@/components/entity-ficha";
import {
  type EntitiesData,
  type CatalogData,
  type Explorable,
  buildExplorables,
} from "@/lib/explorables";
import {
  useLiveDeltas,
  useFlipRows,
  AnimatedNumber,
  LiveDeltaBadge,
  PulsoHeartbeat,
} from "@/app/pulso/pulso-fx";

const bundledEntities = bundledEntitiesRaw as unknown as EntitiesData;
const bundledCatalog = bundledCatalogRaw as unknown as CatalogData;

const REFRESH_MS = 45_000;
const TOP_HOY = 5;
const MAX_CHIPS = 8;
const MAX_MATCHES = 8;

function haceCuanto(d: Date | null): string {
  if (!d) return "cargando…";
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "recién";
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  return `hace ${m} min`;
}

export function LandingLive({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<EntitiesData>(bundledEntities);
  const [catalog, setCatalog] = useState<CatalogData>(bundledCatalog);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [clock, setClock] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  /* poll a Supabase (misma tabla ui_data que /pulso y /explorar) — sin env
     configurado, fetchDatasets devuelve {} y nos quedamos con el bundle. */
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const data = await fetchDatasets(["palco_entities", "palco_catalog"]);
      if (cancelled) return;
      const nextEntities = (data as any)?.palco_entities as EntitiesData | undefined;
      const nextCatalog = (data as any)?.palco_catalog as CatalogData | undefined;
      if (nextEntities?.radars) setEntities(nextEntities);
      if (nextCatalog?.candidates) setCatalog(nextCatalog);
      setLastUpdate(new Date());
    }
    poll();
    const id = setInterval(poll, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /* solo para refrescar el texto "hace Ns" */
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, []);
  void clock;

  const explorables = useMemo<Explorable[]>(
    () => buildExplorables(entities, catalog),
    [entities, catalog]
  );
  const nombresHoy: NombreHoyRow[] = useMemo(
    () => rankNombresHoy(entities.radars ?? {}, TOP_HOY),
    [entities]
  );
  const flashesHoy = useLiveDeltas(nombresHoy, (r) => r.slug, (r) => r.hoy);
  const flipHoy = useFlipRows();
  const maxHoy = Math.max(1, ...nombresHoy.map((r) => r.hoy));
  const actividad = nombresHoy.reduce((acc, r) => acc + r.hoy, 0);
  const intensidad = Math.min(1, actividad / 200);

  const chips = useMemo(() => explorables.slice(0, MAX_CHIPS), [explorables]);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return explorables
      .filter((row) => matchesQuery(query, row.name, row.aliasExtra))
      .slice(0, MAX_MATCHES);
  }, [query, explorables]);

  const selected = selectedSlug ? explorables.find((r) => r.slug === selectedSlug) : null;
  const radar = selected?.full ? entities.radars?.[selected.slug] : null;

  function elegir(slug: string, name: string) {
    setSelectedSlug(slug);
    setQuery(name);
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-6 md:pt-20">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>{children}</div>

          {/* ticker en vivo — reemplaza la card estática de ejemplo */}
          <div className="card p-6 md:justify-self-end w-full max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-signal">
                <span className="pulso-live-dot inline-block h-2 w-2 rounded-full bg-up" />
                <span>Pulso en vivo</span>
              </span>
              <span className="text-muted">actualizado {haceCuanto(lastUpdate)}</span>
            </div>
            <PulsoHeartbeat intensidad={intensidad} className="mt-3" />
            <p className="mt-3 text-xs text-muted">
              Lo más mencionado hoy en el streaming argentino:
            </p>
            <ol className="mt-2 space-y-2">
              {nombresHoy.map((r, i) => {
                const diff = r.ayer == null ? null : r.hoy - r.ayer;
                return (
                  <li key={r.slug} ref={flipHoy(r.slug)} className="pulso-row">
                    <button
                      onClick={() => elegir(r.slug, r.entity)}
                      className="w-full flex items-center gap-3 group text-left"
                    >
                      <span className="w-4 shrink-0 text-right font-display text-sm font-semibold text-muted">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium group-hover:text-signal">
                            {r.entity}
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            <AnimatedNumber value={r.hoy} />
                            {diff != null && diff !== 0 && (
                              <span className={diff > 0 ? "ml-1 text-up" : "ml-1 text-crisis"}>
                                {diff > 0 ? "▲" : "▼"}
                                {Math.abs(diff)}
                              </span>
                            )}
                            <LiveDeltaBadge delta={flashesHoy.get(r.slug)} />
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                          <div
                            className="pulso-bar h-full rounded-full bg-signal-bright"
                            style={{ width: `${(r.hoy / maxHoy) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {!nombresHoy.length && (
                <p className="text-xs text-muted">Todavía no hay datos de hoy.</p>
              )}
            </ol>
            <Link
              href="/pulso"
              className="mt-4 inline-flex text-sm font-medium text-signal hover:underline"
            >
              Ver el pulso completo →
            </Link>
          </div>
        </div>

        {/* buscador + chips: no navega, la ficha aparece ahí mismo abajo */}
        <div className="mt-8 max-w-xl">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedSlug(null);
            }}
            placeholder="Buscá un nombre: Milei, Messi, Adorni…"
            className="w-full rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-signal-ring"
          />
          {query.trim() && !selectedSlug && (
            <div className="mt-2 card divide-y divide-line overflow-hidden max-h-80 overflow-y-auto">
              {matches.length === 0 && (
                <div className="p-4 text-sm text-muted">
                  Todavía no tenemos a &laquo;{query}&raquo; en el índice público. En Palco vos
                  cargás cualquier nombre y lo rastreamos igual.{" "}
                  <Link href="/login" className="text-signal font-medium">
                    Probalo gratis
                  </Link>
                  .
                </div>
              )}
              {matches.map((row) => (
                <button
                  key={row.slug}
                  onClick={() => elegir(row.slug, row.name)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-signal-soft flex items-center justify-between gap-3"
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="text-xs text-muted">{row.kind}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!query.trim() && chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((row) => (
              <button
                key={row.slug}
                onClick={() => elegir(row.slug, row.name)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs hover:bg-signal-soft transition"
              >
                {row.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ficha inline: histórico + share of voice + citas, sin salir de la landing */}
      {selected && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <EntityFicha selected={selected} radar={radar ?? null} />
        </section>
      )}
    </>
  );
}
