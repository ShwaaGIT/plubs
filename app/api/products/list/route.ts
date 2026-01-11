import { NextResponse } from "next/server";
import { sbJson } from "@/lib/supabaseRest";

// GET /api/products/list?category=beer|wine|spirits[&spirit=Name]
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const spirit = searchParams.get("spirit");
    if (!category || !["beer", "wine", "spirits"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (category === "spirits") {
      if (spirit) {
        // List mixers available for a given spirit name
        const sel = encodeURIComponent("mixer");
        const path = `/products?select=${sel}&category=eq.spirits&name=eq.${encodeURIComponent(spirit)}&order=mixer.asc&limit=1000`;
        const rows = (await sbJson(path)) as Array<{ mixer: string | null }>;
        const mixers = Array.from(new Set(rows.map((r) => (r.mixer || "").trim()).filter(Boolean)));
        return NextResponse.json({ mixers }, { status: 200 });
      }
      // List distinct spirit names
      const sel = encodeURIComponent("name,mixer");
      const path = `/products?select=${sel}&category=eq.spirits&order=name.asc&limit=2000`;
      const rows = (await sbJson(path)) as Array<{ name: string | null; mixer: string | null }>;
      const spirits = Array.from(new Set(rows.map((r) => (r.name || "").trim()).filter(Boolean)));
      return NextResponse.json({ spirits }, { status: 200 });
    }

    // Beer or wine: list distinct product names
    const sel = encodeURIComponent("name");
    const path = `/products?select=${sel}&category=eq.${encodeURIComponent(category)}&order=name.asc&limit=2000`;
    const rows = (await sbJson(path)) as Array<{ name: string | null }>;
    const products = Array.from(new Set(rows.map((r) => (r.name || "").trim()).filter(Boolean)));
    return NextResponse.json({ products }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load products";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

