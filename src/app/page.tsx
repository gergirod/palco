import Link from "next/link";
import bundled from "@/data/palco_entities.json";
import bundledRadar from "@/data/radar.json";
import { APP_NAME } from "@/config/app";
import { rankNombresAcumulado, rankPulsoPolitico, type RadarTema } from "@/lib/pulso";

/** Cifra real del catálogo (palco_entities → catalog_summary.candidates_count). */
const CANDIDATOS_COUNT: number = (bundled as any)?.catalog_summary?.candidates_count ?? 0;

/** Chips del hero: los nombres más mencionados del índice real (palco_entities → index),
 *  ya vienen ordenados por menciones desc. Ahorran el paso de escribir en /explorar. */
const HERO_CHIPS: string[] = ((bundled as any)?.index ?? [])
  .slice(0, 8)
  .map((r: any) => r.name)
  .filter(Boolean);

/** Teaser del Pulso en la landing: el nombre más mencionado hoy y el tema
 *  político/económico con más puntaje ahora — mismos datos que /pulso. */
const PULSO_TOP_NOMBRE = rankNombresAcumulado((bundled as any)?.radars ?? {}, 1)[0];
const PULSO_TOP_TEMA = rankPulsoPolitico((bundledRadar as unknown as RadarTema[]) ?? [], 1)[0];

const CANALES = [
  "Olga", "Luzu", "Bondi", "Blender", "Gelatina", "Urbana Play", "Neura",
  "Vorterix", "Border", "Cronista", "Ahora Play", "Aura", "Cenital", "Carajo",
  "El Destape", "Futurock", "Bravo TV", "Carnaval",
];

/** Mención real de Lionel Messi (palco_entities → lionel-messi → feed[0]). */
const EJEMPLO = {
  slug: "lionel-messi",
  nombre: "Lionel Messi",
  canal: "Luzu",
  programa: "Nadie dice nada",
  audiencia: "238k",
  fecha: "23/06",
  cita: "…una figura de Messi muy típica de Argentina. Para mí es Julián.",
};

/** Planes que mostramos en la landing SIN precio: el precio se conversa.
 *  Entrada real: Probalo gratis → /explorar (sin cuenta) → converte a /login. */
const PLANES = [
  {
    nombre: "Individual",
    para: "Un perfil",
    bajada: "Seguí un perfil o tema y no te pierdas nada de lo que se dice.",
    incluye: ["1 perfil o tema", "Tablero al día", "Resumen diario", "Avisos de crisis"],
  },
  {
    nombre: "Pro",
    para: "Hasta 3 perfiles",
    bajada: "Seguí tu principal, un rival y un tema — todo junto.",
    incluye: ["Hasta 3 perfiles", "Avisos de crisis", "Resumen diario", "Reporte semanal curado"],
    destacado: true,
  },
  {
    nombre: "A medida",
    para: "Sin límite",
    bajada: "Todos los perfiles que necesites, con reportes a tu marca y API.",
    incluye: ["Perfiles ilimitados", "Reportes con tu marca", "API", "Soporte dedicado"],
  },
];

