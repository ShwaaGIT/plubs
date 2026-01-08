"use client";

import { useEffect, useState } from "react";

type User = { id: string; email: string; name?: string | null; display_name?: string | null } | null;

export default function AuthStatus() {
  const [user, setUser] = useState<User>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        setUser(data.user || null);
        // Detect guest cookie client-side
        const isGuest = /(?:^|; )plubs_guest=1(?:;|$)/.test(document.cookie);
        setGuest(isGuest);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  if (!user && !guest) {
    return (
      <div style={{ display: "flex", gap: 12 }}>
        <a href="/login">Log in</a>
        <a href="/signup">Sign up</a>
      </div>
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Also clear guest cookie if present
    document.cookie = `plubs_guest=; Expires=${new Date(0).toUTCString()}; Path=/; SameSite=Lax`;
    location.reload();
  }

  if (guest && !user) {
    const leaveGuest = () => {
      document.cookie = `plubs_guest=; Expires=${new Date(0).toUTCString()}; Path=/; SameSite=Lax`;
      location.href = "/welcome";
    };
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span>Guest</span>
        <a href="/login">Sign in</a>
        <button onClick={leaveGuest}>Exit guest</button>
      </div>
    );
  }

  const label = user?.display_name || user?.name || user?.email;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span>{label}</span>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
