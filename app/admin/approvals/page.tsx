"use client";

import { useEffect, useState } from "react";

type PendingRow = {
  id: string;
  price_cents: number;
  observed_at: string | null;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
  venues?: { name?: string | null; formatted_address?: string | null; suburb?: string | null; state?: string | null } | null;
  product_sizes?: { size_label?: string | null; ml?: number | null; products?: { brand?: string | null; name?: string | null; category?: string | null } | null } | null;
};

export default function AdminApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/price-reports/pending", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setRows(data.results || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(id)}/approve`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Approve failed");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function reject(id: string) {
    const note = window.prompt("Optional: add a moderation note", "");
    const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Reject failed");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Pending price approvals</h1>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
      {!loading && !rows.length && !error && <div>No pending reports</div>}

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {rows.map((r) => {
          const venueLabel = r.venues?.name || "Unknown venue";
          const addr = r.venues?.formatted_address || [r.venues?.suburb, r.venues?.state].filter(Boolean).join(", ");
          const prod = r.product_sizes?.products;
          const productLabel = [prod?.brand, prod?.name].filter(Boolean).join(" ") || "Unknown product";
          const sizeLabel = [r.product_sizes?.size_label, r.product_sizes?.ml ? `${r.product_sizes?.ml}ml` : null]
            .filter(Boolean)
            .join(" • ");
          const price = (r.price_cents ?? 0) / 100;
          const when = r.observed_at ? new Date(r.observed_at).toLocaleString() : "Unknown time";
          return (
            <div key={r.id} style={{
              border: "1px solid #2a2e35",
              borderRadius: 8,
              padding: 12,
              background: "#0f1318",
              display: "grid",
              gap: 6,
            }}>
              <div style={{ fontWeight: 600 }}>{venueLabel}</div>
              <div style={{ color: "#aab" }}>{addr}</div>
              <div>{productLabel} {sizeLabel ? `(${sizeLabel})` : ""}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>${price.toFixed(2)}</div>
              {r.notes ? <div style={{ color: "#ccd" }}>Note: {r.notes}</div> : null}
              <div style={{ color: "#889" }}>Observed: {when}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => approve(r.id)} style={btnPrimary}>Approve</button>
                <button type="button" onClick={() => reject(r.id)} style={btnDanger}>Reject</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#10b981",
  color: "#04120d",
  borderColor: "#08916a",
};
const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "#ef4444",
  color: "#140808",
  borderColor: "#dc2626",
};

