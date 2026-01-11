import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbFetch, sbJson } from "@/lib/supabaseRest";

type SubmitBody = {
  place: { place_id: string; name?: string; address?: string };
  product: { brand: string; name: string; category?: string; mixer?: string | null };
  size: { size_label?: string; ml?: number | null };
  price_cents: number;
  observed_at?: string | null; // ISO
  notes?: string | null;
  membership?: boolean | null;
};

export async function POST(req: Request) {
  try {
    const profileId = readCookie(req.headers.get("cookie"));
    const body = (await req.json()) as SubmitBody;
    if (!body?.place?.place_id || typeof body.price_cents !== "number" || !isFinite(body.price_cents)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const place_id = body.place.place_id;
    const venueId = await ensureVenue(place_id, body.place.name, body.place.address);
    const productId = await ensureProduct(body.product.brand, body.product.name, body.product.category || null, body.product.mixer ?? null);
    const sizeId = await ensureProductSize(productId, body.size.size_label || null, body.size.ml ?? null);

    // Determine if this submission matches the currently accepted price for this venue/product/size
    const membership = typeof body.membership === "boolean" ? body.membership : null;
    const submittedPrice = Math.round(body.price_cents);
    let autoApprove = false;
    try {
      let path = `/price_reports?select=price_cents,membership,created_at&status=eq.approved&venue_id=eq.${encodeURIComponent(
        venueId
      )}&product_size_id=eq.${encodeURIComponent(sizeId)}&order=created_at.desc&limit=1`;
      if (membership === true) {
        path += `&membership=is.true`;
      } else {
        // Treat false/null as equivalent to non-member
        path += `&or=(membership.is.false,membership.is.null)`;
      }
      const latest = (await sbJson(path)) as Array<{ price_cents: number; membership: boolean | null; created_at: string }>;
      if (Array.isArray(latest) && latest[0]?.price_cents === submittedPrice) autoApprove = true;
    } catch {}

    const payload = [
      {
        venue_id: venueId,
        product_size_id: sizeId,
        price_cents: submittedPrice,
        observed_at: body.observed_at || null,
        notes: body.notes || null,
        membership,
        submitted_by: profileId || null,
        status: autoApprove ? "approved" : "pending",
        moderated_at: autoApprove ? new Date().toISOString() : null,
        moderation_note: autoApprove ? "auto-approved: matches current accepted price" : null,
      },
    ];

    await sbJson(`/price_reports`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Submit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function ensureVenue(place_id: string, name?: string, address?: string): Promise<string> {
  // Try find by place_id
  const enc = encodeURIComponent(place_id);
  const found = await sbJson(`/venues?select=id&google_place_id=eq.${enc}&limit=1`);
  if (Array.isArray(found) && found[0]?.id) return String(found[0].id);
  // Insert minimal
  const row = [{ google_place_id: place_id, name: name || null, formatted_address: address || null }];
  const ins = await sbJson(`/venues`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
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
  const ins = await sbJson(`/products`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
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
  const ins = await sbJson(`/product_sizes`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (Array.isArray(ins) && ins[0]?.id) return String(ins[0].id);
  throw new Error("Failed to ensure product size");
}
