"use client";
import { Place } from "@/components/MapView";
import LocationPicker from "@/components/LocationPicker";

type Props = {
  center: { lat: number; lng: number };
  loading: boolean;
  error: string | null;
  results: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  onCenterChange: (c: { lat: number; lng: number }) => void;
};

export default function PlacesPanel(props: Props) {
  const { center, loading, error, results, selectedPlaceId } = props;

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Nearby results</div>
        <small style={{ color: "#778" }}>{center.lat.toFixed(4)}, {center.lng.toFixed(4)}</small>
      </div>

      <div style={{ marginBottom: 10 }}>
        <LocationPicker onCenterChange={props.onCenterChange} />
      </div>

      <div style={{ fontSize: 12, color: "#8a94a6", marginBottom: 8 }}>
        {loading ? "Searching this area…" : "Auto-search on map move"}
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={listStyle}>
        {results.map((p) => (
          <div
            key={p.place_id}
            onClick={() => props.onSelectPlace(p.place_id)}
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #2a2e35",
              background: selectedPlaceId === p.place_id ? "#19202a" : undefined,
              cursor: "pointer",
            }}
            title={p.address}
          >
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "#8a94a6" }}>
              {p.rating ? `⭐ ${p.rating} (${p.user_ratings_total ?? 0}) • ` : ""}
              {p.address}
            </div>
          </div>
        ))}
        {!results.length && (
          <div style={{ color: "#8a94a6", padding: 8 }}>No results yet. Move the map to search.</div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 360,
  height: 520,
  display: "flex",
  flexDirection: "column",
  background: "#0f1318",
  color: "#e8eaed",
  border: "1px solid #2a2e35",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  padding: 12,
};

const listStyle: React.CSSProperties = {
  marginTop: 10,
  overflow: "auto",
  border: "1px solid #2a2e35",
  borderRadius: 8,
  flex: 1,
  background: "#0e0f12",
};

const errorStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#ff6b6b",
};
