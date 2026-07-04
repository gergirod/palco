"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import bundled from "@/data/palco_entities.json";
import catalogBundled from "@/data/palco_catalog.json";
import { WatchlistTerms } from "@/components/palco/WatchlistTerms";
import Sheet from "@/components/Sheet";
import { matchesQuery } from "@/lib/palco-watchlist";
import { fetchDataset } from "@/lib/supabase";
import { PaywallExpired } from "@/components/palco/PaywallExpired";
import {
  loadPalcoAccount,
  savePalcoAccount,
  isPalcoAccountConfigured,
  trialState,
  type PalcoAccount,
  type TrialState,
} from "@/lib/palco-account";
import { APP_NAME } from "@/config/app";
import { TRIAL_DIAS, PAGO, whatsappPagoUrl } from "@/config/trial";

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
  by_day: { day: string; mentions: number; neg?: number; neu?: number; pos?: number }[];
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
  live_since?: string; // "YYYYMMDD": primer día de tracking en vivo con chat
};

/** Día 0 del tracking en vivo con chat. El corpus tiene VOD backfilleado más
 *  viejo (sin audiencia), que no cuenta como imagen en vivo. Fallback hasta que
 *  el pipeline lo calcule y lo escriba en el dataset (live_since). */
const LIVE_SINCE_DEFAULT = "20260623";

/** Piso de menciones (dentro de la ventana elegida) para entrar al ranking de
 *  imagen del Top del catálogo — evita que una entidad con 1-2 menciones
 *  "gane" con un 100% que no es representativo de nada. */
const MIN_MENCIONES_IMAGEN = 20;
/** Ventanas que ofrece el Top del catálogo: 24 h / semana / mes (sin "48 h" ni
 *  "máximo" — ese panel es sobre actividad reciente, no histórico completo). */
const TOP_RANGO_IDS: Rango[] = ["24h", "7d", "30d"];

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
const BRAND = "var(--signal)";

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

/** "20260701" -> Date (medianoche local). Para filtrar por ventana temporal. */
function parseYmd(d: string): Date {
  return new Date(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)) - 1,
    Number(d.slice(6, 8)),
  );
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
          ? "border-signal-line bg-signal-soft text-signal"
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

