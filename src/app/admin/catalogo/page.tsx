"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import bundledCatalog from "@/data/palco_catalog.json";
import bundledEntities from "@/data/palco_entities.json";
import { fetchDatasets } from "@/lib/supabase";
import {
  buildMergeTargets,
  candidateKey,
  EMPTY_DECISIONS,
  findMergeGroups,
  isCandidateReviewed,
  kindLabel,
  norm,
  type CatalogCandidate,
  type CatalogData,
  type CatalogDecisions,
  type MergeTarget,
  type Promovida,
} from "@/lib/palco-catalog-admin";
import { APP_NAME } from "@/config/app";

type IndexRow = { slug: string; name: string; type: string };

async function postDecision(body: Record<string, unknown>) {
  const res = await fetch("/api/admin-panel/catalogo/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error al guardar");
  return data;
}

function AliasChips({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1 rounded-full bg-signal-soft px-2.5 py-0.5 text-xs"
          >
            {a}
            <button
              type="button"
              className="text-muted hover:text-crisis"
              onClick={() => onChange(values.filter((x) => x !== a))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Agregar alias"
          className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draft.trim();
              if (v && !values.includes(v)) onChange([...values, v]);
              setDraft("");
            }
          }}
        />
      </div>
    </div>
  );
}

function CandidateRow({
  c,
  mergeTargets,
  busy,
  onAction,
}: {
  c: CatalogCandidate;
  mergeTargets: MergeTarget[];
  busy: boolean;
  onAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "promote" | "merge">("idle");
  const [name, setName] = useState(c.canonical_guess);
  const [type, setType] = useState(c.kind === "empresa" ? "Empresa" : "Político");
  const [alias, setAlias] = useState(c.forms.filter((f) => norm(f) !== norm(c.canonical_guess)));
  const [excluir, setExcluir] = useState<string[]>([]);
  const [mergeQ, setMergeQ] = useState("");
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);

  const filteredTargets = useMemo(() => {
    const q = mergeQ.trim().toLowerCase();
    if (!q) return mergeTargets.slice(0, 40);
    return mergeTargets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        norm(t.name).includes(q)
    );
  }, [mergeTargets, mergeQ]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-lg">{c.canonical_guess}</h3>
          <p className="text-sm text-muted mt-0.5">
            {kindLabel(c.kind)} · {c.mentions} menc. · {c.programs} prog.
            {c.channels != null && ` · ${c.channels} can.`}
            {c.confidence && ` · conf. ${c.confidence}`}
          </p>
          {c.forms.length > 1 && (
            <p className="text-xs text-muted mt-1">
              Formas: {c.forms.slice(0, 6).join(", ")}
              {c.forms.length > 6 && ` (+${c.forms.length - 6})`}
            </p>
          )}
        </div>
        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="btn-signal text-xs px-3 py-1.5"
              onClick={() => setMode("promote")}
            >
              Promover
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => setMode("merge")}
            >
              Fusionar con…
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:border-crisis hover:text-crisis"
              onClick={() =>
                onAction({ tipo: "descartar", canonical_guess: c.canonical_guess })
              }
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      {mode === "promote" && (
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Nombre canónico</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm bg-white"
              >
                <option value="Político">Político / Persona</option>
                <option value="Empresa">Empresa</option>
                <option value="Deporte">Deporte</option>
                <option value="Música">Música</option>
                <option value="Tema">Tema</option>
              </select>
            </label>
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Alias</p>
            <AliasChips values={alias} onChange={setAlias} />
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Excluir (opcional)</p>
            <AliasChips values={excluir} onChange={setExcluir} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="btn-signal text-xs px-4 py-2"
              onClick={() =>
                onAction({
                  tipo: "promover",
                  slug: c.slug_guess,
                  name,
                  type,
                  alias,
                  excluir,
                })
              }
            >
              Confirmar promoción
            </button>
            <button type="button" className="btn-ghost text-xs px-4 py-2" onClick={() => setMode("idle")}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mode === "merge" && (
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <input
            value={mergeQ}
            onChange={(e) => setMergeQ(e.target.value)}
            placeholder="Buscar entidad destino…"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredTargets.map((t) => (
              <button
                key={t.slug}
                type="button"
                className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                  mergeTarget?.slug === t.slug ? "bg-signal-soft border border-signal-line" : "hover:bg-white"
                }`}
                onClick={() => setMergeTarget(t)}
              >
                {t.name} <span className="text-muted">({t.type})</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !mergeTarget}
              className="btn-signal text-xs px-4 py-2 disabled:opacity-50"
              onClick={() =>
                onAction({
                  tipo: "fusionar",
                  canonical_guess: c.canonical_guess,
                  target_name: mergeTarget!.name,
                })
              }
            >
              Fusionar en {mergeTarget?.name ?? "…"}
            </button>
            <button type="button" className="btn-ghost text-xs px-4 py-2" onClick={() => setMode("idle")}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCatalogoPage() {
  const [catalog, setCatalog] = useState<CatalogData>(bundledCatalog as CatalogData);
  const [decisions, setDecisions] = useState<CatalogDecisions>(EMPTY_DECISIONS);
  const [index, setIndex] = useState<IndexRow[]>(
    (bundledEntities as { index?: IndexRow[] }).index ?? []
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const batch = await fetchDatasets([
        "palco_catalog",
        "palco_catalog_decisions",
        "palco_entities",
      ]);
      if (batch.palco_catalog) setCatalog(batch.palco_catalog as CatalogData);
      if (batch.palco_catalog_decisions) {
        setDecisions(batch.palco_catalog_decisions as CatalogDecisions);
      } else {
        setDecisions(EMPTY_DECISIONS);
      }
      const ents = batch.palco_entities as { index?: IndexRow[] } | undefined;
      if (ents?.index) setIndex(ents.index);
    } catch {
      setErr("No se pudieron cargar los datasets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const mergeTargets = useMemo(
    () => buildMergeTargets(index, catalog.curated ?? [], decisions.promovidas ?? []),
    [index, catalog.curated, decisions.promovidas]
  );

  const { pending, reviewed, groups } = useMemo(() => {
    const all = catalog.candidates ?? [];
    const pend: CatalogCandidate[] = [];
    const rev: CatalogCandidate[] = [];
    for (const c of all) {
      (isCandidateReviewed(c, decisions) ? rev : pend).push(c);
    }
    pend.sort((a, b) => b.mentions - a.mentions);
    rev.sort((a, b) => b.mentions - a.mentions);
    return { pending: pend, reviewed: rev, groups: findMergeGroups(pend) };
  }, [catalog.candidates, decisions]);

  const groupedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const c of g) s.add(candidateKey(c));
    return s;
  }, [groups]);

  async function handleAction(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const data = await postDecision(body);
      if (data.decisions) setDecisions(data.decisions);
      else await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function mergeGroup(group: CatalogCandidate[]) {
    const best = [...group].sort((a, b) => b.mentions - a.mentions)[0];
    setBusy(true);
    try {
      await postDecision({
        tipo: "fusionar_grupo",
        target_name: best.canonical_guess,
        items: group.map((c) => ({ canonical_guess: c.canonical_guess })),
      });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin-panel/session", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="font-display text-lg font-semibold">
              {APP_NAME}<span className="text-signal">.</span>
            </Link>
            <p className="text-sm text-muted">Curación de catálogo</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={reload} disabled={loading}>
              {loading ? "Cargando…" : "Refrescar"}
            </button>
            <button type="button" className="text-xs text-muted hover:text-ink px-2" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <strong>{pending.length}</strong> pendientes
          </span>
          <span className="text-muted">
            {reviewed.length} revisadas · {decisions.promovidas.length} promovidas ·{" "}
            {Object.keys(decisions.fusiones).length} fusiones · {decisions.descartadas.length}{" "}
            descartadas
          </span>
          {catalog.generated_at && (
            <span className="text-muted">Catálogo: {catalog.generated_at.slice(0, 19)}</span>
          )}
        </div>

        {err && <p className="text-sm text-crisis rounded-lg bg-crisis-soft px-4 py-2">{err}</p>}

        {groups.map((group) => (
          <div key={group.map((c) => c.slug_guess).join("-")} className="card p-4 border-signal-line bg-signal-soft/30">
            <p className="text-sm font-medium mb-2">¿Son la misma entidad?</p>
            <ul className="text-sm text-muted mb-3 space-y-0.5">
              {group.map((c) => (
                <li key={c.slug_guess}>
                  {c.canonical_guess} — {c.mentions} menc.
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              className="btn-signal text-xs px-4 py-2"
              onClick={() => mergeGroup(group)}
            >
              Fusionar todas en la de mayor mención
            </button>
          </div>
        ))}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Candidatas pendientes</h2>
          {pending.length === 0 && !loading && (
            <p className="text-sm text-muted">No hay candidatas pendientes.</p>
          )}
          {pending
            .filter((c) => !groupedKeys.has(candidateKey(c)))
            .map((c) => (
              <CandidateRow
                key={c.slug_guess}
                c={c}
                mergeTargets={mergeTargets}
                busy={busy}
                onAction={handleAction}
              />
            ))}
        </section>

        {reviewed.length > 0 && (
          <section>
            <button
              type="button"
              className="text-sm text-muted hover:text-ink mb-3"
              onClick={() => setShowReviewed((v) => !v)}
            >
              {showReviewed ? "▾" : "▸"} Ya revisadas ({reviewed.length})
            </button>
            {showReviewed && (
              <div className="space-y-2 opacity-70">
                {reviewed.map((c) => {
                  const key = candidateKey(c);
                  let status = "revisada";
                  if (decisions.descartadas.includes(key)) status = "descartada";
                  else if (key in decisions.fusiones) status = `fusionada → ${decisions.fusiones[key]}`;
                  else if (decisions.promovidas.some((p) => p.slug === c.slug_guess)) status = "promovida";
                  return (
                    <div key={c.slug_guess} className="card p-3 text-sm flex justify-between">
                      <span>{c.canonical_guess}</span>
                      <span className="text-muted">{status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {(decisions.promovidas as Promovida[]).length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold mb-2">Promovidas (en Supabase)</h2>
            <div className="space-y-2">
              {decisions.promovidas.map((p) => (
                <div key={p.slug} className="card p-3 text-sm">
                  <strong>{p.name}</strong> ({p.type}) — alias: {p.alias.join(", ") || "—"}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
