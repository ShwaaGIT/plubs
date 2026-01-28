"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const nextDest = search?.get("next") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.push(nextDest);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.svg" alt="Plubs Live" style={{ width: 120, height: "auto" }} />
          <div style={{ fontSize: 14, letterSpacing: 0.4, color: "#9ca3af", marginTop: 8 }}>WELCOME TO</div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 8px 30px rgba(0,0,0,0.07)",
            padding: 18,
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#111827" }}>Log in</h2>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </label>
            {error ? (
              <div style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", border: "1px solid #fee2e2", padding: "8px 10px", borderRadius: 8 }}>{error}</div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={{
                appearance: "none",
                border: "none",
                background: loading ? "#ff6b64" : "#ff3b30",
                color: "#ffffff",
                padding: "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                fontWeight: 600,
                transition: "filter .15s ease, transform .05s ease",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p style={{ marginTop: 12, textAlign: "center", color: "#6b7280" }}>
          No account? <a href={`/signup?next=${encodeURIComponent(nextDest)}`} style={{ color: "#111827", textDecoration: "none", borderBottom: "1px solid #ffd60a" }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}
