"use client";

/** Ecualizador 3D del catálogo: una barra por canal, altura = menciones reales
 *  acumuladas en ese canal (share_of_voice de todas las entidades del índice
 *  público). No es decoración con números al voleo — cada barra es un dato
 *  real que ya vive en palco_entities.json, solo que nunca lo mostramos así.
 *
 *  Three.js crudo (no react-force-graph-3d: acá no hay grafo, es geometría
 *  simple) — mismo patrón de carga que EntityConstellation: dynamic import
 *  con ssr:false lo hace quien nos importa, este archivo asume WebGL presente. */

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type CanalBarra = { label: string; mentions: number };

type Props = {
  canales: CanalBarra[];
  className?: string;
};

const BRAND = 0xb45309;
const BRAND_BRIGHT = 0xfbbf24;

export function ChannelPulse3D({ canales, className }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Guardamos los valores actuales en un ref para que el loop de animación
  // (que vive fuera de React) siempre lea el último dato sin recrear la escena.
  const dataRef = useRef<CanalBarra[]>(canales);
  dataRef.current = canales;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 5.5, 11);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.PointLight(0xffedd5, 1.2, 30);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.PointLight(BRAND_BRIGHT, 0.8, 30);
    rim.position.set(-6, 3, -4);
    scene.add(rim);

    const n = Math.max(1, dataRef.current.length);
    const spacing = 1.05;
    const startX = -((n - 1) * spacing) / 2;

    const bars: THREE.Mesh[] = [];
    const targetHeights: number[] = new Array(n).fill(0.05);
    const currentHeights: number[] = new Array(n).fill(0.05);

    for (let i = 0; i < n; i++) {
      const geo = new THREE.BoxGeometry(0.62, 1, 0.62);
      const mat = new THREE.MeshStandardMaterial({
        color: BRAND,
        emissive: BRAND,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(startX + i * spacing, 0.025, 0);
      scene.add(mesh);
      bars.push(mesh);
    }

    // Piso sutil para que las barras no floten en el vacío.
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    scene.add(floor);

    function recomputeTargets() {
      const data = dataRef.current;
      const max = Math.max(1, ...data.map((c) => c.mentions));
      for (let i = 0; i < bars.length; i++) {
        const val = data[i]?.mentions ?? 0;
        targetHeights[i] = 0.15 + (val / max) * 3.4;
      }
    }
    recomputeTargets();

    let raf = 0;
    let t = 0;
    let lastRecompute = 0;
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      t += 0.008;

      // Reconsulta el dato real cada ~2s por si el poll de 45s trajo números nuevos.
      if (now - lastRecompute > 2000) {
        recomputeTargets();
        lastRecompute = now;
      }

      for (let i = 0; i < bars.length; i++) {
        currentHeights[i] += (targetHeights[i] - currentHeights[i]) * 0.08;
        const h = Math.max(0.05, currentHeights[i] + Math.sin(t * 2 + i) * 0.03);
        bars[i].scale.y = h;
        bars[i].position.y = h / 2;
        const mat = bars[i].material as THREE.MeshStandardMaterial;
        const heat = Math.min(1, currentHeights[i] / 3.4);
        mat.emissiveIntensity = 0.2 + heat * 0.6;
        mat.color.setHex(heat > 0.55 ? BRAND_BRIGHT : BRAND);
        mat.emissive.setHex(heat > 0.55 ? BRAND_BRIGHT : BRAND);
      }

      camera.position.x = Math.sin(t * 0.15) * 2.2;
      camera.lookAt(0, 1.4, 0);

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    function onResize() {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      bars.forEach((b) => {
        b.geometry.dispose();
        (b.material as THREE.Material).dispose();
      });
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // Solo recreamos la escena si cambia la cantidad de canales (n); los valores
    // se leen del ref en cada frame, así que no hace falta re-montar por poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canales.length]);

  return (
    <div
      ref={mountRef}
      className={`relative h-[260px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#0b0f14] sm:h-[300px] ${className ?? ""}`}
    />
  );
}
