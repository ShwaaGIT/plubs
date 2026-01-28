import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbFetch, sbJson } from "@/lib/supabaseRest";

type Body = {
  place: { place_id: string; name?: string | null; address?: string | null };
  product: { brand?: string | null; name: string; category?: string | null; mixer?: string | null };
  size: { size_label?: string | null; ml?: number | null };
  price_cents: number;
  observed_at?: string | null;
  notes?: string | null;
  membership?: boolean | null;
};

export async function POST(req: Request) {
  try {
    const meId = readCookie(req.headers.get("cookie"));
    if (!meId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const meRes = await sbFetch(`/profiles?select=id,admin&id=eq.${encodeURIComponent(meId)}&limit=1`);
    const meRows = (await meRes.json()) as any[];
    if (!meRows[0]?.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as Body;
    if (!body?.place?.place_id || typeof body.price_cents !== "number" || !isFinite(body.price_cents)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const venueId = await ensureVenue(body.place.place_id, body.place.name || null, body.place.address || null);
    const productId = await ensureProduct(body.product.brand || "", body.product.name, body.product.category || null, body.product.mixer ?? null);
    const sizeId = await ensureProductSize(productId, body.size.size_label || null, body.size.ml ?? null);

    const payload = [
      {
        venue_id: venueId,
        product_size_id: sizeId,
        price_cents: Math.round(body.price_cents),
        observed_at: body.observed_at || null,
        notes: body.notes || null,
        membership: typeof body.membership === "boolean" ? body.membership : null,
        status: "approved",
        moderated_by: meRows[0].id,
        moderated_at: new Date().toISOString(),
        moderation_note: "admin edit",
      },
    ];

    await sbJson(`/price_reports`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function ensureVenue(place_id: string, name: string | null, address: string | null): Promise<string> {
  const enc = encodeURIComponent(place_id);
  const found = await sbJson(`/venues?select=id&google_place_id=eq.${enc}&limit=1`);
  if (Array.isArray(found) && found[0]?.id) return String(found[0].id);
  const row = [{ google_place_id: place_id, name, formatted_address: address }];
  const ins = await sbJson(`/venues`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (Array.isArray(ins) && ins[0]?.id) return String(ins[0].id);
  throw new Error("Failed to ensure venue");
}

async function ensureProduct(brand: string, name: string, category: string | null, mixer: string | null): Promise<string> {
  const q = new URLSearchParams();
  q.set("select", "id");
  q.set("brand", `eq.${brand}`);
  q.set("name", `eq.${name}`);
  if (category) q.set("category", `eq.${category}`);
  if (mixer) q.set("mixer", `eq.${mixer}`);
  const found = await sbJson(`/products?${q.toString()}&limit=1`);
  if (Array.isArray(found) && found[0]?.id) return String(found[0].id);
  const row = [{ brand, name, category, mixer }];
  const ins = await sbJson(`/products`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (Array.isArray(ins) && ins[0]?.id) return String(ins[0].id);
  throw new Error("Failed to ensure product");
}

async function ensureProductSize(product_id: string, size_label: string | null, ml: number | null): Promise<string> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("product_id", `eq.${product_id}`);
  if (size_label) params.set("size_label", `eq.${size_label}`);
  if (ml != null) params.set("ml", `eq.${ml}`);
  const found = await sbJson(`/product_sizes?${params.toString()}&limit=1`);
  if (Array.isArray(found) && found[0]?.id) return String(found[0].id);
  const row = [{ product_id, size_label, ml }];
  const ins = await sbJson(`/product_sizes`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (Array.isArray(ins) && ins[0]?.id) return String(ins[0].id);
  throw new Error("Failed to ensure product size");
}

