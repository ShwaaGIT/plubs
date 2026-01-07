# Nightlife Finder (Next.js App Router)

A Next.js web app with a full-screen Google Map and a top-right menu to search for Pubs, Clubs, and Bars using the Google Places API.

## Features
- Full-screen Google Map (Google Maps JavaScript API).
- Top-right floating menu with multi-select filters (Pubs, Clubs, Bars), radius selector (1/2/5 km), and a "Search this area" action.
- Results list with name, rating, and address; clicking a result pans/zooms the map and opens an info window.
- Clicking a marker highlights the corresponding list item.
- Debounced map move handling; searches are only triggered by the "Search this area" button.
- Places are fetched server-side via `/api/places/search` with in-memory caching and sanitized responses.

## Directory Structure
- `app/page.tsx`: Main page with state, map, and panel wiring.
- `app/api/places/search/route.ts`: Server route that queries Google Places.
- `components/MapView.tsx`: Map component (markers + info windows).
- `components/PlacesPanel.tsx`: Floating menu + results list.
- `lib/googlePlaces.ts`: Helper for Nearby Search + per-query cache.
- `.env.local`: Environment variables (see below).

## Prerequisites
- Node.js 18+.
- Google Cloud project with billing enabled.

## Enable These Google APIs
In Google Cloud Console (same project as your API key):
- Maps JavaScript API
- Places API

Optional (if you want a vector map style):
- Create a Map ID in Google Maps Platform (Maps > Map Management). Use it via `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.

## Environment Variables (.env.local)
Create a `.env.local` at the repo root:

```
# Server-side Places API key (keep secret; restrict to IP/hostname)
GOOGLE_MAPS_API_KEY=YOUR_SERVER_KEY

# Client-side Maps JavaScript API key (browser). You can reuse the same key
# but add HTTP referrer restrictions. Required to render the map in the browser.
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_KEY

# Optional: Map ID for vector basemap styling
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=YOUR_MAP_ID
```

Notes:
- The server route `/api/places/search` uses `GOOGLE_MAPS_API_KEY` to call Places Web Service.
- The client uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only to load the Maps JavaScript API (no Places calls from the browser).

## Run Locally
```
# install deps
npm install

# run dev server
npm run dev

# open
http://localhost:3000
```

## How Searching Works
- The page tracks the current map center (on map `idle` event, debounced by the Maps API cycle).
- When you click "Search this area", the browser POSTs to `/api/places/search`:
  ```json
  { "centerLat": <number>, "centerLng": <number>, "radiusMeters": <1000|2000|5000>, "filters": {"pubs": true, "clubs": false, "bars": true} }
  ```
- The server calls Places Nearby Search for each selected filter, deduplicates by `place_id`, truncates to 40, and returns:
  ```json
  { "results": [ { "place_id", "name", "lat", "lng", "address", "rating", "user_ratings_total", "types" } ] }
  ```
- Results are cached in-memory for 2 minutes by (rounded center, radius, filters).

## Security Notes
- The browser never calls Places Web Service directly. All data comes from `/api/places/search`.
- Restrict your API keys: HTTP referrer restrictions for the browser key; IP or hostname restrictions for the server key if possible.

## Customization Tips
- To change default center, edit `app/page.tsx` (London by default).
- To adjust the result limit or cache TTL, see `lib/googlePlaces.ts`.
- Styling lives inline in components for simplicity; migrate to CSS Modules or Tailwind if preferred.

---
Happy mapping!
