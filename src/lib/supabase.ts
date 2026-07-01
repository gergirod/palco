// Lectura de datasets desde Supabase (tabla ui_data). Isomórfico (server + client).
// Si no hay env configurado o falla, devuelve null y el caller usa el JSON del bundle.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(URL && ANON);

export async function fetchDataset<T>(key: string): Promise<T | null> {
  const batch = await fetchDatasets([key]);
  const payload = batch[key];
  return payload != null ? (payload as T) : null;
}

/** Una sola request REST para N datasets (PostgREST `in`). */
export async function fetchDatasets(keys: string[]): Promise<Record<string, unknown>> {
  if (!URL || !ANON || !keys.length) return {};
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return {};

  try {
    if (unique.length === 1) {
      const one = await fetchDatasetRaw(unique[0]);
      return one != null ? { [unique[0]]: one } : {};
    }

    const inList = unique.map((k) => encodeURIComponent(k)).join(",");
    const res = await fetch(
      `${URL}/rest/v1/ui_data?key=in.(${inList})&select=key,payload`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return {};
    const rows = (await res.json()) as { key: string; payload: unknown }[];
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      if (row?.key && row.payload != null) out[row.key] = row.payload;
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchDatasetRaw(key: string): Promise<unknown | null> {
  if (!URL || !ANON) return null;
  try {
    const res = await fetch(
      `${URL}/rest/v1/ui_data?key=eq.${encodeURIComponent(key)}&select=payload`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.payload ?? null;
  } catch {
    return null;
  }
}
