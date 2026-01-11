import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbFetch, sbJson } from "@/lib/supabaseRest";

async function requireAdmin(req: Request) {
  const profileId = readCookie(req.headers.get("cookie"));
  if (!profileId) return { ok: false as const, status: 401, error: "Not authenticated" };
  const id = encodeURIComponent(profileId);
  const res = await sbFetch(`/profiles?select=id,admin&id=eq.${id}&limit=1`);
  if (!res.ok) return { ok: false as const, status: 401, error: "Auth check failed" };
  const rows = (await res.json()) as any[];
  const me = rows[0];
  if (!me?.admin) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, me: { id: profileId } };
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const id = encodeURIComponent(ctx.params.id);
  const now = new Date().toISOString();
  let note: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    note = typeof body?.note === "string" ? body.note : null;
  } catch {}
  const patch = [{ status: "rejected", moderated_by: gate.me.id, moderated_at: now, moderation_note: note }];
  try {
    await sbJson(`/price_reports?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Reject failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

