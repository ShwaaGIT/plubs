import type { NextRequest } from "next/server";

export type ServerPlace = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
};

export type FilterKey = "pubs" | "clubs" | "bars";

export type SearchInput = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  filters: Record<FilterKey, boolean>;
  limit?: number;
};

type NearbyResponse = {
  results: any[];
  next_page_token?: string;
  status: string;
};

const BASE = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

export async function searchPlaces(input: SearchInput): Promise<ServerPlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const requested: { type?: string; keyword?: string }[] = [];
  if (input.filters.pubs) requested.push({ keyword: "pub" }, { type: "bar" });
  if (input.filters.clubs) requested.push({ type: "night_club" });
  if (input.filters.bars) requested.push({ type: "bar" });

  // If no filters, nothing to do
  if (!requested.length) return [];

  const dedup = new Map<string, ServerPlace>();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 40);

  for (const req of requested) {
    const params = new URLSearchParams({
      key,
      location: `${input.centerLat},${input.centerLng}`,
      radius: String(input.radiusMeters),
      rankby: "prominence",
      opennow: "false",
    });
    if (req.type) params.set("type", req.type);
    if (req.keyword) params.set("keyword", req.keyword);

    let pageToken: string | undefined = undefined;
    let pages = 0;
    do {
      const url = pageToken ? `${BASE}?pagetoken=${pageToken}&key=${key}` : `${BASE}?${params.toString()}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`Places request failed: ${res.status}`);
      const data: NearbyResponse = await res.json();
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        if (data.status === "OVER_QUERY_LIMIT") throw new Error("Places API quota exceeded");
        break;
      }
      for (const r of data.results) {
        const id = r.place_id as string;
        if (dedup.has(id)) continue;
        const place: ServerPlace = {
          place_id: id,
          name: r.name,
          lat: r.geometry?.location?.lat,
          lng: r.geometry?.location?.lng,
          address: r.vicinity ?? r.formatted_address ?? "",
          rating: r.rating,
          user_ratings_total: r.user_ratings_total,
          types: r.types,
        };
        dedup.set(id, place);
        if (dedup.size >= limit) break;
      }
      if (dedup.size >= limit) break;
      pageToken = data.next_page_token;
      pages++;
      if (pageToken) await waitMs(1200); // API requires a short delay before next page token is valid
    } while (pageToken && pages < 3 && dedup.size < limit);
    if (dedup.size >= limit) break;
  }

  return Array.from(dedup.values()).slice(0, limit);
}

function waitMs(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// In-memory cache with TTL
type CacheKey = string;
type CacheEntry = { at: number; value: ServerPlace[] };
const CACHE = new Map<CacheKey, CacheEntry>();
const TTL_MS = 2 * 60 * 1000; // 2 minutes

export function cacheGet(key: CacheKey) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  if (hit) CACHE.delete(key);
  return null;
}
export function cacheSet(key: CacheKey, value: ServerPlace[]) {
  CACHE.set(key, { at: Date.now(), value });
}

export function makeCacheKey(input: SearchInput) {
  const rlat = round(input.centerLat, 4);
  const rlng = round(input.centerLng, 4);
  const rads = input.radiusMeters;
  const f = [input.filters.pubs ? "pubs" : "", input.filters.clubs ? "clubs" : "", input.filters.bars ? "bars" : ""].filter(Boolean).join("|");
  return `${rlat},${rlng}:${rads}:${f}`;
}

function round(n: number, dp: number) {
  const m = 10 ** dp;
  return Math.round(n * m) / m;
}

