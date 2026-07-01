import Link from "next/link";

const CANALES = [
  "Olga", "Luzu", "Bondi", "Blender", "Gelatina", "Urbana", "Neura", "Vorterix",
];

const PLANES = [
  {
    id: "esencial",
    nombre: "Esencial",
    precio: "USD 90",
    detalle: "/mes",
    linea: "Para cuidar un nombre.",
    incluye: ["1 nombre monitoreado", "Brief diario por mail", "Alertas de crisis", "Panel en vivo"],
    destacado: false,
  },
  {
    id: "profesional",
    nombre: "Profesional",
    precio: "USD 250",
    detalle: "/mes",
    linea: "Para una marca o figura con exposición.",
    incluye: ["Hasta 3 nombres", "Brief diario + reporte semanal", "Alertas y crisis en tiempo real", "Co-menciones y contexto", "Share of voice"],
    destacado: true,
  },
  {
    id: "enterprise",
    nombre: "A medida",
    precio: "Hablemos",
    detalle: "",
    linea: "Agencias, prensa y equipos.",
    incluye: ["Nombres ilimitados", "Múltiples destinatarios", "Certificados de emisión", "Onboarding dedicado"],
    destacado: false,
  },
];

const PASOS = [
  {
    n: "01",
    t: "Escuchamos el aire",
    d: "Capturamos, transcribimos y entendemos cada minuto de streaming en vivo — no solo lo que se dijo, también cuánta gente estaba mirando.",
  },
  {
    n: "02",
    t: "Detectamos cada mención",
    d: "Detectamos cada mención de las figuras, marcas o temas que seguís, distinguimos pauta de orgánico y la ubicamos en su contexto real de conversación.",
  },
  {
    n: "03",
    t: "Te avisamos primero",
    d: "Brief diario a tu mail, alerta apenas algo escala y panel en vivo para entrar cuando quieras. Enterate antes de que sea tendencia.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            Palco<span className="text-signal">.</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Ingresar
            </Link>
            <Link href="/onboarding" className="btn-signal">
              Empezar
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <p className="eyebrow mb-5">Inteligencia de reputación · streaming en vivo</p>
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
          Seguí los nombres que te importan{" "}
          <span className="text-signal">antes que nadie</span>.
        </h1>
        <p className="mt-6 text-lg text-muted max-w-2xl">
          Palco escucha el streaming argentino en vivo — Olga, Luzu, Bondi y más — y
          te dice cuándo, dónde y en qué tono mencionan las figuras, marcas o temas
          que elegís seguir. Como un Bloomberg de la atención, pero para política,
          reputación y cultura.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/onboarding" className="btn-signal">
            Configurar mi monitoreo
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Ver un panel de ejemplo
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Cobertura hoy: {CANALES.join(" · ")}.
        </p>
      </section>

      {/* valor */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-8">
          {[
            {
              t: "No medimos publicidad. Medimos atención.",
              d: "Cada mención se pesa por cuánta gente estaba mirando en ese minuto. Sabés el impacto real, no un número inflado.",
            },
            {
              t: "Pauta vs. orgánico, separado.",
              d: "Distinguimos lo que se dijo porque pagaron de lo que surgió solo. Dos historias muy distintas sobre la misma figura o marca.",
            },
            {
              t: "La prueba textual, siempre.",
              d: "Cada alerta trae la cita exacta, el programa, el minuto y el link. Nada de 'confiá en nosotros'.",
            },
          ].map((c) => (
            <div key={c.t}>
              <h3 className="font-display text-xl font-semibold tracking-tight mb-2">{c.t}</h3>
              <p className="text-sm text-muted leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* cómo funciona */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow mb-3">Cómo funciona</p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
          De horas de streaming a una sola frase que te importa.
        </h2>
        <div className="mt-12 grid md:grid-cols-3 gap-10">
          {PASOS.map((p) => (
            <div key={p.n}>
              <div className="font-display text-signal text-2xl font-semibold mb-3">{p.n}</div>
              <h3 className="font-display text-xl font-semibold tracking-tight mb-2">{p.t}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* planes */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow mb-3">Planes</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
            Pagás por nombre cuidado. Simple.
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {PLANES.map((pl) => (
              <div
                key={pl.id}
                className={`card p-7 flex flex-col ${
                  pl.destacado ? "ring-2 ring-signal" : ""
                }`}
              >
                {pl.destacado && (
                  <span className="eyebrow mb-3">Más elegido</span>
                )}
                <h3 className="font-display text-2xl font-semibold tracking-tight">{pl.nombre}</h3>
                <p className="text-sm text-muted mt-1 mb-5">{pl.linea}</p>
                <div className="mb-6">
                  <span className="font-display text-3xl font-semibold">{pl.precio}</span>
                  <span className="text-sm text-muted">{pl.detalle}</span>
                </div>
                <ul className="space-y-2 text-sm mb-7 flex-1">
                  {pl.incluye.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-signal">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboarding"
                  className={pl.destacado ? "btn-signal w-full" : "btn-ghost w-full"}
                >
                  {pl.id === "enterprise" ? "Hablemos" : "Empezar"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
          Lo que seguís ya está sonando en el aire. La pregunta es si te estás enterando.
        </h2>
        <div className="mt-8">
          <Link href="/onboarding" className="btn-signal">
            Configurar mi monitoreo
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            Palco<span className="text-signal">.</span>
          </span>
          <span>Inteligencia de reputación sobre el streaming en vivo · Argentina</span>
          <Link href="/login" className="text-signal font-medium">
            Ingresar
          </Link>
        </div>
      </footer>
    </main>
  );
}
