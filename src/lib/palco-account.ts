import { TRIAL_DIAS, TRIAL_PLAN } from "@/config/trial";
import { getSupabase } from "@/lib/supabase-auth";

export type WatchlistItem = {
  slug: string;
  nombre: string;
  alias: string[];
};

/** Competencia para comparar en el tablero: exactamente 1 por cada entidad
    de la watchlist. Cada competidor apunta, vía `para`, a la entidad contra
    la que se lo compara. */
export const MAX_COMPETIDORES_POR_ENTIDAD = 1;
export type CompetidorItem = WatchlistItem & {
  /** slug de la entidad de la watchlist a la que se compara. */
  para: string;
};

export type AvisosConfig = {
  sensibilidad: "menos" | "equilibrado" | "mas";
  solo_negativo: boolean;
  frecuencia: "al-toque" | "diario" | "semanal";
  email_contacto?: string;
  /** Avisar cuando alguno de tus seguidos entra al Top 10 del Pulso (ranking
   *  de menciones del catálogo). Lo evalúa palco_alerts.py junto al resto de
   *  reglas — este campo solo guarda la preferencia del cliente. */
  avisa_top_pulso?: boolean;
};

export type AccountStatus = "pending" | "trial" | "active" | "blocked";

export type PalcoAccount = {
  user_id: string;
  email: string;
  plan: string | null;
  status: AccountStatus;
  trial_ends_at: string | null;
  watchlist: WatchlistItem[];
  competidores: CompetidorItem[];
  avisos: AvisosConfig;
};

/** Estado de acceso derivado de status + trial_ends_at. */
export type TrialState = {
  /** true si puede usar el tablero. */
  ok: boolean;
  /** por qué: pagó, prueba vigente, vencida o cortada. */
  kind: "active" | "trial" | "expired" | "blocked";
  /** días enteros que faltan (solo en kind="trial"). */
  diasRestantes: number;
  endsAt: Date | null;
};

const MS_DIA = 1000 * 60 * 60 * 24;

/** Decide si la cuenta puede entrar al tablero. Lo automático del flujo. */
export function trialState(acc: PalcoAccount | null | undefined): TrialState {
  if (!acc) return { ok: false, kind: "expired", diasRestantes: 0, endsAt: null };

  if (acc.status === "active") {
    return { ok: true, kind: "active", diasRestantes: 0, endsAt: null };
  }
  if (acc.status === "blocked") {
    return { ok: false, kind: "blocked", diasRestantes: 0, endsAt: null };
  }
  if (acc.status === "pending") {
    return { ok: false, kind: "expired", diasRestantes: 0, endsAt: null };
  }

  // status === "trial": vale mientras no venza trial_ends_at.
  const endsAt = acc.trial_ends_at ? new Date(acc.trial_ends_at) : null;
  if (!endsAt) {
    return { ok: false, kind: "expired", diasRestantes: 0, endsAt: null };
  }
  const restanteMs = endsAt.getTime() - Date.now();
  if (restanteMs <= 0) {
    return { ok: false, kind: "expired", diasRestantes: 0, endsAt };
  }
  return {
    ok: true,
    kind: "trial",
    diasRestantes: Math.max(1, Math.ceil(restanteMs / MS_DIA)),
    endsAt,
  };
}

export const PENDING_ACCOUNT_KEY = "palco_pending_account";

export type PendingPalcoAccount = {
  plan: string;
  watchlist: WatchlistItem[];
  competidores: CompetidorItem[];
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
    const parsed = JSON.parse(raw) as PendingPalcoAccount;
    return { ...parsed, competidores: parsed.competidores ?? [] };
  } catch {
    return null;
  }
}

export function clearPendingAccount() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_ACCOUNT_KEY);
}

export type SavePalcoAccountOpts = {
  /** Al terminar onboarding: plan Pro + prueba de TRIAL_DIAS días. */
  startTrial?: boolean;
};

export async function savePalcoAccount(
  data: PendingPalcoAccount,
  opts?: SavePalcoAccountOpts
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Tenés que estar logueado." };

  const row: Record<string, unknown> = {
    user_id: user.id,
    email: user.email ?? data.avisos.email_contacto ?? "",
    plan: opts?.startTrial ? TRIAL_PLAN : data.plan,
    watchlist: data.watchlist,
    competidores: data.competidores,
    avisos: data.avisos,
    updated_at: new Date().toISOString(),
  };
  if (opts?.startTrial) {
    row.status = "trial";
    row.trial_ends_at = new Date(Date.now() + TRIAL_DIAS * MS_DIA).toISOString();
  }

  const { error } = await sb.from("palco_accounts").upsert(row, { onConflict: "user_id" });

  if (error) return { ok: false, error: error.message };
  clearPendingAccount();
  return { ok: true };
}

/** Elección de plan al vencer la prueba (puede recortar watchlist). */
export async function savePlanChoice(
  plan: string,
  watchlist: WatchlistItem[]
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Tenés que estar logueado." };

  const { error } = await sb
    .from("palco_accounts")
    .update({
      plan,
      watchlist,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
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

/** Tras login: onboarding si falta configurar; tablero si ya tiene watchlist. */
export async function resolvePostAuthPath(): Promise<string> {
  const acc = await loadPalcoAccount();
  if (isPalcoAccountConfigured(acc)) {
    const q = dashboardQueryFromAccount(acc!);
    return q ? `/dashboard?${q}` : "/dashboard";
  }
  return "/onboarding?from=login";
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
    .select("user_id, email, plan, status, trial_ends_at, watchlist, competidores, avisos")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user_id: data.user_id,
    email: data.email,
    plan: data.plan,
    status: (data.status as AccountStatus) ?? "pending",
    trial_ends_at: (data.trial_ends_at as string | null) ?? null,
    watchlist: (data.watchlist as WatchlistItem[]) ?? [],
    competidores: (data.competidores as CompetidorItem[]) ?? [],
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
