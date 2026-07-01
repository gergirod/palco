"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { flushPendingAccount } from "@/lib/palco-account";
import { authEnabled, getSupabase } from "@/lib/supabase-auth";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled) {
      setError("Auth no configurado (faltan NEXT_PUBLIC_SUPABASE_*).");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError("No se pudo iniciar el cliente de auth.");
      return;
    }

    let alive = true;

    async function finish(sessionOk: boolean) {
      if (!sessionOk || !alive) return;
      await flushPendingAccount();
      router.replace(next);
    }

    (async () => {
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (!alive) return;
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          void finish(true);
        }
      });

      const { data, error: sessionError } = await sb.auth.getSession();
      if (!alive) return;

      if (sessionError) {
        setError(sessionError.message);
        sub.subscription.unsubscribe();
        return;
      }
      if (data.session) {
        await finish(true);
        return;
      }

      window.setTimeout(async () => {
        if (!alive) return;
        const { data: retry } = await sb.auth.getSession();
        if (retry.session) {
          await finish(true);
        } else {
          setError("El link expiró o ya fue usado. Pedí uno nuevo.");
        }
        sub.subscription.unsubscribe();
      }, 1500);
    })();

    return () => {
      alive = false;
    };
  }, [next, router]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="card p-8 max-w-md w-full text-center">
          <p className="text-sm text-crisis mb-4">{error}</p>
          <Link href="/login" className="btn-signal">
            Volver a ingresar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <p className="text-sm text-muted">Entrando a Palco…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center px-6">
          <p className="text-sm text-muted">Entrando a Palco…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
