"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import bundledEntitiesRaw from "@/data/palco_entities.json";
import bundledRadarRaw from "@/data/radar.json";
import { fetchDatasets } from "@/lib/supabase";
import {
  rankNombresHoy,
  rankNombresAcumulado,
  rankPulsoPolitico,
  type RadarTema,
  type NombreHoyRow,
  type NombreAcumuladoRow,
  type PulsoTemaRow,
} from "@/lib/pulso";
import { APP_NAME } from "@/config/app";

/* ---------- tipos locales del bundle ---------- */
type RadarFicha = {
  entity: string;
  type: string;
  totals: { transcript_mentions: number; chat_mentions?: number; channels: number };
  by_day: { day: string; mentions: number }[];
};
type EntitiesData = { radars: Record<string, RadarFicha> };

const bundledEntities = bundledEntitiesRaw as unknown as EntitiesData;
const bundledRadar = bundledRadarRaw as unknown as RadarTema[];

const REFRESH_MS = 45_000;
type Vista = "nombres" | "politica";

function haceCuanto(d: Date | null): string {
  if (!d) return "cargando…";
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "recién";
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  return `hace ${m} min`;
}

export default function PulsoPage() {
  const [vista, setVista] = useState<Vista>("nombres");
  const [entities, setEntities] = useState<EntitiesData>(bundledEntities);
  const [radarItems, setRadarItems] = useState<RadarTema[]>(bundledRadar);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [clock, setClock] = useState(0);
  const [mountKey, setMountKey] = useState(0);

  /* poll a Supabase (misma tabla ui_data que ya usa /explorar) — si no hay
     env configurado, fetchDatasets devuelve {} y nos quedamos con el bundle. */
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const data = await fetchDatasets(["palco_entities", "radar"]);
      if (cancelled) return;
      const nextEntities = (data as any)?.palco_entities as EntitiesData | undefined;
      const nextRadar = (data as any)?.radar as RadarTema[] | undefined;
      if (nextEntities?.radars) setEntities(nextEntities);
      if (Array.isArray(nextRadar)) setRadarItems(nextRadar);
      setLastUpdate(new Date());
    }
    poll();
    const id = setInterval(poll, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /* solo para refrescar el texto "hace Ns" */
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, []);

  /* fuerza a las barras a re-animar (crecer desde 0) cada vez que se cambia de vista */
  useEffect(() => {
    setMountKey((k) => k + 1);
  }, [vista]);

  const nombresHoy: NombreHoyRow[] = useMemo(
    () => rankNombresHoy(entities.radars ?? {}, 10),
    [entities]
  );
  const nombresAcumulado: NombreAcumuladoRow[] = useMemo(
    () => rankNombresAcumulado(entities.radars ?? {}, 18),
    [entities]
  );
  const temasPolitica: PulsoTemaRow[] = useMemo(
    () => rankPulsoPolitico(radarItems, 18),
    [radarItems]
  );

  const maxHoy = Math.max(1, ...nombresHoy.map((r) => r.hoy));
  const maxAcumulado = Math.max(1, ...nombresAcumulado.map((r) => r.acumulado));
  const maxScore = Math.max(1, ...temasPolitica.map((r) => r.score));

  return (
    <main className="min-h-screen flex flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            {APP_NAME}
            <span className="text-signal-bright">.</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/explorar" className="text-sm font-medium text-muted hover:text-ink">
              Explorar
            </Link>
            <Link href="/login" className="btn-signal">
              Probalo gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-6">
        <p className="eyebrow mb-4">Pulso · gratis, sin cuenta</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1] max-w-3xl">
          De qué se habla ahora mismo en el streaming argentino.
        </h1>
        <p className="mt-4 text-lg text-muted max-w-2xl">
          Ranking de nombres y de temas de política y economía, armado con lo que ya
          escuchamos en {Object.keys(entities.radars ?? {}).length || "cientos de"} horas de
          aire. Se actualiza solo cada {Math.round(REFRESH_MS / 1000)}s — es &laquo;en
          vivo con delay&raquo;, no el segundo exacto: eso es lo que ves con cuenta en Palco.
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="pulso-live-dot inline-block h-2 w-2 rounded-full bg-up" />
          <span className="font-medium text-ink">En vivo</span>
          <span>· actualizado {haceCuanto(lastUpdate)}</span>
        </div>

        {/* switcher */}
        <div className="mt-7 inline-flex rounded-full border border-line bg-white p-1 text-sm">
          <button
            onClick={() => setVista("nombres")}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              vista === "nombres" ? "bg-signal text-white" : "text-muted hover:text-ink"
            }`}
          >
            Nombres
          </button>
          <button
            onClick={() => setVista("politica")}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              vista === "politica" ? "bg-signal text-white" : "text-muted hover:text-ink"
            }`}
          >
            Política y economía
          </button>
        </div>
      </section>

      {vista === "nombres" ? (
        <section key={mountKey} className="mx-auto w-full max-w-6xl px-6 pb-10 grid md:grid-cols-2 gap-6">
          {/* hoy */}
          <div className="card p-5">
            <p className="font-display text-lg font-semibold tracking-tight">Hoy</p>
            <p className="text-xs text-muted mb-4">
              El día más reciente con datos para cada nombre, contra el día anterior. La
              señal más &laquo;en vivo&raquo; que tenemos, aunque sea con delay.
            </p>
            <ol className="space-y-2.5">
              {nombresHoy.map((r, i) => {
                const diff = r.ayer == null ? null : r.hoy - r.ayer;
                return (
                  <li
                    key={r.slug}
                    className="pulso-row"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <Link
                      href={`/explorar?q=${encodeURIComponent(r.entity)}`}
                      className="flex items-center gap-3 group"
                    >
                      <span className="w-5 shrink-0 text-right font-display text-sm font-semibold text-muted">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium group-hover:text-signal">
                            {r.entity}
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            {r.hoy.toLocaleString("es-AR")}
                            {diff != null && diff !== 0 && (
                              <span className={diff > 0 ? "ml-1 text-up" : "ml-1 text-crisis"}>
                                {diff > 0 ? "▲" : "▼"}
                                {Math.abs(diff)}
                              </span>
                            )}
                            {diff == null && <span className="ml-1 text-signal">nuevo</span>}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                          <div
                            className="pulso-bar h-full rounded-full bg-signal-bright"
                            style={{ width: mountKey ? `${(r.hoy / maxHoy) * 100}%` : "0%" }}
                          />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {!nombresHoy.length && (
                <p className="text-sm text-muted">Todavía no hay datos de hoy.</p>
              )}
            </ol>
          </div>

          {/* acumulado */}
          <div className="card p-5">
            <p className="font-display text-lg font-semibold tracking-tight">Acumulado</p>
            <p className="text-xs text-muted mb-4">
              Volumen total de menciones al aire desde que empezamos a escuchar — todos los
              canales sumados, todo el período.
            </p>
            <ol className="space-y-2.5">
              {nombresAcumulado.map((r, i) => (
                <li
                  key={r.slug}
                  className="pulso-row"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <Link
                    href={`/explorar?q=${encodeURIComponent(r.entity)}`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="w-5 shrink-0 text-right font-display text-sm font-semibold text-muted">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium group-hover:text-signal">
                          {r.entity}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {r.acumulado.toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                        <div
                          className="pulso-bar h-full rounded-full bg-signal"
                          style={{
                            width: mountKey ? `${(r.acumulado / maxAcumulado) * 100}%` : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section key={mountKey} className="mx-auto w-full max-w-6xl px-6 pb-10">
          <div className="card p-5">
            <p className="font-display text-lg font-semibold tracking-tight">
              Temas de política y economía
            </p>
            <p className="text-xs text-muted mb-4">
              Rankeados por un puntaje que combina menciones, crecimiento semana a semana,
              cantidad de canales que lo tocaron y demanda de la audiencia. &laquo;En
              alza&raquo; = viene creciendo fuerte esta semana.
            </p>
            <ol className="space-y-3">
              {temasPolitica.map((r, i) => (
                <li
                  key={r.tema}
                  className="pulso-row"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-5 shrink-0 text-right font-display text-sm font-semibold text-muted pt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium capitalize">{r.tema}</span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {r.enAlza && (
                            <span className="rounded-full bg-up-soft px-2 py-0.5 font-medium text-up">
                              en alza
                            </span>
                          )}
                          <span>{r.menciones.toLocaleString("es-AR")} menciones</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                        <div
                          className="pulso-bar h-full rounded-full bg-signal-bright"
                          style={{ width: mountKey ? `${(r.score / maxScore) * 100}%` : "0%" }}
                        />
                      </div>
                      {r.canales.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted truncate">
                          {r.canales.slice(0, 4).join(" · ")}
                          {r.canales.length > 4 ? ` +${r.canales.length - 4}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {!temasPolitica.length && (
                <p className="text-sm text-muted">Todavía no hay temas identificados.</p>
              )}
            </ol>
          </div>
        </section>
      )}

      {/* hook de pago */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-muted max-w-xl">
            🔒 Esto es un ranking, con delay. El minuto exacto, la audiencia en vivo mirando
            y la reacción del chat en el momento — y avisos automáticos si algo empieza a
            escalar — son lo que ves con cuenta en Palco.
          </p>
          <Link href="/login" className="btn-signal shrink-0">
            Probalo gratis
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-display text-ink font-semibold">
            {APP_NAME}
            <span className="text-signal-bright">.</span>
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
