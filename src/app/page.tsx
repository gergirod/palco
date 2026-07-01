import Link from "next/link";

const CANALES = [
  "Olga", "Luzu", "Bondi", "Blender", "Gelatina", "Urbana", "Neura", "Vorterix",
];

const ENTREGABLES = [
  {
    t: "Alerta en tiempo real",
    d: "Apenas se menciona un nombre de tu watchlist con audiencia y chat que lo justifican, te llega — con la cita, el programa y el minuto.",
  },
  {
    t: "Brief diario",
    d: "Cada mañana a tu mail: qué se dijo ayer sobre los nombres que seguís, en qué canales y con qué clima.",
  },
  {
    t: "Reporte semanal",
    d: "La narrativa de la semana con share of voice y sentimiento por nombre. Lo que un monitor serio te daría — más la sala.",
  },
  {
    t: "Flag de crisis",
    d: "Mención + audiencia alta + chat disparado en negativo, al mismo tiempo. Te enterás tres minutos después de que se dijo, no cuando ya explotó.",
  },
];

const PASOS = [
  {
    n: "01",
    t: "Escuchamos el aire",
    d: "Capturamos y transcribimos cada minuto de streaming en vivo — y medimos cuánta gente estaba mirando y cómo se movía el chat en ese momento.",
  },
  {
    n: "02",
    t: "Rastreamos tus nombres",
    d: "Escribís cualquier nombre —tu candidato, los rivales, una marca, un tema— y Palco lo busca hacia atrás en todo lo capturado y hacia adelante en vivo.",
  },
  {
    n: "03",
    t: "Te avisamos primero",
    d: "Cada aparición se vuelve una ficha: canal, programa, minuto, cita textual, audiencia en vivo, reacción del chat y tono. Enterate antes de que sea tendencia.",
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
              Pedir una demo
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <p className="eyebrow mb-5">Monitoreo de streaming en vivo · comunicación política</p>
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
          El radar sobre los nombres que{" "}
          <span className="text-signal">gestionás</span>.
        </h1>
        <p className="mt-6 text-lg text-muted max-w-2xl">
          El streaming en vivo arma el clima antes que la tele y las redes — y hoy
          nadie lo mira. Palco escucha Olga, Luzu, Bondi y más, y te dice cuándo,
          dónde y en qué tono se habla de tu candidato, tus rivales o el tema que
          estás manejando — y cómo reacciona la audiencia en el minuto exacto.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/onboarding" className="btn-signal">
            Pedir una demo con tus nombres
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Ver un panel de ejemplo
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Cobertura hoy: {CANALES.join(" · ")}.
        </p>
      </section>

      {/* dos termómetros */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="eyebrow mb-3">Dos termómetros a la vez</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
            No contamos menciones. Medimos la atención que tuvieron.
          </h2>
          <div className="mt-12 grid md:grid-cols-2 gap-8">
            <div className="card p-8">
              <h3 className="font-display text-xl font-semibold tracking-tight mb-2">
                El termómetro de cobertura
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Qué se dice, en qué canales y con qué tono. Share of voice y
                sentimiento por cada nombre — lo que hace un monitor de medios serio,
                pero sobre lo hablado en vivo, que hasta ahora quedaba en un punto ciego.
              </p>
            </div>
            <div className="card p-8">
              <h3 className="font-display text-xl font-semibold tracking-tight mb-2">
                El termómetro de la sala
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Cuánta gente estaba mirando y cómo reaccionó el chat en el minuto de la
                mención. Una frase en un programa de 200 personas no es lo mismo que una
                en Olga con 41.000 mirando y el chat explotando. Esto no lo hace nadie más.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* flag de crisis — killer feature */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="card p-8 md:p-12 border-l-4" style={{ borderLeftColor: "var(--crisis)" }}>
          <p className="eyebrow mb-3" style={{ color: "var(--crisis)" }}>
            La señal que nadie más puede computar
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-3xl">
            Flag de crisis: mención + audiencia alta + chat en negativo, al mismo tiempo.
          </h2>
          <p className="mt-6 text-lg text-muted max-w-2xl">
            Cruzamos las tres capas en el mismo minuto. Nadie más las tiene juntas, así
            que nadie más lo puede calcular. Es la diferencia entre enterarte de una
            crisis cuando ya es tendencia y enterarte tres minutos después de que se dijo
            la frase — cuando todavía podés hacer algo.
          </p>
        </div>
      </section>

      {/* cómo funciona */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow mb-3">Cómo funciona</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
            De horas de streaming a la sola frase que te importa.
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
        </div>
      </section>

      {/* para quién */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow mb-3">Para quién</p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
          No monitoreás tu propio nombre. Monitoreás el mapa que tenés que gestionar.
        </h2>
        <div className="mt-12 grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight mb-2">
              Comunicación política
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Consultores, jefes de prensa de campaña y equipos de imagen. Seguís a tu
              candidato, a los rivales y a los temas calientes al mismo tiempo — de cara
              al ciclo 2027 y a cualquier episodio reputacional en curso.
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight mb-2">
              Asuntos corporativos
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Energía, bancos, prepagas, aerolíneas, telcos. Sectores donde una frase al
              aire mueve la percepción de la marca — y donde querés enterarte cuando pasa,
              no en el resumen del día siguiente.
            </p>
          </div>
        </div>
      </section>

      {/* concierge / entregables */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow mb-3">Cómo empezás</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
            Nos das tus nombres. Nosotros operamos el radar. Vos recibís lo que importa.
          </h2>
          <p className="mt-5 text-muted max-w-2xl">
            Palco arranca como servicio gestionado: definís tu watchlist y recibís cuatro
            entregables sobre ella. Se paga por nombre en seguimiento, no por "tu
            reputación".
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-6">
            {ENTREGABLES.map((e) => (
              <div key={e.t} className="card p-7">
                <h3 className="font-display text-xl font-semibold tracking-tight mb-2">{e.t}</h3>
                <p className="text-sm text-muted leading-relaxed">{e.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/onboarding" className="btn-signal">
              Pedir una demo con tus nombres
            </Link>
            <p className="mt-3 text-sm text-muted">
              La demo es el producto funcionando con datos reales. Ves tu propio mapa, no un pitch.
            </p>
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
          Lo que gestionás ya está sonando en el aire. La pregunta es si te estás enterando.
        </h2>
        <div className="mt-8">
          <Link href="/onboarding" className="btn-signal">
            Pedir una demo con tus nombres
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            Palco<span className="text-signal">.</span>
          </span>
          <span>El radar de reputación sobre el streaming en vivo · Argentina</span>
          <Link href="/login" className="text-signal font-medium">
            Ingresar
          </Link>
        </div>
      </footer>
    </main>
  );
}
