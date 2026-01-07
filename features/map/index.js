import { createMapService } from "./map.service.js";

// Public API surface for the map feature.
// Other features should import only from this file.

export function createMap(rootEl, options = {}) {
  const svc = createMapService(rootEl, options);
  return {
    on: svc.on,
    off: svc.off,
    setView: svc.setView,
    addMarker: svc.addMarker,
    clearMarkers: svc.clearMarkers,
    destroy: svc.destroy,
  };
}

