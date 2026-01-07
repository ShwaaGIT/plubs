"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onCenterChange: (center: { lat: number; lng: number }) => void;
};

declare global {
  interface Window {
    _gmapsLoader?: Promise<void>;
  }
}

export default function LocationPicker({ onCenterChange }: Props) {
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const suburbInputRef = useRef<HTMLInputElement | null>(null);
  const [cityLabel, setCityLabel] = useState("");
  const [suburbLabel, setSuburbLabel] = useState("");
  const cityBoundsRef = useRef<google.maps.LatLngBounds | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function ensureMaps() {
      if (window._gmapsLoader) return window._gmapsLoader;
      window._gmapsLoader = new Promise<void>((resolve, reject) => {
        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        const params = new URLSearchParams({ key: key || "", v: "weekly", libraries: "places" });
        const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
        if (mapId) params.set("map_ids", mapId);
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
        document.head.appendChild(s);
      });
      return window._gmapsLoader;
    }

    ensureMaps().then(() => {
      if (destroyed) return;
      if (!cityInputRef.current || !suburbInputRef.current) return;

      const places = google.maps.places;

      const cityAutocomplete = new places.Autocomplete(cityInputRef.current!, {
        types: ["(cities)"],
        fields: ["name", "geometry", "address_components"],
      });

      const suburbAutocomplete = new places.Autocomplete(suburbInputRef.current!, {
        types: ["geocode"],
        fields: ["name", "geometry", "address_components"],
        // Bounds will be set dynamically after city selection
      });

      cityAutocomplete.addListener("place_changed", () => {
        const place = cityAutocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        const center = { lat: loc.lat(), lng: loc.lng() };
        setCityLabel(place.name || "");
        setSuburbLabel("");
        // Create a reasonable bounding box around the city (~25km radius)
        const circle = new google.maps.Circle({ center, radius: 25000 });
        const bounds = circle.getBounds();
        cityBoundsRef.current = bounds ?? null;
        suburbAutocomplete.setBounds(bounds ?? undefined);
        suburbAutocomplete.setOptions({ strictBounds: !!bounds });
        onCenterChange(center);
      });

      suburbAutocomplete.addListener("place_changed", () => {
        const place = suburbAutocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        const center = { lat: loc.lat(), lng: loc.lng() };
        setSuburbLabel(place.name || "");
        // Keep suburb suggestions biased to the last selected city
        if (cityBoundsRef.current) {
          suburbAutocomplete.setBounds(cityBoundsRef.current);
          suburbAutocomplete.setOptions({ strictBounds: true });
        }
        onCenterChange(center);
      });
    });

    return () => {
      destroyed = true;
    };
  }, [onCenterChange]);

  const clearCity = () => {
    setCityLabel("");
    setSuburbLabel("");
    cityBoundsRef.current = null;
    if (cityInputRef.current) cityInputRef.current.value = "";
    if (suburbInputRef.current) suburbInputRef.current.value = "";
  };

  const clearSuburb = () => {
    setSuburbLabel("");
    if (suburbInputRef.current) suburbInputRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <label style={labelStyle}>City</label>
        <div style={inputWrapStyle}>
          <input ref={cityInputRef} placeholder="Search city" style={inputStyle} aria-label="Select city" defaultValue={cityLabel} />
          {cityLabel ? (
            <button type="button" onClick={clearCity} style={clearBtnStyle} aria-label="Clear city">×</button>
          ) : null}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Suburb</label>
        <div style={inputWrapStyle}>
          <input ref={suburbInputRef} placeholder="Search suburb" style={inputStyle} aria-label="Select suburb" defaultValue={suburbLabel} />
          {suburbLabel ? (
            <button type="button" onClick={clearSuburb} style={clearBtnStyle} aria-label="Clear suburb">×</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#8a94a6",
  marginBottom: 4,
};

const inputWrapStyle: React.CSSProperties = {
  position: "relative",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 28px 8px 10px",
  borderRadius: 8,
  border: "1px solid #2a2e35",
  background: "#0e0f12",
  color: "#e8eaed",
  outline: "none",
};

const clearBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: 6,
  width: 20,
  height: 20,
  borderRadius: 10,
  border: "1px solid #2a2e35",
  background: "#14181f",
  color: "#e8eaed",
  cursor: "pointer",
  lineHeight: "16px",
};

