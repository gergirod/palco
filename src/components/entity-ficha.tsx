import Link from "next/link";
import { APP_NAME } from "@/config/app";
import { mailtoPagoUrl } from "@/config/trial";
import {
  type Explorable,
  type Radar,
  fechaCorta,
  SENT_LABEL,
  FREE_QUOTES,
  FREE_DAYS,
} from "@/lib/explorables";
import { EntityDotField } from "@/components/entity-dot-field";

/** Ficha pública de una entidad (persona/marca/tema): completa si viene de
 *  palco_entities.radars (15+ curadas), liviana si es solo un candidato del
 *  catálogo. Extraída de /explorar para reusarla también inline en la landing
 *  — mismo componente, mismo comportamiento, un solo lugar para mantenerlo. */
export function EntityFicha({ selected, radar }: { selected: Explorable; radar: Radar | null }) {
  if (radar) {
    return (
      <div className="card p-6 md:p-8">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">{radar.type}</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">
              {radar.entity}
            </h2>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tracking-tight text-signal">
              {radar.totals.transcript_mentions.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-muted">
              menciones al aire · {radar.totals.channels} canales · acumulado desde que
              empezamos a escuchar
            </p>
            {typeof radar.totals.chat_mentions === "number" && (
              <p className="mt-1 text-xs text-muted">
                + {radar.totals.chat_mentions.toLocaleString("es-AR")} menciones en el chat
                (acumulado, no en vivo)
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold">Tendencia diaria</p>
          <p className="text-xs text-muted mb-3">
            Por día, todos los canales sumados, con el tono real de cada jornada. Solo habla
            al aire, no incluye chat.
          </p>
          <EntityDotField byDay={radar.by_day} ventanaDias={FREE_DAYS} />
          {radar.by_day.length > FREE_DAYS && (
            <p className="mt-2 text-xs text-muted">
              Mostrando los últimos {FREE_DAYS} días (hay {radar.by_day.length} en total).
              Con cuenta ves todo el historial, y se actualiza solo — esto es una foto, no
              en vivo.
            </p>
          )}
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold">
            Dónde más se habló ({radar.share_of_voice.length} canales)
          </p>
          <p className="text-xs text-muted mb-3">
            Acumulado de todo el período mostrado, no por día.
          </p>
          <ul className="columns-2 sm:columns-3 gap-x-6 [&>li]:mb-2">
            {radar.share_of_voice.map((c) => (
              <li key={c.channel} className="flex items-center justify-between text-sm break-inside-avoid">
                <span>{c.channel}</span>
                <span className="text-muted">{c.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        {radar.feed?.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-semibold">
              Menciones reales{radar.feed.length > 1 ? ` (${Math.min(radar.feed.length, FREE_QUOTES)})` : ""}
            </p>
            <p className="text-xs text-muted mb-2">
              Ejemplos puntuales de lo que se dijo al aire, con canal, programa y fecha.
            </p>
            <div className="space-y-4">
              {radar.feed.slice(0, FREE_QUOTES).map((f, i) => (
                <div key={i} className="border-l-2 border-line pl-4">
                  <p className="text-sm leading-relaxed">&laquo;{f.quote}&raquo;</p>
                  <p className="mt-2 text-xs text-muted">
                    {f.channel} · {f.program} · {fechaCorta(f.date)}
                    {" · "}
                    {SENT_LABEL[f.sentiment]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-dashed border-signal-line bg-signal-soft/50 p-5">
          <p className="text-sm font-medium">
            🔒 Cuánta gente estaba mirando en ese momento y cómo reaccionó el chat — eso
            es lo que hace a Palco distinto, y solo se ve con cuenta.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/login" className="btn-signal">
              Probalo gratis
            </Link>
            <a href={mailtoPagoUrl()} className="btn-ghost">
              Escribinos por mail
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted">
          Muestra del corpus ya capturado por {APP_NAME}. No es en vivo ni se actualiza
          minuto a minuto en esta vista pública — para eso está el tablero de Palco.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 md:p-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">{selected.kind}</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">
            {selected.name}
          </h2>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold tracking-tight text-signal">
            {selected.mentions.toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-muted">
            menciones{selected.channels ? ` en ${selected.channels} canales` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        {selected.programs != null && (
          <div>
            <p className="text-muted text-xs">Programas</p>
            <p className="font-semibold">{selected.programs}</p>
          </div>
        )}
        {selected.first_seen && (
          <div>
            <p className="text-muted text-xs">Primera vez visto</p>
            <p className="font-semibold">{fechaCorta(selected.first_seen)}</p>
          </div>
        )}
        {selected.last_seen && (
          <div>
            <p className="text-muted text-xs">Última vez visto</p>
            <p className="font-semibold">{fechaCorta(selected.last_seen)}</p>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-signal-line bg-signal-soft/50 p-5">
        <p className="text-sm font-medium">
          Este nombre está identificado en el corpus pero todavía no tiene ficha
          completa (citas, desglose por canal, tono). Eso se arma automático apenas lo
          sumás a una watchlist en Palco — junto con audiencia en vivo y reacción del
          chat.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className="btn-signal">
            Sumarlo a mi watchlist
          </Link>
          <a href={mailtoPagoUrl()} className="btn-ghost">
            Escribinos por mail
          </a>
        </div>
      </div>
    </div>
  );
}
