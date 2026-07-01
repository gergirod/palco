import Link from "next/link";

const CANALES = [
  "Olga", "Luzu", "Bondi", "Blender", "Gelatina", "Urbana", "Neura", "Vorterix",
];

const PUNTOS = [
  {
    t: "En vivo, no al otro día",
    d: "Te llega en el momento, mientras se está diciendo — no cuando ya es tendencia.",
  },
  {
    t: "Los nombres que vos elegís",
    d: "Tu candidato, los rivales, una marca, un tema. Seguís lo que te importa a vos.",
  },
  {
    t: "Con la reacción de la gente",
    d: "No solo qué se dijo: cuánta gente estaba mirando y cómo lo tomó el chat.",
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

      {/* hero — todo lo que somos, sin scrollear */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-10 md:pt-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* texto */}
          <div>
            <p className="eyebrow mb-5">Monitoreo del streaming en vivo · Argentina</p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08]">
              Enterate cuando hablan de{" "}
              <span className="text-signal">los nombres que seguís</span>.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Es como un monitoreo de medios, pero para el streaming en vivo — eso que
              hoy nadie mira y donde arranca todo. Vos elegís los nombres que te
              importan y te avisamos apenas los nombran: en qué programa, qué se dijo y
              cómo reaccionó la gente que estaba mirando.
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

          {/* ejemplo concreto */}
          <div className="card p-6 md:justify-self-end w-full max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-crisis">
                <span className="inline-block h-2 w-2 rounded-full bg-crisis" />
                Alerta · en vivo
              </span>
              <span className="text-muted">reci&eacute;n</span>
            </div>
            <p className="mt-4 text-sm font-medium">Olga · Ser&iacute;a Incre&iacute;ble</p>
            <p className="text-xs text-muted">12.400 mirando en este momento</p>
            <p className="mt-4 border-l-2 border-line pl-3 text-sm leading-relaxed">
              &laquo;&hellip;lo que dijo no se lo banca nadie, se le fue la mano&hellip;&raquo;
            </p>
            <div className="mt-4 rounded-xl bg-crisis-soft px-3 py-2 text-xs font-medium text-crisis">
              Posible crisis: mucha gente mirando y el chat en contra.
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
          Lo que seguís ya está sonando en vivo. La pregunta es si te estás enterando.
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
