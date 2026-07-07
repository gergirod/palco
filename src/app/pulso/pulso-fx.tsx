"use client";

/** Efectos "wow" de /pulso: todo client-side, sobre datos que ya tenemos en
 *  memoria (el poll anterior vs el poll nuevo). Cero cambios de pipeline.
 *
 *  - useLiveDeltas: cuando un poll trae un cambio real de valor o de posición
 *    respecto al poll anterior, genera una insignia +N/-N/▲/▼ que aparece y
 *    se desvanece sola (no una comparación día-contra-día, sino poll-contra-poll).
 *  - useFlipRows: reordenamiento animado (técnica FLIP) — las filas se deslizan
 *    a su nueva posición en vez de aparecer ya reordenadas.
 *  - AnimatedNumber: los números cuentan hasta el valor nuevo en vez de saltar.
 *  - PulsoHeartbeat: línea tipo electrocardiograma que "late" más rápido cuanto
 *    más actividad hay — decorativo, no es una métrica científica.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const FLASH_MS = 3600;

export type LiveDelta = { valueDelta: number; rankDelta: number };

/** Compara el ranking actual contra el del poll anterior (mismo hook, misma
 *  lista) y devuelve un mapa key → delta que se auto-limpia a los FLASH_MS. */
export function useLiveDeltas<T>(
  rows: T[],
  getKey: (r: T) => string,
  getValue: (r: T) => number
): Map<string, LiveDelta> {
  const prevRef = useRef<Map<string, { value: number; rank: number }> | null>(null);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [flashes, setFlashes] = useState<Map<string, LiveDelta>>(new Map());

  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map<string, { value: number; rank: number }>();
    rows.forEach((r, i) => next.set(getKey(r), { value: getValue(r), rank: i }));

    if (prev) {
      const updates: Array<[string, LiveDelta]> = [];
      next.forEach((cur, key) => {
        const p = prev.get(key);
        if (!p) return; // fila nueva: sin insignia, no sabemos de qué venía
        const valueDelta = cur.value - p.value;
        const rankDelta = p.rank - cur.rank; // positivo = subió de posición
        if (valueDelta !== 0 || rankDelta !== 0) updates.push([key, { valueDelta, rankDelta }]);
      });
      if (updates.length) {
        setFlashes((old) => {
          const m = new Map(old);
          updates.forEach(([k, v]) => m.set(k, v));
          return m;
        });
        updates.forEach(([key]) => {
          const existing = timeoutsRef.current.get(key);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            setFlashes((old) => {
              const m = new Map(old);
              m.delete(key);
              return m;
            });
            timeoutsRef.current.delete(key);
          }, FLASH_MS);
          timeoutsRef.current.set(key, t);
        });
      }
    }
    prevRef.current = next;
    // getKey/getValue son funciones puras pasadas inline por el caller: si las
    // sumamos a las deps, su identidad cambia en cada render y dispara el efecto
    // de más (falsos "cambios"). Solo nos importa cuándo cambian los datos (`rows`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  return flashes;
}

/** Devuelve un ref-callback por key: engancharlo al nodo raíz de cada fila.
 *  Mientras las keys sean estables (React reordena en vez de recrear), el FLIP
 *  detecta el salto de posición entre renders y lo anima. */
export function useFlipRows() {
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const posRef = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const newPos = new Map<string, number>();
    nodesRef.current.forEach((el, key) => newPos.set(key, el.getBoundingClientRect().top));

    nodesRef.current.forEach((el, key) => {
      const prev = posRef.current.get(key);
      const next = newPos.get(key);
      if (prev == null || next == null) return;
      const delta = prev - next;
      if (!delta) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      el.getBoundingClientRect(); // fuerza reflow antes de animar a 0
      requestAnimationFrame(() => {
        el.style.transition = "transform 420ms cubic-bezier(0.16, 1, 0.3, 1)";
        el.style.transform = "";
      });
    });

    posRef.current = newPos;
  });

  return (key: string) => (el: HTMLElement | null) => {
    if (el) nodesRef.current.set(key, el);
    else nodesRef.current.delete(key);
  };
}

/** Número que cuenta hasta el valor nuevo (ease-out, ~700ms) en vez de saltar. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 700;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span className={className}>{display.toLocaleString("es-AR")}</span>;
}

/** Insignia +N / ▲N / ▼N que aparece y se desvanece sola. */
export function LiveDeltaBadge({ delta }: { delta: LiveDelta | undefined }) {
  if (!delta) return null;
  const { valueDelta, rankDelta } = delta;
  const subio = rankDelta > 0;
  const bajo = rankDelta < 0;
  const color = subio ? "text-up" : bajo ? "text-crisis" : valueDelta > 0 ? "text-up" : "text-crisis";
  const label = subio
    ? `▲${rankDelta}`
    : bajo
      ? `▼${Math.abs(rankDelta)}`
      : `${valueDelta > 0 ? "+" : ""}${valueDelta}`;
  return <span className={`pulso-flash ml-1.5 font-semibold ${color}`}>{label}</span>;
}

/** Línea tipo ECG que late más rápido cuanto más actividad — decorativo,
 *  ligado al nombre "Pulso". `intensidad` en [0,1]. */
export function PulsoHeartbeat({ intensidad, className }: { intensidad: number; className?: string }) {
  const clamped = Math.max(0, Math.min(1, intensidad));
  const duration = (2.6 - clamped * 1.4).toFixed(2); // 2.6s calmo → 1.2s intenso
  return (
    <div
      className={`pulso-ecg ${className ?? ""}`}
      style={{ ["--pulso-ecg-duration" as string]: `${duration}s` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="pulso-ecg-svg">
        <path
          className="pulso-ecg-path"
          d="M0 20 L40 20 L48 8 L56 32 L64 20 L110 20 L118 6 L126 34 L134 20 L300 20
             M300 20 L340 20 L348 8 L356 32 L364 20 L410 20 L418 6 L426 34 L434 20 L600 20"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
