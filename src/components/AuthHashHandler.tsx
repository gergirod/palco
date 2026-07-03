"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authEnabled } from "@/lib/supabase-auth";

function authErrorFromHash(hash: string): string | null {
  if (!hash.includes("error=")) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = params.get("error_code") || "";
  if (code === "otp_expired") return "otp_expired";
  if (params.get("error") === "access_denied") return "access_denied";
  return "auth_error";
}

/**
 * Supabase a veces redirige el magic link a la Site URL (/) en vez de
 * /auth/callback. Si el token queda en el hash de otra ruta, lo mandamos
 * al callback para que se establezca la sesión. Errores (link expirado) → /login.
 */
export function AuthHashHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authEnabled || typeof window === "undefined") return;

    const hash = window.location.hash;
    const search = window.location.search;
    const authErr = authErrorFromHash(hash);
    if (authErr) {
      router.replace(`/login?error=${encodeURIComponent(authErr)}`);
      return;
    }

    const hasImplicit = hash.includes("access_token");
    const hasPkce = search.includes("code=");

    if (!hasImplicit && !hasPkce) return;
    if (pathname === "/auth/callback") return;

    const target = hasImplicit
      ? `/auth/callback${hash}`
      : `/auth/callback${search}`;
    router.replace(target);
  }, [pathname, router]);

  return null;
}
