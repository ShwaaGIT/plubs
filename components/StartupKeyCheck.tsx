"use client";

import { useEffect } from "react";

export default function StartupKeyCheck() {
  useEffect(() => {
    const present = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    // Confirm presence without exposing the key value
    // e.g., "Google Maps API key present: true"
    console.log("Google Maps API key present:", present);
  }, []);
  return null;
}

