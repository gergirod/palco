"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import bundled from "@/data/palco_entities.json";
import catalogBundled from "@/data/palco_catalog.json";
import { WatchlistTerms } from "@/components/palco/WatchlistTerms";
import { matchesQuery } from "@/lib/palco-watchlist";
import { fetchDataset } from "@/lib/supabase";

/* ---------- tipos ---------- */
type Card = {
  video_id: string;
  channel: string;
  program: string;
  date: string;
  t_seconds: number;
  t_label: string;
  quote: string;
  conc_at: number | null;
  chat_msgs: number;
  chat_ratio: number;
  chat_ex: string[];
  sentiment: "neg" | "neu" | "pos";
  mentions_in_program: number;
  views: number | null;
  yt_url: string;
  clip_start?: number;
  clip_label?: string;
  origen?: string;
  formato?: string;
};
type Mencion = {
  origen: "aire" | "chat";
  video_id: string;
  channel: string;
  program: string;
  date: string;
  t_seconds: number;
  t_label: string;
  quote?: string; // aire
  text?: string; // chat
  conc_at?: number | null;
  chat_ratio?: number | null;
  sentiment?: "neg" | "neu" | "pos";
  yt_url: string;
};
type Radar = {
  slug: string;
  entity: string;
  type: string;
  watchlist: string[];
  watchlist_display?: { nombre: string; alias: string[]; excluir?: string[] };
  totals: {
    transcript_mentions: number;
    chat_mentions: number;
    programs_with_mentions: number;
    channels: number;
  };
  sentiment: { neg: number; neu: number; pos: number };
  sentiment_chat?: { neg: number; neu: number; pos: number };
  chat_scored?: number;
  share_of_voice: { channel: string; mentions: number; pct: number }[];
  by_day: { day: string; mentions: number }[];
  crisis: Card | null;
  feed: Card[];
  menciones?: Mencion[];
  menciones_total?: { aire: number; chat: number };
};
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
type ComencionCruce = {
  id: string;
  video_id: string;
  channel: string;
  program: string;
  date: string;
  ventana: { label: string; minutos?: number };
  entidades: {
    slug: string;
    nombre?: string;
    t_label: string;
    quote: string;
    sentiment?: string;
  }[];
  conc_at?: number | null;
  chat_ratio?: number | null;
  yt_url: string;
};
type ComencionPar = {
  par: [string, string];
  nombres: [string, string];
  programas: number;
  cruces_total: number;
  by_day: { day: string; cruces: number }[];
  cruces: ComencionCruce[];
};
type Data = {
  default: string;
  index: IndexRow[];
  radars: Record<string, Radar>;
  comenciones?: ComencionPar[];
};

const BUNDLED = bundled as unknown as Data;

type CatalogCurated = { slug: string; name: string; type: string; alias: string[] };
type CatalogCandidate = {
  slug_guess: string;
  canonical_guess: string;
  forms: string[];
  kind: string;
  mentions: number;
  programs: number;
  channels: number;
  confidence?: string;
  status: string;
};
const CATALOG = catalogBundled as unknown as {
  curated: CatalogCurated[];
  candidates: CatalogCandidate[];
};
const CATALOG_BY_SLUG = new Map(CATALOG.curated.map((c) => [c.slug, c]));

/* ---------- design system ----------
   Palco · capa de inteligencia de la atención.
   Marca ámbar sobre neutrales fríos. Ver Palco/design-system.md y tailwind.config.ts.
   Tokens:
     bg      #f6f7f9  surface (fondo de app)
     surface #ffffff  tarjeta
     border  slate-200 / line #e5e7eb
     ink     slate-900 / muted slate-500
     brand   #b45309  (ámbar: acento, chat, links, fills)
     crisis  #e11d48  (carmín)
     pos     emerald-600
*/
const BRAND = "#b45309";

/* ---------- helpers ---------- */
function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k";
  return String(n);
}
function fmtDay(d: string): string {
  if (!d || d.length < 8) return d;
  return `${d.slice(6, 8)}/${d.slice(4, 6)}`;
}

