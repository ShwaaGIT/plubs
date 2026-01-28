"use client";

export default function WelcomeGate() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        setUser(data.user || null);
      } finally {
        // no-op
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const appHref = user ? "/" : "/login?next=/";

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
      <div style={{ width: "100%", maxWidth: 860 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.png" alt="Plubs Live" style={{ width: 200, height: "auto" }} />
          <div style={{ fontSize: 14, letterSpacing: 0.4, color: "#9ca3af", marginTop: 8 }}>WELCOME TO</div>
        </div>

        {/* Hero Card */}
        <div
          style={{
            padding: 24,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            boxShadow: "0 10px 34px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ margin: 0, lineHeight: 1.15, fontSize: 32, color: "#111827" }}>Find fair drink prices near you</h2>
          <p style={{ color: "#374151", fontSize: 18, marginTop: 12, marginBottom: 12 }}>
            Nights out shouldn’t cost a fortune. Discover venues with honest prices and help the community by sharing updates.
          </p>
          <p style={{ color: "#374151", fontSize: 16, marginTop: 0, marginBottom: 16 }}>
            Search your suburb to see the best prices of your favourite drinks. Help display prices by entering the prices of different drinks at your local pub or club.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={appHref} style={btnPrimary}>Open App</a>
          </div>
        </div>


        {/* Gated review form appears only for logged-in users */}
        <div style={{ marginTop: 20 }}>
          <ReviewFormGate />
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
  background: "#ff3b30",
  color: "white",
  fontWeight: 600,
  boxShadow: "0 6px 14px rgba(255,59,48,0.25)",
};

const btnSecondary: React.CSSProperties = {
  ...baseBtn,
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
};

// no tertiary button on the welcome page (guest access removed)

import { useEffect, useState } from "react";

function ReviewFormGate() {
  const [user, setUser] = useState<any>(null);
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

  if (!user) {
    return (
      <div style={{ color: "#444" }}>
        Please log in to leave a review.
      </div>
    );
  }

  return <ReviewForm />;
}

function ReviewForm() {
  const [rating, setRating] = useState<number>(5);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to submit review");
      }
      setBody("");
      setRating(5);
      setMsg("Thanks for your review!");
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Leave a review</div>
      <div style={{ display: "block", marginBottom: 8 }}>
        <div style={{ marginBottom: 6 }}>Rating</div>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <label style={{ display: "block", marginBottom: 8 }}>
        Comment
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your thoughts"
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
      </label>
      <button type="submit" disabled={submitting || !body.trim()} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Submitting..." : "Submit review"}
      </button>
      {msg && <div style={{ marginTop: 8, color: "#444" }}>{msg}</div>}
    </form>
  );
}

type StarRatingProps = {
  value: number;
  onChange: (n: number) => void;
};

function StarRating({ value, onChange }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div role="radiogroup" aria-label="Rating" style={{ display: "inline-flex", gap: 6 }}>
      {stars.map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={filled}
            onClick={() => onChange(n)}
            style={{
              width: 32,
              height: 32,
              lineHeight: "32px",
              textAlign: "center",
              cursor: "pointer",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              background: filled ? "#fff7ed" : "white",
              color: filled ? "#f59e0b" : "#9ca3af",
              fontSize: 20,
              padding: 0,
            }}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
