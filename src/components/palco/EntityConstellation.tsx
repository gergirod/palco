"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";

// react-force-graph-3d toca WebGL/window: sin esto el SSR de Next rompe el build.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export type ConstelacionNodo = {
  slug: string;
  nombre: string;
  mentions: number;
  /** true = está en tu watchlist; false = lo agregamos como rival/comparación. */
  propio: boolean;
};
export type ConstelacionEdge = {
  source: string;
  target: string;
  cruces: number;
};

type Props = {
  nodos: ConstelacionNodo[];
  edges: ConstelacionEdge[];
  onSelect?: (slug: string) => void;
  activeSlug?: string;
};

const BRAND = "#b45309"; // --signal, hardcoded: three.js no lee custom properties CSS
const RIVAL = "#64748b"; // slate-500

/** Radio del nodo: piso legible + escala suave por volumen de menciones, para que
 *  el nombre más hablado no tape literalmente al resto en pantallas chicas. */
function nodeVal(mentions: number): number {
  return 3 + Math.sqrt(Math.max(mentions, 0)) * 0.6;
}

export function EntityConstellation({ nodos, edges, onSelect, activeSlug }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  const graphData = useMemo(() => {
    const ids = new Set(nodos.map((n) => n.slug));
    return {
      nodes: nodos.map((n) => ({
        id: n.slug,
        nombre: n.nombre,
        mentions: n.mentions,
        propio: n.propio,
        val: nodeVal(n.mentions),
      })),
      // 3d-force-graph putea si un link apunta a un nodo que no está en la lista
      // (p. ej. cruce con una entidad fuera de tu watchlist+rivales) — se filtra.
      links: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({ source: e.source, target: e.target, cruces: e.cruces })),
    };
  }, [nodos, edges]);

  if (nodos.length < 2) return null;

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#0b0f14] sm:h-[420px]">
      <ForceGraph3D
        ref={fgRef as any}
        graphData={graphData}
        backgroundColor="#0b0f14"
        showNavInfo={false}
        nodeRelSize={1}
        nodeLabel={(n: any) => `${n.nombre} · ${n.mentions} menc.`}
        nodeColor={(n: any) => (n.id === activeSlug ? "#fbbf24" : n.propio ? BRAND : RIVAL)}
        nodeOpacity={0.95}
        linkWidth={(l: any) => Math.min(4, 0.4 + Math.log2(1 + (l.cruces || 1)))}
        linkColor={() => "rgba(180,83,9,0.35)"}
        linkDirectionalParticles={(l: any) => (l.cruces > 3 ? 2 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleColor={() => BRAND}
        linkDirectionalParticleSpeed={0.004}
        cooldownTime={4000}
        onNodeClick={(n: any) => onSelect?.(n.id)}
        enableNodeDrag={false}
        onEngineStop={() => fgRef.current?.zoomToFit(600, 40)}
      />
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">
        Arrastrá para rotar · cada línea es una vez que se nombraron juntos al aire
      </p>
    </div>
  );
}
