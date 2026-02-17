"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, loadPlacesLibrary } from "../lib/googleMapsLoader";

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
  const autoElMountRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const autoElementRef = useRef<any | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [openSug, setOpenSug] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let destroyed = false;

    // Load Maps core first, then Places via module (works even when global isn't populated)
    loadGoogleMaps().then(() => {
      if (destroyed) return;
      const el = inputRef.current;
      const gmaps = (window as any).google?.maps;
      // Try to ensure Places is present (module or global)
      loadPlacesLibrary().then((placesModule) => {
        if (destroyed) return;
        const placesNs = placesModule || gmaps?.places;

        // New element path
        if (gmaps && placesNs && (placesNs as any).PlaceAutocompleteElement && autoElMountRef.current) {
          try {
            setError(null);
            const mount = autoElMountRef.current;
          // Avoid duplicates on re-render
          if (!autoElementRef.current) {
            const pae = new (placesNs as any).PlaceAutocompleteElement();
            pae.placeholder = placeholder;
            pae.style.cssText = `display:block;width:280px;height:40px;border-radius:9999px;border:1px solid #ff3b30;background:#ffffff;color:#111827;box-shadow:0 2px 10px rgba(255,59,48,0.15);padding:4px 8px;`;
            // Restrict to AU regions roughly equivalent to legacy options
            try {
              pae.autocompleteOptions = {
                componentRestrictions: { country: "au" },
                types: ["(regions)"] as any,
                fields: ["id", "displayName", "location", "types"] as any,
              };
            } catch {}

            // Handle selection events (support both event names just in case)
            const onSelect = (ev: any) => {
              try {
                setLoading(true);
                const detail = ev?.detail || ev;
                const place = detail?.place || detail?.value || pae?.value || null;
                // Try to normalize data across variants
                const name: string =
                  place?.displayName?.text || place?.name || (typeof pae?.value === "string" ? pae.value : value) || "";
                const id: string = place?.id || place?.place_id || "";
                const loc = place?.location || place?.geometry?.location;
                let lat: number | undefined;
                let lng: number | undefined;
                try {
                  if (loc && typeof loc.lat === "function" && typeof loc.lng === "function") {
                    lat = loc.lat();
                    lng = loc.lng();
                  } else if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
                    lat = loc.lat;
                    lng = loc.lng;
                  } else if (loc?.latLng && typeof loc.latLng.lat === "function" && typeof loc.latLng.lng === "function") {
                    lat = loc.latLng.lat();
                    lng = loc.latLng.lng();
                  }
                } catch {}
                if (typeof lat === "number" && typeof lng === "number") {
                  const sel: SuburbSelection = { suburbName: name, placeId: id, lat, lng };
                  setValue(sel.suburbName);
                  onSelect(sel);
                } else {
                  setError("Selected place has no location");
                }
              } finally {
                setLoading(false);
              }
            };

            try { pae.addEventListener("gmp-placeselect", onSelect); } catch {}
            try { pae.addEventListener("gmpx-placechange", onSelect as any); } catch {}

            mount.innerHTML = "";
            mount.appendChild(pae);
            autoElementRef.current = pae;
          }
        } catch (e: any) {
          setError(
            e?.message ||
              "Places API blocked. In Google Cloud, ensure this browser key is HTTP-referrer restricted for localhost + domain, and API-restricted to Maps JavaScript API + Places API, and that both APIs are enabled."
          );
        }
          return;
        }

        // Legacy Autocomplete path
        if (!gmaps || !placesNs || !el) {
          try {
            console.warn("[Maps] Availability check:", {
              mapsLoaded: Boolean(gmaps),
              placesAvailable: Boolean(placesNs),
            });
          } catch {}
          // Fall back to server-side autocomplete via API routes; keep legacy input visible
          setError(null);
          return;
        }
        setError(null);
        try {
          const acCtor: any = (placesNs as any).Autocomplete || (google as any)?.maps?.places?.Autocomplete;
          if (!acCtor) throw new Error("Autocomplete class not available; use PlaceAutocompleteElement");
          const ac = new acCtor(el, {
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
    });

    return () => {
      destroyed = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [onSelect]);

  return (
    <div style={wrapStyle}>
      {/* Mount point for new PlaceAutocompleteElement; hidden when using legacy input */}
      <div ref={autoElMountRef} style={{ display: "block" }} />
      {/* Legacy fallback input (visible when new element not attached) */}
      {!autoElementRef.current ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            // Use server-side autocomplete suggestions if client Places is unavailable
            const hasClientPlaces = Boolean((window as any).google?.maps?.places);
            if (!hasClientPlaces) {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(async () => {
                const q = v.trim();
                if (!q) {
                  setSuggestions([]);
                  setOpenSug(false);
                  return;
                }
                try {
                  const r = await fetch("/api/places/autocomplete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input: q }),
                  });
                  const j = await r.json();
                  if (r.ok && Array.isArray(j?.predictions)) {
                    setSuggestions(j.predictions);
                    setOpenSug(true);
                  } else {
                    setSuggestions([]);
                    setOpenSug(false);
                  }
                } catch {
                  setSuggestions([]);
                  setOpenSug(false);
                }
              }, 250);
            }
          }}
          placeholder={placeholder}
          aria-label="Search suburb"
          style={inputStyle}
        />
      ) : null}
      {/* Server-side suggestions dropdown */}
      {!autoElementRef.current && openSug && suggestions.length ? (
        <div style={sugWrapStyle} role="listbox">
          {suggestions.map((sug) => (
            <button
              type="button"
              key={sug.place_id}
              role="option"
              onClick={async () => {
                setOpenSug(false);
                setSuggestions([]);
                setLoading(true);
                try {
                  const r = await fetch("/api/places/details", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ place_id: sug.place_id }),
                  });
                  const j = await r.json();
                  if (r.ok && typeof j?.lat === "number" && typeof j?.lng === "number") {
                    const sel: SuburbSelection = {
                      suburbName: j?.name || sug.description,
                      placeId: sug.place_id,
                      lat: j.lat,
                      lng: j.lng,
                    };
                    setValue(sel.suburbName);
                    onSelect(sel);
                  } else {
                    setError(j?.error || "Failed to resolve place");
                  }
                } catch {
                  setError("Failed to resolve place");
                } finally {
                  setLoading(false);
                }
              }}
              style={sugItemStyle}
            >
              {sug.description}
            </button>
          ))}
        </div>
      ) : null}
      {value ? (
        <button
          type="button"
          aria-label="Clear suburb"
          title="Clear suburb"
          onClick={() => {
            setValue("");
            try {
              if (inputRef.current) inputRef.current.value = "";
              if (autoElementRef.current) autoElementRef.current.value = "";
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
  border: "1px solid #ff3b30",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  boxShadow: "0 2px 10px rgba(255,59,48,0.15)",
};

const clearBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: 6,
  width: 28,
  height: 28,
  borderRadius: 14,
  border: "1px solid #ff3b30",
  background: "#fff5f5",
  color: "#b91c1c",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
};

const loadingStyle: React.CSSProperties = {
  position: "absolute",
  right: 40,
  top: 10,
  color: "#ff3b30",
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

const sugWrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 44,
  left: 0,
  width: 280,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
  zIndex: 50,
  overflow: "hidden",
};

const sugItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  background: "#ffffff",
  color: "#111827",
  border: "none",
  borderBottom: "1px solid #f3f4f6",
  cursor: "pointer",
};
