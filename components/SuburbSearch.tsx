"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";

export type SuburbSelection = {
  suburbName: string;
  placeId: string;
  lat: number;
  lng: number;
};

type Props = {
  onSelect: (s: SuburbSelection) => void;
  onClear?: () => void;
  placeholder?: string;
};

export default function SuburbSearch({ onSelect, onClear, placeholder = "Search suburb (AU)" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    let destroyed = false;

    loadGoogleMaps().then(() => {
      if (destroyed) return;
      const el = inputRef.current;
      if (!el) return;
      if (!(window as any).google?.maps || !(window as any).google?.maps?.places) {
        try {
          console.warn("[Maps] Availability check:", {
            mapsLoaded: Boolean((window as any).google?.maps),
            placesAvailable: Boolean((window as any).google?.maps?.places),
          });
        } catch {}
        setError(
          "Places API blocked. In Google Cloud, ensure this browser key is HTTP-referrer restricted for localhost + domain, and API-restricted to Maps JavaScript API + Places API, and that both APIs are enabled."
        );
        return;
      }
      setError(null);
      try {
        const ac = new google.maps.places.Autocomplete(el, {
          componentRestrictions: { country: "au" },
          fields: ["place_id", "name", "geometry", "types"],
          types: ["(regions)"] as any,
        });
        autocompleteRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place) return;
          try {
            setLoading(true);
            const name: string = (place as any).displayName?.text || place.name || value || "";
            const id: string = place.place_id || "";
            const loc = place.geometry?.location;
            if (loc && typeof loc.lat === "function" && typeof loc.lng === "function") {
              const sel: SuburbSelection = { suburbName: name, placeId: id, lat: loc.lat(), lng: loc.lng() };
              setValue(sel.suburbName);
              onSelect(sel);
            } else {
              setError("Selected place has no location");
            }
          } finally {
            setLoading(false);
          }
        });
      } catch (e: any) {
        setError(
          e?.message ||
            "Places API blocked. In Google Cloud, ensure this browser key is HTTP-referrer restricted for localhost + domain, and API-restricted to Maps JavaScript API + Places API, and that both APIs are enabled."
        );
      }
    });

    return () => {
      destroyed = true;
    };
  }, [onSelect]);

  return (
    <div style={wrapStyle}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search suburb"
        style={inputStyle}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear suburb"
          title="Clear suburb"
          onClick={() => {
            setValue("");
            try {
              if (inputRef.current) inputRef.current.value = "";
            } catch {}
            onClear?.();
          }}
          style={clearBtnStyle}
        >
          ×
        </button>
      ) : null}
      {loading ? <span style={loadingStyle}>…</span> : null}
      {error ? <span style={errorStyle} role="alert">{error}</span> : null}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};

const inputStyle: React.CSSProperties = {
  width: 280,
  height: 40,
  padding: "8px 30px 8px 12px",
  borderRadius: 9999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
};

const clearBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: 6,
  width: 28,
  height: 28,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  color: "#111827",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
};

const loadingStyle: React.CSSProperties = {
  position: "absolute",
  right: 40,
  top: 10,
  color: "#6b7280",
  fontSize: 16,
};

const errorStyle: React.CSSProperties = {
  position: "absolute",
  top: 44,
  right: 0,
  maxWidth: 280,
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
};
