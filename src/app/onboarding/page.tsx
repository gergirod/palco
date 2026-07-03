"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import data from "@/data/palco_entities.json";
import catalogData from "@/data/palco_catalog.json";
import {
  authEnabled,
  getSession,
} from "@/lib/supabase-auth";
import {
  dashboardQueryFromAccount,
  isPalcoAccountConfigured,
  loadPalcoAccount,
  type PendingPalcoAccount,
  savePalcoAccount,
} from "@/lib/palco-account";
import { buildCatalogBrowseRows, type CatalogBrowseRow } from "@/lib/palco-catalog-browse";
import { fetchDatasets } from "@/lib/supabase";
import { displayAlias, matchesQuery } from "@/lib/palco-watchlist";
import { TRIAL_DIAS, TRIAL_PLAN, TRIAL_LIMITE } from "@/config/trial";

/* ============================================================================
   Palco · Onboarding
   Flujo sin fricción: bienvenida → elegir a quién seguir → cómo lo dicen →
   avisos → listo. Sin planes ni precio: todos entran con una PRUEBA GRATIS
   que simula el plan Pro (hasta 3 nombres). El corte lo maneja la DB
   (palco_accounts.trial_ends_at). Path inicial: /onboarding
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
const ENTITIES_BUNDLED = data as unknown as {
  index: IndexRow[];
  radars: Record<string, { watchlist_display?: { alias?: string[] } }>;
  comenciones?: ComencionPar[];
};
const INDEX = ENTITIES_BUNDLED.index;

type CatalogCurated = {
  slug: string;
  name: string;
  type: string;
  alias: string[];
  in_palco_entities?: boolean;
};
type CatalogCandidate = {
  slug_guess: string;
  canonical_guess: string;
  forms: string[];
  kind: string;
  mentions: number;
  programs: number;
  channels?: number;
  linked_slug?: string | null;
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
const COMENCIONES_BUNDLED = ENTITIES_BUNDLED.comenciones ?? [];
const BUNDLED_ROWS = buildCatalogBrowseRows(
  CATALOG,
  INDEX,
  ENTITIES_BUNDLED.radars
);

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
const CATS = ["Todas", "Político", "Deporte", "Música", "Empresa"] as const;
/** Sin búsqueda/filtro: mostramos un lote y "Ver todas" para no renderizar 400+ cards de golpe. */
const CATALOG_BATCH = 48;

