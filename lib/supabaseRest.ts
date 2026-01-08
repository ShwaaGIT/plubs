const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL) {
  // Not throwing to allow build; runtime routes will validate
}

export async function sbFetch(path: string, init?: RequestInit) {
  if (!SB_URL || !SB_KEY) throw new Error("Supabase env vars not set");
  const url = `${SB_URL.replace(/\/$/, "")}/rest/v1${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers as HeadersInit);
  headers.set("apikey", SB_KEY);
  headers.set("Authorization", `Bearer ${SB_KEY}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers });
}

export type Json = Record<string, any> | any[] | null;

export async function sbJson(path: string, init?: RequestInit): Promise<any> {
  const res = await sbFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase REST error ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

