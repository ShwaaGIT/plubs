import { createMap } from "../features/map/index.js";
import { createStore } from "./store/index.js";
import { Button } from "../ui/Button.js";

const store = createStore({
  selectedLocation: null,
  markers: [],
});

function boot() {
  const mapRoot = document.getElementById("map-root");
  const panel = document.getElementById("side-panel");

  // Initialize map feature
  const map = createMap(mapRoot, {
    center: [0, 0],
    zoom: 2,
  });

  // Simple panel UI
  panel.append(
    Button({
      text: "Add Marker",
      onClick: () => {
        const lat = (Math.random() * 140 - 70).toFixed(3);
        const lng = (Math.random() * 360 - 180).toFixed(3);
        const id = map.addMarker({ lat: Number(lat), lng: Number(lng) });
        store.update((s) => {
          s.markers.push({ id, lat: Number(lat), lng: Number(lng) });
        });
      },
    }),
    Button({
      text: "Clear Markers",
      kind: "secondary",
      onClick: () => {
        map.clearMarkers();
        store.update((s) => {
          s.markers = [];
        });
      },
    })
  );

  // Wire map events to store
  map.on("click", (evt) => {
    store.set("selectedLocation", evt.latlng);
  });

  // Simple store subscriber to reflect selected location in the panel
  const selectionEl = document.createElement("div");
  selectionEl.className = "panel-section";
  panel.append(selectionEl);

  store.subscribe((state, change) => {
    if (change.key === "selectedLocation") {
      const v = state.selectedLocation;
      selectionEl.textContent = v
        ? `Selected: lat ${v.lat.toFixed(3)}, lng ${v.lng.toFixed(3)}`
        : "Click the map to select a location";
    }
  });

  // Initial render
  selectionEl.textContent = "Click the map to select a location";

  // Expose for quick debugging
  window.__APP__ = { map, store };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

