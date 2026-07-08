"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import bundledEntities from "@/data/palco_entities.json";
import bundledCatalog from "@/data/palco_catalog.json";
import { fetchDatasets } from "@/lib/supabase";
import { matchesQuery } from "@/lib/palco-watchlist";
import { APP_NAME } from "@/config/app";
import { EntityFicha } from "@/components/entity-ficha";
import {
  type EntitiesData,
  type CatalogData,
  type Explorable,
  buildExplorables,
} from "@/lib/explorables";

function ExplorarInner() {
  const searchParams = useSearchParams();
  const [entities, setEntities] = useState<EntitiesData>(bundledEntities as unknown as EntitiesData);
  const [catalog, setCatalog] = useState<CatalogData>(bundledCatalog as unknown as CatalogData);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchDatasets(["palco_entities", "palco_catalog"]).then((batch) => {
      if (!vivo) return;
      if (batch.palco_entities) setEntities(batch.palco_entities as EntitiesData);
      if (batch.palco_catalog) setCatalog(batch.palco_catalog as CatalogData);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Índice unificado: primero los 15 con ficha completa, después el resto
   *  del catálogo (deduplicado por slug, por si algún candidato ya fue promovido).
   *  Lógica compartida con la landing en @/lib/explorables. */
  const explorables = useMemo<Explorable[]>(
    () => buildExplorables(entities, catalog),
    [entities, catalog]
  );

  const totalIdentificados =
    (catalog.curated_count || entities.index?.length || 0) + (catalog.candidates_count || 0);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return explorables.filter((row) => matchesQuery(query, row.name, row.aliasExtra));
  }, [query, explorables]);

  const chips = useMemo(() => explorables.slice(0, 30), [explorables]);

  // Deep link desde la landing (?q=nombre): saltea el paso de escribir de nuevo
  // y abre la ficha directo, igual que si el visitante hubiera tocado un chip.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || !q.trim()) return;
    const candidatos = explorables.filter((row) => matchesQuery(q, row.name, row.aliasExtra));
    if (candidatos.length === 0) {
      setQuery(q);
      return;
    }
    const needle = q.trim().toLowerCase();
    const exacto = candidatos.find((row) => row.name.trim().toLowerCase() === needle);
    const best = exacto ?? candidatos[0];
    setSelectedSlug(best.slug);
    setQuery(best.name);
    // Solo al llegar con un ?q= nuevo — no queremos re-disparar en cada cambio de `explorables`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selected = selectedSlug ? explorables.find((r) => r.slug === selectedSlug) : null;
  const radar = selected?.full ? entities.radars?.[selected.slug] : null;

  return (
    <main className="min-h-screen flex flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            {APP_NAME}<span className="text-signal-bright">.</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/pulso" className="text-sm font-medium text-muted hover:text-ink hidden sm:inline-flex">
              Pulso
            </Link>
            <Link href="/login" className="btn-signal">
              Probalo gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-8">
        <p className="eyebrow mb-4">Buscador público · gratis, sin cuenta</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1] max-w-3xl">
          Explorá qué se dice en el streaming argentino de{" "}
          {totalIdentificados > 0 ? `+${totalIdentificados}` : "cientos de"} nombres ya
          identificados.
        </h1>
        <p className="mt-4 text-lg text-muted max-w-2xl">
          Esto es una muestra gratis, sin registrarte. {catalog.curated_count ?? entities.index?.length ?? 0}{" "}
          nombres ya tienen ficha completa: volumen, tendencia diaria, desglose por todos los
          canales y varias citas reales; el resto del catálogo por ahora solo muestra cuánto se
          lo mencionó — la ficha completa se arma cuando lo sumás a una watchlist en Palco. El
          minuto exacto, la audiencia en vivo y la reacción del chat quedan siempre del lado de
          Palco.
        </p>

        <div className="mt-8 max-w-xl">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedSlug(null);
            }}
            placeholder="Escribí un nombre: Milei, Messi, Adorni, Movistar Arena…"
            className="w-full rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-signal-ring"
          />
          {query.trim() && !selectedSlug && (
            <div className="mt-2 card divide-y divide-line overflow-hidden max-h-96 overflow-y-auto">
              {matches.length === 0 && (
                <div className="p-4 text-sm text-muted">
                  Todavía no tenemos a &laquo;{query}&raquo; en el índice público. En Palco
                  vos cargás cualquier nombre y lo rastreamos igual — no hace falta que ya
                  esté acá.{" "}
                  <Link href="/login" className="text-signal font-medium">
                    Probalo gratis
                  </Link>
                  .
                </div>
              )}
              {matches.slice(0, 40).map((row) => (
                <button
                  key={row.slug}
                  onClick={() => setSelectedSlug(row.slug)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-signal-soft flex items-center justify-between gap-3"
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{row.kind}</span>
                    {!row.full && (
                      <span className="text-[10px] uppercase tracking-wide text-muted border border-line rounded-full px-2 py-0.5">
                        solo volumen
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* chips para explorar sin saber qué buscar */}
        {!query.trim() && (
          <div className="mt-8">
            <p className="text-sm text-muted mb-3">
              O elegí uno de los más mencionados para curiosear:
            </p>
            <div className="flex flex-wrap gap-2">
              {chips.map((row) => (
                <button
                  key={row.slug}
                  onClick={() => {
                    setSelectedSlug(row.slug);
                    setQuery(row.name);
                  }}
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-signal-soft transition"
                >
                  {row.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* resultado: ficha compartida con la landing (@/components/entity-ficha) */}
      {selected && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <EntityFicha selected={selected} radar={radar ?? null} />
        </section>
      )}

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            {APP_NAME}<span className="text-signal-bright">.</span>
          </span>
          <span>Monitoreo del streaming en vivo · Argentina</span>
          <Link href="/login" className="text-signal font-medium">
            Ingresar
          </Link>
        </div>
      </footer>
    </main>
  );
}

export default function Explorar() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Cargando…</div>}>
      <ExplorarInner />
    </Suspense>
  );
}
