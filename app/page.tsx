"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Place } from "@/components/MapView";
import PlacesPanel from "@/components/PlacesPanel";

type SearchPayload = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  filters: { pubs: boolean; clubs: boolean; bars: boolean };
};

export default function Page() {
  const [center, setCenter] = useState({ lat: 51.5074, lng: -0.1278 }); // London default
  // Always search for all categories now
  const filters = useMemo(() => ({ pubs: true, clubs: true, bars: true }), []);
  const [radius, setRadius] = useState<number>(1000);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: SearchPayload = {
        centerLat: center.lat,
        centerLng: center.lng,
        radiusMeters: radius,
        filters,
      };
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Search failed (${res.status})`);
      }
      const data = (await res.json()) as { results: Place[] };
      setPlaces(data.results);
      if (data.results.length) setSelectedPlaceId(data.results[0].place_id);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lng, radius, filters]);

  // Geolocate and center on the user's location (track movement)
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setCenter((prev) => {
          // Avoid tiny jitter adjustments triggering unneeded state updates
          const dlat = Math.abs(prev.lat - latitude);
          const dlng = Math.abs(prev.lng - longitude);
          return dlat < 1e-6 && dlng < 1e-6 ? prev : { lat: latitude, lng: longitude };
        });
      },
      (err) => {
        // Permission denied or unavailable; keep default center
        console.warn("Geolocation error:", err?.message || err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {}
    };
  }, []);

  // Auto-search whenever the map center changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      // Only search if we have all categories enabled (we always do now)
      doSearch();
    }, 400);
    return () => clearTimeout(t);
  }, [center.lat, center.lng, radius, doSearch]);

  // Compute radius from viewport
  const handleViewportChanged = useCallback((v: {
    center: { lat: number; lng: number };
    bounds?: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } };
    zoom?: number;
  }) => {
    if (!v.bounds) return;
    const { ne, sw } = v.bounds;
    // Distance from center to NE corner (approx radius to cover viewport)
    const dist = haversineMeters(v.center.lat, v.center.lng, ne.lat, ne.lng);
    const clamped = Math.max(1000, Math.min(5000, Math.round(dist)));
    setRadius((prev) => (Math.abs(prev - clamped) > 50 ? clamped : prev));
  }, []);

  // Keep selection in sync if the selected item disappears
  useEffect(() => {
    if (selectedPlaceId && !places.find((p) => p.place_id === selectedPlaceId)) {
      setSelectedPlaceId(places[0]?.place_id ?? null);
    }
  }, [places, selectedPlaceId]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <MapView
        center={center}
        places={places}
        selectedPlaceId={selectedPlaceId}
        userLocation={userLocation || undefined}
        onCenterChanged={(c) => setCenter(c)}
        onViewportChanged={handleViewportChanged}
        onMarkerClick={(id) => setSelectedPlaceId(id)}
      />
      <PlacesPanel
        center={center}
        loading={loading}
        error={error}
        results={places}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={(id) => setSelectedPlaceId(id)}
      />
    </div>
  );
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
