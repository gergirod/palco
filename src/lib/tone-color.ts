/** Un solo lugar para el mapeo tono → color (regla de coherencia del spec:
 *  "mismo significado de color en todo el producto" — verde/rojo son siempre
 *  pos/neg, nunca un significado distinto por pantalla). Landing, Explorar,
 *  Pulso y Dashboard importan esto, no lo reimplementan cada uno. */

export type Dominante = "neg" | "neu" | "pos" | null;

export function toneColor(dominante: Dominante): string {
  if (dominante === "neg") return "var(--crisis)";
  if (dominante === "pos") return "var(--up)";
  return "var(--muted)";
}
