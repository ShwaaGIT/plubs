"use client";
import { useEffect, useMemo, useRef } from "react";

function verticalEllipsisSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <circle cx="12" cy="5" r="2"/>
  <circle cx="12" cy="12" r="2"/>
  <circle cx="12" cy="19" r="2"/>
</svg>`;
}

export type Place = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  price_cents?: number;
};

type Props = {
  center: { lat: number; lng: number };
  places: Place[];
  selectedPlaceId: string | null;
  userLocation?: { lat: number; lng: number };
  labelCategory?: "beer" | "wine" | "spirits";
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  onViewportChanged?: (v: {
    center: { lat: number; lng: number };
    bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } };
    zoom?: number;
  }) => void;
  onMarkerClick?: (placeId: string) => void;
  onPlaceOptions?: (placeId: string) => void;
};

declare global {
  interface Window {
    _gmapsLoader?: Promise<void>;
  }
}

export default function MapView({ center, places, selectedPlaceId, userLocation, labelCategory = "beer", onCenterChanged, onViewportChanged, onMarkerClick, onPlaceOptions }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function ensureMaps() {
      if (window._gmapsLoader) return window._gmapsLoader;
      window._gmapsLoader = new Promise<void>((resolve, reject) => {
        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!key) {
          console.error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
        }
        const params = new URLSearchParams({
          key: key || "",
          v: "weekly",
          libraries: "marker,places",
        });
        const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
        if (mapId) params.set("map_ids", mapId);
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
        document.head.appendChild(script);
      });
      return window._gmapsLoader;
    }

    ensureMaps().then(() => {
      if (cancelled) return;
      if (!containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 14,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
          gestureHandling: "greedy",
          clickableIcons: false,
          disableDefaultUI: true,
        });

        infoRef.current = new google.maps.InfoWindow();

        mapRef.current.addListener("idle", () => {
          const c = mapRef.current!.getCenter();
          const zoom = mapRef.current!.getZoom?.();
          const b = mapRef.current!.getBounds?.();
          const centerData = c ? { lat: c.lat(), lng: c.lng() } : undefined;
          if (centerData && onCenterChanged) onCenterChanged(centerData);
          if (centerData && onViewportChanged) {
            const ne = b?.getNorthEast?.();
            const sw = b?.getSouthWest?.();
            onViewportChanged({
              center: centerData,
              zoom: zoom ?? undefined,
              bounds: ne && sw ? { ne: { lat: ne.lat(), lng: ne.lng() }, sw: { lat: sw.lat(), lng: sw.lng() } } : undefined,
            });
          }
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep map centered when external center changes (user clicks a result)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(center);
    }
  }, [center.lat, center.lng]);

  // Render or update user's location dot
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = "#1a73e8"; // blue dot
      el.style.boxShadow = "0 0 0 4px rgba(26,115,232,0.25), 0 1px 4px rgba(0,0,0,0.3)";
      el.setAttribute("aria-label", "My location");
      userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: userLocation,
        map,
        content: el,
        title: "You are here",
        zIndex: 9999,
      });
    } else {
      userMarkerRef.current.position = userLocation as any;
      userMarkerRef.current.map = map;
    }
  }, [userLocation?.lat, userLocation?.lng]);

  // Update markers when places change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, id) => {
      if (!places.find((p) => p.place_id === id)) {
        marker.map = null;
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    places.forEach((p) => {
      if (!markersRef.current.has(p.place_id)) {
        // Custom beer icon marker with optional price
        const el = document.createElement("div");
        el.style.display = "inline-flex";
        el.style.alignItems = "center";
        el.style.gap = "4px";
        el.style.minWidth = "28px";
        el.style.height = "28px";
        el.style.padding = "0 6px";
        el.style.borderRadius = "14px";
        el.style.background = "#ffffff";
        el.style.border = "2px solid #d29922";
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35), 0 0 0 4px rgba(210,153,34,0.18)";
        el.style.fontSize = "16px";
        el.style.lineHeight = "1";
        el.style.userSelect = "none";
        el.setAttribute("aria-label", `Pub: ${p.name}`);
        el.innerHTML = markerLabelHtml(p.price_cents, labelCategory);

        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          content: el,
        });
        marker.addListener("click", () => {
          if (onMarkerClick) onMarkerClick(p.place_id);
          const optsId = `opts-${Math.random().toString(36).slice(2)}`;
          const html = `<div style="position:relative;max-width:260px;padding-right:28px">`
            + `<button id="${optsId}" aria-label="Place options" title="Place options" style="position:absolute;right:0;top:0;width:24px;height:24px;display:grid;place-items:center;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);cursor:pointer">`
            + `${verticalEllipsisSvg()}`
            + `</button>`
            + `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(p.name)}</div>`
            + `${p.rating ? `⭐ ${p.rating} (${p.user_ratings_total ?? 0})<br/>` : ""}`
            + `<div style="color:#555">${escapeHtml(p.address)}</div>`
            + `</div>`;

          infoRef.current?.setContent(html);
          infoRef.current?.open({ map, anchor: marker });

          if (infoRef.current) {
            // @ts-ignore Using Maps event util available at runtime
            google.maps.event.addListenerOnce(infoRef.current, "domready", () => {
              const btn = document.getElementById(optsId);
              if (btn) {
                btn.addEventListener("click", (ev) => {
                  ev.stopPropagation();
                  if (onPlaceOptions) onPlaceOptions(p.place_id);
                });
              }
            });
          }
        });
        markersRef.current.set(p.place_id, marker);
      } else {
        const m = markersRef.current.get(p.place_id)!;
        m.position = { lat: p.lat, lng: p.lng } as any;
        const el = m.content as HTMLElement | null;
        if (el) el.innerHTML = markerLabelHtml(p.price_cents, labelCategory);
      }
    });
  }, [places, labelCategory]);

  // Highlight selection
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.content as HTMLElement | null;
      if (!el) return;
      if (selectedPlaceId === id) {
        el.style.transform = "scale(1.2)";
        el.style.filter = "drop-shadow(0 0 6px rgba(62,166,255,0.9))";
      } else {
        el.style.transform = "scale(1.0)";
        el.style.filter = "none";
      }
    });
    // intentionally not auto-panning to the selected marker to avoid map bounce
  }, [selectedPlaceId]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

function markerLabelHtml(price_cents?: number, cat: "beer" | "wine" | "spirits" = "beer") {
  const have = typeof price_cents === "number" && isFinite(price_cents) && price_cents > 0;
  const price = have ? `$${formatCents(price_cents!)}` : "";
  // Using simple HTML; values derived from numbers only
  const icon = cat === "wine" ? "🍷" : cat === "spirits" ? "🥃" : "🍺";
  return `<span aria-hidden="true">${icon}</span>${have ? `<span style=\"font-weight:600;font-size:14px;color:#1f2937\">${price}</span>` : ""}`;
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${dollars}.${String(remainder).padStart(2, "0")}`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]+/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
