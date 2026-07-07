/** Pulso: ranking en vivo (con delay) de qué se habla más en el streaming argentino.
 *  Dos vistas: nombres (personas/empresas, de palco_entities/palco_catalog) y
 *  temas de política/economía (de radar.json — pipeline/radar.py). */

/* ---------- normalización de texto (misma lógica que pipeline/pulso_vivo.py) ---------- */
// Marcas combinadas (acentos) tras normalize("NFD"): rango Unicode U+0300–U+036F.
const COMBINING_MARKS = /[̀-ͯ]/g;
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "");
}
function normCanal(s: string): string {
  return stripAccents((s || "").trim().toUpperCase());
}
function normCategoria(s: string): string {
  return stripAccents((s || "").trim().toLowerCase());
}

/** Canales dedicados a política/economía (pipeline/config/pulso_vivo_profile.yaml).
 *  Si se actualiza ese archivo, replicar el cambio acá. */
const CANALES_POLITICA_ECONOMIA = new Set(
  [
    "AHORA PLAY",
    "BorderPeriodismo",
    "Cenital",
    "El Cronista",
    "El Destape",
    "Carajo",
    "Carnaval Stream",
    "Futurock FM",
    " A U R A ",
    "BravoTV",
  ].map(normCanal)
);

const CATEGORIAS_POLITICA_ECONOMIA = new Set(["politica", "economia"]);

/* ---------- tipos ---------- */
export type RadarTema = {
  tema: string;
  score: number;
  trend_score: number;
  menciones: number;
  growth_wow: number;
  canales: string[];
  categorias: string[];
};

export type PulsoTemaRow = RadarTema & { enAlza: boolean };

/** true si el tema entra al vertical política/economía: canal dedicado O
 *  categoría política/económica (misma regla OR que pulso_vivo_profile.yaml,
 *  con incluir_si_cruza_entretenimiento=true). */
export function esPoliticoEconomico(item: RadarTema): boolean {
  if ((item.canales ?? []).some((c) => CANALES_POLITICA_ECONOMIA.has(normCanal(c)))) return true;
  return (item.categorias ?? []).some((c) => CATEGORIAS_POLITICA_ECONOMIA.has(normCategoria(c)));
}

/** Top temas de política/economía, rankeados por score (ya combina menciones,
 *  crecimiento, canales y demanda — ver pipeline/radar.py::compute_trend_score). */
export function rankPulsoPolitico(items: RadarTema[], limit = 20): PulsoTemaRow[] {
  return items
    .filter(esPoliticoEconomico)
    .filter((i) => i.menciones > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((i) => ({ ...i, enAlza: i.growth_wow >= 0.5 }));
}

/* ---------- nombres (personas/empresas) ---------- */
export type NombreHoyRow = {
  slug: string;
  entity: string;
  type: string;
  hoy: number;
  diaHoy: string | null;
  ayer: number | null;
  acumulado: number;
};

/** Para las fichas con by_day (hoy son las 15 curadas + lo que se sume a futuro):
 *  el día más reciente con datos, y el anterior, para mostrar "hoy" con flecha
 *  de movimiento — la señal más "en vivo" que tenemos, aunque sea con delay. */
export function rankNombresHoy(
  radars: Record<string, { entity: string; type: string; totals: { transcript_mentions: number }; by_day: { day: string; mentions: number }[] }>,
  limit = 12
): NombreHoyRow[] {
  const rows: NombreHoyRow[] = [];
  for (const [slug, r] of Object.entries(radars)) {
    const dias = [...(r.by_day ?? [])].sort((a, b) => (a.day < b.day ? -1 : 1));
    if (!dias.length) continue;
    const ultimo = dias[dias.length - 1];
    const anterior = dias.length > 1 ? dias[dias.length - 2] : null;
    rows.push({
      slug,
      entity: r.entity,
      type: r.type,
      hoy: ultimo.mentions,
      diaHoy: ultimo.day,
      ayer: anterior ? anterior.mentions : null,
      acumulado: r.totals.transcript_mentions,
    });
  }
  return rows.sort((a, b) => b.hoy - a.hoy).slice(0, limit);
}

export type NombreAcumuladoRow = {
  slug: string;
  entity: string;
  type: string;
  acumulado: number;
  chatAcumulado: number;
  canales: number;
};

/** Ranking por volumen total (todo el período con datos), para el leaderboard
 *  amplio de "todos los nombres" — no solo los que tuvieron novedad hoy. */
export function rankNombresAcumulado(
  radars: Record<
    string,
    {
      entity: string;
      type: string;
      totals: { transcript_mentions: number; chat_mentions?: number; channels: number };
    }
  >,
  limit = 50
): NombreAcumuladoRow[] {
  return Object.entries(radars)
    .filter(([, r]) => r.totals.transcript_mentions > 0)
    .map(([slug, r]) => ({
      slug,
      entity: r.entity,
      type: r.type,
      acumulado: r.totals.transcript_mentions,
      chatAcumulado: r.totals.chat_mentions ?? 0,
      canales: r.totals.channels,
    }))
    .sort((a, b) => b.acumulado - a.acumulado)
    .slice(0, limit);
}
