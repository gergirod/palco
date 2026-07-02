"use client";

import { useMemo, useState } from "react";
import { PLANES, type PlanId } from "@/config/plans";
import { TRIAL_DIAS, PAGO } from "@/config/trial";
import type { PalcoAccount, WatchlistItem } from "@/lib/palco-account";
import { savePlanChoice } from "@/lib/palco-account";

const BRAND = "#b45309";

type Props = {
  account: PalcoAccount;
  email: string;
};

export function PaywallExpired({ account, email }: Props) {
  const [planId, setPlanId] = useState<PlanId>(
    (account.plan === "esencial" || account.plan === "profesional"
      ? account.plan
      : "profesional") as PlanId
  );
  const plan = PLANES.find((p) => p.id === planId)!;
  const [keep, setKeep] = useState<string[]>(() =>
    account.watchlist.slice(0, plan.limite).map((w) => w.slug)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const needsTrim = account.watchlist.length > plan.limite;

  const keepRows = useMemo(
    () => account.watchlist.filter((w) => keep.includes(w.slug)),
    [account.watchlist, keep]
  );

  function toggleKeep(slug: string) {
    setKeep((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= plan.limite) return cur;
      return [...cur, slug];
    });
  }

  async function guardarEleccion() {
    if (needsTrim && keep.length === 0) return;
    if (needsTrim && keep.length > plan.limite) return;
    setSaving(true);
    const watchlist: WatchlistItem[] = needsTrim
      ? account.watchlist.filter((w) => keep.includes(w.slug))
      : account.watchlist;
    const r = await savePlanChoice(planId, watchlist);
    setSaving(false);
    if (r.ok) setSaved(true);
    else window.alert(r.error ?? "No se pudo guardar.");
  }

  const waMsg = encodeURIComponent(
    `Hola! Se me terminó la prueba de Palco (${email}). Quiero el plan ${plan.nombre} (${plan.precio}).${
      needsTrim
        ? ` Dejo estos nombres: ${keepRows.map((w) => w.nombre).join(", ")}.`
        : ` Mis nombres: ${account.watchlist.map((w) => w.nombre).join(", ")}.`
    }`
  );
  const waUrl = `https://wa.me/${PAGO.whatsapp}?text=${waMsg}`;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-5 py-10 text-slate-900">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ backgroundColor: BRAND }}
        >
          🔒
        </div>
        <h1 className="mt-4 text-center text-2xl font-bold">Se terminó tu prueba gratis</h1>
        <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-600">
          Tuviste {TRIAL_DIAS} días con el plan Pro. Elegí con qué plan seguir y activalo
          para volver al tablero.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {PLANES.filter((p) => !p.aMedida).map((p) => {
            const on = p.id === planId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPlanId(p.id);
                  setKeep(account.watchlist.slice(0, p.limite).map((w) => w.slug));
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  on ? "border-[#b45309] ring-2 ring-[#f5d9b0]" : "border-slate-200 hover:border-slate-400"
                }`}
                style={on ? { backgroundColor: "#fbebd6" } : undefined}
              >
                <p className="font-semibold text-slate-900">{p.nombre}</p>
                <p className="text-[12px] text-slate-500">{p.para}</p>
                <p className="mt-1 text-[14px] font-bold" style={{ color: BRAND }}>
                  {p.precio}
                </p>
              </button>
            );
          })}
        </div>

        {needsTrim && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] font-medium text-amber-900">
              El plan {plan.nombre} permite {plan.limite}{" "}
              {plan.limite === 1 ? "nombre" : "nombres"}. Elegí cuáles seguís:
            </p>
            <div className="mt-3 space-y-2">
              {account.watchlist.map((w) => {
                const on = keep.includes(w.slug);
                const bloq = !on && keep.length >= plan.limite;
                return (
                  <button
                    key={w.slug}
                    type="button"
                    disabled={bloq}
                    onClick={() => toggleKeep(w.slug)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] ${
                      on
                        ? "border-[#b45309] bg-white"
                        : bloq
                          ? "border-slate-200 opacity-40"
                          : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <span className="font-medium">{w.nombre}</span>
                    <span className="text-slate-400">{on ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {!saved && needsTrim && (
            <button
              type="button"
              onClick={() => void guardarEleccion()}
              disabled={saving || keep.length === 0 || keep.length > plan.limite}
              className="rounded-lg px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BRAND }}
            >
              {saving ? "Guardando…" : "Guardar elección de nombres"}
            </button>
          )}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-6 py-3 text-center text-[15px] font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            Activar plan {plan.nombre} por WhatsApp
          </a>
          {PAGO.mercadoPagoUrl && (
            <a
              href={PAGO.mercadoPagoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-center text-[15px] font-semibold text-slate-700 hover:border-slate-400"
            >
              Pagar con Mercado Pago
            </a>
          )}
        </div>

        <p className="mt-5 border-t border-slate-100 pt-4 text-center text-[12px] text-slate-400">
          Cuando activemos tu pago, el tablero se desbloquea al instante.
        </p>
      </div>
    </main>
  );
}
