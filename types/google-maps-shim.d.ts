// Minimal ambient types to satisfy TS without installing @types/google.maps
// This is intentionally lightweight; runtime uses the actual Google Maps JS API.
declare namespace google {
  namespace maps {
    type LatLngLiteral = { lat: number; lng: number };
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    class LatLngBounds {
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
    }
    class Map {
      constructor(el: HTMLElement, opts?: any);
      getCenter(): LatLng;
      getZoom(): number;
      getBounds(): LatLngBounds;
      setCenter(c: LatLngLiteral): void;
      setZoom(z: number): void;
      panTo(c: LatLng | LatLngLiteral): void;
      addListener(ev: string, cb: () => void): void;
    }
    class InfoWindow {
      setContent(html: string): void;
      open(opts: any): void;
    }
    class Circle {
      constructor(opts?: any);
      getBounds(): LatLngBounds | null;
    }
    namespace marker {
      class PinElement {
        element: HTMLElement;
        constructor(opts?: any);
      }
      class AdvancedMarkerElement {
        position: LatLngLiteral | LatLng;
        map: Map | null;
        content: HTMLElement | null;
        title?: string;
        zIndex?: number;
        constructor(opts?: any);
        addListener(ev: string, cb: () => void): void;
      }
    }
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: any);
        getPlace(): any;
        addListener(ev: string, cb: () => void): void;
        setBounds(bounds?: any): void;
        setOptions(opts: any): void;
      }
    }
  }
}

declare var google: any;
