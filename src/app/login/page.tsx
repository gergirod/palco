"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendLoginCode, verifyLoginCode, authEnabled } from "@/lib/supabase-auth";
import { flushPendingAccount, resolvePostAuthPath } from "@/lib/palco-account";
import { APP_NAME } from "@/config/app";

const AUTH_ERRORS: Record<string, string> = {
  otp_expired: "El código venció o ya fue usado. Pedí uno nuevo abajo.",
  access_denied: "No se pudo completar el ingreso. Pedí un código nuevo.",
  auth_error: "Hubo un problema con el acceso. Pedí un código nuevo.",
};

type Step = "email" | "code";
type State = "idle" | "sending" | "verifying" | "error";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const authError = params.get("error");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    const r = await sendLoginCode(email.trim());
    if (r.ok) {
      setState("idle");
      setStep("code");
    } else {
      setState("error");
      setMsg(r.error || "No se pudo enviar el código.");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setState("verifying");
    const r = await verifyLoginCode(email.trim(), code.trim());
    if (!r.ok) {
      setState("error");
      setMsg(r.error || "Código incorrecto o vencido.");
      return;
    }
    await flushPendingAccount();
    const dest = await resolvePostAuthPath();
    router.push(dest);
  }

  async function resend() {
    setState("sending");
    const r = await sendLoginCode(email.trim());
    if (r.ok) {
      setState("idle");
      setMsg("");
    } else {
      setState("error");
      setMsg(r.error || "No se pudo reenviar el código.");
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
            {authError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {AUTH_ERRORS[authError] ??
                  decodeURIComponent(authError.replace(/\+/g, " ")) ??
                  AUTH_ERRORS.auth_error}
              </div>
            )}

            {step === "email" ? (
              <>
                <p className="eyebrow mb-3">Ingresar</p>
                <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
                  Entrá a tu panel
                </h1>
                <p className="text-sm text-muted mb-6">
                  Te mandamos un código a tu mail. Si ya tenés cuenta, entrás directo a tu
                  panel; si es tu primera vez, elegís a quién seguir y arrancás tu prueba
                  gratis de 2 días. Sin contraseñas.
                </p>
                <form onSubmit={submitEmail} className="space-y-3">
                  <input
                    type="email"
                    required
                    autoFocus
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
                    {state === "sending" ? "Enviando…" : "Enviarme el código"}
                  </button>
                  {state === "error" && <p className="text-sm text-crisis">{msg}</p>}
                  {!authEnabled && (
                    <p className="text-xs text-muted">
                      Modo demo: auth no configurado todavía.
                    </p>
                  )}
                </form>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">Revisá tu mail</p>
                <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
                  Ingresá el código
                </h1>
                <p className="text-sm text-muted mb-6">
                  Te mandamos un código de 6 dígitos a{" "}
                  <span className="font-medium">{email}</span>. Vale por poco tiempo.
                </p>
                <form onSubmit={submitCode} className="space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full rounded-full border border-line bg-white px-5 py-3 text-center text-[20px] tracking-[0.3em] outline-none focus:border-signal"
                  />
                  <button
                    type="submit"
                    disabled={state === "verifying"}
                    className="btn-signal w-full disabled:opacity-60"
                  >
                    {state === "verifying" ? "Verificando…" : "Confirmar"}
                  </button>
                  {state === "error" && <p className="text-sm text-crisis">{msg}</p>}
                  {state !== "error" && msg && (
                    <p className="text-sm text-muted">{msg}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setCode("");
                        setState("idle");
                        setMsg("");
                      }}
                      className="hover:text-ink underline underline-offset-2"
                    >
                      Cambiar mail
                    </button>
                    <button
                      type="button"
                      onClick={resend}
                      disabled={state === "sending"}
                      className="hover:text-ink underline underline-offset-2 disabled:opacity-60"
                    >
                      Reenviar código
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {step === "email" && (
            <p className="text-center text-sm text-muted mt-6">
              ¿Primera vez? Ingresá con tu mail — el onboarding empieza después del código.
            </p>
          )}
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
