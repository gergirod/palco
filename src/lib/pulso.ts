/** Pulso: ranking en vivo (con delay) de qué se habla más en el streaming argentino.
 *  Dos vistas: nombres (personas/empresas, de palco_entities/palco_catalog) y
 *  temas de política/economía (de radar.json — pipeline/radar.py). */

/* ---------- normalización de texto (misma lógica que pipeline/pulso_vivo.py) ---------- */
// Marcas combinadas (acentos) tras normalize("NFD"): rango Unicode U+0300–U+036F.
const COMBINING_MARKS = /[̀-ͯ]/g;
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "");
}
function normCategoria(s: string): string {
  return stripAccents((s || "").trim().toLowerCase());
}

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

/** true si el tema entra al vertical política/economía: requiere que el tema
 *  esté categorizado como político/económico (extract.py → categorias).
 *
 *  Antes también entraba con solo aparecer en un canal "dedicado" (AURA, Ahora
 *  Play, Cenital, etc.), pero esos canales cubren de todo — Mundial, viajes,
 *  cultura — y esa regla metía ruido no-político en la pestaña (ej. "Mundial
 *  Fútbol 2026", "Selección Argentina", "Banderazo Miami", "Audiencia Chile"
 *  aparecían acá solo por el canal, sin ninguna categoría política real). */
export function esPoliticoEconomico(item: RadarTema): boolean {
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

/** Resumen de tono (aire + chat combinado, según lo que traiga by_day) sobre
 *  la ventana que se le pase — dominancia relativa, no proporción exacta de
 *  las menciones (by_day.neg/neu/pos puede incluir volumen de chat que no
 *  guarda 1:1 con transcript_mentions). Sirve para mostrar una lectura rápida
 *  de imagen ("mayormente positivo"), no para una cifra de facturación. */
export type TonoResumen = {
  negPct: number;
  neuPct: number;
  posPct: number;
  dominante: "neg" | "neu" | "pos" | null;
};

const SIN_TONO: TonoResumen = { negPct: 0, neuPct: 0, posPct: 0, dominante: null };

export const TONO_LABEL: Record<NonNullable<TonoResumen["dominante"]>, string> = {
  pos: "positivo",
  neu: "neutro",
  neg: "negativo",
};

export function resumirTono(dias: { neg?: number; neu?: number; pos?: number }[]): TonoResumen {
  let neg = 0;
  let neu = 0;
  let pos = 0;
  for (const d of dias) {
    neg += d.neg ?? 0;
    neu += d.neu ?? 0;
    pos += d.pos ?? 0;
  }
  const total = neg + neu + pos;
  if (!total) return SIN_TONO;
  const negPct = Math.round((neg / total) * 100);
  const posPct = Math.round((pos / total) * 100);
  const neuPct = Math.max(0, 100 - negPct - posPct);
  const dominante: TonoResumen["dominante"] =
    negPct >= posPct && negPct >= neuPct ? "neg" : posPct >= neuPct ? "pos" : "neu";
  return { negPct, neuPct, posPct, dominante };
}

type RadarConCanalYTono = {
  entity: string;
  type: string;
  totals: { transcript_mentions: number; chat_mentions?: number; channels?: number };
  share_of_voice?: { channel: string; mentions: number; pct: number }[];
  by_day: { day: string; mentions: number; neg?: number; neu?: number; pos?: number }[];
};

export type NombreHoyRow = {
  slug: string;
  entity: string;
  type: string;
  hoy: number;
  diaHoy: string | null;
  ayer: number | null;
  acumulado: number;
  topCanal: string | null;
  tono: TonoResumen;
};

/** Para las fichas con by_day (hoy son las 15 curadas + lo que se sume a futuro):
 *  el día más reciente con datos, y el anterior, para mostrar "hoy" con flecha
 *  de movimiento — la señal más "en vivo" que tenemos, aunque sea con delay. */
export function rankNombresHoy(
  radars: Record<string, RadarConCanalYTono>,
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
      topCanal: r.share_of_voice?.[0]?.channel ?? null,
      tono: resumirTono([ultimo]),
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
  topCanal: string | null;
  tono: TonoResumen;
};

/** Ranking por volumen total (todo el período con datos), para el leaderboard
 *  amplio de "todos los nombres" — no solo los que tuvieron novedad hoy. */
export function rankNombresAcumulado(
  radars: Record<string, RadarConCanalYTono>,
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
      canales: r.totals.channels ?? 0,
      topCanal: r.share_of_voice?.[0]?.channel ?? null,
      tono: resumirTono(r.by_day ?? []),
    }))
    .sort((a, b) => b.acumulado - a.acumulado)
    .slice(0, limit);
}
