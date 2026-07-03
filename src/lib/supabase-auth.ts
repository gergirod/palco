// Cliente de auth de Palco (login con código OTP por mail). Distinto de
// lib/supabase.ts, que solo lee datasets vía REST. Acá usamos
// @supabase/supabase-js para el login.
//
// Nota: el mail que manda Supabase usa la plantilla "Magic Link" del
// dashboard, pero acá no usamos el link — le pedimos al usuario que tipee
// el código de 6 dígitos. Para que el mail muestre el código hay que editar
// esa plantilla en Supabase (Authentication → Email Templates → Magic Link)
// y agregar {{ .Token }} en el cuerpo.
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

/** Envía el código de acceso al mail (login o alta, según corresponda). */
export async function sendLoginCode(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth no configurado (falta NEXT_PUBLIC_SUPABASE_*)." };
  const { error } = await sb.auth.signInWithOtp({ email });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Confirma el código de 6 dígitos y abre la sesión. */
export async function verifyLoginCode(
  email: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth no configurado (falta NEXT_PUBLIC_SUPABASE_*)." };
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Sesión actual en el browser (null si no hay login o auth deshabilitado). */
export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}
