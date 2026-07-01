"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import data from "@/data/palco_entities.json";
import catalogData from "@/data/palco_catalog.json";
import { displayAlias, matchesQuery } from "@/lib/palco-watchlist";

/* ============================================================================
   Palco · Onboarding
   Flujo real (mockeado) estilo Streem: bienvenida → plan → elegir a quién seguir
   → confirmar → tablero. Corpus real: las entidades y sus números salen del
   dataset capturado. Light mode + design system de /palco.
   Path inicial: /palco/onboarding
============================================================================ */

const BRAND = "#b45309";

type IndexRow = {
  slug: string;
  name: string;
  type: string;
  mentions: number;
  chat: number;
  channels: number;
  neg: number;
  neu: number;
  pos: number;
};
const INDEX = (data as unknown as { index: IndexRow[] }).index;

type CatalogCurated = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
  in_palco_entities?: boolean;
};
type CatalogCandidate = {
  canonical_guess: string;
  forms: string[];
  kind: string;
  mentions: number;
  programs: number;
  status: string;
  confidence?: "alta" | "media" | "baja";
  filter_reason?: string;
};
type ComencionPar = {
  par: [string, string];
  nombres: [string, string];
  cruces_total: number;
};
const CATALOG = catalogData as unknown as {
  curated: CatalogCurated[];
  candidates: CatalogCandidate[];
};
const COMENCIONES =
  ((data as unknown as { comenciones?: ComencionPar[] }).comenciones) ?? [];
const CATALOG_BY_SLUG = new Map(CATALOG.curated.map((c) => [c.slug, c]));

/* ---------- planes (modelo self-serve tipo Podscan: precio transparente,
   se paga por cuántos nombres/temas seguís. Cada nombre = una persona, marca
   o tema con sus variantes. Escalás sumando nombres → subís de plan). ---------- */
type Plan = {
  id: "esencial" | "profesional" | "enterprise";
  nombre: string;
  para: string;
  limite: number;
  precio: string;
  bajada: string;
  incluye: string[];
  destacado?: boolean;
  aMedida?: boolean;
};
const PLANES: Plan[] = [
  {
    id: "esencial",
    nombre: "Individual",
    para: "Un nombre",
    limite: 1,
    precio: "USD 90/mes",
    bajada: "Seguí un nombre o tema y no te pierdas nada de lo que se dice.",
    incluye: [
      "1 nombre o tema",
      "Tablero actualizado cada día",
      "Resumen diario por mail",
      "Avisos de crisis apenas los detectamos",
    ],
  },
  {
    id: "profesional",
    nombre: "Pro",
    para: "Hasta 3 nombres",
    limite: 3,
    precio: "USD 250/mes",
    bajada: "Seguí tu principal, un rival y un tema — todo junto.",
    incluye: [
      "Hasta 3 nombres o temas",
      "Avisos de crisis apenas los detectamos",
      "Resumen diario por mail",
      "Reporte semanal curado, listo para presentar",
    ],
    destacado: true,
  },
  {
    id: "enterprise",
    nombre: "A medida",
    para: "Sin límite",
    limite: 999,
    precio: "Hablemos",
    aMedida: true,
    bajada: "Todos los nombres que necesites, con reportes a tu marca y API.",
    incluye: [
      "Nombres o temas ilimitados",
      "Reporte semanal curado",
      "Reportes con tu marca + API",
      "Soporte dedicado",
    ],
  },
];

/* ---------- helpers ---------- */
function compact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k";
  return String(n);
}
const CATS = ["Todas", "Político", "Deporte", "Música"] as const;

/* ---------- UI: barra de sentimiento mini ---------- */
function MiniSent({ r }: { r: IndexRow }) {
  const t = r.neg + r.neu + r.pos || 1;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className="bg-red-500" style={{ width: `${(r.neg / t) * 100}%` }} />
      <div className="bg-slate-400" style={{ width: `${(r.neu / t) * 100}%` }} />
      <div className="bg-emerald-500" style={{ width: `${(r.pos / t) * 100}%` }} />
    </div>
  );
}

