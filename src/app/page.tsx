import Link from "next/link";

const CANALES = [
  "Olga", "Luzu", "Bondi", "Blender", "Gelatina", "Urbana", "Neura", "Vorterix",
];

const PUNTOS = [
  {
    t: "En vivo, no al otro día",
    d: "Te llega mientras se está diciendo — no cuando ya es tendencia o llegó al recorte de la tele.",
  },
  {
    t: "Las figuras, marcas y temas que gestionás",
    d: "Tu candidato, la competencia, un vocero, un tema sensible. Seguís lo que tenés que cuidar.",
  },
  {
    t: "Con la reacción de la audiencia",
    d: "No solo qué se dijo: cuánta gente miraba y cómo lo tomó el chat. Si algo escala, te lo marcamos como posible crisis.",
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
            <Link href="/onboarding" className="btn-signal">
              Pedir una demo
            </Link>
          </nav>
        </div>
      </header>

      {/* hero — se explica solo: qué categoría, qué es, qué hace */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-10 md:pt-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* texto */}
          <div>
            <p className="eyebrow mb-5">Monitoreo del streaming en vivo · Argentina</p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08]">
              El monitoreo de medios no escucha el streaming en vivo.{" "}
              <span className="text-signal">Palco sí</span>.
            </h1>
            <p className="mt-5 text-lg text-ink font-medium">
              Es el monitoreo de medios, pero para el streaming en vivo.
            </p>
            <p className="mt-3 text-lg text-muted">
              Los equipos de prensa y comunicación ya siguen diarios, radio y TV. Pero
              hoy la agenda también se arma en el streaming — y nadie lo monitorea.
              Palco escucha el aire y te avisa apenas nombran a las figuras, marcas o
              temas que gestionás: en qué programa, qué se dijo y cómo reaccionó la
              audiencia.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className="btn-signal">
                Pedir una demo con tus nombres
              </Link>
              <Link href="/dashboard" className="btn-ghost">
                Ver un panel de ejemplo
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">
              Hoy escuchamos: {CANALES.join(" · ")}.
            </p>
          </div>

          {/* ejemplo concreto — mención neutra */}
          <div className="card p-6 md:justify-self-end w-full max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-signal">
                <span className="inline-block h-2 w-2 rounded-full bg-signal-bright" />
                Mención detectada · en vivo
              </span>
              <span className="text-muted">hace 2 min</span>
            </div>
            <p className="mt-4 text-sm font-medium">Ciclo de streaming · política</p>
            <p className="text-xs text-muted">8.900 mirando en este momento</p>
            <p className="mt-4 border-l-2 border-line pl-3 text-sm leading-relaxed">
              &laquo;&hellip;lo nombraron al pasar cuando hablaban del acto de ayer&hellip;&raquo;
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-signal-soft px-2.5 py-1 font-medium text-signal">
                Tono: neutro
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-muted">
                Contexto: agenda política
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

      {/* cierre */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl md:text-4xl font-semibold tracking-tight max-w-3xl mx-auto">
          Lo que gestionás ya está sonando en vivo. La pregunta es si te estás enterando.
        </h2>
        <div className="mt-7">
          <Link href="/onboarding" className="btn-signal">
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
