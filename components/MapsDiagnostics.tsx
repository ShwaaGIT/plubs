"use client";
import { useEffect, useMemo, useState } from "react";

type Diag = {
  scriptSrc: string | null;
  query: Record<string, string>;
  mapsPresent: boolean;
  placesPresent: boolean;
  importLibraryPresent: boolean;
  keyPresent: boolean;
  mapIdConfigured: boolean;
  host: string;
};

export default function MapsDiagnostics() {
  // Only render in non-production builds
  if (process.env.NODE_ENV === "production") return null;

  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);

  const mapIdRaw = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "";
  const mapIdConfigured = !!(mapIdRaw && mapIdRaw !== "YOUR_GOOGLE_MAPS_MAP_ID");

  const keyPresent = useMemo(() => Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), []);

  useEffect(() => {
    const collect = () => {
      const script = Array.from(document.querySelectorAll<HTMLScriptElement>("script"))
        .find((s) => (s.src || "").startsWith("https://maps.googleapis.com/maps/api/js"));
      let query: Record<string, string> = {};
      let src: string | null = null;
      if (script?.src) {
        try {
          const u = new URL(script.src);
          src = script.src;
          u.searchParams.forEach((v, k) => (query[k] = v));
        } catch {}
      }
      const g: any = (window as any).google?.maps;
      setDiag({
        scriptSrc: src,
        query,
        mapsPresent: Boolean(g),
        placesPresent: Boolean(g?.places),
        importLibraryPresent: typeof g?.importLibrary === "function",
        keyPresent,
        mapIdConfigured,
        host: location.host,
      });
    };
    collect();
    const t = setInterval(collect, 1500);
    return () => clearInterval(t);
  }, [keyPresent, mapIdConfigured]);

  return (
    <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 10000 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "#111827",
          color: "#ffffff",
          border: "1px solid #374151",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: 12,
          opacity: 0.9,
        }}
        aria-expanded={open}
        aria-controls="maps-diag"
        title="Toggle Maps diagnostics"
      >
        Maps Diagnostics
      </button>
      {open && diag ? (
        <div
          id="maps-diag"
          style={{
            marginTop: 8,
            background: "#111827",
            color: "#e5e7eb",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: 12,
            width: 360,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontSize: 12,
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Environment</div>
          <div>NODE_ENV: {process.env.NODE_ENV}</div>
          <div>Host: {diag.host}</div>
          <div>Browser key present: {String(diag.keyPresent)}</div>
          <div>Map ID configured: {String(diag.mapIdConfigured)}</div>

          <div style={{ margin: "10px 0 8px", fontWeight: 600 }}>Script</div>
          <div style={{ wordBreak: "break-all" }}>src: {diag.scriptSrc || "<not found>"}</div>
          {diag.scriptSrc ? (
            <div style={{ marginTop: 6 }}>
              <div>Query params:</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>v: {diag.query["v"] || ""}</li>
                <li>libraries: {diag.query["libraries"] || ""}</li>
                <li>loading: {diag.query["loading"] || ""}</li>
                <li>map_ids: {diag.query["map_ids"] || ""}</li>
                <li>callback: {diag.query["callback"] || ""}</li>
              </ul>
            </div>
          ) : null}

          <div style={{ margin: "10px 0 8px", fontWeight: 600 }}>Runtime</div>
          <div>google.maps loaded: {String(diag.mapsPresent)}</div>
          <div>google.maps.places available: {String(diag.placesPresent)}</div>
          <div>importLibrary available: {String(diag.importLibraryPresent)}</div>
        </div>
      ) : null}
    </div>
  );
}

