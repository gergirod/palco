"use client";

/** EntityDotField — "un partido, un retrato" (SPEC-dataviz-3d-wow.md, sección
 *  Explorar): reemplaza la barra 2D plana de "Tendencia diaria" por el campo
 *  de dots de la propia entidad.
 *
 *  - Relieve = volumen real de ese día (altura de la columna).
 *  - Color = tono real de ese día, en proporción (neg/neu/pos apilado) — si
 *    el día no tiene clasificación, la columna queda hueca (solo contorno),
 *    nunca se inventa un tono para "completar" la escena.
 *  - Costura = una línea fina que conecta el balance pos/neg día a día, con
 *    huecos reales donde no hay clasificación (nunca la inventa cruzando un
 *    día sin dato).
 *  - Inundación = un resplandor suave en el día pico (mayor volumen de la
 *    ventana), coloreado según el tono dominante de ese día.
 *  - Cielo inclinado de fondo = <ToneTide> con el tono acumulado de la propia
 *    entidad, mismo componente que usa la landing con el catálogo entero.
 *
 *  Siempre queda un texto real al lado (fecha + número) — regla de
 *  honestidad #6: el dato crudo nunca depende solo de la escena. */

import { useMemo } from "react";
import { ToneTide } from "@/components/tone-tide";
import { computeEntityDotField, type DiaConTono } from "@/lib/entity-dots";
import { fechaCorta } from "@/lib/explorables";
import { toneColor } from "@/lib/tone-color";

const W = 680;
const H = 190;
const SEAM_BAND = 34; // franja superior reservada para la costura
const BASE = 8; // margen inferior

export function EntityDotField({
  byDay,
  ventanaDias = 14,
}: {
  byDay: DiaConTono[];
  ventanaDias?: number;
}) {
  const field = useMemo(() => computeEntityDotField(byDay, ventanaDias), [byDay, ventanaDias]);
  const { dots, peak, tide, maxMentions } = field;

  if (!dots.length) {
    return <p className="text-xs text-muted">Todavía no hay historial de días para mostrar.</p>;
  }

  const n = dots.length;
  const colW = W / n;
  const chartH = H - SEAM_BAND - BASE;

  const bars = dots.map((d, i) => {
    const x = i * colW + colW * 0.14;
    const w = colW * 0.72;
    const h = Math.max(3, (d.mentions / maxMentions) * chartH);
    const yTop = H - BASE - h;
    const esPico = peak && d.day === peak.day;

    if (!d.clasificado) {
      // hueco: solo contorno, "manto gris chato" — nunca inventamos color.
      return (
        <rect
          key={d.day}
          x={x}
          y={yTop}
          width={w}
          height={h}
          rx={1.5}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1.25}
        />
      );
    }

    // apilado neg (abajo) → neu → pos (arriba), proporción real de ese día.
    const negH = h * d.negShare;
    const neuH = h * d.neuShare;
    const posH = h * d.posShare;
    return (
      <g key={d.day}>
        {esPico && (
          <circle
            cx={x + w / 2}
            cy={yTop}
            r={colW * 1.6}
            fill={toneColor(d.tono.dominante)}
            opacity={0.16}
          />
        )}
        <rect x={x} y={yTop} width={w} height={negH} fill="var(--crisis)" opacity={0.85} />
        <rect
          x={x}
          y={yTop + negH}
          width={w}
          height={neuH}
          fill="var(--muted)"
          opacity={0.35}
        />
        <rect
          x={x}
          y={yTop + negH + neuH}
          width={w}
          height={posH}
          fill="var(--up)"
          opacity={0.85}
        />
      </g>
    );
  });

  // costura: balance pos/neg por día, solo entre días clasificados
  // consecutivos — se corta (no se inventa) donde falta clasificación.
  const seamMidY = SEAM_BAND * 0.62;
  const seamAmp = SEAM_BAND * 0.42;
  const runs: string[] = [];
  let current: string[] = [];
  dots.forEach((d, i) => {
    if (!d.clasificado) {
      if (current.length > 1) runs.push(current.join(" "));
      current = [];
      return;
    }
    const cx = i * colW + colW / 2;
    const lean = d.posShare - d.negShare; // -1..1
    const cy = seamMidY - lean * seamAmp;
    current.push(`${current.length ? "L" : "M"} ${cx} ${cy}`);
  });
  if (current.length > 1) runs.push(current.join(" "));

  return (
    <div className="relative">
      <ToneTide tide={tide} maxOpacity={0.14} className="-z-10 rounded-xl" />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
        <line
          x1={0}
          y1={H - BASE}
          x2={W}
          y2={H - BASE}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {bars}
        {runs.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--ink)" strokeOpacity={0.3} strokeWidth={1.5} />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          {fechaCorta(dots[0].day)} – {fechaCorta(dots[n - 1].day)}
        </span>
        {peak && (
          <span>
            pico: <span className="font-medium text-ink">{peak.mentions}</span> el{" "}
            {fechaCorta(peak.day)}
          </span>
        )}
      </div>
    </div>
  );
}
