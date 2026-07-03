"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, authEnabled } from "@/lib/supabase-auth";
import { APP_NAME } from "@/config/app";

const AUTH_ERRORS: Record<string, string> = {
  otp_expired:
    "El link del mail expiró o ya fue usado. Pedí uno nuevo abajo — llega al instante y dura ~1 hora.",
  access_denied:
    "No se pudo completar el ingreso con ese link. Pedí uno nuevo.",
  auth_error: "Hubo un problema con el link de acceso. Pedí uno nuevo.",
};

function LoginForm() {
  const params = useSearchParams();
  const authError = params.get("error");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    const r = await sendMagicLink(email.trim());
    if (r.ok) {
      setState("sent");
    } else {
      setState("error");
      setMsg(r.error || "No se pudo enviar el link.");
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          {APP_NAME}<span className="text-signal">.</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <p className="eyebrow mb-3">Ingresar</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
              Entrá a tu panel
            </h1>
            <p className="text-sm text-muted mb-6">
              Te mandamos un link a tu mail. Después elegís a quién seguir y arrancás tu
              prueba gratis de 2 días. Sin contraseñas.
            </p>

            {authError && state !== "sent" && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {AUTH_ERRORS[authError] ??
                  decodeURIComponent(authError.replace(/\+/g, " ")) ??
                  AUTH_ERRORS.auth_error}
              </div>
            )}

            {state === "sent" ? (
              <div className="rounded-xl bg-signal-soft border border-line p-4 text-sm">
                Listo. Revisá <span className="font-medium">{email}</span> y abrí el link.
                El siguiente paso es elegir tus nombres y abrir el panel.
                <p className="mt-2 text-xs text-muted">
                  Si no llega en 2 minutos, revisá spam. Usá el link apenas llegue — vence en
                  ~1 hora y solo funciona una vez.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@empresa.com"
                  className="w-full rounded-full border border-line bg-white px-5 py-3 text-[16px] outline-none focus:border-signal sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="btn-signal w-full disabled:opacity-60"
                >
                  {state === "sending" ? "Enviando…" : "Enviarme el link"}
                </button>
                {state === "error" && (
                  <p className="text-sm text-crisis">{msg}</p>
                )}
                {!authEnabled && (
                  <p className="text-xs text-muted">
                    Modo demo: auth no configurado todavía.
                  </p>
                )}
              </form>
            )}
          </div>

          <p className="text-center text-sm text-muted mt-6">
            ¿Primera vez? Ingresá con tu mail — el onboarding empieza después del link.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
