import { NextResponse } from "next/server";

export async function POST() {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 30);
  const cookie = [
    `plubs_guest=1`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
    `Expires=${expires.toUTCString()}`,
  ].join("; ");
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("Set-Cookie", cookie);
  return res;
}

