"use client";

/** PulsoDotField — la cámara de Pulso sobre el mismo campo de dots
 *  (SPEC-dataviz-3d-wow.md, sección Pulso).
 *
 *  El spec original imaginaba agrupar por franja horaria reusando
 *  ChannelPulse3D — pero el dato real de Palco no tiene granularidad horaria
 *  (`by_day` es diario, `ChannelPulse3D`/`EntityConstellation` están escritos
 *  pero no están conectados a ninguna pantalla hoy). En vez de inventar una
 *  franja horaria que no existe, esta pieza aplica el mismo lenguaje —
 *  relieve = volumen real, color = tono real, inundación = un salto real —
 *  agrupado por nombre, que es el eje que "Hoy" ya tiene con datos genuinos.
 *
 *  - Relieve = menciones de hoy de cada nombre (mismo ranking que la lista
 *    de al lado, mismo orden — la escena y el texto cuentan la misma historia).
 *  - Color = tono real de hoy, apilado (neg/neu/pos) — hueco si ese nombre
 *    todavía no tiene clasificación.
 *  - Inundación = un resplandor en los nombres que tuvieron un salto real en
 *    el último poll (mismo criterio que ya dispara `useLiveDeltas` en
 *    pulso-fx.tsx) — coloreado por el tono real de ese nombre, nunca por si
 *    el salto fue positivo o negativo (el significado de verde/rojo es
 *    siempre tono, no "subió/bajó" — regla de coherencia del spec). */

import { useMemo } from "react";
import { toneColor } from "@/lib/tone-color";
import type { TonoResumen } from "@/lib/pulso";

export type PulsoDotRow = {
  slug: string;
  entity: string;
  mentions: number;
  tono: TonoResumen;
};

const W = 640;
const H = 96;
const BASE = 6;

export function PulsoDotField({
  rows,
  flashSlugs,
}: {
  rows: PulsoDotRow[];
  /** slugs con un salto real detectado en el último poll (useLiveDeltas) */
  flashSlugs: Set<string>;
}) {
  const maxMentions = useMemo(() => Math.max(1, ...rows.map((r) => r.mentions)), [rows]);

  if (!rows.length) return null;

  const n = rows.length;
  const colW = W / n;
  const chartH = H - BASE;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} aria-hidden="true">
      <line x1={0} y1={H - BASE} x2={W} y2={H - BASE} stroke="var(--line)" strokeWidth={1} />
      {rows.map((r, i) => {
        const x = i * colW + colW * 0.16;
        const w = colW * 0.68;
        const h = Math.max(2, (r.mentions / maxMentions) * chartH);
        const yTop = H - BASE - h;
        const clasificado = r.tono.dominante !== null;
        const enSalto = flashSlugs.has(r.slug);

        if (!clasificado) {
          return (
            <rect
              key={r.slug}
              x={x}
              y={yTop}
              width={w}
              height={h}
              rx={1.5}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1.1}
            />
          );
        }

        const negH = h * (r.tono.negPct / 100);
        const neuH = h * (r.tono.neuPct / 100);
        const posH = h * (r.tono.posPct / 100);

        return (
          <g key={r.slug}>
            {enSalto && (
              <circle
                cx={x + w / 2}
                cy={yTop}
                r={colW * 1.3}
                fill={toneColor(r.tono.dominante)}
                opacity={0.2}
              />
            )}
            <rect x={x} y={yTop} width={w} height={negH} fill="var(--crisis)" opacity={0.85} />
            <rect x={x} y={yTop + negH} width={w} height={neuH} fill="var(--muted)" opacity={0.35} />
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
      })}
    </svg>
  );
}
