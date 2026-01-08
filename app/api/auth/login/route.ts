import { NextResponse } from "next/server";
import { getSessionExpiryDate, buildCookie, verifyPassword } from "@/lib/auth";
import { sbFetch } from "@/lib/supabaseRest";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const e = encodeURIComponent(email.toLowerCase().trim());
    const resp = await sbFetch(`/profiles?select=*&email=eq.${e}&limit=1`);
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(t || `Lookup failed ${resp.status}`);
    }
    const rows = (await resp.json()) as any[];
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const ok = await verifyPassword(password, {
      algo: "scrypt",
      salt: row.password_salt,
      hash: row.password_hash,
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 64,
    });
    if (!ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    // Single-table mode: emulate a session by storing the profile id in an HttpOnly cookie
    const res = NextResponse.json(
      { ok: true, user: { id: row.id, email: row.email, display_name: row.display_name } },
      { status: 200 }
    );
    const expires = getSessionExpiryDate();
    res.headers.set("Set-Cookie", buildCookie(String(row.id), expires));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}
