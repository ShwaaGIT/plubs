"use client";

declare global {
  interface Window {
    __gmapsLoaderPromise?: Promise<void>;
  }
}

function buildScriptSrc(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const params = new URLSearchParams({ key, v: "weekly", libraries: "places" });
  const rawMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "";
  const mapId = rawMapId && rawMapId !== "YOUR_GOOGLE_MAPS_MAP_ID" ? rawMapId : "";
  // Runtime diagnostics (do not log the key)
  try {
    console.info("[Maps] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY present:", Boolean(key));
    console.info("[Maps] Map ID configured:", Boolean(mapId));
  } catch {}
  if (mapId) params.set("map_ids", mapId);
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

export async function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return; // SSR no-op

  if (window.__gmapsLoaderPromise) return window.__gmapsLoaderPromise;

  window.__gmapsLoaderPromise = new Promise<void>((resolve, reject) => {
    // If already present, resolve immediately
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const src = buildScriptSrc();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
    s.onload = () => resolve();
    document.head.appendChild(s);
  })
    .then(async () => {
      // Ensure core libraries are imported (no Advanced Marker lib)
      const importLib = (google as any)?.maps?.importLibrary?.bind(google.maps);
      try {
        console.info("[Maps] google.maps loaded:", Boolean((window as any).google?.maps));
      } catch {}
      if (importLib) {
        await Promise.all([importLib("maps"), importLib("places")]);
      }
      try {
        console.info("[Maps] google.maps.places available:", Boolean((window as any).google?.maps?.places));
      } catch {}
    });

  return window.__gmapsLoaderPromise;
}

export function getOptionalMapId(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "";
  if (!raw || raw === "YOUR_GOOGLE_MAPS_MAP_ID") return undefined;
  return raw;
}
