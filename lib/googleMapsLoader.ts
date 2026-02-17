"use client";

declare global {
  interface Window {
    __gmapsLoaderPromise?: Promise<void>;
  }
}

function buildScriptSrc(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const params = new URLSearchParams({ key, v: "weekly", libraries: "places" });
  // Follow best-practice loading pattern to avoid console warning
  params.set("loading", "async");
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
        try {
          const mapsModule = await importLib("maps");
          // Attach module constructors back onto the global for legacy usage
          try {
            Object.assign((google as any).maps, mapsModule);
          } catch {}
        } catch (e) {
          // If maps import fails, log but DO NOT throw — fall back to global
          // constructors if available so the map can still render.
          console.error("[Maps] Failed to import 'maps' library", e);
        }
        try {
          const placesModule = await importLib("places");
          // Best-effort: ensure global namespace exposes places
          try {
            if (!(google as any).maps.places) {
              (google as any).maps.places = placesModule;
            } else {
              Object.assign((google as any).maps.places, placesModule);
            }
          } catch {}
        } catch (e) {
          // Places might be unavailable for new customers; ignore but log
          console.warn("[Maps] 'places' library not available or failed to import", e);
        }
      }
      try {
        console.info("[Maps] google.maps.places available:", Boolean((window as any).google?.maps?.places));
      } catch {}
    });

  return window.__gmapsLoaderPromise;
}

// Optionally expose the Places module even if the global namespace isn't populated.
let __placesModule: any | null = null;

export async function loadPlacesLibrary(): Promise<any | null> {
  if (typeof window === "undefined") return null;
  await loadGoogleMaps();
  const gmaps: any = (window as any).google?.maps;
  // If global namespace already has places, prefer it
  if (gmaps?.places) return gmaps.places;
  const importLib = gmaps?.importLibrary?.bind(gmaps);
  if (!importLib) return null;
  try {
    if (!__placesModule) {
      __placesModule = await importLib("places");
      try {
        console.info("[Maps] Places module loaded:", Boolean(__placesModule));
      } catch {}
      // Best-effort: attach to global for legacy code paths
      try {
        if (!(gmaps as any).places && __placesModule) {
          (gmaps as any).places = __placesModule;
        }
      } catch {}
    }
    return __placesModule;
  } catch (e) {
    try {
      console.warn("[Maps] Failed to import 'places' library", e);
    } catch {}
    return gmaps?.places || null;
  }
}

export function getOptionalMapId(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "";
  if (!raw || raw === "YOUR_GOOGLE_MAPS_MAP_ID") return undefined;
  return raw;
}