/* ---------- gobernanza de avisos (mapea a DEFAULT_REGLAS del pipeline,
   pero en palabras humanas: el usuario decide CUÁNDO y CÓMO le avisamos,
   sin tocar umbrales técnicos). ---------- */
type Sensibilidad = "menos" | "equilibrado" | "mas";
type Frecuencia = "al-toque" | "diario" | "semanal";
const SENSIBILIDADES: {
  id: Sensibilidad;
  titulo: string;
  bajada: string;
  reco?: boolean;
}[] = [
  {
    id: "menos",
    titulo: "Menos avisos",
    bajada: "Solo cuando algo se prende fuego de verdad: mucha audiencia y chat disparado.",
  },
  {
    id: "equilibrado",
    titulo: "Equilibrado",
    bajada: "El punto justo. Te avisamos los picos que importan, sin ruido.",
    reco: true,
  },
  {
    id: "mas",
    titulo: "Más avisos",
    bajada: "Enterate de casi todo lo que se mueva, aunque a veces sea menor.",
  },
];
const FRECUENCIAS: { id: Frecuencia; titulo: string; bajada: string }[] = [
  {
    id: "al-toque",
    titulo: "Ni bien aparece",
    bajada: "En cuanto procesamos el programa donde te nombraron.",
  },
  { id: "diario", titulo: "Resumen diario", bajada: "Un mail cada tarde con lo del día." },
  { id: "semanal", titulo: "Resumen semanal", bajada: "Un reporte curado, listo para presentar." },
];

