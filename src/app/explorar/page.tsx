"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import bundledEntities from "@/data/palco_entities.json";
import bundledCatalog from "@/data/palco_catalog.json";
import { fetchDatasets } from "@/lib/supabase";
import { matchesQuery } from "@/lib/palco-watchlist";
import { APP_NAME } from "@/config/app";
import { whatsappPagoUrl } from "@/config/trial";

/* ---------- tipos ---------- */
type FeedCard = {
  channel: string;
  program: string;
  date: string;
  quote: string;
  sentiment: "neg" | "neu" | "pos";
};
type Radar = {
  slug: string;
  entity: string;
  type: string;
  watchlist_display?: { nombre: string; alias: string[] };
  watchlist?: string[];
  totals: { transcript_mentions: number; channels: number };
  share_of_voice: { channel: string; mentions: number; pct: number }[];
  by_day: { day: string; mentions: number }[];
  feed: FeedCard[];
};
type IndexRow = { slug: string; name: string; type: string; mentions: number; channels: number };
type EntitiesData = { index: IndexRow[]; radars: Record<string, Radar> };

type CuratedRow = { slug: string; name: string; type: string; alias?: string[] };
type CandidateRow = {
  slug_guess: string;
  canonical_guess: string;
  forms?: string[];
  kind: string;
  mentions: number;
  programs: number;
  channels: number;
  first_seen: string;
  last_seen: string;
};
type CatalogData = {
  curated: CuratedRow[];
  candidates: CandidateRow[];
  candidates_count: number;
  curated_count: number;
};

/** Fila unificada del índice explorable: fusiona los 15 con ficha completa
 *  (palco_entities.radars) con el resto del catálogo (palco_catalog.candidates),
 *  que solo tiene volumen — sin citas ni desglose por canal todavía. */
type Explorable = {
  slug: string;
  name: string;
  kind: string;
  mentions: number;
  aliasExtra: string[];
  full: boolean;
  programs?: number;
  channels?: number;
  first_seen?: string;
  last_seen?: string;
};

