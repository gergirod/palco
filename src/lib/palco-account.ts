import { getSupabase } from "@/lib/supabase-auth";

export type WatchlistItem = {
  slug: string;
  nombre: string;
  alias: string[];
};

export type AvisosConfig = {
  sensibilidad: "menos" | "equilibrado" | "mas";
  solo_negativo: boolean;
  frecuencia: "al-toque" | "diario" | "semanal";
  email_contacto?: string;
};

export type PalcoAccount = {
  user_id: string;
  email: string;
  plan: string | null;
  watchlist: WatchlistItem[];
  avisos: AvisosConfig;
};

export const PENDING_ACCOUNT_KEY = "palco_pending_account";

export type PendingPalcoAccount = {
  plan: string;
  watchlist: WatchlistItem[];
  avisos: AvisosConfig;
};

export function stashPendingAccount(data: PendingPalcoAccount) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_ACCOUNT_KEY, JSON.stringify(data));
}

export function readPendingAccount(): PendingPalcoAccount | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PENDING_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPalcoAccount;
  } catch {
    return null;
  }
}

export function clearPendingAccount() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_ACCOUNT_KEY);
}

export async function savePalcoAccount(data: PendingPalcoAccount): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Tenés que estar logueado." };

  const { error } = await sb.from("palco_accounts").upsert(
    {
      user_id: user.id,
      email: user.email ?? data.avisos.email_contacto ?? "",
      plan: data.plan,
      watchlist: data.watchlist,
      avisos: data.avisos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: error.message };
  clearPendingAccount();
  return { ok: true };
}

/** Guarda la config pendiente del onboarding tras el magic link. */
export async function flushPendingAccount(): Promise<{ ok: boolean; error?: string }> {
  const pending = readPendingAccount();
  if (!pending) return { ok: true };
  return savePalcoAccount(pending);
}

/** Cuenta lista para usar el tablero (completó onboarding). */
export function isPalcoAccountConfigured(acc: PalcoAccount | null | undefined): boolean {
  return Boolean(acc?.watchlist?.length && acc.plan);
}

/** Tras login: tablero si ya configuró, onboarding si no. */
export async function resolvePostAuthPath(): Promise<string> {
  const acc = await loadPalcoAccount();
  if (isPalcoAccountConfigured(acc)) {
    const q = dashboardQueryFromAccount(acc!);
    return q ? `/dashboard?${q}` : "/dashboard";
  }
  return "/onboarding";
}

export async function loadPalcoAccount(): Promise<PalcoAccount | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("palco_accounts")
    .select("user_id, email, plan, watchlist, avisos")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user_id: data.user_id,
    email: data.email,
    plan: data.plan,
    watchlist: (data.watchlist as WatchlistItem[]) ?? [],
    avisos: (data.avisos as AvisosConfig) ?? {
      sensibilidad: "equilibrado",
      solo_negativo: false,
      frecuencia: "diario",
    },
  };
}

export function dashboardQueryFromAccount(acc: PalcoAccount): string {
  const slugs = acc.watchlist.map((w) => w.slug).filter(Boolean);
  const p = new URLSearchParams();
  if (slugs.length) p.set("e", slugs.join(","));
  if (acc.plan) p.set("plan", acc.plan);
  const a = acc.avisos;
  if (a.sensibilidad) p.set("sens", a.sensibilidad);
  if (a.solo_negativo) p.set("neg", "1");
  if (a.frecuencia) p.set("freq", a.frecuencia);
  const mail = a.email_contacto || acc.email;
  if (mail) p.set("mail", mail);
  return p.toString();
}
