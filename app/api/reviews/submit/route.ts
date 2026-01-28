import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbJson } from "@/lib/supabaseRest";

export async function POST(req: Request) {
  try {
    const userId = readCookie(req.headers.get("cookie"));
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { rating, body } = await req.json().catch(() => ({}));
    const r = Number(rating);
    const comment = typeof body === "string" ? body.trim() : "";
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }
    if (comment.length > 2000) {
      return NextResponse.json({ error: "Comment too long" }, { status: 413 });
    }

    // Optional: verify user exists
    // If this lookup fails, we still reject insert as unauthorized
    try {
      // minimal, cheap lookup via RPC style filter
      const id = encodeURIComponent(userId);
      const rows = await sbJson(`/profiles?id=eq.${id}&select=id&limit=1`);
      if (!Array.isArray(rows) || !rows[0]) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = { user_id: userId, rating: r, body: comment };
    const created = await sbJson(`/reviews`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    // Supabase returns array of inserted rows
    const row = Array.isArray(created) ? created[0] : created;
    return NextResponse.json({ review: row }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

