import { createEventBus } from "../../lib/events.js";

// This is a lightweight wrapper that fakes a map until
// you plug in Leaflet/Mapbox/OpenLayers. The DOM structure
// and public API are stable so features remain decoupled.

export function createMapService(rootEl, { center = [0, 0], zoom = 2 } = {}) {
  if (!rootEl) throw new Error("createMap: root element is required");

  const bus = createEventBus();
  const mapEl = document.createElement("div");
  mapEl.className = "map-canvas";
  mapEl.tabIndex = 0;
  rootEl.appendChild(mapEl);

  const markersEl = document.createElement("div");
  markersEl.className = "map-markers";
  mapEl.appendChild(markersEl);

  let state = {
    center: toLatLng(center),
    zoom,
    markers: new Map(),
    nextId: 1,
  };

  // Simulated click to produce lat/lng in a normalized way
  mapEl.addEventListener("click", (e) => {
    const rect = mapEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height; // 0..1
    const lng = x * 360 - 180;
    const lat = 90 - y * 180;
    bus.emit("click", { latlng: { lat, lng } });
  });

  function setView(latlng, nextZoom = state.zoom) {
    state = { ...state, center: toLatLng(latlng), zoom: nextZoom };
    renderView();
    bus.emit("move", { center: state.center, zoom: state.zoom });
  }

  function addMarker({ lat, lng }) {
    const id = String(state.nextId++);
    const el = document.createElement("div");
    el.className = "map-marker";
    el.title = `#${id}`;
    el.dataset.id = id;
    markersEl.appendChild(el);
    state.markers.set(id, { id, el, lat, lng });
    renderMarkers();
    return id;
  }

  function clearMarkers() {
    state.markers.forEach((m) => m.el.remove());
    state.markers.clear();
  }

  function destroy() {
    clearMarkers();
    mapEl.remove();
  }

  function on(ev, fn) {
    return bus.on(ev, fn);
  }
  function off(ev, fn) {
    return bus.off(ev, fn);
  }

  function renderView() {
    // For stub: encode center/zoom into a background gradient
    const { lat, lng } = state.center;
    const hue = Math.round(((lng + 180) / 360) * 360);
    const light = Math.round(((lat + 90) / 180) * 30) + 50; // 50..80
    mapEl.style.background = `linear-gradient(135deg, hsl(${hue} 70% ${light}%) 0%, hsl(${(hue + 90) % 360} 70% ${light}%) 100%)`;
  }

  function renderMarkers() {
    const rect = mapEl.getBoundingClientRect();
    state.markers.forEach((m) => {
      const x = (m.lng + 180) / 360; // 0..1
      const y = 1 - (m.lat + 90) / 180; // 0..1
      const left = Math.max(0, Math.min(1, x)) * rect.width;
      const top = Math.max(0, Math.min(1, y)) * rect.height;
      m.el.style.transform = `translate(${left - 6}px, ${top - 6}px)`;
    });
  }

  // Reposition markers on resize
  const resizeObserver = new ResizeObserver(() => renderMarkers());
  resizeObserver.observe(mapEl);

  // Initial paint
  renderView();
  bus.emit("ready", { center: state.center, zoom: state.zoom });

  return { on, off, setView, addMarker, clearMarkers, destroy };
}

function toLatLng(v) {
  if (Array.isArray(v)) return { lat: Number(v[0]), lng: Number(v[1]) };
  return { lat: Number(v.lat), lng: Number(v.lng) };
}

