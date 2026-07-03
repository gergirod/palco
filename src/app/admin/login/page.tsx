"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { APP_NAME } from "@/config/app";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/catalogo";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/admin-panel/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace(next);
      return;
    }
    setState("error");
    const data = await res.json().catch(() => ({}));
    setMsg(data.error || "Contraseña incorrecta");
  }

  return (
    <main className="min-h-screen flex flex-col bg-surface">
      <header className="px-6 py-5">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          {APP_NAME}<span className="text-signal">.</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <p className="eyebrow mb-3">Admin</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
              Curación de catálogo
            </h1>
            <p className="text-sm text-muted mb-6">
              Panel interno. Promover, fusionar o descartar candidatas del catálogo.
            </p>

            <form onSubmit={submit} className="space-y-3">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full rounded-full border border-line bg-white px-5 py-3 text-[16px] outline-none focus:border-signal sm:text-sm"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="btn-signal w-full disabled:opacity-60"
              >
                {state === "sending" ? "Entrando…" : "Entrar"}
              </button>
              {state === "error" && <p className="text-sm text-crisis">{msg}</p>}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
