"use client";

/** Terreno wireframe interactivo: una malla que ondula sola (nunca se queda
 *  quieta) y cuyo relieve real está anclado a datos reales — la altura de
 *  cada columna sigue las menciones acumuladas de un canal (share_of_voice
 *  de todo el catálogo). Se arrastra con el mouse para rotar (OrbitControls).
 *
 *  Reemplaza al primer intento (barras rígidas 3D) que salió con la cámara
 *  mal encuadrada — acá el tamaño real del contenedor se mide con
 *  ResizeObserver (no solo "resize" de window) y se re-mide un frame después
 *  del mount, así nunca queda con un aspect ratio roto por un layout que
 *  todavía no había asentado. */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CanalBarra = { label: string; mentions: number };

type Props = {
  canales: CanalBarra[];
  className?: string;
};

const COLD = new THREE.Color("#1e2a3a"); // valle: casi sin menciones
const HOT = new THREE.Color("#fbbf24"); // pico: canal más nombrado

const SEG_PER_CHANNEL = 5;
const DEPTH_SEGMENTS = 22;
const PLANE_DEPTH = 7;

export function ChannelPulse3D({ canales, className }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<CanalBarra[]>(canales);
  dataRef.current = canales;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 6.5, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minPolarAngle = Math.PI / 5;
    controls.maxPolarAngle = Math.PI / 2.3;
    controls.target.set(0, 0.3, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.PointLight(0xffedd5, 1, 30);
    key.position.set(4, 7, 5);
    scene.add(key);

    // --- geometría: se reconstruye si cambia la cantidad de canales ---
    let planeWidth = 12;
    let widthSegments = SEG_PER_CHANNEL * 4;
    let geometry: THREE.PlaneGeometry | null = null;
    let mesh: THREE.Mesh | null = null;
    let wireMesh: THREE.LineSegments | null = null;

    function alturaCanal(u: number, heights: number[]): number {
      // u en [0, n-1]: interpola suave entre el canal i y el i+1.
      const n = heights.length;
      if (n === 0) return 0;
      if (n === 1) return heights[0];
      const i = Math.max(0, Math.min(n - 2, Math.floor(u)));
      const frac = u - i;
      const smooth = frac * frac * (3 - 2 * frac); // smoothstep
      return heights[i] + (heights[i + 1] - heights[i]) * smooth;
    }

    function buildGeometry() {
      const data = dataRef.current;
      const n = Math.max(2, data.length);
      widthSegments = SEG_PER_CHANNEL * (n - 1);
      planeWidth = Math.max(8, (n - 1) * 1.3);

      if (mesh) scene.remove(mesh);
      if (wireMesh) scene.remove(wireMesh);
      geometry?.dispose();

      geometry = new THREE.PlaneGeometry(planeWidth, PLANE_DEPTH, widthSegments, DEPTH_SEGMENTS);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      });
      mesh = new THREE.Mesh(geometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);

      const wireGeo = new THREE.WireframeGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({ color: 0xb45309, transparent: true, opacity: 0.65 });
      wireMesh = new THREE.LineSegments(wireGeo, wireMat);
      wireMesh.rotation.x = -Math.PI / 2;
      scene.add(wireMesh);
    }
    buildGeometry();

    let wireframeFrame = 0;
    function updateVertices(t: number) {
      if (!geometry) return;
      const data = dataRef.current;
      const max = Math.max(1, ...data.map((c) => c.mentions));
      const heights = data.map((c) => 0.25 + (c.mentions / max) * 2.6);
      const n = Math.max(2, data.length);

      const pos = geometry.attributes.position as THREE.BufferAttribute;
      const col = geometry.attributes.color as THREE.BufferAttribute;
      const cols = widthSegments + 1;
      const rows = DEPTH_SEGMENTS + 1;

      for (let idx = 0; idx < pos.count; idx++) {
        const colI = idx % cols;
        const rowI = Math.floor(idx / cols);
        const u = (colI / widthSegments) * (n - 1);
        const v = rowI / DEPTH_SEGMENTS; // 0..1 a lo largo de la profundidad

        const base = alturaCanal(u, heights);
        const norm = base / 2.85;

        // ondas vivas: viajan en profundidad y a lo largo del tiempo, más
        // marcadas donde hay más actividad real — nunca queda quieto.
        const wave =
          Math.sin(u * 1.1 + t * 0.9) * 0.14 +
          Math.sin(v * 6 - t * 1.3) * 0.1 +
          Math.sin((u + v * 3) * 0.7 + t * 0.5) * 0.08;

        const z = base + wave * (0.35 + norm * 0.65);
        pos.setZ(idx, z);

        const heat = Math.max(0, Math.min(1, z / 2.85));
        const c = COLD.clone().lerp(HOT, heat);
        col.setXYZ(idx, c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      geometry.computeVertexNormals();
      // Regenerar el wireframe es la parte cara (recorre todas las aristas):
      // alcanza con refrescarlo cada pocos frames, la malla sólida de abajo
      // ya se mueve a 60fps y disimula el lag de las líneas.
      wireframeFrame++;
      if (wireMesh && wireframeFrame % 3 === 0) {
        wireMesh.geometry.dispose();
        wireMesh.geometry = new THREE.WireframeGeometry(geometry);
      }
    }

    // --- tamaño real del contenedor: ResizeObserver, no solo window.resize ---
    function applySize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    }
    // Un frame después del mount: garantiza que el layout final (flex/grid) ya asentó.
    requestAnimationFrame(applySize);
    const ro = new ResizeObserver(() => applySize());
    ro.observe(mount);

    let raf = 0;
    let lastRebuild = dataRef.current.length;
    function tick() {
      raf = requestAnimationFrame(tick);
      const t = performance.now() / 1000;
      if (dataRef.current.length !== lastRebuild) {
        lastRebuild = dataRef.current.length;
        buildGeometry();
      }
      updateVertices(t);
      controls.update();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      geometry?.dispose();
      wireMesh?.geometry.dispose();
      (mesh?.material as THREE.Material | undefined)?.dispose();
      (wireMesh?.material as THREE.Material | undefined)?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative h-[300px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#0b0f14] sm:h-[360px] ${className ?? ""}`}
    >
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">
        Arrastrá para rotar · el relieve son las menciones reales por canal, todo el catálogo
      </p>
    </div>
  );
}
