"use client";

import { useEffect, useState } from "react";

type User = { id: string; email: string; name?: string | null; display_name?: string | null } | null;

export default function AuthStatus() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        setUser(data.user || null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  const baseBtn: React.CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid transparent",
    textDecoration: "none",
    cursor: "pointer",
    fontSize: 12,
  };
  const btnPrimary: React.CSSProperties = {
    ...baseBtn,
    background: "#ff3b30",
    color: "#ffffff",
    boxShadow: "0 4px 10px rgba(255,59,48,0.2)",
  };
  const btnSecondary: React.CSSProperties = {
    ...baseBtn,
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #ff3b30",
  };

  if (!user) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <a href="/login" style={btnPrimary}>Log in</a>
        <a href="/signup" style={btnSecondary}>Sign up</a>
      </div>
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.reload();
  }

  const label = user?.display_name || user?.name || user?.email;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ color: "#374151", fontSize: 12 }}>{label}</span>
      <button onClick={logout} style={btnSecondary}>Log out</button>
    </div>
  );
}
