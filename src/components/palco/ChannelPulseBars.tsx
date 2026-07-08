"use client";

/** Reemplaza el ECG decorativo por un ecualizador real: una barra por canal,
 *  altura = menciones reales acumuladas en ese canal (share_of_voice de todo
 *  el catálogo). Va en el mismo lugar donde antes vivía PulsoHeartbeat —
 *  franja delgada, no una escena aparte.
 *
 *  CSS puro (nada de WebGL): la altura se anima con transition al llegar
 *  datos nuevos del poll, más un idle sutil vía keyframes para que nunca se
 *  vea estático entre polls. Cero riesgo de aspect-ratio raro o perspectiva
 *  rota — es lo que se ve, siempre. */

export type CanalBarra = { label: string; mentions: number };

const MAX_BARS = 18;

export function ChannelPulseBars({
  canales,
  className,
}: {
  canales: CanalBarra[];
  className?: string;
}) {
  const bars = canales.slice(0, MAX_BARS);
  const max = Math.max(1, ...bars.map((c) => c.mentions));

  return (
    <div
      className={`pulso-bars ${className ?? ""}`}
      role="img"
      aria-label="Reparto de menciones por canal, catálogo completo"
    >
      {bars.map((c, i) => {
        const pct = Math.max(8, Math.round((c.mentions / max) * 100));
        return (
          <span
            key={c.label}
            className="pulso-bars-bar"
            style={{ height: `${pct}%`, animationDelay: `${i * 110}ms` }}
            title={`${c.label} · ${c.mentions} menc.`}
          />
        );
      })}
    </div>
  );
}
