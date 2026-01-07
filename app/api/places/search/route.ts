import { NextResponse } from "next/server";
import { cacheGet, cacheSet, makeCacheKey, searchPlaces } from "@/lib/googlePlaces";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { centerLat, centerLng, radiusMeters, filters } = body ?? {};

    if (
      typeof centerLat !== "number" ||
      typeof centerLng !== "number" ||
      typeof radiusMeters !== "number" ||
      !filters || typeof filters !== "object"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const key = makeCacheKey({ centerLat, centerLng, radiusMeters, filters, limit: 40 });
    const cached = cacheGet(key);
    if (cached) return NextResponse.json({ results: cached, cached: true }, { status: 200 });

    const results = await searchPlaces({ centerLat, centerLng, radiusMeters, filters, limit: 40 });
    cacheSet(key, results);
    return NextResponse.json({ results }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ?? "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

