"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Place } from "@/components/MapView";
import AdminMenu from "@/components/AdminMenu";
import AddPriceModal from "@/components/AddPriceModal";
import PriceFilterMenu, { Selection } from "@/components/PriceFilterMenu";

type SearchPayload = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  filters: { pubs: boolean; clubs: boolean; bars: boolean };
};

export default function Page() {
  const [center, setCenter] = useState({ lat: -27.4698, lng: 153.0251 }); // Brisbane default
  // Always search for all categories now
  const filters = useMemo(() => ({ pubs: true, clubs: true, bars: true }), []);
  const [radius, setRadius] = useState<number>(1000);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placePrices, setPlacePrices] = useState<Record<string, number>>({});
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>({ category: "beer", product_name: null, size_label: "Schooner", ml: null, membership: "non-member" });
  const selectedPlace = useMemo(() => places.find((p) => p.place_id === selectedPlaceId) || null, [places, selectedPlaceId]);
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
      // Fetch latest approved prices for these places, filtered by current selection
      const ids = data.results.map((p) => p.place_id);
      if (ids.length) {
        try {
          const pr = await fetch("/api/places/prices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ place_ids: ids, filter: selectionToFilter(selection) }),
          });
          const pj = await pr.json();
          if (pr.ok && Array.isArray(pj.results)) {
            const map: Record<string, number> = {};
            for (const r of pj.results as Array<{ place_id: string; price_cents: number }>) {
              map[r.place_id] = r.price_cents;
            }
            setPlacePrices(map);
          } else {
            setPlacePrices({});
          }
        } catch {
          setPlacePrices({});
        }
      } else {
        setPlacePrices({});
      }
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lng, radius, filters, selection]);

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

  const placesWithPrices: Place[] = useMemo(() => {
    return places.map((p) => ({ ...p, price_cents: placePrices[p.place_id] } as Place));
  }, [places, placePrices]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <PriceFilterMenu
        value={selection}
        onChange={(sel) => {
          setSelection(sel);
          // Refetch prices for current places
          const ids = places.map((p) => p.place_id);
          if (ids.length) {
            fetch("/api/places/prices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ place_ids: ids, filter: selectionToFilter(sel) }),
            })
              .then((r) => r.json())
              .then((pj) => {
                if (Array.isArray(pj?.results)) {
                  const map: Record<string, number> = {};
                  for (const r of pj.results as Array<{ place_id: string; price_cents: number }>) map[r.place_id] = r.price_cents;
                  setPlacePrices(map);
                } else {
                  setPlacePrices({});
                }
              })
              .catch(() => setPlacePrices({}));
          } else {
            setPlacePrices({});
          }
        }}
      />
      <MapView
        center={center}
        places={placesWithPrices}
        selectedPlaceId={selectedPlaceId}
        labelCategory={selection.category}
        userLocation={userLocation || undefined}
        onCenterChanged={(c) => setCenter(c)}
        onViewportChanged={handleViewportChanged}
        onMarkerClick={(id) => setSelectedPlaceId(id)}
        onPlaceOptions={(id) => {
          setSelectedPlaceId(id);
          setAddPriceOpen(true);
        }}
      />
      {/* Add price modal */}
      {selectedPlace && addPriceOpen && (
        <AddPriceModal
          place={selectedPlace}
          onClose={() => setAddPriceOpen(false)}
          onSubmitted={() => {
            // waits for admin approval to reflect on map
          }}
        />
      )}
      <AdminMenu
        onApproved={(pid, price) => {
          setPlacePrices((prev) => ({ ...prev, [pid]: price }));
        }}
      />
      {/* My Location button (top-right) */}
      <button
        type="button"
        aria-label="Go to my location"
        title="Go to my location"
        onClick={() => {
          if (userLocation) {
            setCenter(userLocation);
            return;
          }
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              (err) => console.warn("Geolocation error:", err?.message || err),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }
        }}
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#ffffff",
          color: "#1f2937",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          zIndex: 10,
          padding: 0,
          lineHeight: 0,
        }}
      >
        {/* crosshair/target icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
    </div>
  );
}

function selectionToFilter(sel: Selection) {
  if (sel.category === "beer") {
    return { category: "beer", product_name: sel.product_name || null, size_label: sel.size_label || null, ml: null, membership: sel.membership === "member" };
  }
  if (sel.category === "wine") {
    return { category: "wine", product_name: sel.product_name || null, size_label: sel.size_label || null, ml: sel.ml ?? null, membership: sel.membership === "member" };
  }
  // spirits
  return { category: "spirits", product_name: sel.spirit || null, mixer: sel.mixer || null, size_label: sel.size_label || null, ml: null, membership: sel.membership === "member" };
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