/* ---------- barra fija abajo: Seguir siempre visible sin scrollear todo el catálogo ---------- */
function OnboardingStepFooter({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled,
  nextLoading,
  summary,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  summary?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex max-w-[1000px] items-center gap-3 px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-[14px] text-slate-500 hover:text-slate-800"
        >
          {backLabel}
        </button>
        {summary ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            {summary}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
          className="shrink-0 rounded-lg px-6 py-2.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: BRAND }}
        >
          {nextLoading ? "Guardando…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------- UI: barra de sentimiento mini ---------- */
function MiniSent({ r }: { r: { neg: number; neu: number; pos: number } }) {
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
type Paso =
  | "bienvenida"
  | "plan"
  | "entidades"
  | "competencia"
  | "alias"
  | "avisos"
  | "confirmar"
  | "listo";
// "competencia" queda afuera del alta nueva: es una decisión que se toma
// mejor con datos en pantalla, no a ciegas antes de ver el tablero. Sigue
// disponible desde el dashboard ("Editar competencia" → deep link directo a
// ?edit=1&paso=competencia).
// "alias" + "avisos" + "listo" se fusionan en un único paso "confirmar" en
// el alta nueva: para la mayoría de los usuarios no hay nada que decidir ahí
// (alias viene precargado, avisos ya trae defaults recomendados), así que
// tres pantallas de solo-mirar-y-avanzar pasan a ser una sola pantalla
// editable con un solo botón al final. "alias" sigue existiendo como paso
// propio solo para el flujo de edición (PASOS_EDIT abajo).
const PASOS: { id: Paso; label: string }[] = [
  { id: "bienvenida", label: "Bienvenida" },
  { id: "entidades", label: "A quién seguir" },
  { id: "confirmar", label: "Confirmar" },
];
// "competencia" no forma parte de PASOS_EDIT: "Editar watchlist" (entrada
// genérica desde el tablero) va directo de entidades a alias, sin forzar
// asignar rival a cada entidad solo para guardar un cambio menor (ej. un
// alias). "competencia" sigue siendo un paso válido — se llega ahí solo por
// el deep link explícito "Editar competencia", que setea paso=competencia
// directamente (ver el useEffect de ?edit=1 más abajo).
const PASOS_EDIT: { id: Paso; label: string }[] = [
  { id: "entidades", label: "A quién seguir" },
  { id: "alias", label: "Cómo lo dicen" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isEdit, setIsEdit] = useState(false);
  const [paso, setPaso] = useState<Paso>("bienvenida");
  // Sin selección de plan: todos entran con la prueba que simula Pro (3 nombres).
  const [planId, setPlanId] = useState<Plan["id"]>(TRIAL_PLAN as Plan["id"]);
  const [sel, setSel] = useState<string[]>([]);
  // Competencia: 1 por cada entidad de la watchlist → mapa entidad→rival.
  const [compByEntity, setCompByEntity] = useState<Record<string, string>>({});
  // Entidad que se está asignando en el paso "Competencia".
  const [compActiveEntity, setCompActiveEntity] = useState<string>("");
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
  const [entrarLoading, setEntrarLoading] = useState(false);
  const [browseRows, setBrowseRows] = useState<CatalogBrowseRow[]>(BUNDLED_ROWS);
  const [comenciones, setComenciones] = useState(COMENCIONES_BUNDLED);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  const browseBySlug = useMemo(
    () => new Map(browseRows.map((r) => [r.slug, r])),
    [browseRows]
  );
  const radarCount = useMemo(
    () => browseRows.filter((r) => r.radarReady).length,
    [browseRows]
  );

  const plan = PLANES.find((p) => p.id === planId)!;
  const pasosUi = isEdit ? PASOS_EDIT : PASOS;
  const pasoIdx = pasosUi.findIndex((p) => p.id === paso);

  // Catálogo vivo desde Supabase (400+ radares); fallback al bundle local.
  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    fetchDatasets(["palco_entities", "palco_catalog"])
      .then((batch) => {
        if (!alive) return;
        const ent = batch.palco_entities as typeof ENTITIES_BUNDLED | undefined;
        const cat = batch.palco_catalog as typeof CATALOG | undefined;
        if (ent?.index?.length) {
          setBrowseRows(
            buildCatalogBrowseRows(
              cat ?? CATALOG,
              ent.index,
              ent.radars
            )
          );
          if (ent.comenciones?.length) setComenciones(ent.comenciones);
        } else if (cat) {
          setBrowseRows(buildCatalogBrowseRows(cat, INDEX, ENTITIES_BUNDLED.radars));
        }
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Modo edición desde el tablero (?edit=1): sin bienvenida ni plan, con watchlist actual.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("edit") !== "1") return;
    setIsEdit(true);
    const slugs = (p.get("e") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (slugs.length) setSel(slugs);
    const pl = p.get("plan");
    if (pl === "esencial" || pl === "profesional" || pl === "enterprise") setPlanId(pl);
    const s = p.get("sens");
    if (s === "menos" || s === "equilibrado" || s === "mas") setSensibilidad(s);
    if (p.get("neg") === "1") setSoloNegativo(true);
    const f = p.get("freq");
    if (f === "al-toque" || f === "diario" || f === "semanal") setFrecuencia(f);
    if (p.get("mail")) setEmail(p.get("mail")!);
    const pasoParam = p.get("paso");
    if (pasoParam === "competencia" || pasoParam === "alias" || pasoParam === "entidades") {
      setPaso(pasoParam);
    } else {
      setPaso("entidades");
    }
    loadPalcoAccount().then((acc) => {
      if (!acc) return;
      if (acc.watchlist?.length && !slugs.length) {
        setSel(acc.watchlist.map((w) => w.slug));
      }
      if (acc.competidores?.length) {
        const map: Record<string, string> = {};
        for (const c of acc.competidores) {
          if (c.para && c.slug) map[c.para] = c.slug;
        }
        setCompByEntity(map);
      }
      if (acc.avisos?.email_contacto) setEmail(acc.avisos.email_contacto);
    });
  }, []);

  // Alta por /login: sin sesión → ingresar; con sesión → mail del usuario.
  useEffect(() => {
    if (isEdit) return;
    if (!authEnabled) return;

    let alive = true;
    (async () => {
      const session = await getSession();
      if (!alive) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (session.user.email) {
        setEmail((cur) => cur || session.user.email!);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isEdit, router]);

  // Viene del magic link: arrancar en bienvenida (no saltar al tablero).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("from") === "login") setPaso("bienvenida");
  }, []);

  // Usuario logueado con cuenta lista → tablero (salvo edición o alta en curso).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("edit") === "1") return;
    if (p.get("from") === "login") return;
    if (!authEnabled) return;

    let alive = true;
    (async () => {
      const session = await getSession();
      if (!session || !alive) return;
      const acc = await loadPalcoAccount();
      if (!alive || !isPalcoAccountConfigured(acc)) return;
      const q = dashboardQueryFromAccount(acc!);
      router.replace(q ? `/dashboard?${q}` : "/dashboard");
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function volverAlTablero() {
    const p = new URLSearchParams(window.location.search);
    p.delete("edit");
    const q = p.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  }

  // Pre-carga alias del catálogo al entrar al paso "Cómo lo dicen" (edición)
  // o al paso "Confirmar" (alta nueva, donde alias vive fusionado).
  useEffect(() => {
    if ((paso !== "alias" && paso !== "confirmar") || sel.length === 0) return;
    setAliasCfg((prev) => {
      const next = { ...prev };
      for (const slug of sel) {
        if (next[slug]) continue;
        const row = browseBySlug.get(slug);
        next[slug] = row?.alias?.length ? [...row.alias] : [];
      }
      return next;
    });
  }, [paso, sel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return browseRows.filter((r) => {
      if (cat !== "Todas" && r.type !== cat) return false;
      return matchesQuery(q, r.name, r.alias);
    });
  }, [query, cat, browseRows]);

  // Sin búsqueda: lote inicial + "Ver todas". Con búsqueda/filtro: todo el match.
  useEffect(() => {
    setShowAllCatalog(false);
  }, [query, cat]);

  const catalogBrowsing = !query.trim() && cat === "Todas";
  const catalogVisible = useMemo(() => {
    if (!catalogBrowsing || showAllCatalog) return filtered;
    return filtered.slice(0, CATALOG_BATCH);
  }, [filtered, catalogBrowsing, showAllCatalog]);
  const catalogHasMore =
    catalogBrowsing && !showAllCatalog && filtered.length > CATALOG_BATCH;

  const comencionesSel = useMemo(() => {
    if (sel.length < 2) return [];
    const set = new Set(sel);
    return comenciones.filter((p) => set.has(p.par[0]) && set.has(p.par[1]))
      .sort((a, b) => b.cruces_total - a.cruces_total)
      .slice(0, 4);
  }, [sel, comenciones]);

  function toggle(slug: string) {
    setSel((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= plan.limite) return cur; // tope del plan elegido
      return [...cur, slug];
    });
  }
  const lleno = sel.length >= plan.limite;

  // Asigna (o deselecciona) la competencia de la entidad activa. 1 por entidad.
  function assignComp(compSlug: string) {
    if (!compActiveEntity) return;
    setCompByEntity((cur) => {
      if (cur[compActiveEntity] === compSlug) {
        const next = { ...cur };
        delete next[compActiveEntity];
        return next;
      }
      return { ...cur, [compActiveEntity]: compSlug };
    });
  }
  // (Antes había un "compCompleto" que gateaba "Guardar cambios" hasta
  // asignar rival a cada entidad de la watchlist; se sacó el bloqueo — ver
  // comentario en PASOS_EDIT: competencia pasa a ser un paso opcional.)

  // Mantiene la entidad activa dentro de la watchlist y poda competencias
  // de entidades que se hayan sacado.
  useEffect(() => {
    if (!sel.includes(compActiveEntity)) {
      setCompActiveEntity(sel[0] ?? "");
    }
    setCompByEntity((cur) => {
      const next: Record<string, string> = {};
      for (const s of sel) if (cur[s]) next[s] = cur[s];
      return Object.keys(next).length === Object.keys(cur).length ? cur : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  function addAlias(slug: string) {
    const raw = (aliasDraft[slug] || "").trim().toLowerCase();
    if (raw.length < 2) return;
    const nombre = browseBySlug.get(slug)?.name.toLowerCase() ?? "";
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

  function buildPending(): PendingPalcoAccount {
    return {
      plan: isEdit ? planId : TRIAL_PLAN,
      watchlist: sel.map((slug) => {
        const row = browseBySlug.get(slug)!;
        return {
          slug,
          nombre: row.name,
          alias: aliasCfg[slug] ?? row.alias,
        };
      }),
      competidores: sel
        .map((entidadSlug) => {
          const compSlug = compByEntity[entidadSlug];
          const row = compSlug ? browseBySlug.get(compSlug) : undefined;
          if (!compSlug || !row) return null;
          return {
            slug: compSlug,
            nombre: row.name,
            alias: row.alias,
            para: entidadSlug,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null),
      avisos: {
        sensibilidad,
        solo_negativo: soloNegativo,
        frecuencia,
        email_contacto: email.trim(),
      },
    };
  }

  async function entrar() {
    const pending = buildPending();
    const q = dashboardQueryFromAccount({
      user_id: "",
      email: email.trim(),
      plan: pending.plan,
      status: "trial",
      trial_ends_at: null,
      watchlist: pending.watchlist,
      competidores: pending.competidores,
      avisos: pending.avisos,
    });

    if (!authEnabled) {
      router.push(`/dashboard?${q}`);
      return;
    }

    setEntrarLoading(true);
    const session = await getSession();
    if (!session) {
      setEntrarLoading(false);
      router.push("/login");
      return;
    }
    const saved = await savePalcoAccount(pending, { startTrial: !isEdit });
    setEntrarLoading(false);
    if (!saved.ok) {
      window.alert(saved.error ?? "No se pudo guardar tu cuenta.");
      return;
    }
    router.push(`/dashboard?${q}`);
  }

  const selRows = sel
    .map((s) => browseBySlug.get(s))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const stickyFooter = ["entidades", "competencia", "alias", "confirmar"].includes(paso);
  const selSummary =
    selRows.length > 0 ? (
      selRows.map((r) => (
        <span
          key={r.slug}
          className="rounded-full bg-[#fbebd6] px-2.5 py-0.5 text-[12px] font-medium"
          style={{ color: BRAND }}
        >
          {r.name}
        </span>
      ))
    ) : (
      <span className="text-[12px] text-slate-400">Elegí al menos 1 nombre</span>
    );

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* barra superior */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {isEdit ? (
              <>
                <span className="text-[13px] font-medium text-slate-600">Editar a quién monitoreo</span>
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

      <div className={`mx-auto max-w-[1000px] px-5 py-10 ${stickyFooter ? "pb-28" : ""}`}>
        {/* ---------------- BIENVENIDA ---------------- */}
        {!isEdit && paso === "bienvenida" && (
          <section className="mx-auto max-w-[680px] text-center">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              Bienvenido a Palco
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">
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
              onClick={() => setPaso("entidades")}
              className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Empezar gratis →
            </button>
            <p className="mt-3 text-[12px] text-slate-400">
              {TRIAL_DIAS} días de prueba · hasta {TRIAL_LIMITE} nombres · sin tarjeta
            </p>
          </section>
        )}

        {/* ---------------- ENTIDADES ---------------- */}
        {paso === "entidades" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">¿A quién querés seguir?</h1>
                <p className="mt-2 text-[15px] text-slate-600">
                  En tu prueba gratis seguís hasta <b>{plan.limite} nombres</b>.
                  Elegí entre <b>{radarCount}</b> nombres con radar listo en streaming
                  argentino — buscá por apodo o filtrá por categoría.
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
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0] sm:text-[14px]"
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
            <p className="mt-2 text-[12px] text-slate-500">
              {catalogBrowsing && !showAllCatalog
                ? `Mostrando ${catalogVisible.length} de ${browseRows.length} (las más nombradas)`
                : `Mostrando ${catalogVisible.length} de ${browseRows.length} entidades`}
              {catalogLoading ? " · actualizando catálogo…" : ""}
              {query.trim() || cat !== "Todas" ? " (filtradas)" : ""}
              {" · "}buscá por apodo para encontrar cualquiera
            </p>

            {lleno && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f0c99a] bg-[#fbebd6] px-4 py-2.5 text-[13px]">
                <span className="text-slate-700">
                  Llegaste al tope de la prueba ({plan.limite}{" "}
                  {plan.limite === 1 ? "nombre" : "nombres"}). ¿Necesitás más?
                </span>
                <a
                  href="mailto:german@knownfy.ai?subject=Palco%20-%20quiero%20seguir%20m%C3%A1s%20nombres"
                  className="font-semibold hover:underline"
                  style={{ color: BRAND }}
                >
                  Escribinos →
                </a>
              </div>
            )}

            {/* grilla de entidades */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalogVisible.map((r) => {
                const on = sel.includes(r.slug);
                const bloq = !on && lleno;
                const aliasHint = r.alias.slice(0, 3).join(" · ");
                const hasSent = r.neg + r.neu + r.pos > 0;
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
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              r.radarReady
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {r.radarReady ? "Radar listo" : "Detectado"}
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
                        <b className="tabular-nums text-slate-800">{r.channels || "—"}</b>{" "}
                        canales
                      </span>
                      {!r.radarReady && r.programs > 0 && (
                        <span>
                          <b className="tabular-nums text-slate-800">{r.programs}</b> prog.
                        </span>
                      )}
                    </div>
                    {hasSent && (
                      <div className="mt-2">
                        <MiniSent r={r} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {catalogHasMore && (
              <button
                type="button"
                onClick={() => setShowAllCatalog(true)}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-medium text-slate-600 hover:border-slate-400"
              >
                Ver las {filtered.length} entidades
              </button>
            )}

            {filtered.length === 0 && (
              <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-[14px] text-slate-500">
                No encontramos ese nombre. Probá otro apodo o cambiá el filtro de categoría.
              </p>
            )}

            <OnboardingStepFooter
              backLabel={isEdit ? "← Cancelar" : "← Volver"}
              onBack={() => (isEdit ? volverAlTablero() : setPaso("bienvenida"))}
              nextLabel="Seguir →"
              onNext={() => setPaso(isEdit ? "alias" : "confirmar")}
              nextDisabled={sel.length === 0}
              summary={selSummary}
            />
          </section>
        )}

        {/* ---------------- COMPETENCIA (hasta 3, independiente de watchlist) ---------------- */}
        {paso === "competencia" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">¿Con quién comparás a cada uno?</h1>
                <p className="mt-2 text-[15px] text-slate-600">
                  Elegí <b>1 competencia por cada nombre</b> que seguís. En el tablero
                  vas a medir a cada uno contra su rival.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Asignadas
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {sel.filter((s) => compByEntity[s]).length}
                  <span className="ml-1 text-[13px] font-medium text-slate-400">
                    / {sel.length}
                  </span>
                </p>
              </div>
            </div>

            {/* tabs: una por entidad de la watchlist */}
            <div className="mt-5 flex flex-wrap gap-2">
              {selRows.map((r) => {
                const activa = r.slug === compActiveEntity;
                const rivalSlug = compByEntity[r.slug];
                const rival = rivalSlug ? browseBySlug.get(rivalSlug) : undefined;
                return (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => setCompActiveEntity(r.slug)}
                    className={`flex flex-col rounded-xl border px-4 py-2 text-left transition ${
                      activa
                        ? "border-[#b45309] ring-2 ring-[#f5d9b0]"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                    style={activa ? { backgroundColor: "#fbebd6" } : undefined}
                  >
                    <span className="text-[14px] font-semibold">{r.name}</span>
                    <span className="text-[12px] text-slate-500">
                      {rival ? `vs ${rival.name}` : "elegí su competencia…"}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[13px] text-slate-600">
              Elegí la competencia de{" "}
              <b>{browseBySlug.get(compActiveEntity)?.name ?? "—"}</b>:
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar competencia por nombre…"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0] sm:text-[14px]"
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalogVisible
                .filter((r) => r.slug !== compActiveEntity)
                .map((r) => {
                  const on = compByEntity[compActiveEntity] === r.slug;
                  return (
                    <button
                      key={r.slug}
                      type="button"
                      onClick={() => assignComp(r.slug)}
                      className={`flex flex-col rounded-xl border p-4 text-left shadow-sm transition ${
                        on
                          ? "border-slate-700 ring-2 ring-slate-300"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                      style={on ? { backgroundColor: "#f1f5f9" } : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">{r.name}</p>
                        {on && (
                          <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                            competencia
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {r.type} · {compact(r.mentions)} menc.
                      </p>
                    </button>
                  );
                })}
            </div>

            {catalogHasMore && (
              <button
                type="button"
                onClick={() => setShowAllCatalog(true)}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-medium text-slate-600 hover:border-slate-400"
              >
                Ver las {filtered.length} entidades
              </button>
            )}

            <OnboardingStepFooter
              backLabel="← Volver"
              onBack={() => setPaso("entidades")}
              nextLabel={isEdit ? "Guardar cambios" : "Seguir →"}
              onNext={() => (isEdit ? void entrar() : setPaso("alias"))}
              nextLoading={isEdit && entrarLoading}
              summary={
                <span className="text-[12px] text-slate-500">
                  {sel.filter((s) => compByEntity[s]).length}/{sel.length} competencias asignadas
                </span>
              }
            />
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
                const row = browseBySlug.get(slug);
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
                          className="w-28 rounded-full border border-slate-200 px-3 py-1 text-[16px] outline-none focus:border-[#b45309] sm:text-[13px]"
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

            <OnboardingStepFooter
              backLabel="← Volver"
              onBack={() => setPaso("entidades")}
              nextLabel={isEdit ? "Guardar cambios" : "Seguir →"}
              onNext={() => (isEdit ? void entrar() : setPaso("confirmar"))}
              nextLoading={isEdit && entrarLoading}
              summary={selSummary}
            />
          </section>
        )}

        {/* ---------------- CONFIRMAR (alias + avisos + resumen, todo junto) ----------------
            Fusiona lo que antes eran 3 pantallas ("Cómo lo dicen", "Avisos", "Listo") en una
            sola: para la mayoría de los usuarios no hay nada que decidir en alias (viene
            precargado del catálogo) ni en avisos (defaults recomendados ya aplicados), así
            que en vez de tres pantallas de solo-mirar-y-avanzar queda una sola vista editable
            con un único botón al final. */}
        {!isEdit && paso === "confirmar" && (
          <section className="mx-auto max-w-[720px]">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Último paso: revisá y confirmá</h1>
              <p className="mt-2 text-[15px] text-slate-600">
                Ya viene todo con una configuración recomendada. Ajustá lo que
                quieras y arrancá — esto lo volvés a cambiar cuando quieras
                desde tu tablero.
              </p>
            </div>

            {/* watchlist + alias */}
            <div className="mt-8">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                A quién monitoreo ({selRows.length})
              </p>
              <div className="mt-3 space-y-3">
                {sel.map((slug) => {
                  const row = browseBySlug.get(slug);
                  if (!row) return null;
                  const alias = aliasCfg[slug] ?? [];
                  const w = { nombre: row.name, alias };
                  const shown = displayAlias(w);
                  return (
                    <div
                      key={slug}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-[15px] font-bold">{row.name}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                            className="w-28 rounded-full border border-slate-200 px-3 py-1 text-[16px] outline-none focus:border-[#b45309] sm:text-[13px]"
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
                    </div>
                  );
                })}
              </div>
              {planId === "profesional" && comencionesSel.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nombrados juntos al aire (Pro)
                  </p>
                  <div className="mt-2 space-y-2">
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
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                Avisos
              </h2>
              <p className="mt-1 text-[12px] text-slate-500">
                Ya vienen con la config recomendada. Cambiala si querés.
              </p>
            </div>

            {/* sensibilidad */}
            <div className="mt-4">
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
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[16px] outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#f5d9b0] sm:text-[14px]"
              />
              <p className="mt-2 text-[12px] text-slate-400">
                Ahí te llegan los avisos y el{" "}
                {FRECUENCIAS.find((f) => f.id === frecuencia)!.titulo.toLowerCase()}.
              </p>
            </div>

            <p className="mt-6 text-center text-[12px] text-slate-400">
              Tu prueba gratis de <b>{TRIAL_DIAS} días</b> arranca cuando abras el panel.
            </p>

            <OnboardingStepFooter
              backLabel="← Volver"
              onBack={() => setPaso("entidades")}
              nextLabel={
                entrarLoading
                  ? "Guardando…"
                  : authEnabled
                    ? `Empezar prueba gratis · ${TRIAL_DIAS} días →`
                    : "Ver mi tablero →"
              }
              onNext={() => void entrar()}
              nextDisabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
              nextLoading={entrarLoading}
              summary={selSummary}
            />
          </section>
        )}
      </div>
    </div>
  );
}
