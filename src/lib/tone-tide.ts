/** "Marea de tono": lectura ambiental y agregada del clima del catálogo completo,
 *  pensada para el fondo del hero de la landing.
 *
 *  Dos principios prestados y fusionados acá (ver docs/specs/SPEC-dataviz-3d-wow.md):
 *  - Bogachev: el color cuenta la historia sin leyenda — no hay ejes ni números,
 *    solo un balance verde/rojo que se lee de un vistazo.
 *  - Vaganov: nada se inventa — es el mismo "dot field" que alimenta /pulso y
 *    /explorar, solo que visto desde lejos. Si no hay clasificación real, no hay
 *    marea (SIN_MAREA), nunca un tono inventado.
 *
 *  Toma, por entidad, su día más reciente con datos (mismo criterio que
 *  rankNombresHoy en pulso.ts) y suma el tono ya clasificado (by_day.neg/neu/
 *  pos). No promedia por entidad ni pondera por relevancia — es la suma cruda
 *  de clasificaciones reales de todo el catálogo, así que las entidades con más
 *  actividad hoy pesan más. Es "qué se siente hoy en el streaming", no un
 *  promedio de opinión por nombre. */

import { resumirTono, type TonoResumen } from "./pulso";

type DiaConTono = { day: string; mentions: number; neg?: number; neu?: number; pos?: number };
type RadarConDias = { by_day?: DiaConTono[] };

export type CatalogTide = TonoResumen & {
  /** menciones totales del día más reciente de cada entidad, sumadas */
  volumen: number;
  /** clasificaciones reales (neg+neu+pos) que sostienen la lectura */
  muestra: number;
  /** cuántas entidades aportaron su día más reciente */
  entidades: number;
};

export const SIN_MAREA: CatalogTide = {
  negPct: 0,
  neuPct: 100,
  posPct: 0,
  dominante: null,
  volumen: 0,
  muestra: 0,
  entidades: 0,
};

/** Umbral mínimo de clasificaciones reales para mostrar la marea con confianza.
 *  Por debajo de esto, con pocas muestras, un solo día ruidoso puede teñir todo
 *  el fondo — mejor quedarse cerca del centro (ver tone-tide.tsx: opacidad
 *  proporcional a `muestra`, nunca un salto binario). */
export const MUESTRA_MINIMA = 30;

/** Forma mínima que necesita <ToneTide> — cualquier lectura de tono (la del
 *  catálogo entero o la acumulada de una sola entidad en Explorar) sirve, es
 *  el mismo componente y el mismo mapeo dato → forma en los dos casos. */
export type TonoMarea = TonoResumen & { muestra: number };

export function computeCatalogTide(radars: Record<string, RadarConDias>): CatalogTide {
  const ultimosDias: DiaConTono[] = [];
  let volumen = 0;
  let entidades = 0;

  for (const r of Object.values(radars)) {
    const dias = r.by_day;
    if (!dias || !dias.length) continue;
    const ordenados = [...dias].sort((a, b) => (a.day < b.day ? -1 : 1));
    const ultimo = ordenados[ordenados.length - 1];
    if (!ultimo || ultimo.mentions <= 0) continue;
    ultimosDias.push(ultimo);
    volumen += ultimo.mentions;
    entidades++;
  }

  if (!entidades) return SIN_MAREA;

  const tono = resumirTono(ultimosDias);
  const muestra = ultimosDias.reduce(
    (acc, d) => acc + (d.neg ?? 0) + (d.neu ?? 0) + (d.pos ?? 0),
    0
  );

  if (!muestra) return { ...SIN_MAREA, volumen, entidades };

  return { ...tono, volumen, muestra, entidades };
}

export type { TonoResumen };
