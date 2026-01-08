import { NextResponse } from "next/server";
import { getSessionExpiryDate, buildCookie, hashPassword } from "@/lib/auth";
import { sbJson } from "@/lib/supabaseRest";

export async function POST(req: Request) {
  try {
    const { email, password, username } = await req.json();
    const uname = typeof username === "string" ? username.trim() : "";
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof username !== "string" ||
      email.length < 3 ||
      password.length < 6 ||
      uname.length === 0
    ) {
      return NextResponse.json({ error: "Invalid email, username, or password" }, { status: 400 });
    }

    // Hash password
    const digest = await hashPassword(password);

    // Create profile in single-table setup
    const body = [
      {
        email: email.toLowerCase().trim(),
        display_name: uname,
        password_hash: digest.hash,
        password_salt: digest.salt,
      },
    ];

    // Prefer: return=representation to get inserted row
    const created = await sbJson("/profiles?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });

    const profile = Array.isArray(created) ? created[0] : created;
    if (!profile?.id) return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });

    // Set pseudo-session cookie with profile id so user is immediately signed in
    const res = NextResponse.json(
      { ok: true, user: { id: profile.id, email: profile.email, display_name: profile.display_name } },
      { status: 200 }
    );
    const expires = getSessionExpiryDate();
    res.headers.set("Set-Cookie", buildCookie(String(profile.id), expires));
    return res;
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Signup failed";
    const isConflict = /duplicate key value|already exists|409/.test(msg);
    return NextResponse.json({ error: isConflict ? "Email already registered" : msg }, { status: isConflict ? 409 : 500 });
  }
}
