import { NextResponse } from "next/server";

type AutocompleteBody = {
  input?: string;
};

type Prediction = {
  description: string;
  place_id: string;
};

export async function POST(req: Request) {
  try {
    const body: AutocompleteBody = await req.json();
    const input = (body.input || "").trim();
    if (!input) return NextResponse.json({ predictions: [] }, { status: 200 });

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return NextResponse.json({ error: "Server key not configured" }, { status: 500 });

    const params = new URLSearchParams({
      key,
      input,
      types: "(regions)",
      components: "country:au",
    });

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return NextResponse.json({ error: `Autocomplete failed: ${res.status}` }, { status: 500 });
    const data = await res.json();
    const preds: Prediction[] = Array.isArray(data?.predictions)
      ? data.predictions.map((p: any) => ({ description: p.description, place_id: p.place_id }))
      : [];
    return NextResponse.json({ predictions: preds }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