/* termómetro de imagen reutilizable (aire vs chat vs combinado), en % sobre su propia base */
function ImagenThermo({
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

function imagenDominante(s: { neg: number; neu: number; pos: number }) {
  const total = s.neg + s.neu + s.pos;
  if (!total) return null;
  const max = Math.max(s.neg, s.neu, s.pos);
  if (max / total < 0.45) return null;
  if (s.neg === max) return "neg" as const;
  if (s.pos === max) return "pos" as const;
  return "neu" as const;
}

function MiniImagenBar({ s }: { s: { neg: number; neu: number; pos: number } }) {
  const total = s.neg + s.neu + s.pos;
  if (!total) return <span className="text-[11px] text-slate-400">sin clasificar</span>;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="flex h-2 min-w-[72px] flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className="bg-red-500" style={{ width: `${pct(s.neg)}%` }} />
      <div className="bg-slate-400" style={{ width: `${pct(s.neu)}%` }} />
      <div className="bg-emerald-500" style={{ width: `${pct(s.pos)}%` }} />
    </div>
  );
}

type DiaRow = {
  day: string;
  total: number;
  neg: number;
  neu: number;
  pos: number;
  /** true = tenemos volumen (se habló) pero todavía no hay muestra de tono para
   *  ese día (ni menciones individuales ni by_day enriquecido). Se muestra en
   *  el gráfico como barra gris (volumen real), pero se excluye de los % de
   *  Imagen agregados para no diluirlos con un "neutro" inventado. */
  sinDato?: boolean;
};

function pctImagen(d: DiaRow, k: "neg" | "pos") {
  return d.total ? Math.round((d[k] / d.total) * 100) : 0;
}

function imagenNegRadar(radar: Radar): number {
  return imagenBreakdownRadar(radar).negPct;
}

/** Imagen completa de una entidad (aire + chat) en % sobre su propia base.
 *  net = pos − neg (rankea mejor/peor imagen); veredicto = etiqueta en palabras. */
function imagenBreakdownRadar(radar: Radar): {
  negPct: number;
  neuPct: number;
  posPct: number;
  net: number;
  verdicto: string;
  cls: string;
} {
  const sc = radar.sentiment_chat ?? { neg: 0, neu: 0, pos: 0 };
  const neg = radar.sentiment.neg + sc.neg;
  const neu = radar.sentiment.neu + sc.neu;
  const pos = radar.sentiment.pos + sc.pos;
  const total = neg + neu + pos || 1;
  const negPct = Math.round((neg / total) * 100);
  const posPct = Math.round((pos / total) * 100);
  const neuPct = Math.max(0, 100 - negPct - posPct);
  // veredicto por % negativo (honesto); el ranking mejor/peor usa net.
  const [verdicto, cls] =
    negPct >= 55
      ? ["Muy negativa", "text-red-600"]
      : negPct >= 40
        ? ["Negativa", "text-red-600"]
        : negPct >= 25
          ? ["Mixta", "text-amber-600"]
          : ["Positiva", "text-emerald-600"];
  return { negPct, neuPct, posPct, net: posPct - negPct, verdicto, cls };
}

function mencionesRadar(radar: Radar): number {
  return radar.totals.transcript_mentions + radar.totals.chat_mentions;
}

const ORIGEN: Record<string, { label: string; cls: string; origen: "hablado" | "ambos" | "chat" }> = {
  hablado: { label: "dicho al aire", cls: "text-slate-700 bg-slate-100 border-slate-200", origen: "hablado" },
  ambos: { label: "aire y sala", cls: "text-signal bg-signal-soft border-signal-line", origen: "ambos" },
  chat: { label: "solo la sala", cls: "text-signal bg-signal-soft border-signal-line", origen: "chat" },
};

/* ---------- página ---------- */
const PLAN_LABEL: Record<string, string> = {
  esencial: "Individual",
  profesional: "Pro",
  enterprise: "A medida",
};

/* ---------- gobernanza de avisos (mismos controles que el onboarding;
   mapean a DEFAULT_REGLAS del pipeline, en palabras humanas) ---------- */
type ImagenTab = "todo" | "aire" | "chat";
type Rango = "24h" | "48h" | "7d" | "30d" | "max";
const RANGO_DIAS: Record<Exclude<Rango, "max">, number> = {
  "24h": 1,
  "48h": 2,
  "7d": 7,
  "30d": 30,
};
const RANGO_OPTS: { id: Rango; label: string }[] = [
  { id: "24h", label: "24 h" },
  { id: "48h", label: "48 h" },
  { id: "7d", label: "1 semana" },
  { id: "30d", label: "1 mes" },
  { id: "max", label: "Máximo" },
];

/** Filtra menciones por ventana temporal (misma lógica que Imagen / Dónde se habla). */
function mencionesEnRango(menc: Mencion[], rango: Rango, liveSince: string): Mencion[] {
  const base = menc.filter((m) => {
    const day = m.date?.slice(0, 8);
    return Boolean(day) && day >= liveSince;
  });
  if (rango === "max" || !base.length) return base;
  let ultimoDia = base[0].date!.slice(0, 8);
  for (const m of base) {
    const day = m.date!.slice(0, 8);
    if (day > ultimoDia) ultimoDia = day;
  }
  const desde = parseYmd(ultimoDia);
  desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
  return base.filter((m) => parseYmd(m.date!.slice(0, 8)) >= desde);
}
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
  // El buscador completo (input + categorías + "no lo encontramos") solo se
  // abre a pedido. Por default va colapsado: con una sola entidad no tiene
  // sentido mostrarlo, y con varias alcanza con los chips para cambiar rápido.
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  // Top del catálogo: colapsado por default (vidriera de todo streaming
  // argentino trackeado, no solo la watchlist). Ventana propia (no comparte
  // "rango" con la sección Imagen de la entidad enfocada) porque es un panel
  // aparte, a nivel catálogo.
  const [topCatalogoAbierto, setTopCatalogoAbierto] = useState(false);
  const [topCatalogoTab, setTopCatalogoTab] = useState<
    "menciones" | "positiva" | "negativa"
  >("menciones");
  const [topRango, setTopRango] = useState<Rango>("24h");
  const [tab, setTab] = useState<"todas" | "neg">("todas");
  const [logOrigen, setLogOrigen] = useState<"todas" | "aire" | "chat">("todas");
  const [logRango, setLogRango] = useState<Rango>("7d");
  const [logShow, setLogShow] = useState(20); // paginado del detalle
  const [feedShow, setFeedShow] = useState(6); // destacados por programa (resumen)
  const [solicitadas, setSolicitadas] = useState<string[]>([]); // catálogo: pedidas para seguir
  const [watch, setWatch] = useState<string[]>([]);
  // Competencia por entidad: mapa entidad→rival (1 por cada nombre seguido).
  const [compByEntity, setCompByEntity] = useState<Record<string, string>>({});
  // Comparación: por defecto contra todo el rubro (dinámico); "fija" muestra
  // solo el rival elegido a mano en el onboarding.
  const [compView, setCompView] = useState<"rubro" | "fija">("rubro");
  const [plan, setPlan] = useState<string>("");
  // gobernanza de avisos (settings del tablero)
  const [showAvisos, setShowAvisos] = useState(false);
  const [sensibilidad, setSensibilidad] = useState<Sensibilidad>("equilibrado");
  const [soloNegativo, setSoloNegativo] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("diario");
  const [email, setEmail] = useState("");
  const [cruceShow, setCruceShow] = useState<Record<string, number>>({});
  // Canal abierto en "Dónde se habla más": al hacer click se despliegan las
  // citas reales que arman ese número (trazabilidad número → fuente).
  const [canalAbierto, setCanalAbierto] = useState<string | null>(null);
  const [imagenTab, setImagenTab] = useState<ImagenTab>("todo");
  const [rango, setRango] = useState<Rango>("max");
  const [accountReady, setAccountReady] = useState(false);
  const [palcoAccount, setPalcoAccount] = useState<PalcoAccount | null>(null);
  // Acceso: prueba vigente / pagó / vencida. Lo calcula trialState() desde la DB.
  const [trial, setTrial] = useState<TrialState | null>(null);

  // Lee la cuenta guardada en Supabase.
  useEffect(() => {
    let alive = true;

    (async () => {
      const acc = await loadPalcoAccount();
      if (!alive) return;

      if (acc && !isPalcoAccountConfigured(acc)) {
        router.replace("/onboarding");
        return;
      }

      if (!acc) {
        router.replace("/onboarding");
        return;
      }

      setPalcoAccount(acc);

      // Estado de la prueba: si venció (y no pagó) bloqueamos el tablero abajo.
      setTrial(trialState(acc));

      if (acc?.watchlist?.length) {
        const slugs = acc.watchlist.map((w) => w.slug).filter((s) => D.radars[s]);
        if (slugs.length) {
          setWatch(slugs);
          setSlug(slugs[0]);
        }
        if (acc.plan) setPlan(acc.plan);
        if (acc.competidores?.length) {
          const map: Record<string, string> = {};
          for (const c of acc.competidores) {
            if (c.para && c.slug && D.radars[c.slug]) map[c.para] = c.slug;
          }
          setCompByEntity(map);
        }
        const a = acc.avisos;
        if (a.sensibilidad) setSensibilidad(a.sensibilidad);
        setSoloNegativo(!!a.solo_negativo);
        if (a.frecuencia) setFrecuencia(a.frecuencia);
        setEmail(a.email_contacto || acc.email || "");
        setAccountReady(true);
        return;
      }

      router.replace("/onboarding");
    })();

    return () => {
      alive = false;
    };
  }, [D, router]);

  useEffect(() => {
    setCruceShow({});
    setImagenTab("todo");
    setCanalAbierto(null);
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

  // Top del catálogo completo: quién más se habla y quién tiene mejor/peor
  // imagen en TODO streaming argentino trackeado (no solo la watchlist del
  // usuario) — misma ventana temporal que el resto del tablero (24 h / semana
  // / mes), acumulado dentro de esa ventana, no histórico de toda la vida.
  // Piso de MIN_MENCIONES_IMAGEN en la ventana elegida para que una entidad
  // con 2 menciones (las 2 positivas) no gane "100% positivo" sin decir nada.
  const topCatalogo = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    const filas = D.index.map((r) => {
      const radar = D.radars[r.slug];
      const menc = mencionesEnRango(radar?.menciones ?? [], topRango, liveSince);
      let neg = 0;
      let neu = 0;
      let pos = 0;
      for (const m of menc) {
        if (m.sentiment === "neg") neg++;
        else if (m.sentiment === "pos") pos++;
        else neu++;
      }
      const total = neg + neu + pos || 1;
      const negPct = Math.round((neg / total) * 100);
      const posPct = Math.round((pos / total) * 100);
      return {
        slug: r.slug,
        name: r.name,
        type: r.type,
        mentions: menc.length,
        negPct,
        posPct,
        net: posPct - negPct,
      };
    });
    const conMenciones = filas.filter((f) => f.mentions > 0);
    const menciones = [...conMenciones]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20);
    const elegiblesImagen = conMenciones.filter(
      (f) => f.mentions >= MIN_MENCIONES_IMAGEN
    );
    const positiva = [...elegiblesImagen].sort((a, b) => b.net - a.net).slice(0, 20);
    const negativa = [...elegiblesImagen].sort((a, b) => a.net - b.net).slice(0, 20);
    return { menciones, positiva, negativa };
  }, [D, topRango]);

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

  async function guardarAvisos() {
    const existing = await loadPalcoAccount();
    if (existing) {
      const slugs =
        existing.watchlist.length > 0
          ? existing.watchlist
          : watch.map((slug) => ({
              slug,
              nombre: D.radars[slug]?.entity ?? slug,
              alias: D.radars[slug]?.watchlist_display?.alias ?? [],
            }));
      await savePalcoAccount({
        plan: (existing.plan ?? plan) || "profesional",
        watchlist: slugs,
        competidores: existing.competidores ?? [],
        avisos: {
          sensibilidad,
          solo_negativo: soloNegativo,
          frecuencia,
          email_contacto: email.trim(),
        },
      });
    }
    setShowAvisos(false);
  }

  // Mismo filtro de ventana temporal que porDia (rango + live_since), para que
  // "Dónde más se habló" no muestre el acumulado histórico mientras el resto
  // de la sección Imagen ya está filtrada por el rango elegido arriba.
  const porCanal = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    const menc = (R.menciones ?? []).filter((m) => {
      if (imagenTab === "aire" && m.origen !== "aire") return false;
      if (imagenTab === "chat" && m.origen !== "chat") return false;
      const day = m.date?.slice(0, 8);
      return Boolean(day) && day >= liveSince;
    });
    let filtradas = menc;
    if (rango !== "max" && menc.length) {
      let ultimoDia = menc[0].date!.slice(0, 8);
      for (const m of menc) {
        const day = m.date!.slice(0, 8);
        if (day > ultimoDia) ultimoDia = day;
      }
      const desde = parseYmd(ultimoDia);
      desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
      filtradas = menc.filter((m) => parseYmd(m.date!.slice(0, 8)) >= desde);
    }
    const map = new Map<
      string,
      { channel: string; total: number; neg: number; neu: number; pos: number }
    >();
    for (const m of filtradas) {
      const ch = m.channel || "?";
      const row = map.get(ch) ?? { channel: ch, total: 0, neg: 0, neu: 0, pos: 0 };
      row.total++;
      if (m.sentiment === "neg") row.neg++;
      else if (m.sentiment === "pos") row.pos++;
      else row.neu++;
      map.set(ch, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [R, imagenTab, rango, D]);
  const maxCanal = Math.max(...porCanal.map((c) => c.total), 1);
  // Mismo filtro que porCanal, pero conservando las menciones individuales
  // (no agregadas) para poder mostrar citas reales al abrir un canal en
  // "Dónde se habla más" — trazabilidad: del número a la cita que lo compone.
  const mencionesPorCanalMap = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    const menc = (R.menciones ?? []).filter((m) => {
      if (imagenTab === "aire" && m.origen !== "aire") return false;
      if (imagenTab === "chat" && m.origen !== "chat") return false;
      const day = m.date?.slice(0, 8);
      return Boolean(day) && day >= liveSince;
    });
    let filtradas = menc;
    if (rango !== "max" && menc.length) {
      let ultimoDia = menc[0].date!.slice(0, 8);
      for (const m of menc) {
        const day = m.date!.slice(0, 8);
        if (day > ultimoDia) ultimoDia = day;
      }
      const desde = parseYmd(ultimoDia);
      desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
      filtradas = menc.filter((m) => parseYmd(m.date!.slice(0, 8)) >= desde);
    }
    const map = new Map<string, Mencion[]>();
    for (const m of filtradas) {
      const ch = m.channel || "?";
      const arr = map.get(ch) ?? [];
      arr.push(m);
      map.set(ch, arr);
    }
    return map;
  }, [R, imagenTab, rango, D]);
  // Historial completo del día 0. El volumen de fondo sale de by_day (todo el
  // corpus trackeado, no solo las menciones recientes que vienen capadas); el
  // sentimiento se toma de las menciones cuando existen (preciso y por pestaña),
  // o de by_day si viene enriquecido, o queda neutro para días viejos.
  const porDia = useMemo(() => {
    // 1) menciones → sentimiento por día (respeta la pestaña aire/chat/todo)
    const desdeMenc = new Map<string, DiaRow>();
    for (const m of R.menciones ?? []) {
      if (imagenTab === "aire" && m.origen !== "aire") continue;
      if (imagenTab === "chat" && m.origen !== "chat") continue;
      const day = m.date?.slice(0, 8);
      if (!day) continue;
      const row = desdeMenc.get(day) ?? { day, total: 0, neg: 0, neu: 0, pos: 0 };
      row.total++;
      if (m.sentiment === "neg") row.neg++;
      else if (m.sentiment === "pos") row.pos++;
      else row.neu++;
      desdeMenc.set(day, row);
    }
    // 2) unir todos los días (by_day = volumen al aire de todo el historial).
    //    En la pestaña "chat" by_day no aplica (solo trackea aire).
    const dias = new Set<string>(desdeMenc.keys());
    if (imagenTab !== "chat") {
      for (const b of R.by_day ?? []) if (b.day) dias.add(b.day);
    }
    const byDayMap = new Map(
      (imagenTab === "chat" ? [] : R.by_day ?? []).map((b) => [b.day, b]),
    );
    // 3) por día: volumen autoritativo + split de sentimiento proporcional.
    //    Si el día no tiene muestra de sentimiento (ni menciones individuales
    //    ni by_day enriquecido), no inventamos un tono — pero SÍ mostramos la
    //    barra con el volumen real (marcada sinDato), porque "cuánto se habló"
    //    es un dato de volumen, no de imagen. Antes se excluía el día entero
    //    del gráfico, y con datasets donde la sentimentización va atrás del
    //    volumen (normal en un pipeline en vivo) el "Máximo" terminaba
    //    mostrando 1 sola barra pese a haber muchos días trackeados. Los días
    //    sinDato sí se excluyen del cálculo de % de Imagen más abajo.
    let rows: DiaRow[] = [];
    for (const day of dias) {
      const menc = desdeMenc.get(day);
      const bd = byDayMap.get(day);
      const total = bd ? bd.mentions : menc ? menc.total : 0;
      if (total <= 0) continue;
      let neg = 0;
      let pos = 0;
      let neu = 0;
      let sinDato = false;
      if (menc && menc.total > 0) {
        neg = Math.round((total * menc.neg) / menc.total);
        pos = Math.round((total * menc.pos) / menc.total);
        neu = Math.max(0, total - neg - pos);
      } else if (bd && typeof bd.neg === "number" && typeof bd.pos === "number") {
        neg = bd.neg;
        pos = bd.pos;
        neu = Math.max(0, total - neg - pos);
      } else {
        neu = total;
        sinDato = true;
      }
      rows.push({ day, total, neg, neu, pos, sinDato });
    }
    rows.sort((a, b) => a.day.localeCompare(b.day));
    // 4) piso: solo el tracking en vivo con chat. El VOD backfilleado más viejo
    //    (sin audiencia) no cuenta como imagen en vivo.
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    rows = rows.filter((d) => d.day >= liveSince);
    // 5) filtro por ventana temporal, relativo al último día con data
    if (rango !== "max" && rows.length) {
      const desde = parseYmd(rows[rows.length - 1].day);
      desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
      return rows.filter((d) => parseYmd(d.day) >= desde);
    }
    return rows;
  }, [R, imagenTab, rango, D]);
  const maxDiaVol = Math.max(...porDia.map((d) => d.total), 1);
  // Volumen REAL del rango elegido (todos los días, incluidos los sinDato) —
  // es lo que "Máximo"/"Semana"/etc. tienen que responder cuando alguien
  // pregunta "cuánto se habló en total". imagenTotalActual, en cambio, es
  // solo la porción con tono ya clasificado (puede ser mucho más chica si la
  // clasificación de sentimiento va atrás del volumen crudo) — mezclar los
  // dos números en un solo "sobre X menciones" hacía parecer que el rango
  // elegido no se estaba respetando (mostraba solo el día con clasificación,
  // no el total del período).
  const volumenTotalRango = useMemo(
    () => porDia.reduce((acc, d) => acc + d.total, 0),
    [porDia]
  );
  // Igual que porDia pero SIN recortar por rango: hace falta el historial
  // completo (día a día) para poder comparar el período elegido (24h/48h/
  // semana/mes) contra el período inmediatamente anterior de igual duración.
  const porDiaCompleto = useMemo(() => {
    const desdeMenc = new Map<string, DiaRow>();
    for (const m of R.menciones ?? []) {
      if (imagenTab === "aire" && m.origen !== "aire") continue;
      if (imagenTab === "chat" && m.origen !== "chat") continue;
      const day = m.date?.slice(0, 8);
      if (!day) continue;
      const row = desdeMenc.get(day) ?? { day, total: 0, neg: 0, neu: 0, pos: 0 };
      row.total++;
      if (m.sentiment === "neg") row.neg++;
      else if (m.sentiment === "pos") row.pos++;
      else row.neu++;
      desdeMenc.set(day, row);
    }
    const dias = new Set<string>(desdeMenc.keys());
    if (imagenTab !== "chat") {
      for (const b of R.by_day ?? []) if (b.day) dias.add(b.day);
    }
    const byDayMap = new Map(
      (imagenTab === "chat" ? [] : R.by_day ?? []).map((b) => [b.day, b]),
    );
    let rows: DiaRow[] = [];
    for (const day of dias) {
      const menc = desdeMenc.get(day);
      const bd = byDayMap.get(day);
      const total = bd ? bd.mentions : menc ? menc.total : 0;
      if (total <= 0) continue;
      let neg = 0;
      let pos = 0;
      let neu = 0;
      if (menc && menc.total > 0) {
        neg = Math.round((total * menc.neg) / menc.total);
        pos = Math.round((total * menc.pos) / menc.total);
        neu = Math.max(0, total - neg - pos);
      } else if (bd && typeof bd.neg === "number" && typeof bd.pos === "number") {
        neg = bd.neg;
        pos = bd.pos;
        neu = Math.max(0, total - neg - pos);
      } else {
        // Sin muestra de sentimiento para este día: no lo contamos en Imagen.
        continue;
      }
      rows.push({ day, total, neg, neu, pos });
    }
    rows.sort((a, b) => a.day.localeCompare(b.day));
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    return rows.filter((d) => d.day >= liveSince);
  }, [R, imagenTab, D]);
  // Imagen del período seleccionado: se arma sumando porDia (que ya respeta
  // imagenTab + rango + live_since), no R.sentiment/R.sentiment_chat crudos.
  // Antes esta tarjeta mostraba el acumulado histórico sin importar el rango
  // elegido arriba, lo que contradecía al gráfico "Cómo viene" de al lado.
  const imagenActual = useMemo(
    () =>
      porDia
        .filter((d) => !d.sinDato)
        .reduce(
          (acc, d) => ({
            neg: acc.neg + d.neg,
            neu: acc.neu + d.neu,
            pos: acc.pos + d.pos,
          }),
          { neg: 0, neu: 0, pos: 0 }
        ),
    [porDia]
  );
  // Veredicto grande del hero ("Imagen positiva/negativa/mixta"), sobre el
  // mismo período ya filtrado que imagenActual (no el acumulado histórico
  // crudo de R.sentiment). Mismos umbrales que imagenBreakdownRadar, para que
  // el hero y la tabla de Comparación cuenten la misma historia.
  const imagenTotalActual = imagenActual.neg + imagenActual.neu + imagenActual.pos;
  const negPctActual = imagenTotalActual
    ? Math.round((imagenActual.neg / imagenTotalActual) * 100)
    : 0;
  const posPctActual = imagenTotalActual
    ? Math.round((imagenActual.pos / imagenTotalActual) * 100)
    : 0;
  const neuPctActual = imagenTotalActual ? Math.max(0, 100 - negPctActual - posPctActual) : 0;
  const veredictoActual = !imagenTotalActual
    ? { texto: "Todavía sin datos", cls: "text-slate-400" }
    : negPctActual >= 55
      ? { texto: "Imagen muy negativa", cls: "text-red-600" }
      : negPctActual >= 40
        ? { texto: "Imagen negativa", cls: "text-red-600" }
        : negPctActual >= 25
          ? { texto: "Imagen mixta", cls: "text-amber-600" }
          : { texto: "Imagen positiva", cls: "text-emerald-600" };
  const rangoLabel = RANGO_OPTS.find((r) => r.id === rango)?.label ?? "el período";
  // Desglose de volumen del período elegido arriba (mismo rango que todo lo
  // demás en "Imagen"), siempre sobre los DOS orígenes juntos — no cambia con
  // la pestaña Todo/Aire/Chat, que solo filtra qué sentimiento se juzga en el
  // veredicto. Antes esta fila usaba R.totals (acumulado histórico de toda la
  // vida del radar), que no coincidía con "sobre X menciones · 24 h" de arriba.
  const statsPeriodo = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    const dias = (R.by_day ?? []).filter((b) => b.day && b.day >= liveSince);
    let diasVentana = dias;
    if (rango !== "max" && dias.length) {
      let ultimoDia = dias[0].day;
      for (const d of dias) if (d.day > ultimoDia) ultimoDia = d.day;
      const desde = parseYmd(ultimoDia);
      desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
      diasVentana = dias.filter((d) => parseYmd(d.day) >= desde);
    }
    const aire = diasVentana.reduce((acc, d) => acc + (d.mentions || 0), 0);

    const menc = (R.menciones ?? []).filter((m) => {
      const day = m.date?.slice(0, 8);
      return Boolean(day) && day >= liveSince;
    });
    let mencVentana = menc;
    if (rango !== "max" && menc.length) {
      let ultimoDia = menc[0].date!.slice(0, 8);
      for (const m of menc) {
        const day = m.date!.slice(0, 8);
        if (day > ultimoDia) ultimoDia = day;
      }
      const desde = parseYmd(ultimoDia);
      desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
      mencVentana = menc.filter((m) => parseYmd(m.date!.slice(0, 8)) >= desde);
    }
    const programas = new Set<string>();
    const canales = new Set<string>();
    let chat = 0;
    for (const m of mencVentana) {
      if (m.program) programas.add(m.program);
      if (m.channel) canales.add(m.channel);
      if (m.origen === "chat") chat++;
    }
    return { aire, chat, programas: programas.size, canales: canales.size };
  }, [R, rango, D]);
  const imagenMeta: Record<
    ImagenTab,
    { sub: string; note: string; baseLabel: string }
  > = {
    todo: {
      sub: "Lo dicho al aire y la reacción del chat, en conjunto",
      note: "La imagen completa: programas + audiencia en vivo.",
      baseLabel: `sobre ${imagenActual.neg + imagenActual.neu + imagenActual.pos} menciones · ${rangoLabel}`,
    },
    aire: {
      sub: "Lo que dijeron los programas en vivo",
      note: "Ojo: un medio puede estar alineado o pautado.",
      baseLabel: `sobre ${imagenActual.neg + imagenActual.neu + imagenActual.pos} menciones · ${rangoLabel}`,
    },
    chat: {
      sub: "La reacción de la gente en la sala",
      note: "Más genuino: es lo que escribe la audiencia en vivo.",
      baseLabel: `sobre ${imagenActual.neg + imagenActual.neu + imagenActual.pos} mensajes · ${rangoLabel}`,
    },
  };
  // Compara el período elegido arriba (24h/48h/semana/mes) contra el período
  // inmediatamente anterior de igual duración (no solo "ayer vs hoy"), para
  // que la tendencia hable el mismo idioma que el filtro de rango.
  // "Máximo" no tiene una duración fija, así que no hay período anterior con
  // el que comparar.
  const tendencia = useMemo(() => {
    if (rango === "max" || !porDiaCompleto.length) return null;
    const dias = RANGO_DIAS[rango];
    const hastaActual = parseYmd(porDiaCompleto[porDiaCompleto.length - 1].day);
    const desdeActual = new Date(hastaActual);
    desdeActual.setDate(desdeActual.getDate() - (dias - 1));
    const hastaPrevio = new Date(desdeActual);
    hastaPrevio.setDate(hastaPrevio.getDate() - 1);
    const desdePrevio = new Date(hastaPrevio);
    desdePrevio.setDate(desdePrevio.getDate() - (dias - 1));

    const sumar = (desde: Date, hasta: Date) =>
      porDiaCompleto.reduce(
        (acc, d) => {
          const day = parseYmd(d.day);
          if (day < desde || day > hasta) return acc;
          return {
            total: acc.total + d.total,
            neg: acc.neg + d.neg,
            neu: acc.neu + d.neu,
            pos: acc.pos + d.pos,
          };
        },
        { total: 0, neg: 0, neu: 0, pos: 0 }
      );

    const actual = sumar(desdeActual, hastaActual);
    const previo = sumar(desdePrevio, hastaPrevio);
    if (!previo.total) return null;
    const pct = (row: typeof actual, k: "neg" | "pos") =>
      row.total ? Math.round((row[k] / row.total) * 100) : 0;
    return {
      actual,
      previo,
      volDelta: actual.total - previo.total,
      negActual: pct(actual, "neg"),
      negPrevio: pct(previo, "neg"),
      posActual: pct(actual, "pos"),
      posPrevio: pct(previo, "pos"),
    };
  }, [porDiaCompleto, rango]);
  const TENDENCIA_LABEL: Record<Exclude<Rango, "max">, string> = {
    "24h": "vs. las 24 hs anteriores",
    "48h": "vs. las 48 hs anteriores",
    "7d": "vs. la semana anterior",
    "30d": "vs. el mes anterior",
  };
  const comparativa = useMemo(() => {
    // Cada entidad se compara contra su propia competencia (1 por entidad).
    const rival = compByEntity[slug];
    if (!rival || rival === slug || !D.radars[rival]) return [];
    const slugs = [slug, rival];
    const seen = new Set<string>();
    const filas = slugs
      .filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return Boolean(D.radars[s]);
      })
      .map((s) => {
        const radar = D.radars[s]!;
        const img = imagenBreakdownRadar(radar);
        return {
          slug: s,
          nombre: radar.entity,
          esVos: s === slug,
          menciones: mencionesRadar(radar),
          negPct: img.negPct,
          neuPct: img.neuPct,
          posPct: img.posPct,
          net: img.net,
          verdicto: img.verdicto,
          verdictoCls: img.cls,
          crisis: Boolean(radar.crisis),
        };
      });
    // Share of voice: cada uno sobre el total del set comparado (así el versus
    // es real, no menciones absolutas sueltas al lado de un % de base propia).
    const totalSet = filas.reduce((acc, f) => acc + f.menciones, 0) || 1;
    return filas
      .map((f) => ({ ...f, sovPct: Math.round((f.menciones / totalSet) * 100) }))
      .sort((a, b) => b.menciones - a.menciones);
  }, [slug, compByEntity, D]);

  // Comparación dinámica: contra todas las entidades del mismo rubro (D.index
  // ya trae el type de cada una), no solo el rival fijo elegido en el
  // onboarding. Muestra la entidad en foco + hasta 7 más, priorizando por
  // volumen de menciones para el subset visible; la posición (ranking) se
  // calcula por imagen negativa contra TODO el rubro (no solo las 8 visibles).
  const comparativaRubro = useMemo(() => {
    const mismoRubro = D.index.filter((r) => r.type === R.type && D.radars[r.slug]);
    const otras = mismoRubro
      .filter((r) => r.slug !== slug)
      .map((r) => ({ slug: r.slug, menciones: mencionesRadar(D.radars[r.slug]!) }))
      .sort((a, b) => b.menciones - a.menciones)
      .slice(0, 7)
      .map((r) => r.slug);
    const slugsSet = Array.from(new Set([slug, ...otras])).filter((s) => D.radars[s]);
    const filas = slugsSet.map((s) => {
      const radar = D.radars[s]!;
      const img = imagenBreakdownRadar(radar);
      return {
        slug: s,
        nombre: radar.entity,
        esVos: s === slug,
        menciones: mencionesRadar(radar),
        negPct: img.negPct,
        neuPct: img.neuPct,
        posPct: img.posPct,
        net: img.net,
        verdicto: img.verdicto,
        verdictoCls: img.cls,
        crisis: Boolean(radar.crisis),
      };
    });
    const totalSet = filas.reduce((acc, f) => acc + f.menciones, 0) || 1;
    const filasConSov = filas
      .map((f) => ({ ...f, sovPct: Math.round((f.menciones / totalSet) * 100) }))
      .sort((a, b) => b.menciones - a.menciones);
    // Ranking por imagen negativa dentro de TODO el rubro (no solo el subset
    // de hasta 8 que se ve en la tabla de abajo): es la métrica que le
    // importa a un asesor de imagen y a los medios argentinos — cuánto
    // negativo hay, no cuánto se habla. Puesto 1 = menos negativa.
    const posicion =
      [...mismoRubro]
        .map((r) => ({ slug: r.slug, negPct: imagenBreakdownRadar(D.radars[r.slug]!).negPct }))
        .sort((a, b) => a.negPct - b.negPct)
        .findIndex((r) => r.slug === slug) + 1;
    return { filas: filasConSov, posicion, totalRubro: mismoRubro.length, rubro: R.type };
  }, [D, R, slug]);

  const filasActivas = compView === "rubro" ? comparativaRubro.filas : comparativa;
  // Mejor / peor imagen del set activo: rankeo por net (pos − neg). Responde de
  // una "¿quién tiene mejor y peor imagen?" sin leer toda la tabla.
  const imagenRanking = useMemo(() => {
    if (filasActivas.length < 2) return null;
    const orden = [...filasActivas].sort((a, b) => b.net - a.net);
    return { mejor: orden[0], peor: orden[orden.length - 1] };
  }, [filasActivas]);
  // Mismo recorte de fechas que el resto de "Imagen" (porDia/porCanal): sin
  // esto, "Qué se dice" podía mostrar citas de meses atrás aunque el hero de
  // arriba diga "24 h" — rompía la promesa de trazabilidad (click en el % →
  // ver las citas que arman ESE número, no citas de cualquier momento).
  const feedPeriodo = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    const cards = (R.feed ?? []).filter((c) => {
      const day = c.date?.slice(0, 8);
      return Boolean(day) && day >= liveSince;
    });
    if (rango === "max" || !cards.length) return cards;
    let ultimoDia = cards[0].date.slice(0, 8);
    for (const c of cards) {
      const day = c.date.slice(0, 8);
      if (day > ultimoDia) ultimoDia = day;
    }
    const desde = parseYmd(ultimoDia);
    desde.setDate(desde.getDate() - (RANGO_DIAS[rango] - 1));
    return cards.filter((c) => parseYmd(c.date.slice(0, 8)) >= desde);
  }, [R, rango, D]);
  const feed = tab === "neg" ? feedPeriodo.filter((f) => f.sentiment === "neg") : feedPeriodo;
  const feedVisible = feed.slice(0, feedShow);

  // Detalle fino: menciones del período elegido (aire + chat), nuevo→viejo.
  const logAll = R.menciones ?? [];
  const logRangoLabel = RANGO_OPTS.find((r) => r.id === logRango)?.label ?? "el período";
  const logEnRango = useMemo(() => {
    const liveSince = D.live_since || LIVE_SINCE_DEFAULT;
    return mencionesEnRango(logAll, logRango, liveSince);
  }, [logAll, logRango, D.live_since]);
  const logFiltered = useMemo(() => {
    return logOrigen === "todas"
      ? logEnRango
      : logEnRango.filter((m) => m.origen === logOrigen);
  }, [logEnRango, logOrigen]);
  const logVisible = logFiltered.slice(0, logShow);
  const logCorpusTotal =
    (R.menciones_total?.aire ?? 0) + (R.menciones_total?.chat ?? 0);
  const logLoadedCount = logAll.length;
  const logTruncated = logCorpusTotal > logLoadedCount;

  // Co-menciones: pares donde esta entidad cruza con otra (mismo programa / bloque 10 min).
  const crucesPairs = useMemo(() => {
    const all = (D as Data).comenciones ?? [];
    return all
      .filter((p) => p.par.includes(slug))
      .sort((a, b) => b.cruces_total - a.cruces_total)
      .slice(0, 4);
  }, [D, slug]);

  if (!accountReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9]">
        <p className="text-sm text-slate-500">Cargando tu panel…</p>
      </main>
    );
  }

  // PAYWALL: la prueba venció (o la cuenta está cortada) y no pagó → bloqueamos.
  if (trial && !trial.ok) {
    if (trial.kind === "blocked") {
      return (
        <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-5 py-10 text-slate-900">
          <div className="w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
              style={{ backgroundColor: BRAND }}
            >
              🔒
            </div>
            <h1 className="mt-4 text-2xl font-bold">Tu cuenta está pausada</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              Escribinos y la reactivamos en el momento.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={whatsappPagoUrl(email)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Escribir por WhatsApp
              </a>
              <a
                href={`mailto:${PAGO.email}?subject=${encodeURIComponent(`${APP_NAME} - reactivar cuenta`)}`}
                className="text-[13px] font-medium text-slate-500 hover:text-slate-800"
              >
                o escribinos a {PAGO.email}
              </a>
            </div>
          </div>
        </main>
      );
    }
    if (palcoAccount) {
      return <PaywallExpired account={palcoAccount} email={email || palcoAccount.email} />;
    }
  }

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
          <div className="flex items-center gap-2 sm:gap-3 text-[13px]">
            {trial?.kind === "trial" ? (
              <a
                href={whatsappPagoUrl(email)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-signal-line bg-signal-soft px-3 py-1 font-medium hover:opacity-90"
                style={{ color: BRAND }}
                title="Activar mi plan"
              >
                Prueba
                {trial.diasRestantes > 0
                  ? ` · ${trial.diasRestantes} día${trial.diasRestantes === 1 ? "" : "s"}`
                  : ""}
              </a>
            ) : (
              plan && (
                <span className="hidden sm:inline-block rounded-full border border-signal-line bg-signal-soft px-3 py-1 font-medium" style={{ color: BRAND }}>
                  Plan {PLAN_LABEL[plan] || plan}
                </span>
              )
            )}
            <button
              onClick={() => setShowAvisos(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:border-slate-400"
            >
              ⚙ Ajustes
            </button>
          </div>
        </div>
      </div>

      {/* ---------- panel de Avisos (gobernanza / settings) ----------
          Sheet: bottom sheet en mobile (sube desde abajo, con handle),
          drawer lateral en desktop — ver src/components/Sheet.tsx. */}
      <Sheet open={showAvisos} onClose={() => setShowAvisos(false)}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold">Ajustes</h2>
                <p className="text-[12px] text-slate-500">A quién monitoreo y cuándo te avisamos.</p>
              </div>
              <button
                onClick={() => setShowAvisos(false)}
                className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] text-slate-500 hover:border-slate-400 sm:block"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* a quién monitoreo */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  A quién monitoreo
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {watch.map((s) => {
                      const row = D.index.find((r) => r.slug === s);
                      if (!row) return null;
                      return (
                        <span
                          key={s}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600"
                        >
                          {row.name}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const p = new URLSearchParams(window.location.search);
                      p.set("edit", "1");
                      router.push(`/onboarding?${p.toString()}`);
                    }}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-slate-400"
                  >
                    Editar
                  </button>
                </div>
              </div>

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
                            ? "border-signal bg-signal-soft ring-2 ring-signal-ring"
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
                      ? "border-signal bg-signal-soft ring-2 ring-signal-ring"
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
                            ? "border-signal bg-signal-soft ring-2 ring-signal-ring"
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
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] outline-none focus:border-signal focus:ring-2 focus:ring-signal-ring sm:text-[14px]"
                />
              </div>

              <button
                type="button"
                onClick={() => void guardarAvisos()}
                className="w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Guardar
              </button>
            </div>
      </Sheet>

      <div className="mx-auto max-w-[1100px] px-5 py-8">
        {/* Top del catálogo: colapsado por default, arriba de todo. Vidriera
            de TODO streaming argentino trackeado (no solo tu watchlist):
            quién más se habla y quién tiene mejor/peor imagen, acumulado en
            la ventana elegida (24 h / semana / mes). */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setTopCatalogoAbierto((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Top del catálogo
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-400">
                Todo streaming argentino que trackeamos ({D.index.length} entidades) — no solo lo que seguís
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-medium text-slate-500">
              {topCatalogoAbierto ? "Ocultar ▲" : "Ver ▼"}
            </span>
          </button>

          {topCatalogoAbierto && (
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* tabs: qué ranking */}
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[13px]">
                  {(
                    [
                      { id: "menciones", label: "Más mencionados" },
                      { id: "positiva", label: "Mejor imagen" },
                      { id: "negativa", label: "Peor imagen" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTopCatalogoTab(t.id)}
                      className={`rounded-md px-3 py-1.5 font-medium ${
                        topCatalogoTab === t.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* ventana: 24 h / semana / mes */}
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[13px]">
                  {TOP_RANGO_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTopRango(id)}
                      className={`rounded-md px-3 py-1.5 font-medium ${
                        topRango === id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {RANGO_OPTS.find((r) => r.id === id)?.label ?? id}
                    </button>
                  ))}
                </div>
              </div>

              <ol className="mt-3 divide-y divide-slate-100">
                {topCatalogo[topCatalogoTab].map((r, i) => (
                  <li key={r.slug} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {r.name}
                        </p>
                        <p className="text-[11px] text-slate-400">{r.type}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[12px]">
                      {topCatalogoTab === "menciones" ? (
                        <span className="font-semibold tabular-nums text-slate-700">
                          {compact(r.mentions)} menc.
                        </span>
                      ) : (
                        <span
                          className={`font-semibold tabular-nums ${
                            topCatalogoTab === "positiva" ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {topCatalogoTab === "positiva" ? r.posPct : r.negPct}%{" "}
                          {topCatalogoTab === "positiva" ? "positivo" : "negativo"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {topCatalogo[topCatalogoTab].length === 0 && (
                <p className="mt-3 text-center text-[12px] text-slate-400">
                  Todavía no hay suficientes menciones en esta ventana para armar el ranking.
                </p>
              )}
            </div>
          )}
        </section>

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
                  type="button"
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

        {/* selector de entidad (oculto cuando solo hay una entidad en el
            monitoreo — con una sola opción, el buscador era puro ruido antes
            de llegar a la respuesta). Con varias, alcanza con chips para
            cambiar rápido; el buscador completo (input + categorías +
            "no lo encontramos") queda colapsado a pedido. */}
        {watch.length > 1 && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {!buscarAbierto ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {baseIndex.map((r) => {
                  const active = r.slug === slug;
                  return (
                    <button
                      key={r.slug}
                      onClick={() => {
                        setSlug(r.slug);
                        setTab("todas");
                        setFeedShow(6);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-left text-[12px] transition ${
                        active
                          ? "border-signal bg-signal-soft text-signal"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      <span className="font-medium">{r.name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setBuscarAbierto(true)}
                className="shrink-0 text-[12px] font-medium hover:underline"
                style={{ color: BRAND }}
              >
                + buscar otra
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[12px] font-medium text-slate-500">
                  ¿A quién querés monitorear?
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBuscarAbierto(false);
                    setQuery("");
                    setCat("todas");
                  }}
                  className="text-[12px] font-medium text-slate-400 hover:text-slate-700"
                >
                  cerrar ✕
                </button>
              </div>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribí un nombre — persona, marca, tema…"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] text-slate-900 placeholder-slate-400 outline-none focus:border-signal focus:ring-2 focus:ring-signal-ring sm:text-[15px]"
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
                      setCat("todas");
                      setBuscarAbierto(false);
                      setTab("todas");
                      setFeedShow(6);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-left text-[12px] transition ${
                      active
                        ? "border-signal bg-signal-soft text-signal"
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
            </>
          )}
        </section>
        )}

        {/* header entidad */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 mt-6">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-slate-400">{R.type}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Radar de {R.entity} en el streaming
            </h1>
            <p className="mt-1 text-[14px] text-slate-500">
              Qué se dice · dónde · con qué imagen
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Monitoreo activo</p>
            <div className="mt-1">
              <WatchlistTerms radar={R} />
            </div>
          </div>
        </header>

        {/* alerta de crisis — lo más urgente, antes que cualquier otra lectura */}
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
                  <span className="text-red-600">🔴 imagen negativa</span>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  <b className="text-slate-700">Por qué es crisis:</b> mención + audiencia alta + chat
                  disparado + imagen negativa, todo al mismo tiempo. Nadie más puede computar este cruce.
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

        {/* ---------------------------------------------------------------
            HERO: responde "qué pasó con esta persona" en un solo bloque —
            veredicto de imagen, tendencia vs. ayer, evolución día a día y
            volumen. La barra de imagen es clickeable: lleva a "Qué se dice"
            ya filtrado por tono (trazabilidad: del % a la cita real). ---- */}
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Imagen
              </h2>
              <p className="mt-1 text-[12px] text-slate-400">
                Qué pasó, con qué imagen y cómo viene en el tiempo
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
                {(
                  [
                    { id: "todo" as const, label: "Todo" },
                    { id: "aire" as const, label: "Al aire" },
                    { id: "chat" as const, label: "Chat" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setImagenTab(t.id)}
                    className={`rounded-md px-3 py-1 ${
                      imagenTab === t.id
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
                <div className="flex w-max gap-1">
                  {RANGO_OPTS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRango(r.id)}
                      className={`shrink-0 rounded-md px-3 py-1 ${
                        rango === r.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-2xl font-bold ${veredictoActual.cls}`}>{veredictoActual.texto}</p>
              <p className="text-[12px] text-slate-400">
                {imagenTotalActual
                  ? volumenTotalRango > imagenTotalActual
                    ? `${compact(volumenTotalRango)} menciones · imagen sobre ${compact(
                        imagenTotalActual
                      )} ya clasificadas (${Math.round(
                        (imagenTotalActual / volumenTotalRango) * 100
                      )}%) · ${rangoLabel}`
                    : `sobre ${imagenTotalActual} ${imagenTab === "chat" ? "mensajes" : "menciones"} · ${rangoLabel}`
                  : volumenTotalRango > 0
                    ? `${compact(volumenTotalRango)} menciones · todavía sin imagen clasificada · ${rangoLabel}`
                    : "sin datos aún"}
              </p>
            </div>

            {tendencia && (
              <p className="mt-1 text-[13px] text-slate-600">
                <span className="tabular-nums">
                  {compact(tendencia.previo.total)} → {compact(tendencia.actual.total)} menciones
                </span>{" "}
                {tendencia.volDelta > 0 ? (
                  <span className="font-medium" style={{ color: BRAND }}>
                    (hablan más)
                  </span>
                ) : tendencia.volDelta < 0 ? (
                  <span className="font-medium text-slate-600">(hablan menos)</span>
                ) : (
                  <span className="text-slate-500">(mismo volumen)</span>
                )}
                {" · "}
                {TENDENCIA_LABEL[rango as Exclude<Rango, "max">]}
                {", imagen negativa "}
                <span className="tabular-nums">
                  {tendencia.negPrevio}% → {tendencia.negActual}%
                </span>
                {tendencia.negActual > tendencia.negPrevio + 2 ? (
                  <span className="ml-1 font-medium text-red-600">empeoró</span>
                ) : tendencia.negActual < tendencia.negPrevio - 2 ? (
                  <span className="ml-1 font-medium text-emerald-600">mejoró</span>
                ) : (
                  <span className="ml-1 text-slate-400">estable</span>
                )}
              </p>
            )}

            {imagenTotalActual > 0 ? (
              <>
                <div
                  className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-slate-100"
                  title="Imagen del período: rojo negativa, gris neutra, verde positiva"
                >
                  <div className="h-full bg-red-500" style={{ width: `${negPctActual}%` }} />
                  <div className="h-full bg-slate-400" style={{ width: `${neuPctActual}%` }} />
                  <div className="h-full bg-emerald-500" style={{ width: `${posPctActual}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("neg");
                      setFeedShow(6);
                      document
                        .getElementById("que-se-dice")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="text-slate-600 hover:underline"
                  >
                    🔴 {negPctActual}% negativa{" "}
                    <span className="text-slate-400">({imagenActual.neg}) · ver citas →</span>
                  </button>
                  <span className="text-slate-500">
                    ⚪ {neuPctActual}% neutra <span className="text-slate-400">({imagenActual.neu})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("todas");
                      setFeedShow(6);
                      document
                        .getElementById("que-se-dice")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="text-slate-600 hover:underline"
                  >
                    🟢 {posPctActual}% positiva{" "}
                    <span className="text-slate-400">({imagenActual.pos}) · ver citas →</span>
                  </button>
                </div>
                {/* Cobertura baja: la mayoría del volumen de este período todavía
                    no tiene tono clasificado (barras grises abajo). Sin esto, el
                    veredicto de arriba parece "roto" — en realidad está bien
                    calculado, pero sobre una muestra chica del total. */}
                {volumenTotalRango > imagenTotalActual * 1.5 && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    ⚠ El veredicto de arriba se calcula solo sobre{" "}
                    {compact(imagenTotalActual)} de {compact(volumenTotalRango)} menciones (
                    {Math.round((imagenTotalActual / volumenTotalRango) * 100)}%) — las que ya
                    tienen tono clasificado. El resto ({compact(volumenTotalRango - imagenTotalActual)}
                    ) todavía no fue procesado por el clasificador de sentimiento; por eso las
                    barras grises abajo no suman al %.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 text-[13px] text-slate-400">
                Todavía sin mensajes clasificados para este período.
              </p>
            )}

            {porDia.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Cómo evolucionó
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  Barras = cuánto se habló cada día · franja de color = imagen ese día
                  {porDia.some((d) => d.sinDato) && " · gris = todavía sin dato de imagen"}
                </p>
                {/* Con rangos largos (30 días o "máximo") hay demasiadas barras para
                    achicarlas a lo ancho de un teléfono sin que queden ilegibles.
                    A partir de 15 barras, en vez de comprimir todo, les damos un
                    ancho mínimo fijo y dejamos que este bloque scrollee horizontal
                    (patrón mobile: scroll lateral en vez de apretar contenido). */}
                <div className="mt-5 overflow-x-auto">
                  <div
                    className={`flex h-48 gap-1.5 ${porDia.length > 14 ? "" : "w-full"}`}
                    style={porDia.length > 14 ? { minWidth: `${porDia.length * 18}px` } : undefined}
                  >
                  {(() => {
                    // Con rangos largos (30 días o "máximo") hay demasiadas barras
                    // para poner un número y una fecha arriba/abajo de cada una sin
                    // que se pisen — se ve sucio. A partir de 15 barras se apoya
                    // solo en la altura + el tooltip, y se muestran ~8 fechas guía.
                    const denso = porDia.length > 14;
                    const pasoFecha = denso ? Math.ceil(porDia.length / 8) : 1;
                    return porDia.map((d, i) => {
                      const volPct = d.total / maxDiaVol;
                      const mostrarFecha = !denso || i % pasoFecha === 0 || i === porDia.length - 1;
                      return (
                        <div
                          key={d.day}
                          className={
                            denso
                              ? "flex w-[16px] shrink-0 flex-col h-full"
                              : "flex min-w-0 flex-1 flex-col h-full"
                          }
                          title={
                            d.sinDato
                              ? `${fmtDay(d.day)}: ${d.total} menciones · imagen: sin datos todavía`
                              : `${fmtDay(d.day)}: ${d.total} menciones · ${pctImagen(d, "neg")}% neg · ${pctImagen(d, "pos")}% pos`
                          }
                        >
                          {!denso && (
                            <span className="shrink-0 text-center text-[10px] tabular-nums text-slate-400">
                              {compact(d.total)}
                            </span>
                          )}
                          <div className="flex min-h-0 flex-1 items-end pt-1">
                            <div
                              className="w-full rounded-t"
                              style={{
                                height: `${Math.max(volPct * 100, d.total > 0 ? 6 : 0)}%`,
                                minHeight: d.total > 0 ? 4 : 0,
                                background: d.sinDato
                                  ? "linear-gradient(to top, #94a3b8, #cbd5e1)"
                                  : `linear-gradient(to top, ${BRAND}, #f0a44e)`,
                              }}
                            />
                          </div>
                          <div className="mt-1 shrink-0">
                            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                              {d.sinDato ? (
                                <div className="w-full bg-slate-200" />
                              ) : d.total > 0 ? (
                                <>
                                  <div
                                    className="bg-red-500"
                                    style={{ width: `${(d.neg / d.total) * 100}%` }}
                                  />
                                  <div
                                    className="bg-slate-400"
                                    style={{ width: `${(d.neu / d.total) * 100}%` }}
                                  />
                                  <div
                                    className="bg-emerald-500"
                                    style={{ width: `${(d.pos / d.total) * 100}%` }}
                                  />
                                </>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 pt-1 text-center text-[9px] text-slate-400">
                            {mostrarFecha ? fmtDay(d.day) : ""}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-4 text-[11px] text-slate-400">{imagenMeta[imagenTab].note}</p>
          </div>

          {/* contexto de volumen del mismo período — secundario, no compite
              con el veredicto, pero ahora sí cuenta la misma historia */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "Al aire", v: compact(statsPeriodo.aire), s: `en transcripción · ${rangoLabel}` },
              { k: "En el chat", v: compact(statsPeriodo.chat), s: "la sala hablando" },
              { k: "Programas", v: String(statsPeriodo.programas), s: "lo nombraron" },
              { k: "Canales", v: String(statsPeriodo.canales), s: "cobertura" },
            ].map((kpi) => (
              <div key={kpi.k} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{kpi.k}</p>
                <p className="text-[18px] font-bold tabular-nums text-slate-800">{kpi.v}</p>
                <p className="text-[10.5px] text-slate-400">{kpi.s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            QUÉ SE DICE: citas reales que explican el número de arriba, no
            solo un porcentaje. Responde "con qué tono se habla de esta
            persona", con evidencia (clip / mensaje de chat) por cada una. -- */}
        <section id="que-se-dice" className="mt-10 scroll-mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Qué se dice
              </h2>
              <p className="mt-1 max-w-xl text-[12px] text-slate-400">
                Una cita al aire por programa donde apareció, con qué tono, ordenada por
                audiencia en vivo — del mismo período elegido arriba ({rangoLabel}). No es el
                listado completo — eso está en{" "}
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
                  {t === "todas" ? "Todas" : "Imagen negativa"}
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

        {/* ---------------------------------------------------------------
            DÓNDE SE HABLA MÁS: por canal, con qué tono. Cada canal se abre
            para ver las citas reales que arman ese número (trazabilidad). -- */}
        {porCanal.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Dónde se habla más
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">
              {imagenTab === "todo"
                ? "Por canal · aire y chat juntos"
                : imagenTab === "aire"
                  ? "Por canal · solo lo dicho al aire"
                  : "Por canal · solo el chat de la audiencia"}
              {" · "}
              {rangoLabel} · tocá un canal para ver las citas
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {porCanal.map((c) => {
                  const dom = imagenDominante(c);
                  const abierto = canalAbierto === c.channel;
                  const citas = (mencionesPorCanalMap.get(c.channel) ?? [])
                    .slice()
                    .sort((a, b) => (b.conc_at ?? 0) - (a.conc_at ?? 0))
                    .slice(0, 3);
                  return (
                    <div key={c.channel} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setCanalAbierto(abierto ? null : c.channel)}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left hover:opacity-80"
                      >
                        <span className="w-28 shrink-0 truncate text-[12px] font-medium text-slate-700">
                          {c.channel}
                        </span>
                        <div className="h-3 w-20 shrink-0 overflow-hidden rounded bg-slate-100 sm:w-28">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${(c.total / maxCanal) * 100}%`,
                              backgroundColor: BRAND,
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-slate-500">
                          {compact(c.total)}
                        </span>
                        <MiniImagenBar s={c} />
                        {dom && (
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${SENT[dom].cls}`}
                          >
                            {SENT[dom].dot}
                            <span className="hidden sm:inline">
                              {" "}
                              {dom === "neg" ? "negativa" : dom === "pos" ? "positiva" : "neutra"}
                            </span>
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                          <span className="sm:hidden">{abierto ? "▲" : "▼"}</span>
                          <span className="hidden sm:inline">{abierto ? "ocultar citas ▲" : "ver citas ▼"}</span>
                        </span>
                      </button>
                      {abierto && (
                        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                          {citas.length === 0 ? (
                            <p className="text-[12px] text-slate-400">
                              Sin citas textuales para este canal en el período.
                            </p>
                          ) : (
                            citas.map((m, i) => {
                              const s = m.sentiment ? SENT[m.sentiment] : null;
                              const esChat = m.origen === "chat";
                              return (
                                <p
                                  key={m.video_id + m.origen + m.t_seconds + i}
                                  className="text-[12.5px] leading-relaxed text-slate-700"
                                >
                                  <span className={esChat ? "" : "italic"}>
                                    {esChat ? m.text : <>&ldquo;{m.quote}&rdquo;</>}
                                  </span>
                                  <span className="ml-2 text-slate-400">
                                    {m.program} · {fmtDay(m.date)} · {m.t_label}
                                  </span>
                                  {s && (
                                    <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${s.cls}`}>
                                      {s.dot} {s.label}
                                    </span>
                                  )}
                                  {!esChat && (
                                    <a
                                      href={m.yt_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-2 font-medium hover:underline"
                                      style={{ color: BRAND }}
                                    >
                                      ver clip
                                    </a>
                                  )}
                                </p>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------
            Contexto secundario: cómo estoy vs. el rubro / mi competencia, y
            cruces con otras entidades. Responden otra pregunta ("cómo estoy
            vs. otros"), no "qué pasó con esta persona" — quedan más abajo. */}
          <section className="mt-12 border-t border-slate-200 pt-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  Comparación
                </h2>
                <p className="mt-1 max-w-xl text-[12px] text-slate-400">
                  {compView === "rubro"
                    ? `Cuánto se habla de cada ${R.type.toLowerCase()} y con qué tono (histórico completo). Cada fila muestra su propio reparto: % negativo, neutro y positivo.`
                    : "Cuánto se habla de cada uno y con qué tono (histórico completo). Cada fila muestra su propio reparto de menciones."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setCompView("rubro")}
                    className={`rounded-md px-3 py-1 ${
                      compView === "rubro" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Todo el rubro
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompView("fija")}
                    className={`rounded-md px-3 py-1 ${
                      compView === "fija" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Mi competencia
                  </button>
                </div>
                {compView === "fija" && (
                  <button
                    type="button"
                    onClick={() => router.push("/onboarding?edit=1&paso=competencia")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-slate-400"
                  >
                    Editar competencia
                  </button>
                )}
              </div>
            </div>
            {compView === "rubro" && comparativaRubro.totalRubro > 1 && (
              <p className="mb-3 text-[13px] text-slate-600">
                <b>{R.entity}</b> está en el puesto{" "}
                <b className="tabular-nums">{comparativaRubro.posicion}</b> de{" "}
                <b className="tabular-nums">{comparativaRubro.totalRubro}</b> en imagen negativa
                dentro de {R.type.toLowerCase()} (puesto 1 = menos negativa). Se muestran{" "}
                {R.entity} y los 7 con más volumen del rubro.
              </p>
            )}
            {filasActivas.length > 1 && imagenRanking && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Mejor imagen en este set
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[15px] font-semibold text-slate-800">
                      {imagenRanking.mejor.nombre}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {imagenRanking.mejor.posPct}% positivo · {imagenRanking.mejor.negPct}% negativo
                    <span className="text-emerald-600 font-medium">
                      {" "}
                      · balance +{imagenRanking.mejor.net} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Gana quien tiene mayor diferencia positivo − negativo.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Peor imagen en este set
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-[15px] font-semibold text-slate-800">
                      {imagenRanking.peor.nombre}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {imagenRanking.peor.negPct}% negativo · {imagenRanking.peor.posPct}% positivo
                    <span className="text-red-600 font-medium">
                      {" "}
                      · balance {imagenRanking.peor.net >= 0 ? "+" : ""}
                      {imagenRanking.peor.net} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Pierde quien acumula más negativo que positivo.
                  </p>
                </div>
              </div>
            )}
            {filasActivas.length > 1 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 font-semibold">Nombre</th>
                      <th className="px-4 py-3 font-semibold" title="Cuánto se habla de cada uno: menciones totales y qué parte de la charla del set comparado se lleva.">
                        Se habla de
                      </th>
                      <th className="px-4 py-3 font-semibold" title="Reparto del tono en sus menciones: % negativo, neutro y positivo (histórico). La etiqueta usa el % negativo; el ranking mejor/peor usa positivo − negativo.">
                        Imagen (tono)
                      </th>
                      <th className="hidden px-4 py-3 font-semibold sm:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasActivas.map((f) => (
                      <tr
                        key={f.slug}
                        className={`border-b border-slate-50 last:border-0 ${
                          f.esVos ? "bg-signal-soft/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSlug(f.slug);
                              setTab("todas");
                            }}
                            className={`text-left font-semibold hover:underline ${
                              f.esVos ? "" : "text-slate-800"
                            }`}
                            style={f.esVos ? { color: BRAND } : undefined}
                          >
                            {f.nombre}
                          </button>
                          {f.esVos && (
                            <span className="ml-2 text-[10px] font-medium uppercase text-slate-400">
                              en foco
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="tabular-nums font-medium text-slate-800">
                            {compact(f.menciones)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {f.sovPct}% de la charla
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex w-36 justify-between text-[10px] tabular-nums leading-none"
                            title={`${f.negPct}% negativo · ${f.neuPct}% neutro · ${f.posPct}% positivo`}
                          >
                            <span className="font-medium text-red-600">{f.negPct}%</span>
                            <span className="text-slate-400">{f.neuPct}%</span>
                            <span className="font-medium text-emerald-600">{f.posPct}%</span>
                          </div>
                          <div
                            className="mt-1 flex h-2.5 w-36 overflow-hidden rounded-full bg-slate-100"
                            title="Rojo = negativo · gris = neutro · verde = positivo"
                          >
                            {f.negPct > 0 && (
                              <div className="h-full bg-red-500" style={{ width: `${f.negPct}%` }} />
                            )}
                            {f.neuPct > 0 && (
                              <div className="h-full bg-slate-300" style={{ width: `${f.neuPct}%` }} />
                            )}
                            {f.posPct > 0 && (
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${f.posPct}%` }}
                              />
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                            <span className={`font-medium ${f.verdictoCls}`}>{f.verdicto}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 tabular-nums">
                              balance {f.net >= 0 ? "+" : ""}
                              {f.net}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            neg · neutro · pos
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {f.crisis ? (
                            <span className="text-[12px] font-medium text-red-600">🚨 crisis</span>
                          ) : (
                            <span className="text-[12px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
                  Cada fila es independiente: los % suman 100 sobre las menciones clasificadas de
                  esa persona. &ldquo;Positiva&rdquo; = menos del 25% negativo; &ldquo;Negativa&rdquo;
                  = 40% o más negativo. Mejor/peor del set = mayor/menor balance (positivo −
                  negativo).
                </p>
              </div>
            ) : compView === "rubro" ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
                <p className="text-[14px] text-slate-600">
                  Todavía no hay más perfiles con radar activo en {R.type.toLowerCase()} para
                  comparar. En cuanto sumemos más entidades del rubro, aparecen acá solas.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
                <p className="text-[14px] text-slate-600">
                  Elegí un rival fijo para comparar volumen e imagen en el streaming.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding?edit=1&paso=competencia")}
                  className="mt-3 rounded-lg px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Elegir competencia
                </button>
              </div>
            )}
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

        {/* TODO lo que se dijo — línea de tiempo completa (aire + chat), nuevo→viejo */}
        <section id="detalle-menciones" className="mt-8 scroll-mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">
                Todo lo que se dijo
              </h2>
              <p className="mt-0.5 max-w-2xl text-[13px] text-slate-500">
                Menciones del período elegido ({logRangoLabel}), del más nuevo al más viejo — al
                aire y en el chat. Una cita por ocurrencia (no una sola por programa como arriba).
                {logCorpusTotal > 0 && (
                  <>
                    {" "}
                    <span className="text-slate-400">
                      Corpus: {compact(logCorpusTotal)} totales
                      {R.menciones_total && (
                        <>
                          {" "}
                          ({compact(R.menciones_total.aire)} al aire ·{" "}
                          {compact(R.menciones_total.chat)} en el chat)
                        </>
                      )}
                      {logLoadedCount > 0 && (
                        <>
                          {" "}
                          · acá ves las {compact(logLoadedCount)} más recientes cargadas
                        </>
                      )}
                      .
                    </span>
                  </>
                )}
              </p>
              {logTruncated && (
                <p className="mt-2 max-w-2xl rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  No entran todas en el panel: el dataset trae las {compact(logLoadedCount)} más
                  nuevas de {compact(logCorpusTotal)}. Los totales de arriba sí usan el corpus
                  completo; este listado es una muestra reciente para navegar citas.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
                {RANGO_OPTS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setLogRango(r.id);
                      setLogShow(20);
                    }}
                    className={`rounded-md px-2.5 py-1 ${
                      logRango === r.id
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
              {(["todas", "aire", "chat"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    setLogOrigen(o);
                    setLogShow(20);
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
          </div>

          {logVisible.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center text-[13px] text-slate-400">
              No hay menciones en {logRangoLabel.toLowerCase()} para este filtro.
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
                onClick={() => setLogShow((n) => n + 20)}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-400"
              >
                Ver más ({logFiltered.length - logShow} restantes en {logRangoLabel.toLowerCase()})
              </button>
            </div>
          )}

          {logFiltered.length > 0 &&
            logFiltered.length <= logShow &&
            logTruncated &&
            logRango === "max" &&
            logOrigen === "todas" && (
              <p className="mt-4 text-center text-[12px] text-slate-400">
                Llegaste al tope de lo cargado ({compact(logLoadedCount)}). Quedan{" "}
                {compact(logCorpusTotal - logLoadedCount)} menciones más antiguas fuera del panel.
              </p>
            )}
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
          {APP_NAME} · datos capturados del streaming argentino en vivo
          <> · elegí otra entidad arriba para cambiar el radar</>
        </footer>
      </div>
    </div>
  );
}
