import { NextResponse } from "next/server";

type DetailsBody = {
  place_id?: string;
};

export async function POST(req: Request) {
  try {
    const body: DetailsBody = await req.json();
    const place_id = (body.place_id || "").trim();
    if (!place_id) return NextResponse.json({ error: "place_id required" }, { status: 400 });

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return NextResponse.json({ error: "Server key not configured" }, { status: 500 });

    const params = new URLSearchParams({
      key,
      place_id,
      fields: "name,geometry",
    });
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return NextResponse.json({ error: `Details failed: ${res.status}` }, { status: 500 });
    const data = await res.json();
    if (data?.status && data.status !== "OK") {
      return NextResponse.json({ error: data.status || "Details error" }, { status: 500 });
    }
    const r = data?.result || {};
    const name: string = r?.name || "";
    const loc = r?.geometry?.location;
    const lat: number | undefined = typeof loc?.lat === "number" ? loc.lat : undefined;
    const lng: number | undefined = typeof loc?.lng === "number" ? loc.lng : undefined;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "No geometry" }, { status: 500 });
    }
    return NextResponse.json({ name, place_id, lat, lng }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