/* ---------- pasos ---------- */
type Paso = "bienvenida" | "plan" | "entidades" | "alias" | "avisos" | "listo";
const PASOS: { id: Paso; label: string }[] = [
  { id: "bienvenida", label: "Bienvenida" },
  { id: "plan", label: "Plan" },
  { id: "entidades", label: "A quién seguir" },
  { id: "alias", label: "Cómo lo dicen" },
  { id: "avisos", label: "Avisos" },
  { id: "listo", label: "Listo" },
];
const PASOS_EDIT: { id: Paso; label: string }[] = [
  { id: "entidades", label: "A quién seguir" },
  { id: "alias", label: "Cómo lo dicen" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isEdit, setIsEdit] = useState(false);
  const [paso, setPaso] = useState<Paso>("bienvenida");
  const [planId, setPlanId] = useState<Plan["id"]>("profesional");
  const [sel, setSel] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("Todas");
  // gobernanza de avisos (defaults sanos: equilibrado + todo + diario)
  const [sensibilidad, setSensibilidad] = useState<Sensibilidad>("equilibrado");
  const [soloNegativo, setSoloNegativo] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("diario");
  const [email, setEmail] = useState("");
  // alias editables por entidad (mock local; en producción → palco_watchlist.yaml)
  const [aliasCfg, setAliasCfg] = useState<Record<string, string[]>>({});
  const [aliasDraft, setAliasDraft] = useState<Record<string, string>>({});

  const plan = PLANES.find((p) => p.id === planId)!;
  const pasosUi = isEdit ? PASOS_EDIT : PASOS;
  const pasoIdx = pasosUi.findIndex((p) => p.id === paso);

  // Modo edición desde el tablero (?edit=1): sin bienvenida ni plan, con watchlist actual.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("edit") !== "1") return;
    setIsEdit(true);
    const slugs = (p.get("e") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => INDEX.some((r) => r.slug === s));
    if (slugs.length) setSel(slugs);
    const pl = p.get("plan");
    if (pl === "esencial" || pl === "profesional" || pl === "enterprise") setPlanId(pl);
    const s = p.get("sens");
    if (s === "menos" || s === "equilibrado" || s === "mas") setSensibilidad(s);
    if (p.get("neg") === "1") setSoloNegativo(true);
    const f = p.get("freq");
    if (f === "al-toque" || f === "diario" || f === "semanal") setFrecuencia(f);
    if (p.get("mail")) setEmail(p.get("mail")!);
    setPaso("entidades");
  }, []);

  function volverAlTablero() {
    const p = new URLSearchParams(window.location.search);
    p.delete("edit");
    const q = p.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  }

  // Pre-carga alias del catálogo al entrar al paso "Cómo lo dicen".
  useEffect(() => {
    if (paso !== "alias" || sel.length === 0) return;
    setAliasCfg((prev) => {
      const next = { ...prev };
      for (const slug of sel) {
        if (next[slug]) continue;
        const cur = CATALOG_BY_SLUG.get(slug);
        next[slug] = cur?.alias?.length ? [...cur.alias] : [];
      }
      return next;
    });
  }, [paso, sel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INDEX.filter((r) => {
      if (cat !== "Todas" && r.type !== cat) return false;
      const catRow = CATALOG_BY_SLUG.get(r.slug);
      return matchesQuery(q, r.name, catRow?.alias ?? []);
    }).sort((a, b) => b.mentions - a.mentions);
  }, [query, cat]);

  const candidateHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CATALOG.candidates
      .filter(
        (c) =>
          (c.confidence === "alta" || c.confidence === "media") &&
          (c.canonical_guess.toLowerCase().includes(q) ||
            c.forms.some((f) => f.toLowerCase().includes(q)))
      )
      .slice(0, 6);
  }, [query]);

  const comencionesSel = useMemo(() => {
    if (sel.length < 2) return [];
    const set = new Set(sel);
    return COMENCIONES.filter((p) => set.has(p.par[0]) && set.has(p.par[1]))
      .sort((a, b) => b.cruces_total - a.cruces_total)
      .slice(0, 4);
  }, [sel]);

  function toggle(slug: string) {
    setSel((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= plan.limite) return cur; // tope del plan elegido
      return [...cur, slug];
    });
  }
  const lleno = sel.length >= plan.limite;

  function addAlias(slug: string) {
    const raw = (aliasDraft[slug] || "").trim().toLowerCase();
    if (raw.length < 2) return;
    const nombre = INDEX.find((r) => r.slug === slug)?.name.toLowerCase() ?? "";
    if (raw === nombre) return;
    setAliasCfg((cur) => {
      const list = cur[slug] ?? [];
      if (list.some((a) => a.toLowerCase() === raw)) return cur;
      return { ...cur, [slug]: [...list, raw] };
    });
    setAliasDraft((d) => ({ ...d, [slug]: "" }));
  }

  function removeAlias(slug: string, alias: string) {
    setAliasCfg((cur) => ({
      ...cur,
      [slug]: (cur[slug] ?? []).filter((a) => a !== alias),
    }));
  }

  function entrar() {
    const e = sel.join(",");
    const q = new URLSearchParams({
      e,
      plan: planId,
      sens: sensibilidad,
      neg: soloNegativo ? "1" : "0",
      freq: frecuencia,
      mail: email.trim(),
    });
    router.push(`/dashboard?${q.toString()}`);
  }

  const selRows = sel
    .map((s) => INDEX.find((r) => r.slug === s))
    .filter(Boolean) as IndexRow[];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* barra superior */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {isEdit ? (
              <>
                <span className="text-[13px] font-medium text-slate-600">Editar watchlist</span>
                <button
                  type="button"
                  onClick={volverAlTablero}
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-800"
                >
                  ← Volver al tablero
                </button>
              </>
            ) : (
              <span
                className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.2em]"
                style={{ color: BRAND }}
              >
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: BRAND }}
                />
                PALCO
              </span>
            )}
          </div>
          {/* progreso */}
          <div className="flex items-center gap-2">
            {pasosUi.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    i <= pasoIdx ? "text-white" : "bg-slate-100 text-slate-400"
                  }`}
                  style={i <= pasoIdx ? { backgroundColor: BRAND } : undefined}
                >
                  {i + 1}
                </div>
                {i < pasosUi.length - 1 && (
                  <div
                    className={`hidden h-px w-6 sm:block ${
                      i < pasoIdx ? "" : "bg-slate-200"
                    }`}
                    style={i < pasoIdx ? { backgroundColor: BRAND } : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1000px] px-5 py-10">
        {/* ---------------- BIENVENIDA ---------------- */}
        {!isEdit && paso === "bienvenida" && (
          <section className="mx-auto max-w-[680px] text-center">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              Bienvenido a Palco
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight">
              Enterate de todo lo que se dice en el streaming, sin escuchar horas de vivo.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
              Palco escucha los programas en vivo de Argentina las 24 horas. Cada vez
              que nombran a alguien que te importa, lo anotamos: qué dijeron, cuánta
              gente lo estaba escuchando y cómo reaccionó la gente en el chat.
            </p>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
              {[
                {
                  t: "Vos elegís a quién seguir",
                  d: "Personas, candidatos, marcas o temas. Nosotros los buscamos en todo lo hablado.",
                },
                {
                  t: "Te avisamos cuando importa",
                  d: "Si algo se prende fuego —mala mención + mucha audiencia + chat disparado— te llega un aviso.",
                },
                {
                  t: "Listo para mostrar",
                  d: "Un tablero claro y un reporte que podés llevar a la reunión sin traducir nada.",
                },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[14px] font-semibold">{c.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{c.d}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPaso("plan")}
              className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Empezar →
            </button>
            <p className="mt-3 text-[12px] text-slate-400">
              Toma 1 minuto · sin tarjeta
            </p>
          </section>
        )}

        {/* ---------------- PLAN ---------------- */}
        {!isEdit && paso === "plan" && (
          <section>
            <div className="text-center">
              <h1 className="text-3xl font-bold">Elegí tu plan</h1>
              <p className="mt-2 text-[15px] text-slate-600">
                Pagás por <b>cuántos nombres o temas</b> querés seguir. Un nombre es
                una persona, marca o tema. Sumás más cuando quieras — sin sorpresas.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PLANES.map((p) => {
                const active = p.id === planId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlanId(p.id)}
                    className={`relative flex flex-col rounded-2xl border p-5 text-left shadow-sm transition ${
                      active
                        ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                    style={active ? { backgroundColor: "#fbebd6" } : { backgroundColor: "#fff" }}
                  >
                    {p.destacado && (
                      <span
                        className="absolute -top-2.5 left-5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-white"
                        style={{ backgroundColor: BRAND }}
                      >
                        MÁS ELEGIDO
                      </span>
                    )}
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                      {p.para}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{p.nombre}</p>
                    <p className="mt-0.5 text-[13px] font-medium" style={{ color: BRAND }}>
                      {p.aMedida
                        ? "Nombres ilimitados"
                        : p.limite === 1
                        ? "1 nombre"
                        : `Hasta ${p.limite} nombres`}{" "}
                      · {p.precio}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                      {p.bajada}
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {p.incluye.map((f) => (
                        <li key={f} className="flex gap-2 text-[13px] text-slate-700">
                          <span style={{ color: BRAND }}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div
                      className={`mt-4 rounded-lg py-2 text-center text-[13px] font-semibold ${
                        active ? "text-white" : "bg-slate-100 text-slate-600"
                      }`}
                      style={active ? { backgroundColor: BRAND } : undefined}
                    >
                      {active ? "Seleccionado" : "Elegir"}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[13px] text-slate-500">
              Un nombre es una persona, marca o tema. Sumás o sacás cuando quieras.
            </p>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setPaso("bienvenida")}
                className="text-[14px] text-slate-500 hover:text-slate-800"
              >
                ← Volver
              </button>
              <button
                onClick={() => setPaso("entidades")}
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Seguir →
              </button>
            </div>
          </section>
        )}

        {/* ---------------- ENTIDADES ---------------- */}
        {paso === "entidades" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">¿A quién querés seguir?</h1>
                <p className="mt-2 text-[15px] text-slate-600">
                  {plan.aMedida ? (
                    <>
                      Con <b>{plan.nombre}</b> elegís los nombres que quieras.
                    </>
                  ) : plan.limite === 1 ? (
                    <>
                      Con <b>{plan.nombre}</b> seguís <b>1 nombre</b>.
                    </>
                  ) : (
                    <>
                      Elegí hasta <b>{plan.limite} nombres</b> con tu plan {plan.nombre}.
                    </>
                  )}{" "}
                  Estos ya aparecen en lo capturado; en tu cuenta sumás cualquier
                  otro nombre o tema.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Elegiste
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {sel.length}
                  <span className="ml-1 text-[13px] font-medium text-slate-400">
                    {plan.aMedida ? "nombres" : `/ ${plan.limite}`}
                  </span>
                </p>
              </div>
            </div>

            {/* buscador + filtros */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o apodo…"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0]"
              />
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[13px]">
                {CATS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`rounded-md px-3 py-1.5 ${
                      cat === c ? "text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                    style={cat === c ? { backgroundColor: BRAND } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {lleno && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f0c99a] bg-[#fbebd6] px-4 py-2.5 text-[13px]">
                <span className="text-slate-700">
                  Llegaste al tope de tu plan {plan.nombre} ({plan.limite}{" "}
                  {plan.limite === 1 ? "nombre" : "nombres"}).
                </span>
                <button
                  onClick={() => setPaso("plan")}
                  className="font-semibold hover:underline"
                  style={{ color: BRAND }}
                >
                  Subir de plan →
                </button>
              </div>
            )}

            {/* grilla de entidades */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => {
                const on = sel.includes(r.slug);
                const bloq = !on && lleno;
                const catRow = CATALOG_BY_SLUG.get(r.slug);
                const aliasHint = catRow?.alias?.slice(0, 3).join(" · ");
                return (
                  <button
                    key={r.slug}
                    onClick={() => toggle(r.slug)}
                    disabled={bloq}
                    className={`flex flex-col rounded-xl border p-4 text-left shadow-sm transition ${
                      on
                        ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                        : bloq
                        ? "border-slate-200 bg-white opacity-40"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                    style={on ? { backgroundColor: "#fbebd6" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-semibold leading-tight">
                            {r.name}
                          </p>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Radar listo
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-400">{r.type}</p>
                        {aliasHint && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            también: {aliasHint}
                          </p>
                        )}
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                          on ? "border-transparent text-white" : "border-slate-300 text-transparent"
                        }`}
                        style={on ? { backgroundColor: BRAND } : undefined}
                      >
                        ✓
                      </span>
                    </div>
                    <div className="mt-3 flex gap-4 text-[12px] text-slate-500">
                      <span>
                        <b className="tabular-nums text-slate-800">
                          {compact(r.mentions)}
                        </b>{" "}
                        veces nombrado
                      </span>
                      <span>
                        <b className="tabular-nums text-slate-800">{r.channels}</b>{" "}
                        canales
                      </span>
                    </div>
                    <div className="mt-2">
                      <MiniSent r={r} />
                    </div>
                  </button>
                );
              })}
            </div>

            {candidateHits.length > 0 && (
              <div className="mt-6">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Detectado en el corpus
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {candidateHits.map((c) => (
                    <div
                      key={c.canonical_guess}
                      className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-semibold">{c.canonical_guess}</p>
                          <p className="text-[11px] text-slate-500">
                            {c.kind} · {compact(c.mentions)} menc. · {c.programs} programas
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                          {c.confidence === "alta" ? "Detectado" : "Candidata"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-slate-600">
                        Todavía sin radar completo. En tu cuenta lo activamos con un retro-scan.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && candidateHits.length === 0 && (
              <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-[14px] text-slate-500">
                No encontramos ese nombre en el demo. En tu cuenta escribís cualquiera
                y lo empezamos a seguir desde ese momento.
              </p>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => (isEdit ? volverAlTablero() : setPaso("plan"))}
                className="text-[14px] text-slate-500 hover:text-slate-800"
              >
                {isEdit ? "← Cancelar" : "← Volver"}
              </button>
              <button
                onClick={() => setPaso("alias")}
                disabled={sel.length === 0}
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: BRAND }}
              >
                Seguir →
              </button>
            </div>
          </section>
        )}

        {/* ---------------- ALIAS (cómo lo dicen) ---------------- */}
        {paso === "alias" && (
          <section className="mx-auto max-w-[720px]">
            <div className="text-center">
              <h1 className="text-3xl font-bold">¿Cómo lo dicen en la tele?</h1>
              <p className="mt-2 text-[15px] text-slate-600">
                En streaming casi nadie dice el nombre completo. Agregá apodos y apellidos —
                Palco busca <b>todas</b> las formas, pero cuenta como <b>una sola</b> entidad.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              {sel.map((slug) => {
                const row = INDEX.find((r) => r.slug === slug);
                if (!row) return null;
                const alias = aliasCfg[slug] ?? [];
                const w = { nombre: row.name, alias };
                const shown = displayAlias(w);
                return (
                  <div
                    key={slug}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Nombre en el tablero
                    </p>
                    <p className="mt-1 text-[18px] font-bold">{row.name}</p>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      También buscar como
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {shown.map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[13px] text-slate-700"
                        >
                          {a}
                          <button
                            type="button"
                            onClick={() => removeAlias(slug, a)}
                            className="ml-0.5 text-slate-400 hover:text-slate-700"
                            aria-label={`Quitar ${a}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          value={aliasDraft[slug] ?? ""}
                          onChange={(e) =>
                            setAliasDraft((d) => ({ ...d, [slug]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addAlias(slug);
                            }
                          }}
                          placeholder="agregar…"
                          className="w-28 rounded-full border border-slate-200 px-3 py-1 text-[13px] outline-none focus:border-[#b45309]"
                        />
                        <button
                          type="button"
                          onClick={() => addAlias(slug)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-[12px] text-slate-600 hover:border-slate-400"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg bg-[#fbebd6] px-3 py-2 text-[13px] text-slate-700">
                      Con estos términos: <b className="tabular-nums">{compact(row.mentions)}</b>{" "}
                      menciones en el corpus capturado.
                    </p>
                  </div>
                );
              })}
            </div>

            {planId === "profesional" && comencionesSel.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Nombrados juntos al aire (Pro)
                </p>
                <div className="mt-3 space-y-2">
                  {comencionesSel.map((p) => (
                    <p key={p.par.join("-")} className="text-[14px] text-slate-700">
                      <b>{p.nombres[0]}</b> × <b>{p.nombres[1]}</b>
                      <span className="ml-2 text-[13px] text-slate-500">
                        {p.cruces_total} cruces
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-center text-[12px] text-slate-400">
              En el piloto, estos términos los confirma el operador en tu cuenta.
            </p>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setPaso("entidades")}
                className="text-[14px] text-slate-500 hover:text-slate-800"
              >
                ← Volver
              </button>
              <button
                onClick={() => (isEdit ? entrar() : setPaso("avisos"))}
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                {isEdit ? "Guardar cambios" : "Seguir →"}
              </button>
            </div>
          </section>
        )}

        {/* ---------------- AVISOS (gobernanza) ---------------- */}
        {!isEdit && paso === "avisos" && (
          <section className="mx-auto max-w-[720px]">
            <div className="text-center">
              <h1 className="text-3xl font-bold">¿Cuándo querés que te avisemos?</h1>
              <p className="mt-2 text-[15px] text-slate-600">
                Vos decidís cuánto te molestamos. Podés cambiar todo esto cuando
                quieras desde tu tablero.
              </p>
            </div>

            {/* sensibilidad */}
            <div className="mt-8">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                Cuánto avisar
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SENSIBILIDADES.map((s) => {
                  const active = s.id === sensibilidad;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSensibilidad(s.id)}
                      className={`relative flex flex-col rounded-2xl border p-4 text-left shadow-sm transition ${
                        active
                          ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                      style={active ? { backgroundColor: "#fbebd6" } : undefined}
                    >
                      {s.reco && (
                        <span
                          className="absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-white"
                          style={{ backgroundColor: BRAND }}
                        >
                          RECOMENDADO
                        </span>
                      )}
                      <p className="text-[15px] font-semibold">{s.titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                        {s.bajada}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* solo negativo */}
            <div className="mt-6">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                Qué avisar
              </p>
              <button
                onClick={() => setSoloNegativo((v) => !v)}
                className={`mt-3 flex w-full items-center justify-between rounded-2xl border p-4 text-left shadow-sm transition ${
                  soloNegativo
                    ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
                style={soloNegativo ? { backgroundColor: "#fbebd6" } : undefined}
              >
                <div>
                  <p className="text-[15px] font-semibold">Avisame solo lo negativo</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    Ideal para modo crisis: te llegan solo las malas menciones. Si lo
                    dejás apagado, te avisamos también lo bueno y lo neutro.
                  </p>
                </div>
                <span
                  className={`ml-4 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                    soloNegativo ? "" : "bg-slate-200"
                  }`}
                  style={soloNegativo ? { backgroundColor: BRAND } : undefined}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition ${
                      soloNegativo ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* frecuencia / cómo */}
            <div className="mt-6">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                Cómo querés recibirlo
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {FRECUENCIAS.map((f) => {
                  const active = f.id === frecuencia;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFrecuencia(f.id)}
                      className={`flex flex-col rounded-2xl border p-4 text-left shadow-sm transition ${
                        active
                          ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                      style={active ? { backgroundColor: "#fbebd6" } : undefined}
                    >
                      <p className="text-[15px] font-semibold">{f.titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                        {f.bajada}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[12px] text-slate-400">
                Los avisos de crisis los mandamos en cuanto los detectamos, sin
                importar esta elección. Esto define el ritmo del resto.
              </p>
            </div>

            {/* a dónde */}
            <div className="mt-6">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                A dónde te lo mandamos
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0]"
              />
              <p className="mt-2 text-[12px] text-slate-400">
                Ahí te llegan los avisos y el{" "}
                {FRECUENCIAS.find((f) => f.id === frecuencia)!.titulo.toLowerCase()}.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setPaso("alias")}
                className="text-[14px] text-slate-500 hover:text-slate-800"
              >
                ← Volver
              </button>
              <button
                onClick={() => setPaso("listo")}
                disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: BRAND }}
              >
                Seguir →
              </button>
            </div>
          </section>
        )}

        {/* ---------------- LISTO ---------------- */}
        {!isEdit && paso === "listo" && (
          <section className="mx-auto max-w-[680px]">
            <div className="text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
                style={{ backgroundColor: BRAND }}
              >
                ✓
              </div>
              <h1 className="mt-4 text-3xl font-bold">Todo listo, {plan.nombre}.</h1>
              <p className="mt-2 text-[15px] text-slate-600">
                Ya estamos escuchando por vos. Así te queda configurado:
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[13px] text-slate-500">Plan</span>
                <span className="text-[14px] font-semibold">
                  {plan.nombre} ·{" "}
                  {plan.aMedida
                    ? "nombres ilimitados"
                    : plan.limite === 1
                    ? "1 nombre"
                    : `hasta ${plan.limite} nombres`}
                </span>
              </div>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                Tu watchlist ({selRows.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selRows.map((r) => {
                  const alias = displayAlias({
                    nombre: r.name,
                    alias: aliasCfg[r.slug] ?? CATALOG_BY_SLUG.get(r.slug)?.alias ?? [],
                  });
                  return (
                    <div
                      key={r.slug}
                      className="rounded-xl border border-[#f0c99a] bg-[#fbebd6] px-3 py-2 text-[13px]"
                      style={{ color: BRAND }}
                    >
                      <p className="font-semibold">{r.name}</p>
                      {alias.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          buscando: {alias.join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                Tus avisos
              </p>
              <div className="mt-2 grid gap-2 text-[13px] text-slate-600">
                <p className="flex gap-2">
                  <span style={{ color: BRAND }}>✓</span>{" "}
                  {SENSIBILIDADES.find((s) => s.id === sensibilidad)!.titulo} ·{" "}
                  {soloNegativo ? "solo lo negativo" : "todo (bueno, neutro y malo)"}
                </p>
                <p className="flex gap-2">
                  <span style={{ color: BRAND }}>✓</span>{" "}
                  {FRECUENCIAS.find((f) => f.id === frecuencia)!.titulo} a{" "}
                  <b className="text-slate-700">{email.trim()}</b>
                </p>
                <p className="flex gap-2">
                  <span style={{ color: BRAND }}>✓</span> Avisos de crisis apenas los detectamos
                </p>
                {planId === "enterprise" && (
                  <p className="flex gap-2">
                    <span style={{ color: BRAND }}>✓</span> Reportes exportables con tu marca
                  </p>
                )}
              </div>
              <p className="mt-3 text-[12px] text-slate-400">
                Todo esto lo cambiás cuando quieras desde <b>Avisos</b> en tu tablero.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setPaso("avisos")}
                className="text-[14px] text-slate-500 hover:text-slate-800"
              >
                ← Ajustar
              </button>
              <button
                onClick={entrar}
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Entrar a mi tablero →
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
