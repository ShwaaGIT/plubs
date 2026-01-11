import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbJson, sbFetch } from "@/lib/supabaseRest";

async function requireAdmin(req: Request) {
  const profileId = readCookie(req.headers.get("cookie"));
  if (!profileId) return { ok: false as const, status: 401, error: "Not authenticated" };
  const id = encodeURIComponent(profileId);
  const res = await sbFetch(`/profiles?select=id,admin,display_name&id=eq.${id}&limit=1`);
  if (!res.ok) return { ok: false as const, status: 401, error: "Auth check failed" };
  const rows = (await res.json()) as any[];
  const me = rows[0];
  if (!me?.admin) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, me };
}

export async function GET(req: Request) {
  // Admin-only: list pending price reports with related venue/product info
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const select = [
    "id",
    "price_cents",
    "observed_at",
    "notes",
    "submitted_by",
    "created_at",
    // related data for context
    "venues(place_id:google_place_id,name,formatted_address,suburb,state,country)",
    "product_sizes(size_label,ml,products(brand,name,category))",
  ].join(",");

  const path = `/price_reports?select=${encodeURIComponent(select)}&status=eq.pending&order=created_at.asc&limit=100`;
  try {
    const rows = await sbJson(path);
    return NextResponse.json({ results: Array.isArray(rows) ? rows : [] }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
