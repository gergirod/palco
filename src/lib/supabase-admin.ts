/** Escritura server-side en ui_data (service role). */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;

export function supabaseAdminEnabled(): boolean {
  return Boolean(URL && SERVICE);
}

export async function fetchUiPayload<T>(key: string): Promise<T | null> {
  if (!URL || !SERVICE) return null;
  try {
    const res = await fetch(
      `${URL}/rest/v1/ui_data?key=eq.${encodeURIComponent(key)}&select=payload`,
      {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return (rows?.[0]?.payload as T) ?? null;
  } catch {
    return null;
  }
}

export async function upsertUiPayload(key: string, payload: unknown): Promise<boolean> {
  if (!URL || !SERVICE) return false;
  try {
    const res = await fetch(`${URL}/rest/v1/ui_data`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify([{ key, payload }]),
    });
    return res.ok;
  } catch {
    return false;
  }
}