const PUNTOS = [
  {
    t: "Te enterás antes de que se prenda del todo",
    d: "Medimos cómo reacciona la audiencia y el chat en el momento. Si algo empieza a escalar, te llega marcado como posible crisis — no cuando ya es tendencia.",
  },
  {
    t: "Los perfiles que vos elegís",
    d: `Cargás las personas o empresas que gestionás — tu candidato, tu marca, un vocero, la competencia — y ${APP_NAME} los escucha en todo el aire.`,
  },
  {
    t: "El mismo día, no el resumen de la semana",
    d: "Escuchamos horas de aire que nadie puede seguir a mano. Cada mención: en qué programa, qué se dijo y con qué tono.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            {APP_NAME}<span className="text-signal-bright">.</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-2">
            <Link href="/pulso" className="text-sm font-medium text-muted hover:text-ink hidden sm:inline-flex">
              Pulso
            </Link>
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Ingresar
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted sm:hidden">
              Ingresar
            </Link>
            <Link href="/explorar" className="btn-signal">
              Probalo gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* hero — se explica solo: categoría + analogía + qué hace */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-10 md:pt-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* texto */}
          <div>
            <p className="eyebrow mb-5">Monitoreo del streaming en vivo · Argentina</p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] sm:leading-[1.08]">
              Enterate cuándo, cómo y dónde se habla de las{" "}
              <span className="text-signal">personas y empresas</span> que te importan.
            </h1>
            <p className="mt-5 text-lg text-ink font-medium">
              {APP_NAME} escucha {CANALES.length} canales del streaming en vivo argentino.
            </p>
            <p className="mt-3 text-lg text-muted">
              Vos cargás los perfiles. {APP_NAME} te avisa el mismo día en qué programa se
              habló, qué se dijo y con qué tono — y si conviene prender una alarma.
            </p>
            {CANDIDATOS_COUNT > 0 && (
              <p className="mt-3 text-sm font-medium text-signal">
                {CANDIDATOS_COUNT} personas y empresas ya identificadas en el streaming
                argentino, en vivo, todos los días.
              </p>
            )}
            {/* buscador rápido: entra directo a la ficha en /explorar, sin escribir dos veces.
                Form GET nativo — sigue siendo un server component, sin JS extra. */}
            <form action="/explorar" method="GET" className="mt-7 flex flex-wrap gap-2">
              <input
                type="text"
                name="q"
                placeholder="Buscá un nombre: Milei, Messi, Adorni…"
                className="flex-1 min-w-[220px] rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-signal-ring"
              />
              <button type="submit" className="btn-signal">
                Buscar gratis
              </button>
            </form>
            {HERO_CHIPS.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {HERO_CHIPS.map((name) => (
                  <Link
                    key={name}
                    href={`/explorar?q=${encodeURIComponent(name)}`}
                    className="rounded-full border border-line bg-white px-3 py-1.5 text-xs hover:bg-signal-soft transition"
                  >
                    {name}
                  </Link>
                ))}
              </div>
            )}
            <p className="mt-5 text-sm text-muted">
              Hoy escuchamos: {CANALES.join(" · ")}.
            </p>
          </div>

          {/* ejemplo real — Lionel Messi */}
          <div className="card p-6 md:justify-self-end w-full max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-signal">
                <span className="inline-block h-2 w-2 rounded-full bg-signal-bright" />
                <span>Mención detectada</span>
              </span>
              <span className="text-muted">{EJEMPLO.fecha}</span>
            </div>
            <p className="mt-4 font-display text-lg font-semibold tracking-tight">{EJEMPLO.nombre}</p>
            <p className="mt-1 text-sm font-medium">
              {EJEMPLO.canal} · {EJEMPLO.programa}
            </p>
            <p className="text-xs text-muted">{EJEMPLO.audiencia} mirando en ese momento</p>
            <p className="mt-4 border-l-2 border-line pl-3 text-sm leading-relaxed">
              &laquo;{EJEMPLO.cita}&raquo;
            </p>
            <div className="mt-4">
              <span className="rounded-full bg-signal-soft px-2.5 py-1 text-xs font-medium text-signal">
                Tono: neutro
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* teaser: Pulso */}
      {(PULSO_TOP_NOMBRE || PULSO_TOP_TEMA) && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <Link
            href="/pulso"
            className="card group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 hover:border-signal-line transition"
          >
            <span className="pulso-live-dot inline-block h-2 w-2 shrink-0 rounded-full bg-up" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">
                Pulso: el ranking en vivo (con delay) de qué se habla más
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {PULSO_TOP_NOMBRE && (
                  <>
                    Ahora mismo, el más mencionado es{" "}
                    <span className="font-medium text-signal">{PULSO_TOP_NOMBRE.entity}</span>
                    {PULSO_TOP_TEMA && " · "}
                  </>
                )}
                {PULSO_TOP_TEMA && (
                  <>
                    en política y economía, el tema que más pesa es{" "}
                    <span className="font-medium text-signal capitalize">{PULSO_TOP_TEMA.tema}</span>
                  </>
                )}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-signal group-hover:underline">
              Ver el pulso completo →
            </span>
          </Link>
        </section>
      )}

      {/* tres puntos — corto */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-12 grid md:grid-cols-3 gap-8">
          {PUNTOS.map((p) => (
            <div key={p.t}>
              <h3 className="font-display text-lg font-semibold tracking-tight mb-1.5">{p.t}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* planes — sin precio: se conversa (Consultanos) */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="text-center">
          <p className="eyebrow mb-3">Planes</p>
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            Elegí según cuántos perfiles seguís.
          </h2>
          <p className="mt-3 text-muted">
            Empezás con una prueba gratis. El plan lo armamos con vos según lo que necesites.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANES.map((p) => (
            <div
              key={p.nombre}
              className={`card relative flex flex-col p-6 ${
                p.destacado ? "ring-2 ring-signal" : ""
              }`}
            >
              {p.destacado && (
                <span className="absolute -top-3 left-6 rounded-full bg-signal px-2.5 py-0.5 text-xs font-semibold text-white">
                  Más elegido
                </span>
              )}
              <p className="eyebrow">{p.para}</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{p.nombre}</p>
              <p className="mt-2 text-sm text-muted leading-relaxed">{p.bajada}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.incluye.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-signal">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login" className="btn-ghost mt-6 justify-center">
                Consultanos
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          ¿No sabés cuál te sirve? <Link href="/explorar" className="text-signal font-medium">Probalo gratis</Link> y lo vemos juntos.
        </p>
      </section>

      {/* cierre */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl md:text-4xl font-semibold tracking-tight max-w-3xl mx-auto">
          Ya se está hablando de lo que te importa en el streaming. La pregunta es si te estás enterando.
        </h2>
        <div className="mt-7">
          <Link href="/explorar" className="btn-signal">
            Probalo gratis
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            {APP_NAME}<span className="text-signal-bright">.</span>
          </span>
          <span>Monitoreo del streaming en vivo · Argentina</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-signal font-medium">
              Ingresar
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
