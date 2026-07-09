"use client";

/** ToneTide — fondo ambiental del hero: dos mareas (verde/rojo) que se
 *  encuentran en una costura, más un leve "cielo inclinado" hacia quién domina.
 *  Inspirado en los "data portraits" de Alexander Bogachev (wc26.bogachev.fr):
 *  el color cuenta la historia sin ejes ni leyenda. Pero el dato es honesto —
 *  viene de @/lib/tone-tide (computeCatalogTide), que solo suma clasificaciones
 *  reales; si no hay muestra suficiente, no hay marea (ver `muestra` abajo).
 *
 *  Sin interacción, sin texto, sin competir con la copy del hero: es puro
 *  clima de fondo, muy tenue (opacidad tope ~0.09). La única "lectura" posible
 *  es sentir de reojo si el catálogo está mayormente verde o rojo hoy — no
 *  hace falta entenderlo para que el producto funcione, así que no necesita
 *  leyenda (si la necesitara, no estaría lista: ver SPEC-dataviz-3d-wow.md). */

import { useMemo } from "react";
import { MUESTRA_MINIMA, type CatalogTide } from "@/lib/tone-tide";

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
}: {
  tide: CatalogTide;
  className?: string;
}) {
  const geo = useMemo(() => {
    if (tide.muestra <= 0) return null;

    // lean: -1 (todo negativo) .. +1 (todo positivo). Ignora neuPct a propósito
    // — el neutro no tiene dirección, y en este catálogo domina casi siempre,
    // así que si lo dejáramos pesar la marea sería invisible siempre.
    const lean = clamp((tide.posPct - tide.negPct) / 100, -1, 1);

    // confianza: cuánta muestra real sostiene la lectura. Con poca muestra la
    // marea se mantiene casi imperceptible en vez de mostrar un salto binario
    // "hay dato / no hay dato".
    const confianza = clamp(tide.muestra / (MUESTRA_MINIMA * 5), 0, 1);

    const seamXPct = 50 - lean * 14; // quien domina "gana terreno" del otro lado
    const seam = buildSeam(seamXPct);
    const tiltDeg = clamp(lean * 2.2, -1.6, 1.6); // "cielo apenas inclinado"

    const baseOpacity = 0.09 * confianza;
    const negOpacity = baseOpacity * clamp(0.35 + Math.max(0, -lean) * 1.4, 0, 1);
    const posOpacity = baseOpacity * clamp(0.35 + Math.max(0, lean) * 1.4, 0, 1);

    return { seam, tiltDeg, negOpacity, posOpacity, confianza };
  }, [tide]);

  if (!geo) return null;

  const { seam, tiltDeg, negOpacity, posOpacity } = geo;
  const leftFill = `${seam.d} L 0 ${H} L 0 0 Z`;
  const rightFill = `${seam.d} L ${W} ${H} L ${W} 0 Z`;

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
          <linearGradient id="tideNeg" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0%" stopColor="var(--crisis)" stopOpacity={negOpacity} />
            <stop offset="100%" stopColor="var(--crisis)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tidePos" x1="1" y1="0" x2="0" y2="0.3">
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
          <path d={leftFill} fill="url(#tideNeg)" />
          <path d={rightFill} fill="url(#tidePos)" />
          <path
            d={seam.d}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.05 * (geo.confianza ?? 0)}
            strokeWidth={1.5}
          />
        </g>
      </svg>
    </div>
  );
}
