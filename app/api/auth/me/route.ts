import { NextResponse } from "next/server";
import { readCookie } from "@/lib/auth";
import { sbFetch } from "@/lib/supabaseRest";

// Single-table auth: cookie stores the profile id
export async function GET(req: Request) {
  try {
    const profileId = readCookie(req.headers.get("cookie"));
    if (!profileId) return NextResponse.json({ user: null }, { status: 200 });

    const id = encodeURIComponent(profileId);
    const res = await sbFetch(`/profiles?select=id,email,display_name&id=eq.${id}&limit=1`);
    if (!res.ok) return NextResponse.json({ user: null }, { status: 200 });
    const rows = (await res.json()) as any[];
    const row = rows[0];
    if (!row) return NextResponse.json({ user: null }, { status: 200 });
    const user = { id: row.id, email: row.email, display_name: row.display_name };
    return NextResponse.json({ user }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
