// Cliente de auth de Palco (magic link). Distinto de lib/supabase.ts,
// que solo lee datasets vía REST. Acá usamos @supabase/supabase-js para el login.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(URL && ANON);

let _client: SupabaseClient | null = null;

/** Singleton en el browser. Devuelve null si no hay env (modo demo sin login). */
export function getSupabase(): SupabaseClient | null {
  if (!authEnabled) return null;
  if (_client) return _client;
  _client = createClient(URL as string, ANON as string, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

/** Envía el magic link al mail. redirectTo vuelve al dashboard. */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth no configurado (falta NEXT_PUBLIC_SUPABASE_*)." };
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/dashboard` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
