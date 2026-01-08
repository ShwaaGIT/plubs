import { NextResponse } from "next/server";
import { clearCookie, readCookie } from "@/lib/auth";
import { sbFetch } from "@/lib/supabaseRest";

export async function POST(req: Request) {
  try {
    const token = readCookie(req.headers.get("cookie"));
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set("Set-Cookie", clearCookie());
    if (token) {
      await sbFetch(`/sessions?token=eq.${encodeURIComponent(token)}`, { method: "DELETE" });
    }
    return res;
  } catch (e: any) {
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set("Set-Cookie", clearCookie());
    return res;
  }
}

