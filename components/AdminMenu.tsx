"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PendingRow = {
  id: string;
  price_cents: number;
  observed_at: string | null;
  notes: string | null;
  created_at: string;
  venues?: { place_id?: string | null; name?: string | null; formatted_address?: string | null; suburb?: string | null; state?: string | null } | null;
  product_sizes?: { size_label?: string | null; ml?: number | null; products?: { brand?: string | null; name?: string | null; category?: string | null } | null } | null;
};

type Props = {
  onApproved?: (place_id: string, price_cents: number) => void;
};

export default function AdminMenu({ onApproved }: Props) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // detect admin on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        setIsAdmin(!!data?.user?.admin);
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/price-reports/pending", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function approve(id: string) {
    const target = rows.find((x) => x.id === id);
    const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(id)}/approve`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Approve failed");
      return;
    }
    // Optimistically remove and notify map if we have place_id
    setRows((prev) => prev.filter((r) => r.id !== id));
    const pid = target?.venues?.place_id || undefined;
    if (pid && typeof target?.price_cents === "number" && onApproved) onApproved(pid, target.price_cents);
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

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Admin approvals"
        style={{
          position: "fixed",
          top: 8,
          right: 12,
          zIndex: 20,
          background: "#ffffff",
          color: "#111827",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          padding: "6px 10px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          cursor: "pointer",
        }}
      >
        Admin
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 30,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(640px, 92vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "#0f1318",
              color: "#e5e7eb",
              border: "1px solid #2a2e35",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Pending price approvals</h2>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "#9aa1a9", cursor: "pointer" }}>✕</button>
            </div>
            {loading && <div>Loading…</div>}
            {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
            {!loading && !rows.length && !error && <div>No pending reports</div>}
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((r) => {
                const venueLabel = r.venues?.name || "Unknown venue";
                const addr = r.venues?.formatted_address || [r.venues?.suburb, r.venues?.state].filter(Boolean).join(", ");
                const prod = r.product_sizes?.products;
                const productLabel = [prod?.brand, prod?.name].filter(Boolean).join(" ") || "Unknown product";
                const sizeLabel = [r.product_sizes?.size_label, r.product_sizes?.ml ? `${r.product_sizes?.ml}ml` : null].filter(Boolean).join(" • ");
                const price = (r.price_cents ?? 0) / 100;
                const when = r.observed_at ? new Date(r.observed_at).toLocaleString() : "Unknown time";
                return (
                  <div key={r.id} style={{ border: "1px solid #2a2e35", borderRadius: 8, padding: 12, background: "#0f1318", display: "grid", gap: 6 }}>
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
        </div>
      )}
    </>
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
