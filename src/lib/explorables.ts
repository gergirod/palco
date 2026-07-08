/** Índice explorable compartido: fusiona las entidades con ficha completa
 *  (palco_entities.radars) con el resto del catálogo (palco_catalog.candidates),
 *  que solo tiene volumen — sin citas ni desglose por canal todavía.
 *
 *  Extraído de /explorar para reusarlo también en la landing (buscador + chips
 *  + ficha inline), sin duplicar la lógica de fusión ni los tipos. */

/* ---------- tipos ---------- */
export type FeedCard = {
  channel: string;
  program: string;
  date: string;
  quote: string;
  sentiment: "neg" | "neu" | "pos";
};

export type Radar = {
  slug: string;
  entity: string;
  type: string;
  watchlist_display?: { nombre: string; alias: string[] };
  watchlist?: string[];
  totals: { transcript_mentions: number; chat_mentions?: number; channels: number };
  share_of_voice: { channel: string; mentions: number; pct: number }[];
  by_day: { day: string; mentions: number }[];
  feed: FeedCard[];
};

/** Cuántas citas y días mostramos gratis en la ficha pública.
 *  El resto (audiencia en vivo + reacción del chat) sigue del lado de Palco. */
export const FREE_QUOTES = 3;
export const FREE_DAYS = 14;

export type IndexRow = { slug: string; name: string; type: string; mentions: number; channels: number };
export type EntitiesData = { index: IndexRow[]; radars: Record<string, Radar> };

export type CuratedRow = { slug: string; name: string; type: string; alias?: string[] };
export type CandidateRow = {
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
export type CatalogData = {
  curated: CuratedRow[];
  candidates: CandidateRow[];
  candidates_count: number;
  curated_count: number;
};

/** Fila unificada del índice explorable. */
export type Explorable = {
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
export function fechaCorta(yyyymmdd?: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

export function aliasDe(radar?: Radar): string[] {
  if (!radar) return [];
  if (radar.watchlist_display?.alias) return radar.watchlist_display.alias;
  return (radar.watchlist ?? []).slice(1);
}

export const SENT_LABEL: Record<FeedCard["sentiment"], string> = {
  neg: "Tono negativo",
  neu: "Tono neutro",
  pos: "Tono positivo",
};

export const KIND_LABEL: Record<string, string> = {
  persona: "Persona",
  empresa: "Empresa / marca",
  mixto: "Persona o marca",
};

/** Fusiona entities.index (ficha completa) + catalog.candidates (solo volumen),
 *  deduplicado por slug/nombre (por si algún candidato ya fue promovido a curado),
 *  ordenado por menciones desc. */
export function buildExplorables(entities: EntitiesData, catalog: CatalogData): Explorable[] {
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
}