/* ---------- helpers ---------- */
function fechaCorta(yyyymmdd?: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

function aliasDe(radar?: Radar): string[] {
  if (!radar) return [];
  if (radar.watchlist_display?.alias) return radar.watchlist_display.alias;
  return (radar.watchlist ?? []).slice(1);
}

const SENT_LABEL: Record<FeedCard["sentiment"], string> = {
  neg: "Tono negativo",
  neu: "Tono neutro",
  pos: "Tono positivo",
};

const KIND_LABEL: Record<string, string> = {
  persona: "Persona",
  empresa: "Empresa / marca",
  mixto: "Persona o marca",
};

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
   *  del catálogo (deduplicado por slug, por si algún candidato ya fue promovido). */
  const explorables = useMemo<Explorable[]>(() => {
    const full: Explorable[] = (entities.index ?? []).map((row) => ({
      slug: row.slug,
      name: row.name,
      kind: row.type,
      mentions: row.mentions,
      aliasExtra: aliasDe(entities.radars?.[row.slug]),
      full: true,
    }));
    const fullSlugs = new Set(full.map((r) => r.slug));
    const fullNames = new Set(full.map((r) => r.name.trim().toLowerCase()));

    const liviano: Explorable[] = (catalog.candidates ?? [])
      .filter(
        (c) =>
          !fullSlugs.has(c.slug_guess) &&
          !fullNames.has(c.canonical_guess.trim().toLowerCase())
      )
      .map((c) => ({
        slug: c.slug_guess,
        name: c.canonical_guess,
        kind: KIND_LABEL[c.kind] ?? c.kind,
        mentions: c.mentions,
        aliasExtra: (c.forms ?? []).slice(1),
        full: false,
        programs: c.programs,
        channels: c.channels,
        first_seen: c.first_seen,
        last_seen: c.last_seen,
      }));

    return [...full, ...liviano].sort((a, b) => b.mentions - a.mentions);
  }, [entities, catalog]);

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
          nombres ya tienen ficha completa (volumen, canales y una cita real); el resto del
          catálogo por ahora solo muestra cuánto se lo mencionó — la ficha completa se arma
          cuando lo sumás a una watchlist en Palco. El minuto exacto, la audiencia en vivo y
          la reacción del chat quedan siempre del lado de Palco.
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

      {/* resultado: ficha completa (15 curados) */}
      {selected && radar && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="card p-6 md:p-8">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="eyebrow">{radar.type}</p>
                <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">
                  {radar.entity}
                </h2>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-semibold tracking-tight text-signal">
                  {radar.totals.transcript_mentions.toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-muted">menciones en {radar.totals.channels} canales</p>
              </div>
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-semibold mb-3">Últimos días con datos</p>
                <div className="space-y-1.5">
                  {radar.by_day.slice(-7).map((d) => {
                    const max = Math.max(...radar.by_day.slice(-7).map((x) => x.mentions), 1);
                    return (
                      <div key={d.day} className="flex items-center gap-3 text-xs">
                        <span className="w-10 text-muted">{fechaCorta(d.day)}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full bg-signal-bright rounded-full"
                            style={{ width: `${Math.max((d.mentions / max) * 100, 4)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-medium">{d.mentions}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-3">Dónde más se habló</p>
                <ul className="space-y-2">
                  {radar.share_of_voice.slice(0, 3).map((c) => (
                    <li key={c.channel} className="flex items-center justify-between text-sm">
                      <span>{c.channel}</span>
                      <span className="text-muted">{c.pct}%</span>
                    </li>
                  ))}
                </ul>
                {radar.share_of_voice.length > 3 && (
                  <p className="mt-2 text-xs text-muted">
                    +{radar.share_of_voice.length - 3} canales más en Palco.
                  </p>
                )}
              </div>
            </div>

            {radar.feed?.[0] && (
              <div className="mt-8">
                <p className="text-sm font-semibold mb-2">Una mención real</p>
                <div className="border-l-2 border-line pl-4">
                  <p className="text-sm leading-relaxed">&laquo;{radar.feed[0].quote}&raquo;</p>
                  <p className="mt-2 text-xs text-muted">
                    {radar.feed[0].channel} · {radar.feed[0].program} · {fechaCorta(radar.feed[0].date)}
                    {" · "}
                    {SENT_LABEL[radar.feed[0].sentiment]}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 rounded-xl border border-dashed border-signal-line bg-signal-soft/50 p-5">
              <p className="text-sm font-medium">
                🔒 Cuánta gente estaba mirando en ese momento y cómo reaccionó el chat — eso
                es lo que hace a Palco distinto, y solo se ve con cuenta.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/login" className="btn-signal">
                  Probalo gratis
                </Link>
                <a href={whatsappPagoUrl()} className="btn-ghost">
                  Hablar por WhatsApp
                </a>
              </div>
            </div>

            <p className="mt-6 text-xs text-muted">
              Muestra del corpus ya capturado por {APP_NAME}. No es en vivo ni se actualiza
              minuto a minuto en esta vista pública — para eso está el tablero de Palco.
            </p>
          </div>
        </section>
      )}

      {/* resultado: candidato del catálogo, todavía sin ficha completa */}
      {selected && !radar && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="card p-6 md:p-8">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="eyebrow">{selected.kind}</p>
                <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">
                  {selected.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-semibold tracking-tight text-signal">
                  {selected.mentions.toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-muted">
                  menciones{selected.channels ? ` en ${selected.channels} canales` : ""}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {selected.programs != null && (
                <div>
                  <p className="text-muted text-xs">Programas</p>
                  <p className="font-semibold">{selected.programs}</p>
                </div>
              )}
              {selected.first_seen && (
                <div>
                  <p className="text-muted text-xs">Primera vez visto</p>
                  <p className="font-semibold">{fechaCorta(selected.first_seen)}</p>
                </div>
              )}
              {selected.last_seen && (
                <div>
                  <p className="text-muted text-xs">Última vez visto</p>
                  <p className="font-semibold">{fechaCorta(selected.last_seen)}</p>
                </div>
              )}
            </div>

            <div className="mt-8 rounded-xl border border-dashed border-signal-line bg-signal-soft/50 p-5">
              <p className="text-sm font-medium">
                Este nombre está identificado en el corpus pero todavía no tiene ficha
                completa (citas, desglose por canal, tono). Eso se arma automático apenas lo
                sumás a una watchlist en Palco — junto con audiencia en vivo y reacción del
                chat.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/login" className="btn-signal">
                  Sumarlo a mi watchlist
                </Link>
                <a href={whatsappPagoUrl()} className="btn-ghost">
                  Hablar por WhatsApp
                </a>
              </div>
            </div>
          </div>
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
