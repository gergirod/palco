"use client";

import { TRIAL_DIAS, mailtoPagoUrl } from "@/config/trial";
import type { PalcoAccount } from "@/lib/palco-account";
import { APP_NAME } from "@/config/app";

const BRAND = "var(--signal)";

type Props = {
  account: PalcoAccount;
  email: string;
};

/** Pantalla que ve el usuario cuando `trialState` da ok:false y hay cuenta
 *  (status "pending" recién armada en onboarding, o "trial" ya vencido).
 *  Venta por mail, no self-serve: no elegís plan ni precio acá — le
 *  escribís a Germán y él activa la cuenta a mano en Supabase. */
export function PaywallExpired({ account, email }: Props) {
  const nombres = account.watchlist.map((w) => w.nombre);
  const detalle = nombres.length ? nombres.join(", ") : undefined;
  const waUrl = mailtoPagoUrl(email, detalle);

  const esNueva = account.status === "pending";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-5 py-10 text-slate-900">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ backgroundColor: BRAND }}
        >
          🔒
        </div>

        {esNueva ? (
          <>
            <h1 className="mt-4 text-center text-2xl font-bold">Ya armamos tu monitoreo</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-600">
              Cargaste a quién seguir — nos falta activarlo. Escribinos y en el
              día te habilitamos {TRIAL_DIAS} días para que lo veas en vivo.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-center text-2xl font-bold">Se terminó tu prueba gratis</h1>
            <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-600">
              Tuviste {TRIAL_DIAS} días viendo en vivo. Escribinos y seguimos con tu
              monitoreo, sin perder nada de lo que ya cargaste.
            </p>
          </>
        )}

        {nombres.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              A quién estás siguiendo
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nombres.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[13px] font-medium text-slate-700"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <a
            href={waUrl}
            className="rounded-lg px-6 py-3 text-center text-[15px] font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {esNueva ? "Activar mi monitoreo por mail" : "Seguir por mail"}
          </a>
        </div>

        <p className="mt-5 border-t border-slate-100 pt-4 text-center text-[12px] text-slate-400">
          Te respondemos directo desde {APP_NAME} — sin vueltas, sin tarjeta hasta que
          arreglemos el plan juntos.
        </p>
      </div>
    </main>
  );
}
