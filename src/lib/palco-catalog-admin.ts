/** Tipos y helpers para el panel admin de curación de catálogo. */

export type CatalogCandidate = {
  slug_guess: string;
  canonical_guess: string;
  forms: string[];
  kind: string;
  mentions: number;
  programs: number;
  channels?: number;
  confidence?: string;
  linked_slug?: string | null;
};

export type CatalogCurated = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
};

export type CatalogData = {
  generated_at?: string;
  curated: CatalogCurated[];
  candidates: CatalogCandidate[];
  candidates_count?: number;
};

export type Promovida = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
  excluir: string[];
};

export type CatalogDecisions = {
  descartadas: string[];
  fusiones: Record<string, string>;
  promovidas: Promovida[];
};

export const EMPTY_DECISIONS: CatalogDecisions = {
  descartadas: [],
  fusiones: {},
  promovidas: [],
};

export function norm(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function kindLabel(kind: string): string {
  if (kind === "empresa") return "Empresa";
  if (kind === "persona") return "Político";
  return kind;
}

export function entityTypeToKind(type: string): "persona" | "empresa" {
  return type === "Empresa" ? "empresa" : "persona";
}

export function candidateKey(c: CatalogCandidate): string {
  return norm(c.canonical_guess);
}

export function isCandidateReviewed(
  c: CatalogCandidate,
  d: CatalogDecisions
): boolean {
  const key = candidateKey(c);
  if (d.descartadas.includes(key)) return true;
  if (key in d.fusiones) return true;
  if (d.promovidas.some((p) => p.slug === c.slug_guess)) return true;
  return false;
}

export type MergeTarget = { slug: string; name: string; type: string };

/** Entidades disponibles como destino de fusión. */
export function buildMergeTargets(
  index: { slug: string; name: string; type: string }[],
  curated: CatalogCurated[],
  promovidas: Promovida[]
): MergeTarget[] {
  const seen = new Set<string>();
  const out: MergeTarget[] = [];
  const add = (slug: string, name: string, type: string) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push({ slug, name, type });
  };
  for (const r of index) add(r.slug, r.name, r.type);
  for (const c of curated) add(c.slug, c.name, c.type);
  for (const p of promovidas) add(p.slug, p.name, p.type);
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Agrupa candidatas con señales obvias de duplicado (ej. Maradona). */
export function findMergeGroups(candidates: CatalogCandidate[]): CatalogCandidate[][] {
  const pending = [...candidates];
  const groups: CatalogCandidate[][] = [];
  const used = new Set<string>();

  function tokens(name: string): string[] {
    return norm(name).split(/\s+/).filter(Boolean);
  }

  function shouldGroup(a: CatalogCandidate, b: CatalogCandidate): boolean {
    const na = norm(a.canonical_guess);
    const nb = norm(b.canonical_guess);
    if (na.includes(nb) || nb.includes(na)) return na !== nb;
    const ta = new Set(tokens(a.canonical_guess));
    const tb = tokens(b.canonical_guess);
    return tb.some((t) => t.length >= 5 && ta.has(t));
  }

  for (let i = 0; i < pending.length; i++) {
    const a = pending[i];
    const ak = candidateKey(a);
    if (used.has(ak)) continue;
    const group = [a];
    used.add(ak);
    for (let j = i + 1; j < pending.length; j++) {
      const b = pending[j];
      const bk = candidateKey(b);
      if (used.has(bk)) continue;
      if (group.some((g) => shouldGroup(g, b))) {
        group.push(b);
        used.add(bk);
      }
    }
    if (group.length >= 2) groups.push(group);
  }
  return groups;
}

export function mergeDecisions(
  current: CatalogDecisions,
  action: {
    tipo: "descartar" | "fusionar" | "promover";
    formNorm?: string;
    targetNorm?: string;
    promovida?: Promovida;
  }
): CatalogDecisions {
  const next: CatalogDecisions = {
    descartadas: [...current.descartadas],
    fusiones: { ...current.fusiones },
    promovidas: [...current.promovidas],
  };

  if (action.tipo === "descartar" && action.formNorm) {
    if (!next.descartadas.includes(action.formNorm)) {
      next.descartadas.push(action.formNorm);
    }
  }

  if (action.tipo === "fusionar" && action.formNorm && action.targetNorm) {
    next.fusiones[action.formNorm] = action.targetNorm;
    next.descartadas = next.descartadas.filter((d) => d !== action.formNorm);
    next.promovidas = next.promovidas.filter(
      (p) => norm(p.name) !== action.formNorm
    );
  }

  if (action.tipo === "promover" && action.promovida) {
    const p = action.promovida;
    next.promovidas = next.promovidas.filter((x) => x.slug !== p.slug);
    next.promovidas.push(p);
    const fn = norm(p.name);
    delete next.fusiones[fn];
    next.descartadas = next.descartadas.filter((d) => d !== fn);
  }

  return next;
}
