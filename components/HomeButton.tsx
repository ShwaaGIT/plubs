"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeButton() {
  const pathname = usePathname();
  // Hide the Home button on the welcome page only
  if (pathname === "/welcome") return null;

  return (
    <Link
      href="/welcome"
      aria-label="Home"
      title="Home"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#ffffff",
        color: "#1f2937",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        display: "grid",
        placeItems: "center",
        textDecoration: "none",
        zIndex: 10001,
        lineHeight: 0,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3 9 9-7 9 7" />
        <path d="M9 22V12h6v10" />
        <path d="M21 10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10" />
      </svg>
    </Link>
  );
}
