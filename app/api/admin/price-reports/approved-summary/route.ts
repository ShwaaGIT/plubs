import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbFetch, sbJson } from "@/lib/supabaseRest";

async function requireAdmin(req: Request) {
  const profileId = readCookie(req.headers.get("cookie"));
  if (!profileId) return { ok: false as const, status: 401, error: "Not authenticated" };
  const id = encodeURIComponent(profileId);
  const res = await sbFetch(`/profiles?select=id,admin,display_name&id=eq.${id}&limit=1`);
  if (!res.ok) return { ok: false as const, status: 401, error: "Auth check failed" };
  const rows = (await res.json()) as any[];
  const me = rows[0];
  if (!me?.admin) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

type Group = {
  place_id: string;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  mixer?: string | null;
  size_label?: string | null;
  ml?: number | null;
};

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const groups: Group[] = Array.isArray(body?.groups) ? body.groups : [];
    if (!groups.length) return NextResponse.json({ results: [] }, { status: 200 });

    const results: Array<{ key: string; counts: Array<{ price_cents: number; count: number }>; latest_price_cents: number | null; latest_created_at: string | null; latest_count: number }>
      = [];

    for (const g of groups) {
      if (!g.place_id) continue;
      const key = [g.place_id, g.category || "", g.brand || "", g.name || "", g.mixer || "", g.size_label || "", g.ml ?? ""].join("||");
      const select = "price_cents,created_at,venues(google_place_id),product_sizes(size_label,ml,products(brand,name,category,mixer))";
      let path = `/price_reports?select=${encodeURIComponent(select)}&status=eq.approved&venues.google_place_id=eq.${encodeURIComponent(g.place_id)}&order=created_at.desc&limit=5000`;
      if (g.category) path += `&product_sizes.products.category=eq.${encodeURIComponent(g.category)}`;
      if (g.brand) path += `&product_sizes.products.brand=eq.${encodeURIComponent(g.brand)}`;
      if (g.name) path += `&product_sizes.products.name=eq.${encodeURIComponent(g.name)}`;
      if (g.mixer) path += `&product_sizes.products.mixer=eq.${encodeURIComponent(g.mixer)}`;
      if (g.size_label) path += `&product_sizes.size_label=eq.${encodeURIComponent(g.size_label)}`;
      if (typeof g.ml === "number") path += `&product_sizes.ml=eq.${g.ml}`;

      const rows = (await sbJson(path)) as Array<{ price_cents: number; created_at: string }>;
      const priceCounts = new Map<number, number>();
      let latest_price_cents: number | null = null;
      let latest_created_at: string | null = null;
      for (const r of rows) {
        priceCounts.set(r.price_cents, (priceCounts.get(r.price_cents) || 0) + 1);
        if (!latest_created_at || r.created_at > latest_created_at) {
          latest_created_at = r.created_at;
          latest_price_cents = r.price_cents;
        }
      }
      const counts = Array.from(priceCounts.entries()).map(([price_cents, count]) => ({ price_cents, count })).sort((a, b) => a.price_cents - b.price_cents);
      const latest_count = latest_price_cents != null ? (priceCounts.get(latest_price_cents) || 0) : 0;
      results.push({ key, counts, latest_price_cents, latest_created_at, latest_count });
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

