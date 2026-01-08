"use client";

import { useRouter } from "next/navigation";

export default function WelcomeGate() {
  const router = useRouter();

  function continueAsGuest() {
    // Set a lightweight guest cookie for gating
    const days = 180; // ~6 months
    const exp = new Date();
    exp.setDate(exp.getDate() + days);
    document.cookie = `plubs_guest=1; Expires=${exp.toUTCString()}; Path=/; SameSite=Lax`;
    router.push("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <h1 style={{ marginBottom: 8 }}>Welcome</h1>
        <p style={{ color: "#444", marginTop: 0 }}>
          Log in or sign up for extra features coming soon. You can also continue as a guest to start exploring now.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <a href="/login" style={btnPrimary}>Log in</a>
          <a href="/signup" style={btnSecondary}>Sign up</a>
          <button onClick={continueAsGuest} style={btnTertiary}>Continue as guest</button>
        </div>
      </div>
    </div>
  );
}

const baseBtn: React.CSSProperties = {
  display: "inline-block",
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid transparent",
  fontSize: 16,
  cursor: "pointer",
  textDecoration: "none",
};

const btnPrimary: React.CSSProperties = {
  ...baseBtn,
  background: "#111827",
  color: "white",
};

const btnSecondary: React.CSSProperties = {
  ...baseBtn,
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
};

const btnTertiary: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  color: "#111827",
  border: "1px dashed #9ca3af",
};

