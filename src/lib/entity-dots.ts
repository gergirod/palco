/** Campo de dots de una sola entidad: "un partido, un retrato" (ver
 *  docs/specs/SPEC-dataviz-3d-wow.md, sección Explorar). Cada día trackeado es
 *  una columna del relieve — alta si hubo mucho volumen, baja si hubo poco —
 *  coloreada con la proporción real de tono de ese día si está clasificado, o
 *  hueca (sin relleno, "manto gris chato") si no hay clasificación todavía.
 *  Nunca se inventa un tono para un día sin dato — mismo principio que
 *  `porDia` en el dashboard y que documenta SPEC-pipeline-cobertura-tono.md. */

import { resumirTono, type TonoResumen } from "./pulso";
import type { TonoMarea } from "./tone-tide";

export type DiaConTono = {
  day: string;
  mentions: number;
  neg?: number;
  neu?: number;
  pos?: number;
};

export type EntityDot = {
  day: string;
  mentions: number;
  /** true si este día tiene clasificación real (neg+neu+pos > 0) */
  clasificado: boolean;
  /** proporción 0..1 de cada tono dentro de este día (solo si clasificado) */
  negShare: number;
  neuShare: number;
  posShare: number;
  tono: TonoResumen;
};

export type EntityDotField = {
  dots: EntityDot[];
  /** día de mayor volumen dentro de la ventana mostrada — dispara la
   *  "inundación" (flood) en el componente visual. null si no hay días. */
  peak: EntityDot | null;
  /** tono acumulado de todos los días clasificados de la ventana — alimenta
   *  el "cielo inclinado" de fondo (mismo <ToneTide> que usa la landing). */
  tide: TonoMarea;
  maxMentions: number;
};

export function computeEntityDotField(byDay: DiaConTono[], ventanaDias: number): EntityDotField {
  const ordenados = [...byDay].sort((a, b) => (a.day < b.day ? -1 : 1));
  const ventana = ordenados.slice(-ventanaDias);

  const dots: EntityDot[] = ventana.map((d) => {
    const neg = d.neg ?? 0;
    const neu = d.neu ?? 0;
    const pos = d.pos ?? 0;
    const total = neg + neu + pos;
    const clasificado = total > 0;
    return {
      day: d.day,
      mentions: d.mentions,
      clasificado,
      negShare: clasificado ? neg / total : 0,
      neuShare: clasificado ? neu / total : 0,
      posShare: clasificado ? pos / total : 0,
      tono: resumirTono([d]),
    };
  });

  const maxMentions = Math.max(1, ...dots.map((d) => d.mentions));
  const peak =
    dots.length === 0
      ? null
      : dots.reduce((a, b) => (b.mentions > a.mentions ? b : a), dots[0]);

  const acumulado = resumirTono(ventana);
  const muestra = ventana.reduce(
    (acc, d) => acc + (d.neg ?? 0) + (d.neu ?? 0) + (d.pos ?? 0),
    0
  );

  return { dots, peak, tide: { ...acumulado, muestra }, maxMentions };
}