/* iconos SVG (aire / chat) — sin emoji para render consistente */
function IconMic({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}
function IconChat({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <circle cx="9" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconPlay({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
function IconEye({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Badge vertical aire / chat (log de menciones). */
function OrigenBadge({ origen }: { origen: "aire" | "chat" | "hablado" | "ambos" }) {
  const esChat = origen === "chat";
  const esAmbos = origen === "ambos";
  const label =
    origen === "chat" ? "chat" : origen === "ambos" ? "ambos" : "aire";
  return (
    <span
      className={`mt-0.5 flex w-11 shrink-0 flex-col items-center justify-center rounded-lg border py-1.5 ${
        esChat || esAmbos
          ? "border-[#f0c99a] bg-[#fbebd6] text-[#b45309]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className="flex items-center gap-0.5">
        {(origen === "aire" || origen === "hablado" || esAmbos) && (
          <IconMic className="h-3.5 w-3.5" />
        )}
        {(esChat || esAmbos) && <IconChat className="h-3.5 w-3.5" />}
      </span>
      <span className="mt-1 text-[9px] font-medium leading-none">{label}</span>
    </span>
  );
}

/** Pill horizontal con iconos (fichas, crisis). */
function OrigenPill({
  origen,
  cls,
  label,
}: {
  origen: "hablado" | "ambos" | "chat";
  cls: string;
  label: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {(origen === "hablado" || origen === "ambos") && <IconMic className="h-3 w-3 shrink-0" />}
      {(origen === "chat" || origen === "ambos") && <IconChat className="h-3 w-3 shrink-0" />}
      {label}
    </span>
  );
}

const SENT = {
  neg: { label: "negativo", dot: "🔴", cls: "text-red-700 bg-red-50 border-red-200" },
  neu: { label: "neutro", dot: "⚪", cls: "text-slate-600 bg-slate-100 border-slate-200" },
  pos: { label: "positivo", dot: "🟢", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
} as const;

/* termómetro de tono reutilizable (aire vs chat), en % sobre su propia base */
function ToneThermo({
  title,
  sub,
  note,
  s,
  baseLabel,
}: {
  title: string;
  sub: string;
  note: string;
  s: { neg: number; neu: number; pos: number };
  baseLabel: string;
}) {
  const total = s.neg + s.neu + s.pos;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
        <p className="text-[11px] text-slate-400">{total ? baseLabel : "sin datos aún"}</p>
      </div>
      <p className="mt-0.5 text-[12px] text-slate-500">{sub}</p>
      {total ? (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-red-500" style={{ width: `${pct(s.neg)}%` }} />
            <div className="bg-slate-400" style={{ width: `${pct(s.neu)}%` }} />
            <div className="bg-emerald-500" style={{ width: `${pct(s.pos)}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-[12px] text-slate-500">
            <span>🔴 {pct(s.neg)}% <span className="text-slate-400">({s.neg})</span></span>
            <span>⚪ {pct(s.neu)}% <span className="text-slate-400">({s.neu})</span></span>
            <span>🟢 {pct(s.pos)}% <span className="text-slate-400">({s.pos})</span></span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-slate-400">
          Todavía sin mensajes clasificados para esta entidad.
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

const ORIGEN: Record<string, { label: string; cls: string; origen: "hablado" | "ambos" | "chat" }> = {
  hablado: { label: "dicho al aire", cls: "text-slate-700 bg-slate-100 border-slate-200", origen: "hablado" },
  ambos: { label: "aire y sala", cls: "text-[#b45309] bg-[#fbebd6] border-[#f0c99a]", origen: "ambos" },
  chat: { label: "solo la sala", cls: "text-[#b45309] bg-[#fbebd6] border-[#f0c99a]", origen: "chat" },
};

/* ---------- página ---------- */
const PLAN_LABEL: Record<string, string> = {
  esencial: "Individual",
  profesional: "Pro",
  enterprise: "A medida",
};

/* ---------- gobernanza de avisos (mismos controles que el onboarding;
   mapean a DEFAULT_REGLAS del pipeline, en palabras humanas) ---------- */
type Sensibilidad = "menos" | "equilibrado" | "mas";
type Frecuencia = "al-toque" | "diario" | "semanal";
const SENS_OPTS: { id: Sensibilidad; titulo: string; bajada: string; reco?: boolean }[] = [
  { id: "menos", titulo: "Menos avisos", bajada: "Solo cuando algo se prende fuego de verdad." },
  { id: "equilibrado", titulo: "Equilibrado", bajada: "El punto justo, sin ruido.", reco: true },
  { id: "mas", titulo: "Más avisos", bajada: "Casi todo lo que se mueva." },
];
const FREQ_OPTS: { id: Frecuencia; titulo: string; bajada: string }[] = [
  { id: "al-toque", titulo: "Ni bien aparece", bajada: "En cuanto procesamos el programa." },
  { id: "diario", titulo: "Resumen diario", bajada: "Un mail cada tarde." },
  { id: "semanal", titulo: "Resumen semanal", bajada: "Un reporte curado." },
];

export default function PalcoPage() {
  const router = useRouter();
  // Dataset: arranca con el bundle horneado en el build y, si Supabase tiene
  // una versión (la que pushea palco_build.py), la reemplaza en runtime.
  // Así el tablero se actualiza sin re-deploy cada vez que corre el pipeline.
  const [D, setD] = useState<Data>(BUNDLED);
  const [slug, setSlug] = useState<string>(BUNDLED.default);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("todas");
  const [tab, setTab] = useState<"todas" | "neg">("todas");
  const [logOrigen, setLogOrigen] = useState<"todas" | "aire" | "chat">("todas");
  const [logShow, setLogShow] = useState(30); // paginado del detalle
  const [feedShow, setFeedShow] = useState(6); // destacados por programa (resumen)
  const [solicitadas, setSolicitadas] = useState<string[]>([]); // catálogo: pedidas para seguir
  const [watch, setWatch] = useState<string[]>([]);
  const [plan, setPlan] = useState<string>("");
  // gobernanza de avisos (settings del tablero)
  const [showAvisos, setShowAvisos] = useState(false);
  const [sensibilidad, setSensibilidad] = useState<Sensibilidad>("equilibrado");
  const [soloNegativo, setSoloNegativo] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("diario");
  const [email, setEmail] = useState("");
  const [cruceShow, setCruceShow] = useState<Record<string, number>>({});

  // Lee la watchlist elegida en el onboarding (?e=slug1,slug2&plan=pro).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = (p.get("e") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => D.radars[s]);
    if (e.length) {
      setWatch(e);
      setSlug(e[0]);
    }
    if (p.get("plan")) setPlan(p.get("plan")!);
    const s = p.get("sens");
    if (s === "menos" || s === "equilibrado" || s === "mas") setSensibilidad(s);
    if (p.get("neg") === "1") setSoloNegativo(true);
    const f = p.get("freq");
    if (f === "al-toque" || f === "diario" || f === "semanal") setFrecuencia(f);
    if (p.get("mail")) setEmail(p.get("mail")!);
  }, []);

  useEffect(() => {
    setCruceShow({});
  }, [slug]);

  // Trae la última versión del dataset desde Supabase (fallback: el bundle).
  useEffect(() => {
    let alive = true;
    fetchDataset<Data>("palco_entities")
      .then((remote) => {
        if (alive && remote?.radars && remote?.index?.length) setD(remote);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const R = D.radars[slug] ?? D.radars[D.default];

  // Catálogo base: si hay watchlist del onboarding, se limita a esas entidades.
  const baseIndex = useMemo(
    () => (watch.length ? D.index.filter((r) => watch.includes(r.slug)) : D.index),
    [watch, D]
  );

  // Categorías presentes en el catálogo (Político, Empresa, Deporte…), para el filtro.
  const cats = useMemo(() => {
    const seen: string[] = [];
    for (const r of baseIndex) if (r.type && !seen.includes(r.type)) seen.push(r.type);
    return seen;
  }, [baseIndex]);

  const filteredIndex = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseIndex.filter((r) => {
      if (cat !== "todas" && r.type !== cat) return false;
      if (!q) return true;
      const catRow = CATALOG_BY_SLUG.get(r.slug);
      const radarAlias = D.radars[r.slug]?.watchlist_display?.alias;
      const alias = catRow?.alias ?? radarAlias ?? [];
      return matchesQuery(q, r.name, alias);
    });
  }, [query, cat, baseIndex, D]);

  // Alertas: entidades de la watchlist (o todas) con crisis detectada.
  const alertas = useMemo(
    () =>
      baseIndex
        .map((r) => D.radars[r.slug])
        .filter((rr) => rr && rr.crisis)
        .sort(
          (a, b) => (b.crisis!.conc_at ?? 0) - (a.crisis!.conc_at ?? 0)
        ),
    [baseIndex, D]
  );

  const notFound = query.trim().length > 0 && filteredIndex.length === 0;

  // Catálogo self-serve: si la búsqueda no matchea una entidad con radar, buscamos
  // en las candidatas que el pipeline ya descubrió (con señal real) y ofrecemos
  // activar el seguimiento. Esto saca a Palco del "modo demo con lista fija".
  const catalogMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!notFound || q.length < 2) return [] as CatalogCandidate[];
    const curatedSlugs = new Set(D.index.map((r) => r.slug));
    return (CATALOG.candidates ?? [])
      .filter(
        (c) =>
          !curatedSlugs.has(c.slug_guess) &&
          matchesQuery(q, c.canonical_guess, c.forms)
      )
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 6);
  }, [query, notFound, D]);

  const maxSov = Math.max(...R.share_of_voice.map((s) => s.mentions), 1);
  const maxDay = Math.max(...R.by_day.map((s) => s.mentions), 1);
  const airProgs = R.sentiment.neg + R.sentiment.neu + R.sentiment.pos;
  const chatScored = R.chat_scored ?? 0;
  // Reacción de la sala = intensidad del chat. Solo cuenta para programas con
  // chat en vivo capturado (LUZU y otros sin chat quedan afuera: darían ×0 y
  // ensucian la métrica). El pico es el momento de mayor reacción del chat.
  const conChat = R.feed.filter(
    (f) => (f.chat_ratio ?? 0) > 0 || (f.chat_msgs ?? 0) > 0
  );
  const pico = conChat.length
    ? conChat.reduce((a, b) => ((b.chat_ratio ?? 0) > (a.chat_ratio ?? 0) ? b : a))
    : null;
  const feed = tab === "neg" ? R.feed.filter((f) => f.sentiment === "neg") : R.feed;
  const feedVisible = feed.slice(0, feedShow);

  // Detalle fino: TODO lo que se dijo (aire + chat), nuevo→viejo, con filtro por origen.
  const logAll = R.menciones ?? [];
  const logFiltered =
    logOrigen === "todas" ? logAll : logAll.filter((m) => m.origen === logOrigen);
  const logVisible = logFiltered.slice(0, logShow);

  // Co-menciones: pares donde esta entidad cruza con otra (mismo programa / bloque 10 min).
  const crucesPairs = useMemo(() => {
    const all = (D as Data).comenciones ?? [];
    return all
      .filter((p) => p.par.includes(slug))
      .sort((a, b) => b.cruces_total - a.cruces_total)
      .slice(0, 4);
  }, [D, slug]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* nav superior */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3">
          <div
            className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.2em]"
            style={{ color: BRAND }}
          >
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ backgroundColor: BRAND }}
            />
            PALCO
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            {plan && (
              <span className="rounded-full border border-[#f0c99a] bg-[#fbebd6] px-3 py-1 font-medium" style={{ color: BRAND }}>
                Plan {PLAN_LABEL[plan] || plan}
              </span>
            )}
            <button
              onClick={() => setShowAvisos(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:border-slate-400"
            >
              ⚙ Avisos
            </button>
            <button
              type="button"
              onClick={() => {
                const p = new URLSearchParams(window.location.search);
                p.set("edit", "1");
                router.push(`/onboarding?${p.toString()}`);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:border-slate-400"
            >
              Editar watchlist
            </button>
          </div>
        </div>
      </div>

      {/* ---------- panel de Avisos (gobernanza / settings) ---------- */}
      {showAvisos && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
          onClick={() => setShowAvisos(false)}
        >
          <div
            className="h-full w-full max-w-[440px] overflow-y-auto bg-[#f6f7f9] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold">Avisos</h2>
                <p className="text-[12px] text-slate-500">Vos decidís cuándo te molestamos.</p>
              </div>
              <button
                onClick={() => setShowAvisos(false)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] text-slate-500 hover:border-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* cuánto */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Cuánto avisar
                </p>
                <div className="mt-2 space-y-2">
                  {SENS_OPTS.map((s) => {
                    const active = s.id === sensibilidad;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSensibilidad(s.id)}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[#b45309] bg-[#fbebd6] ring-2 ring-[#f5d9b0]"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <div>
                          <p className="text-[14px] font-semibold">
                            {s.titulo}
                            {s.reco && (
                              <span
                                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: BRAND }}
                              >
                                RECOMENDADO
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">{s.bajada}</p>
                        </div>
                        {active && <span style={{ color: BRAND }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* qué */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Qué avisar
                </p>
                <button
                  onClick={() => setSoloNegativo((v) => !v)}
                  className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                    soloNegativo
                      ? "border-[#b45309] bg-[#fbebd6] ring-2 ring-[#f5d9b0]"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div>
                    <p className="text-[14px] font-semibold">Solo lo negativo</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      Modo crisis: solo malas menciones. Apagado = también lo bueno y neutro.
                    </p>
                  </div>
                  <span
                    className={`ml-2 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
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

              {/* cómo */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Cómo recibirlo
                </p>
                <div className="mt-2 space-y-2">
                  {FREQ_OPTS.map((f) => {
                    const active = f.id === frecuencia;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFrecuencia(f.id)}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[#b45309] bg-[#fbebd6] ring-2 ring-[#f5d9b0]"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <div>
                          <p className="text-[14px] font-semibold">{f.titulo}</p>
                          <p className="mt-0.5 text-[12px] text-slate-500">{f.bajada}</p>
                        </div>
                        {active && <span style={{ color: BRAND }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Los avisos de crisis los mandamos en cuanto los detectamos, sin importar esto.
                </p>
              </div>

              {/* a dónde */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  A dónde te lo mandamos
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0]"
                />
              </div>

              <button
                onClick={() => setShowAvisos(false)}
                className="w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1100px] px-5 py-8">
        {/* rail de watchlist (viene del onboarding) */}
        {watch.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-slate-400">Tu watchlist:</span>
            {watch.map((s) => {
              const row = D.index.find((r) => r.slug === s);
              const active = s === slug;
              if (!row) return null;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSlug(s);
                    setTab("todas");
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] transition ${
                    active
                      ? "border-[#b45309] bg-[#fbebd6] text-[#b45309]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {row.name}
                  {D.radars[s]?.crisis && <span className="ml-1">🚨</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* panel de alertas */}
        {alertas.length > 0 && (
          <section className="mb-5 rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-red-600">
                🚨 Alertas activas ({alertas.length})
              </h2>
              <span className="text-[12px] text-slate-400">necesitan tu atención</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {alertas.map((rr) => (
                <button
                  key={rr.slug}
                  onClick={() => {
                    setSlug(rr.slug);
                    setTab("neg");
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left hover:border-red-300"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {rr.entity}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">
                      {rr.crisis!.channel} · {fmtDay(rr.crisis!.date)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-[12px] text-red-600">
                    <span className="inline-flex items-center gap-0.5">
                      <IconEye className="h-3.5 w-3.5" />
                      {compact(rr.crisis!.conc_at)}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <IconChat className="h-3.5 w-3.5" />
                      ×{rr.crisis!.chat_ratio}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* selector de entidad */}
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-[12px] font-medium text-slate-500">
            ¿A quién querés monitorear?
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí un nombre — persona, marca, tema…"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0]"
          />
          {cats.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["todas", ...cats].map((c) => {
                const on = cat === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition ${
                      on
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                    }`}
                  >
                    {c === "todas" ? "Todas" : c}
                  </button>
                );
              })}
            </div>
          )}
          {notFound ? (
            catalogMatches.length > 0 ? (
              <div className="mt-3">
                <p className="text-[12px] text-slate-500">
                  No tiene radar todavía, pero <b>ya lo detectamos en la conversación</b>.
                  Activá el seguimiento y armamos el análisis completo:
                </p>
                <div className="mt-2 space-y-2">
                  {catalogMatches.map((c) => {
                    const pedida = solicitadas.includes(c.slug_guess);
                    return (
                      <div
                        key={c.slug_guess}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-800">
                            {c.canonical_guess}
                            <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10.5px] font-normal text-slate-500">
                              {c.kind === "persona"
                                ? "persona"
                                : c.kind === "empresa"
                                ? "empresa"
                                : "persona/marca"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            Lo nombraron <b className="text-slate-700">{compact(c.mentions)}</b> veces
                            en <b className="text-slate-700">{c.programs}</b> programas ·{" "}
                            {c.channels} canales
                          </p>
                        </div>
                        {pedida ? (
                          <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700">
                            ✓ En preparación
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              setSolicitadas((s) => [...s, c.slug_guess])
                            }
                            className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                            style={{ backgroundColor: BRAND }}
                          >
                            Seguir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {solicitadas.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Armamos el radar completo en la próxima corrida del pipeline y te
                    avisamos cuando esté listo.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                No lo encontramos en la conversación de los canales que seguimos. Que
                <b> no aparezca también es señal</b>: no se está hablando de esto. Si
                creés que debería estar, sumamos el canal donde se lo menciona y hacemos
                el <b>retro-scan</b>.
              </div>
            )
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredIndex.map((r) => {
                const active = r.slug === slug;
                return (
                  <button
                    key={r.slug}
                    onClick={() => {
                      setSlug(r.slug);
                      setQuery("");
                      setTab("todas");
                      setFeedShow(6);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-left text-[12px] transition ${
                      active
                        ? "border-[#b45309] bg-[#fbebd6] text-[#b45309]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-slate-400">
                      {r.type} · {compact(r.mentions)} menc.
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* header entidad */}
        <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-slate-400">{R.type}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Radar de {R.entity} en el streaming
            </h1>
            <p className="mt-1 text-[14px] text-slate-500">
              Qué se dice · cuánta gente lo escucha en vivo · cómo reacciona la sala
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Watchlist activa</p>
            <div className="mt-1">
              <WatchlistTerms radar={R} />
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Menciones habladas", v: compact(R.totals.transcript_mentions), s: "en transcripción" },
            { k: "Menciones en chat", v: compact(R.totals.chat_mentions), s: "la sala hablando" },
            { k: "Programas", v: String(R.totals.programs_with_mentions), s: "lo nombraron" },
            { k: "Canales", v: String(R.totals.channels), s: "cobertura" },
          ].map((kpi) => (
            <div key={kpi.k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{kpi.k}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{kpi.v}</p>
              <p className="text-[12px] text-slate-400">{kpi.s}</p>
            </div>
          ))}
        </section>

        {/* resumen visual: dónde y cuándo (solo aire) */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Dónde más se habla · por canal
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">
              Solo lo dicho al aire (transcript de conductores). No suma la sala — el chat
              {R.totals.chat_mentions > 0
                ? ` (${compact(R.totals.chat_mentions)} menciones) va aparte en el detalle.`
                : " va aparte cuando hay captura."}
            </p>
            <div className="mt-4 space-y-2">
              {R.share_of_voice.slice(0, 8).map((s) => (
                <div key={s.channel} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-[12px] text-slate-600">{s.channel}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(s.mentions / maxSov) * 100}%`, backgroundColor: BRAND }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-slate-500">
                    {s.mentions}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Menciones por día
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">
              Misma base: menciones habladas al aire por día (sin chat).
            </p>
            <div className="mt-6 flex h-44 gap-1.5">
              {R.by_day.slice(-14).map((d) => {
                const pct = d.mentions / maxDay;
                return (
                  <div key={d.day} className="flex min-w-0 flex-1 flex-col h-full">
                    <span className="shrink-0 text-center text-[10px] tabular-nums text-slate-400">
                      {d.mentions}
                    </span>
                    <div className="flex min-h-0 flex-1 items-end pt-1">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(pct * 100, d.mentions > 0 ? 6 : 0)}%`,
                          minHeight: d.mentions > 0 ? 4 : 0,
                          background: `linear-gradient(to top, ${BRAND}, #f0a44e)`,
                        }}
                        title={`${fmtDay(d.day)}: ${d.mentions} menciones`}
                      />
                    </div>
                    <span className="shrink-0 pt-1 text-center text-[9px] text-slate-400">
                      {fmtDay(d.day)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* termómetros de tono: aire vs chat (separados a propósito) */}
        <section className="mt-4 grid gap-3 md:grid-cols-2">
          <ToneThermo
            title="Tono en el aire"
            sub="Lo que dijeron los programas"
            note="Ojo: un medio puede estar alineado o pautado."
            s={R.sentiment}
            baseLabel={`sobre ${airProgs} programas`}
          />
          <ToneThermo
            title="Tono en el chat"
            sub="La reacción de la gente"
            note="Más genuino: es lo que escribe la audiencia en vivo."
            s={R.sentiment_chat ?? { neg: 0, neu: 0, pos: 0 }}
            baseLabel={`sobre ${chatScored} mensajes`}
          />
        </section>

        {/* reacción de la sala: intensidad (cuánto, no qué tono) */}
        <section className="mt-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Reacción de la sala · intensidad{" "}
              <span style={{ color: BRAND }}>(único de Palco)</span>
            </p>
            {pico ? (
              <div className="mt-3 flex items-end gap-8">
                <div>
                  <p className="text-3xl font-bold tabular-nums">{compact(pico.conc_at)}</p>
                  <p className="text-[12px] text-slate-400">mirando en vivo · {pico.channel}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: BRAND }}>
                    ×{pico.chat_ratio}
                  </p>
                  <p className="text-[12px] text-slate-400">chat vs. su ritmo normal</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-slate-400">
                Todavía no hay chat en vivo capturado para esta entidad. La reacción de
                la sala aparece cuando el programa donde se la nombra tiene chat activo.
              </p>
            )}
          </div>
        </section>

        {/* cruces con otras entidades (co-mención) */}
        {crucesPairs.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Cruces · nombrados juntos al aire
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">
              Mismo programa, ventana de ~10 minutos. Cada cruce muestra qué dijeron de cada uno
              en ese bloque.
            </p>
            <div className="mt-4 space-y-4">
              {crucesPairs.map((p) => {
                const parKey = p.par.join("-");
                const otroIdx = p.par[0] === slug ? 1 : 0;
                const otro = p.nombres[otroIdx];
                const enDataset = p.cruces.length;
                const visible = Math.min(cruceShow[parKey] ?? 1, enDataset);
                const puedeMas = visible < enDataset;
                return (
                  <div
                    key={parKey}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[14px] font-semibold text-slate-800">
                        {R.entity} × {otro}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {p.cruces_total} cruces · {p.programas} programas
                        {p.cruces_total > enDataset && (
                          <span className="text-slate-300"> · top {enDataset} en tablero</span>
                        )}
                      </p>
                    </div>
                    <div className="mt-3 space-y-4 border-t border-slate-100 pt-3">
                      {p.cruces.slice(0, visible).map((cruce, i) => (
                        <div
                          key={cruce.id}
                          className={i > 0 ? "border-t border-slate-100 pt-4" : ""}
                        >
                          <p className="text-[12px] font-medium text-slate-500">
                            {cruce.channel} · {fmtDay(cruce.date)} · {cruce.ventana?.label}
                            {cruce.program && (
                              <span className="font-normal text-slate-400"> · {cruce.program}</span>
                            )}
                          </p>
                          <div className="mt-2 space-y-2">
                            {cruce.entidades.map((e) => (
                              <p key={`${cruce.id}-${e.slug}`} className="text-[13px] text-slate-700">
                                <span className="font-semibold text-slate-600">
                                  {e.nombre || e.slug}
                                </span>
                                <span className="text-slate-400"> ({e.t_label})</span>
                                <span className="text-slate-500"> — </span>
                                <span className="italic">&ldquo;{e.quote}&rdquo;</span>
                              </p>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
                            {cruce.conc_at != null && (
                              <span className="inline-flex items-center gap-1">
                                <IconEye className="h-3.5 w-3.5" />
                                {compact(cruce.conc_at)} en vivo
                              </span>
                            )}
                            {(cruce.chat_ratio ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <IconChat className="h-3.5 w-3.5" />
                                ×{cruce.chat_ratio} chat
                              </span>
                            )}
                            <a
                              href={cruce.yt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium hover:underline"
                              style={{ color: BRAND }}
                            >
                              <IconPlay className="h-3.5 w-3.5" />
                              ver clip
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(enDataset > 1 || visible > 1) && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {puedeMas && (
                          <button
                            type="button"
                            onClick={() =>
                              setCruceShow((s) => ({
                                ...s,
                                [parKey]: Math.min(visible + 5, enDataset),
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:border-slate-400"
                          >
                            Ver más cruces ({Math.min(visible + 5, enDataset)} de {enDataset})
                          </button>
                        )}
                        {puedeMas && enDataset > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCruceShow((s) => ({ ...s, [parKey]: enDataset }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-slate-400"
                          >
                            Ver los {enDataset} del tablero
                          </button>
                        )}
                        {visible > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCruceShow((s) => ({ ...s, [parKey]: 1 }))
                            }
                            className="rounded-lg px-3 py-1.5 text-[12px] text-slate-500 hover:text-slate-800"
                          >
                            Colapsar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* alerta de crisis */}
        {R.crisis && (
          <section className="mt-6">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-red-600">
              🚨 Alerta de crisis
            </h2>
            <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
              <div className="flex items-center justify-between bg-red-600 px-4 py-2 text-[12px] font-medium text-white">
                <span>PALCO · CRISIS</span>
                <span className="opacity-90">{fmtDay(R.crisis.date)}</span>
              </div>
              <div className="p-5">
                <p className="text-[15px] font-semibold">
                  {R.crisis.channel} · <span className="text-slate-500">{R.crisis.program}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {R.crisis.origen && ORIGEN[R.crisis.origen] && (
                    <OrigenPill
                      origen={ORIGEN[R.crisis.origen].origen}
                      cls={ORIGEN[R.crisis.origen].cls}
                      label={ORIGEN[R.crisis.origen].label}
                    />
                  )}
                  {R.crisis.formato && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {R.crisis.formato}
                    </span>
                  )}
                </div>
                <p className="mt-3 border-l-2 border-red-400 pl-3 text-[15px] italic text-slate-700">
                  &ldquo;{R.crisis.quote}&rdquo;
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <IconEye className="h-3.5 w-3.5" />
                    <b className="tabular-nums text-slate-900">{compact(R.crisis.conc_at)}</b> en vivo
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconChat className="h-3.5 w-3.5" />
                    chat{" "}
                    <b className="tabular-nums" style={{ color: BRAND }}>
                      ×{R.crisis.chat_ratio}
                    </b>
                  </span>
                  <span>🕐 {R.crisis.t_label}</span>
                  <span className="text-red-600">🔴 tono negativo</span>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  <b className="text-slate-700">Por qué es crisis:</b> mención + audiencia alta + chat
                  disparado + tono negativo, todo al mismo tiempo. Nadie más puede computar este cruce.
                </p>
                <a
                  href={R.crisis.yt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <IconPlay className="h-3.5 w-3.5" />
                  {R.crisis.clip_label || "Ver clip en el minuto exacto"}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* destacados: una cita por programa (resumen), no es el detalle completo */}
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Destacados por programa
              </h2>
              <p className="mt-1 max-w-xl text-[12px] text-slate-400">
                Una cita al aire por programa donde apareció, ordenada por audiencia en vivo.
                No es el listado completo — eso está en{" "}
                <a href="#detalle-menciones" className="font-medium hover:underline" style={{ color: BRAND }}>
                  Todo lo que se dijo
                </a>
                . El chat solo se muestra si el canal tiene sala capturada (Luzu, por ejemplo, no).
              </p>
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
              {(["todas", "neg"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setFeedShow(6);
                  }}
                  className={`rounded-md px-3 py-1 ${
                    tab === t
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t === "todas" ? "Todas" : "Solo negativas"}
                </button>
              ))}
            </div>
          </div>

          {feedVisible.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-[13px] text-slate-400">
              Sin menciones negativas en el período.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {feedVisible.map((c) => {
                const s = SENT[c.sentiment];
                const o = c.origen ? ORIGEN[c.origen] : null;
                const conChat = (c.chat_ratio ?? 0) > 0 || (c.chat_msgs ?? 0) > 0;
                return (
                  <article
                    key={c.video_id + c.t_seconds}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-800">{c.channel}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`}>
                        {s.dot} {s.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-400 line-clamp-1">{c.program}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {o && (
                        <OrigenPill origen={o.origen} cls={o.cls} label={o.label} />
                      )}
                      {c.formato && (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">
                          {c.formato}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex-1 text-[13.5px] italic leading-relaxed text-slate-700 line-clamp-3">
                      &ldquo;{c.quote}&rdquo;
                    </p>
                    {c.chat_ex?.[0] && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-500">
                        <IconChat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>la sala: «{c.chat_ex[0]}»</span>
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <IconEye className="h-3.5 w-3.5" />
                        <b className="tabular-nums text-slate-800">{compact(c.conc_at)}</b>
                        <span className="text-slate-400">en vivo</span>
                      </span>
                      {conChat ? (
                        <span className="inline-flex items-center gap-1">
                          <IconChat className="h-3.5 w-3.5" />
                          <b className="tabular-nums" style={{ color: BRAND }}>
                            ×{c.chat_ratio}
                          </b>
                          <span className="text-slate-400">chat</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">sin chat en este canal</span>
                      )}
                      <span>{fmtDay(c.date)} · {c.t_label}</span>
                      <a
                        href={c.yt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
                        style={{ color: BRAND }}
                      >
                        <IconPlay className="h-3.5 w-3.5" />
                        {c.clip_label || "clip"}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {feed.length > feedShow && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setFeedShow((n) => n + 6)}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-400"
              >
                Ver más programas ({feed.length - feedShow} restantes)
              </button>
              <a
                href="#detalle-menciones"
                className="text-[13px] font-medium hover:underline"
                style={{ color: BRAND }}
              >
                Ir al detalle completo →
              </a>
            </div>
          )}
        </section>

        {/* TODO lo que se dijo — línea de tiempo completa (aire + chat), nuevo→viejo */}
        <section id="detalle-menciones" className="mt-8 scroll-mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">
                Todo lo que se dijo
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Cada mención, textual, del más nuevo al más viejo — al aire y en el chat.
                A diferencia de los destacados de arriba, acá no hay una sola cita por programa:
                aparece todo, una por una.
                {R.menciones_total && (
                  <>
                    {" "}
                    <span className="text-slate-400">
                      ({R.menciones_total.aire} al aire · {R.menciones_total.chat} en el chat)
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
              {(["todas", "aire", "chat"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    setLogOrigen(o);
                    setLogShow(30);
                  }}
                  className={`rounded-md px-3 py-1 ${
                    logOrigen === o
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {o === "todas" ? (
                    "Todo"
                  ) : o === "aire" ? (
                    <span className="inline-flex items-center gap-1">
                      <IconMic className="h-3 w-3" /> Al aire
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <IconChat className="h-3 w-3" /> Chat
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {logVisible.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center text-[13px] text-slate-400">
              No hay menciones para mostrar en este filtro.
            </p>
          ) : (
            <ol className="mt-4 space-y-1.5">
              {logVisible.map((m, i) => {
                const s = m.sentiment ? SENT[m.sentiment] : null;
                const esChat = m.origen === "chat";
                return (
                  <li
                    key={m.video_id + m.origen + m.t_seconds + i}
                    className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm"
                  >
                    <OrigenBadge origen={esChat ? "chat" : "aire"} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13.5px] leading-relaxed text-slate-700 ${
                          esChat ? "" : "italic"
                        }`}
                      >
                        {esChat ? m.text : <>&ldquo;{m.quote}&rdquo;</>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-400">
                        <span className="font-medium text-slate-500">{m.channel}</span>
                        <span className="truncate max-w-[220px]">{m.program}</span>
                        <span className="tabular-nums">
                          {fmtDay(m.date)} · {m.t_label}
                        </span>
                        {!esChat && m.conc_at != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <IconEye className="h-3 w-3" />
                            {compact(m.conc_at)}
                          </span>
                        )}
                        {s && (
                          <span className={`rounded-full border px-1.5 py-0.5 ${s.cls}`}>
                            {s.dot} {s.label}
                          </span>
                        )}
                        {!esChat && (
                          <a
                            href={m.yt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: BRAND }}
                          >
                            <IconPlay className="h-3 w-3" />
                            ver
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {logFiltered.length > logShow && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setLogShow((n) => n + 40)}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-400"
              >
                Ver más ({logFiltered.length - logShow} restantes)
              </button>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
          Palco · demo sobre corpus real · datos capturados del streaming argentino en vivo ·
          elegí otra entidad arriba para cambiar el radar
        </footer>
      </div>
    </div>
  );
}
