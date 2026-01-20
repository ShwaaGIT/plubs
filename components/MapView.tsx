"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps, getOptionalMapId } from "../lib/googleMapsLoader";

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
  suburbSelection?: { suburbName: string; placeId: string; lat: number; lng: number } | null;
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  onViewportChanged?: (v: {
    center: { lat: number; lng: number };
    bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } };
    zoom?: number;
  }) => void;
  onMarkerClick?: (placeId: string) => void;
  onPlaceOptions?: (placeId: string) => void;
};

export default function MapView({ center, places, selectedPlaceId, userLocation, labelCategory = "beer", suburbSelection, onCenterChanged, onViewportChanged, onMarkerClick, onPlaceOptions }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const suburbMarkerRef = useRef<google.maps.Marker | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled) return;
      if (!containerRef.current) return;
      if (!(window as any).google?.maps || !(window as any).google?.maps?.places) {
        try {
          console.warn("[Maps] Availability check:", {
            mapsLoaded: Boolean((window as any).google?.maps),
            placesAvailable: Boolean((window as any).google?.maps?.places),
          });
        } catch {}
        setMapsError(
          "Places API blocked. In Google Cloud, ensure this browser key is HTTP-referrer restricted for localhost + domain, and API-restricted to Maps JavaScript API + Places API, and that both APIs are enabled."
        );
        return;
      } else {
        setMapsError(null);
      }
      if (!mapRef.current) {
        const mapOptions: any = {
          center: { lat: center.lat, lng: center.lng },
          zoom: 14,
          gestureHandling: "greedy",
          clickableIcons: false,
          disableDefaultUI: true,
        };
        const mapId = getOptionalMapId();
        if (mapId) mapOptions.mapId = mapId;
        mapRef.current = new google.maps.Map(containerRef.current, mapOptions);

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

  // Suburb selection: pan/zoom and show a dedicated marker.
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const sel = suburbSelection;
    if (!sel) {
      if (suburbMarkerRef.current) {
        suburbMarkerRef.current.setMap(null);
        suburbMarkerRef.current = null;
      }
      return;
    }
    // Ensure marker exists
    if (!suburbMarkerRef.current) {
      suburbMarkerRef.current = new google.maps.Marker({
        position: { lat: sel.lat, lng: sel.lng },
        map,
        title: sel.suburbName,
      });
    } else {
      suburbMarkerRef.current.setPosition({ lat: sel.lat, lng: sel.lng } as any);
      suburbMarkerRef.current.setMap(map);
    }
    // Pan and zoom to suburb
    try {
      map.panTo({ lat: sel.lat, lng: sel.lng } as any);
      map.setZoom?.(13);
    } catch {}
  }, [suburbSelection?.lat, suburbSelection?.lng]);

  // Render or update user's location dot
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      return;
    }
    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation,
        map,
        title: "You are here",
      });
    } else {
      userMarkerRef.current.setPosition(userLocation as any);
      userMarkerRef.current.setMap(map);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  // Update markers when places change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, id) => {
      if (!places.find((p) => p.place_id === id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    places.forEach((p) => {
      if (!markersRef.current.has(p.place_id)) {
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          icon: makeWhiteDotIcon(),
          label: makeMarkerLabel(p.price_cents),
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
        m.setPosition({ lat: p.lat, lng: p.lng } as any);
        try {
          m.setIcon(makeWhiteDotIcon());
          m.setLabel(makeMarkerLabel(p.price_cents));
        } catch {}
      }
    });
  }, [places, labelCategory]);

  // Highlight selection (bring selected marker above others)
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      if (selectedPlaceId === id) {
        try {
          marker.setZIndex((google as any).maps?.Marker?.MAX_ZINDEX ? (google as any).maps.Marker.MAX_ZINDEX + 1 : 1000);
        } catch {
          marker.setZIndex(1000 as any);
        }
      } else {
        marker.setZIndex(0 as any);
      }
    });
    // intentionally not auto-panning to the selected marker to avoid map bounce
  }, [selectedPlaceId]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {mapsError ? (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 10000,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "8px 10px",
            maxWidth: 560,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          {mapsError}
        </div>
      ) : null}
    </>
  );
}

// Marker label: beer emoji + approved price (if present)
function makeMarkerLabel(price_cents?: number): google.maps.MarkerLabel {
  const have = typeof price_cents === "number" && isFinite(price_cents) && price_cents > 0;
  const text = have ? `🍺 $${formatCents(price_cents)}` : "🍺";
  return {
    text,
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: "600",
  } as google.maps.MarkerLabel;
}

// Small white dot icon with label origin to the right
function makeWhiteDotIcon(): google.maps.Icon {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
  <circle cx="7" cy="7" r="5.5" fill="#ffffff" stroke="#9ca3af" stroke-width="1" />
  <circle cx="7" cy="7" r="2" fill="#9ca3af" opacity="0.15" />
</svg>`;
  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  // Label rendered to the right-middle of the dot
  return {
    url,
    scaledSize: new google.maps.Size(14, 14),
    anchor: new google.maps.Point(7, 7),
    labelOrigin: new google.maps.Point(20, 8),
  } as google.maps.Icon;
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
