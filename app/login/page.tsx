"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "64px auto", padding: 16 }}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
        </label>
        <label>
          <div>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%" }} />
        </label>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        No account? <a href="/signup">Sign up</a>
      </p>
      <hr style={{ margin: "16px 0" }} />
      <GuestButton />
    </div>
  );
}

function GuestButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function goGuest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start guest session");
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to start guest session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
      <button onClick={goGuest} disabled={loading}>{loading ? "Entering as guest…" : "Continue as guest"}</button>
    </div>
  );
}
