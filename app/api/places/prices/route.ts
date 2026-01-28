import { NextResponse } from "next/server";
import { sbJson } from "@/lib/supabaseRest";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.place_ids) ? body.place_ids.filter((x: any) => typeof x === "string") : [];
    if (!ids.length) return NextResponse.json({ results: [] }, { status: 200 });

    // Optional filters
    const filter = body?.filter as
      | {
          category?: "beer" | "wine" | "spirits";
          product_name?: string | null;
          mixer?: string | null;
          size_label?: string | null;
          ml?: number | null;
          membership?: boolean | null;
        }
      | undefined;

    // Build select with joins so we can filter on products/sizes
    const inList = ids.map((s) => s.replace(/[,()]/g, "")).join(",");
    const select = "price_cents,membership,created_at,venues(place_id:google_place_id),product_sizes(size_label,ml,products(name,category,mixer))";
    const base = new URLSearchParams();
    base.set("select", select);
    base.set("status", "eq.approved");
    base.set("venues.google_place_id", `in.(${inList})`);
    base.set("order", "created_at.desc");
    base.set("limit", "5000");

    // We cannot safely pass filters via URLSearchParams for nested eq in PostgREST in this util, so compose string manually
    let path = `/price_reports?select=${encodeURIComponent(select)}&status=eq.approved&venues.google_place_id=in.(${inList})&order=created_at.desc&limit=5000`;
    if (filter?.category) path += `&product_sizes.products.category=eq.${encodeURIComponent(filter.category)}`;
    if (filter?.product_name) path += `&product_sizes.products.name=eq.${encodeURIComponent(filter.product_name)}`;
    if (filter?.mixer) path += `&product_sizes.products.mixer=eq.${encodeURIComponent(filter.mixer)}`;
    if (filter?.size_label) path += `&product_sizes.size_label=eq.${encodeURIComponent(filter.size_label)}`;
    if (typeof filter?.ml === "number") path += `&product_sizes.ml=eq.${filter.ml}`;
    // For membership=true we will fetch both member and non-member, then prefer member in-memory.
    // For membership=false we restrict to non-member (or null) as before.
    const wantMember = typeof filter?.membership === "boolean" ? filter.membership : undefined;
    if (wantMember === false) {
      // Treat missing membership as non-member for backward compatibility
      path += `&or=(membership.is.false,membership.is.null)`;
    }

    const rows = (await sbJson(path)) as Array<{
      price_cents: number;
      membership: boolean | null;
      created_at: string;
      venues: { place_id: string } | null;
      product_sizes?: { size_label?: string | null; ml?: number | null; products?: { name?: string | null; category?: string | null; mixer?: string | null } | null } | null;
    }>;

    // If members requested, prefer member price if any exist; otherwise fall back to latest non-member.
    if (wantMember === true) {
      const pick: { place_id: string; price_cents: number }[] = [];
      const chosen = new Set<string>();
      // First, take most recent member prices
      for (const r of rows as Array<{ price_cents: number; membership: boolean | null; venues: { place_id: string } | null }>) {
        const pid = r.venues?.place_id;
        if (!pid || chosen.has(pid)) continue;
        if (r.membership === true) {
          // Prefer the first member price encountered (most recent)
          pick.push({ place_id: pid, price_cents: r.price_cents });
          chosen.add(pid);
        }
      }
      // Fallback to most recent any price for places without member prices
      for (const r of rows as Array<{ price_cents: number; venues: { place_id: string } | null }>) {
        const pid = r.venues?.place_id;
        if (!pid || chosen.has(pid)) continue;
        pick.push({ place_id: pid, price_cents: r.price_cents });
        chosen.add(pid);
      }
      return NextResponse.json({ results: pick }, { status: 200 });
    } else {
      // Non-member (or no membership preference): return the most recent per place from the filtered rows
      const seen = new Set<string>();
      const out: { place_id: string; price_cents: number }[] = [];
      for (const r of rows) {
        const pid = r.venues?.place_id;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        out.push({ place_id: pid, price_cents: r.price_cents });
      }
      return NextResponse.json({ results: out }, { status: 200 });
    }
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load prices";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
