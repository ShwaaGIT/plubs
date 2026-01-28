import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbJson, sbFetch } from "@/lib/supabaseRest";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const place_id = url.searchParams.get("place_id") || "";
    if (!place_id) return NextResponse.json({ results: [] }, { status: 200 });

    const meId = readCookie(req.headers.get("cookie"));
    if (!meId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const res = await sbFetch(`/profiles?select=id,admin&id=eq.${encodeURIComponent(meId)}&limit=1`);
    const rows = (await res.json()) as any[];
    if (!rows[0]?.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const vrows = await sbJson(`/venues?select=id,google_place_id&google_place_id=eq.${encodeURIComponent(place_id)}&limit=1`);
    const venue_id = Array.isArray(vrows) && vrows[0]?.id ? String(vrows[0].id) : null;
    if (!venue_id) return NextResponse.json({ results: [] }, { status: 200 });

    const select = [
      "id",
      "status",
      "price_cents",
      "membership",
      "observed_at",
      "notes",
      "created_at",
      "moderated_at",
      "product_sizes(size_label,ml,products(brand,name,category,mixer))",
    ].join(",");
    const path = `/price_reports?select=${encodeURIComponent(select)}&venue_id=eq.${encodeURIComponent(
      venue_id
    )}&order=created_at.desc&limit=500`;
    const reports = (await sbJson(path)) as any[];
    return NextResponse.json({ results: reports || [] }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

