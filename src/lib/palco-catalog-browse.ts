/** Fila unificada para buscar/seleccionar entidades en onboarding (radar + catálogo). */
export type CatalogBrowseRow = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
  mentions: number;
  channels: number;
  programs: number;
  neg: number;
  neu: number;
  pos: number;
  /** Tiene tablero completo en palco_entities. */
  radarReady: boolean;
};

type IndexRow = {
  slug: string;
  name: string;
  type: string;
  mentions: number;
  channels: number;
  neg: number;
  neu: number;
  pos: number;
};

type CatalogCurated = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
};

type CatalogCandidate = {
  slug_guess: string;
  canonical_guess: string;
  forms: string[];
  kind: string;
  mentions: number;
  programs: number;
  channels?: number;
  linked_slug?: string | null;
  confidence?: string;
};

type CatalogData = {
  curated: CatalogCurated[];
  candidates: CatalogCandidate[];
};

type RadarAlias = {
  watchlist_display?: { alias?: string[] };
};

function kindToType(kind: string): string {
  if (kind === "empresa") return "Empresa";
  if (kind === "persona") return "Político";
  return "Político";
}

/** Index (radar listo) + candidatas del catálogo, ordenadas por menciones. */
export function buildCatalogBrowseRows(
  catalog: CatalogData,
  index: IndexRow[],
  radars?: Record<string, RadarAlias>
): CatalogBrowseRow[] {
  const catalogBySlug = new Map(catalog.curated.map((c) => [c.slug, c]));
  const rows: CatalogBrowseRow[] = [];
  const seen = new Set<string>();

  for (const idx of index) {
    const curated = catalogBySlug.get(idx.slug);
    const radarAlias = radars?.[idx.slug]?.watchlist_display?.alias;
    rows.push({
      slug: idx.slug,
      name: idx.name,
      type: idx.type,
      alias: curated?.alias?.length ? curated.alias : (radarAlias ?? []),
      mentions: idx.mentions,
      channels: idx.channels,
      programs: 0,
      neg: idx.neg,
      neu: idx.neu,
      pos: idx.pos,
      radarReady: true,
    });
    seen.add(idx.slug);
  }

  for (const c of catalog.candidates) {
    const slug = c.linked_slug ?? c.slug_guess;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    rows.push({
      slug,
      name: c.canonical_guess,
      type: kindToType(c.kind),
      alias: c.forms ?? [],
      mentions: c.mentions,
      channels: c.channels ?? 0,
      programs: c.programs,
      neg: 0,
      neu: 0,
      pos: 0,
      radarReady: false,
    });
  }

  return rows.sort((a, b) => b.mentions - a.mentions);
}
