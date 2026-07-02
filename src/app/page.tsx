import Link from "next/link";

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
 *  El alta real es por prueba gratis: /login → onboarding → panel. */
const PLANES = [
  {
    nombre: "Individual",
    para: "Un nombre",
    bajada: "Seguí un nombre o tema y no te pierdas nada de lo que se dice.",
    incluye: ["1 nombre o tema", "Tablero al día", "Resumen diario", "Avisos de crisis"],
  },
  {
    nombre: "Pro",
    para: "Hasta 3 nombres",
    bajada: "Seguí tu principal, un rival y un tema — todo junto.",
    incluye: ["Hasta 3 nombres", "Avisos de crisis", "Resumen diario", "Reporte semanal curado"],
    destacado: true,
  },
  {
    nombre: "A medida",
    para: "Sin límite",
    bajada: "Todos los nombres que necesites, con reportes a tu marca y API.",
    incluye: ["Nombres ilimitados", "Reportes con tu marca", "API", "Soporte dedicado"],
  },
];

const PUNTOS = [
  {
    t: "Personas y empresas que te importan",
    d: "Cargás los nombres que gestionás — tu candidato, tu marca, un vocero, la competencia — y Palco los escucha en todo el aire.",
  },
  {
    t: "El mismo día, no cuando ya es tendencia",
    d: "Escuchamos horas de aire que nadie puede seguir a mano. Cada mención te llega el mismo día: en qué programa, qué se dijo y con qué tono. No cuando ya llegó al recorte de la tele.",
  },
  {
    t: "Con la reacción de la audiencia",
    d: "Cuánta gente lo estaba escuchando y cómo lo tomó el chat. Si algo se prende, te lo marcamos como posible crisis.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            Palco<span className="text-signal-bright">.</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Ingresar
            </Link>
            <Link href="/login" className="btn-signal">
              Pedir una demo
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
              Palco escucha {CANALES.length} canales del streaming en vivo argentino.
            </p>
            <p className="mt-3 text-lg text-muted">
              Cada día, durante horas, en el streaming en vivo se habla de todo — y es
              imposible seguirlo a mano. Palco lo escucha por vos y te muestra cada vez
              que nombran a una persona o empresa que te importa: en qué programa, qué se
              dijo, con qué tono y cómo lo tomó la audiencia.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn-signal">
                Pedir una demo con tus nombres
              </Link>
              <Link href={`/dashboard?demo=1&e=${EJEMPLO.slug}`} className="btn-ghost">
                Ver un panel de ejemplo
              </Link>
            </div>
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
            Elegí según cuántos nombres seguís.
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
          ¿No sabés cuál te sirve? <Link href="/login" className="text-signal font-medium">Probalo gratis</Link> y lo vemos juntos.
        </p>
      </section>

      {/* cierre */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl md:text-4xl font-semibold tracking-tight max-w-3xl mx-auto">
          Ya se está hablando de lo que te importa en el streaming. La pregunta es si te estás enterando.
        </h2>
        <div className="mt-7">
          <Link href="/login" className="btn-signal">
            Pedir una demo con tus nombres
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            Palco<span className="text-signal-bright">.</span>
          </span>
          <span>Monitoreo del streaming en vivo · Argentina</span>
          <Link href="/login" className="text-signal font-medium">
            Ingresar
          </Link>
        </div>
      </footer>
    </main>
  );
}
