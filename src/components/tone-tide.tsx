"use client";

/** ToneTide — fondo ambiental del hero: dos mareas (verde/rojo) que se
 *  encuentran en una costura, más un leve "cielo inclinado" hacia quién domina.
 *  Inspirado en los "data portraits" de Alexander Bogachev (wc26.bogachev.fr):
 *  el color cuenta la historia sin ejes ni leyenda. Pero el dato es honesto —
 *  viene de @/lib/tone-tide (computeCatalogTide), que solo suma clasificaciones
 *  reales; si no hay muestra suficiente, no hay marea (ver `muestra` abajo).
 *
 *  Sin interacción, sin texto, sin competir con la copy del hero: es puro
 *  clima de fondo, tenue pero perceptible (opacidad tope ~0.22). La única "lectura" posible
 *  es sentir de reojo si el catálogo está mayormente verde o rojo hoy — no
 *  hace falta entenderlo para que el producto funcione, así que no necesita
 *  leyenda (si la necesitara, no estaría lista: ver SPEC-dataviz-3d-wow.md). */

import { useId, useMemo } from "react";
import { MUESTRA_MINIMA, type TonoMarea } from "@/lib/tone-tide";

const W = 1000;
const H = 620;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Curva de costura orgánica (no una línea recta): entra y sale del punto
 *  central `xPct` con una ola suave. `startX`/`endX` sirven para cerrar las
 *  regiones de relleno a izquierda/derecha de la curva. */
function buildSeam(xPct: number) {
  const x = (clamp(xPct, 8, 92) / 100) * W;
  const amp = W * 0.026;
  const p0x = x - amp;
  const p1x = x + amp;
  const p2x = x - amp;
  const p3x = x + amp * 0.5;
  const d = [
    `M ${p0x} 0`,
    `C ${p0x} ${H * 0.18}, ${p1x} ${H * 0.15}, ${p1x} ${H * 0.34}`,
    `S ${p2x} ${H * 0.52}, ${p2x} ${H * 0.67}`,
    `S ${p3x} ${H * 0.86}, ${p3x} ${H}`,
  ].join(" ");
  return { d, startX: p0x, endX: p3x };
}

export function ToneTide({
  tide,
  className,
  maxOpacity = 0.22,
}: {
  tide: TonoMarea;
  className?: string;
  /** tope de opacidad de la marea — la landing usa el default (catálogo
   *  entero, mucho volumen); una sola entidad en Explorar puede pedir menos
   *  para no competir con las citas/números de al lado. */
  maxOpacity?: number;
}) {
  const uid = useId();
  const geo = useMemo(() => {
    if (tide.muestra <= 0) return null;

    // lean: -1 (todo negativo) .. +1 (todo positivo), para la costura y el
    // tilt. Ignora neuPct a propósito — el neutro no tiene dirección.
    const lean = clamp((tide.posPct - tide.negPct) / 100, -1, 1);

    // confianza: cuánta muestra real sostiene la lectura — satura rápido
    // (con ~90 clasificaciones ya se muestra a intensidad plena), así que no
    // se queda invisible por tener un catálogo grande y disperso.
    const confianza = clamp(tide.muestra / (MUESTRA_MINIMA * 3), 0, 1);

    // presencia: cuánta marea hay en total (ambos colores juntos) — sube con
    // la confianza, tope configurable para que se sienta pero no compita con
    // el contenido de al lado.
    const presencia = maxOpacity * confianza;

    // reparto entre rojo/verde: proporcional a neg vs pos *entre sí* (no
    // contra el neutro) — así el balance real entre lo negativo y lo positivo
    // se ve claro aunque el catálogo sea mayormente neutro. Sin señal
    // direccional (negPct=posPct=0), reparto parejo.
    const coloreado = tide.negPct + tide.posPct;
    const posShare = coloreado > 0 ? tide.posPct / coloreado : 0.5;
    const negShare = 1 - posShare;

    const seamXPct = 50 - lean * 20; // quien domina "gana terreno" del otro lado
    const seam = buildSeam(seamXPct);
    const tiltDeg = clamp(lean * 3.5, -2.2, 2.2); // "cielo apenas inclinado"

    const negOpacity = presencia * negShare;
    const posOpacity = presencia * posShare;

    return { seam, tiltDeg, negOpacity, posOpacity, confianza };
  }, [tide, maxOpacity]);

  if (!geo) return null;

  const { seam, tiltDeg, negOpacity, posOpacity } = geo;
  const leftFill = `${seam.d} L 0 ${H} L 0 0 Z`;
  const rightFill = `${seam.d} L ${W} ${H} L ${W} 0 Z`;
  const negGradId = `tideNeg-${uid}`;
  const posGradId = `tidePos-${uid}`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={negGradId} x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0%" stopColor="var(--crisis)" stopOpacity={negOpacity} />
            <stop offset="100%" stopColor="var(--crisis)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={posGradId} x1="1" y1="0" x2="0" y2="0.3">
            <stop offset="0%" stopColor="var(--up)" stopOpacity={posOpacity} />
            <stop offset="100%" stopColor="var(--up)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g
          className="tide-breathe"
          style={{
            ["--tide-tilt" as string]: `${tiltDeg}deg`,
            transformOrigin: `${W / 2}px ${H / 2}px`,
          }}
        >
          <path d={leftFill} fill={`url(#${negGradId})`} />
          <path d={rightFill} fill={`url(#${posGradId})`} />
          <path
            d={seam.d}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.12 * (geo.confianza ?? 0)}
            strokeWidth={1.5}
          />
        </g>
      </svg>
    </div>
  );
}
