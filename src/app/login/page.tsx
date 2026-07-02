"use client";

import Link from "next/link";
import { useState } from "react";
import { sendMagicLink, authEnabled } from "@/lib/supabase-auth";

export default function LoginPage() {
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
          Palco<span className="text-signal">.</span>
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

            {state === "sent" ? (
              <div className="rounded-xl bg-signal-soft border border-line p-4 text-sm">
                Listo. Revisá <span className="font-medium">{email}</span> y abrí el link.
                El siguiente paso es elegir tus nombres y abrir el panel.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@empresa.com"
                  className="w-full rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:border-signal"
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
