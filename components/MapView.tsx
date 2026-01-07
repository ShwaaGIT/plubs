"use client";
import { useEffect, useMemo, useRef } from "react";

export type Place = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
};

type Props = {
  center: { lat: number; lng: number };
  places: Place[];
  selectedPlaceId: string | null;
  userLocation?: { lat: number; lng: number };
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  onViewportChanged?: (v: {
    center: { lat: number; lng: number };
    bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } };
    zoom?: number;
  }) => void;
  onMarkerClick?: (placeId: string) => void;
};

declare global {
  interface Window {
    _gmapsLoader?: Promise<void>;
  }
}

export default function MapView({ center, places, selectedPlaceId, userLocation, onCenterChanged, onViewportChanged, onMarkerClick }: Props) {
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
        const pin = new google.maps.marker.PinElement({
          background: "#3ea6ff",
          borderColor: "#0b5e9a",
          glyphColor: "#001a2d",
        });
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          content: pin.element,
        });
        marker.addListener("click", () => {
          if (onMarkerClick) onMarkerClick(p.place_id);
          const html = `<div style="max-width:220px"><div style="font-weight:600;margin-bottom:4px">${escapeHtml(
            p.name
          )}</div>${p.rating ? `⭐ ${p.rating} (${p.user_ratings_total ?? 0})<br/>` : ""}<div style="color:#555">${escapeHtml(
            p.address
          )}</div></div>`;
        
          infoRef.current?.setContent(html);
          infoRef.current?.open({ map, anchor: marker });
        });
        markersRef.current.set(p.place_id, marker);
      } else {
        const m = markersRef.current.get(p.place_id)!;
        m.position = { lat: p.lat, lng: p.lng } as any;
      }
    });
  }, [places]);

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
    if (selectedPlaceId) {
      const m = markersRef.current.get(selectedPlaceId);
      if (m && mapRef.current) {
        mapRef.current.panTo(m.position as google.maps.LatLng | google.maps.LatLngLiteral);
        mapRef.current.setZoom(Math.max((mapRef.current.getZoom() ?? 14), 15));
      }
    }
  }, [selectedPlaceId]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]+/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
