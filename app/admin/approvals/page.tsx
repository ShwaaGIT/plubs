"use client";

import { useEffect, useRef, useState } from "react";

type PendingRow = {
  id: string;
  price_cents: number;
  observed_at: string | null;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
  venues?: { place_id?: string | null; name?: string | null; formatted_address?: string | null; suburb?: string | null; state?: string | null } | null;
  product_sizes?: { size_label?: string | null; ml?: number | null; products?: { brand?: string | null; name?: string | null; category?: string | null } | null } | null;
};

export default function AdminApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [approvedMap, setApprovedMap] = useState<Record<string, { latest_price_cents: number | null; latest_count: number; counts: Array<{ price_cents: number; count: number }> }>>({});
  const autoApproved = useRef<Set<string>>(new Set());

  // Group by venue + product/size; count agreeing price submissions
  const groups = (() => {
    const map = new Map<string, { key: string; venueLabel: string; addr: string; venueSort: string; productLabel: string; sizeLabel: string; rows: PendingRow[] }>();
    for (const r of rows) {
      const venueLabel = r.venues?.name || "Unknown venue";
      const addr = r.venues?.formatted_address || [r.venues?.suburb, r.venues?.state].filter(Boolean).join(", ");
      const prod = r.product_sizes?.products;
      const productLabel = [prod?.brand, prod?.name].filter(Boolean).join(" ") || "Unknown product";
      const sizeLabel = [r.product_sizes?.size_label, r.product_sizes?.ml ? `${r.product_sizes?.ml}ml` : null].filter(Boolean).join(" • ");
      const productKey = [prod?.category || "", prod?.brand || "", prod?.name || "", r.product_sizes?.size_label || "", r.product_sizes?.ml ?? ""].join("|");
      const venueKey = r.venues?.place_id || `${venueLabel}|${addr}`;
      const key = `${venueKey}||${productKey}`;
      if (!map.has(key)) {
        map.set(key, { key, venueLabel, addr, venueSort: [r.venues?.state || "", r.venues?.suburb || "", venueLabel].join("|"), productLabel, sizeLabel, rows: [] });
      }
      map.get(key)!.rows.push(r);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.venueSort.localeCompare(b.venueSort) || a.productLabel.localeCompare(b.productLabel) || a.sizeLabel.localeCompare(b.sizeLabel)));
    return arr.map((g) => {
      const priceCounts = new Map<number, number>();
      for (const r of g.rows) priceCounts.set(r.price_cents, (priceCounts.get(r.price_cents) || 0) + 1);
      const prices = Array.from(priceCounts.entries()).map(([price_cents, count]) => ({ price_cents, count })).sort((a, b) => a.price_cents - b.price_cents);
      return { ...g, prices };
    });
  })();

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

  // After rows load, fetch approved summaries for each group
  useEffect(() => {
    if (!rows.length) {
      setApprovedMap({});
      autoApproved.current.clear();
      return;
    }
    const uniqueGroups: Array<{ key: string; place_id: string; category?: string | null; brand?: string | null; name?: string | null; mixer?: string | null; size_label?: string | null; ml?: number | null }> = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const place_id = r.venues?.place_id || "";
      if (!place_id) continue;
      const prod = r.product_sizes?.products;
      const category = prod?.category || null;
      const brand = prod?.brand || null;
      const name = prod?.name || null;
      const mixer = (prod as any)?.mixer || null;
      const size_label = r.product_sizes?.size_label || null;
      const ml = r.product_sizes?.ml ?? null;
      const key = [place_id, category || "", brand || "", name || "", mixer || "", size_label || "", ml ?? ""].join("||");
      if (!seen.has(key)) {
        seen.add(key);
        uniqueGroups.push({ key, place_id, category, brand, name, mixer, size_label, ml });
      }
    }
    if (!uniqueGroups.length) return;
    fetch("/api/admin/price-reports/approved-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups: uniqueGroups.map(({ key, ...g }) => g) }),
    })
      .then((r) => r.json())
      .then((dj) => {
        const map: Record<string, { latest_price_cents: number | null; latest_count: number; counts: Array<{ price_cents: number; count: number }> }> = {};
        if (Array.isArray(dj?.results)) {
          for (const row of dj.results as Array<{ key: string; latest_price_cents: number | null; latest_count: number; counts: Array<{ price_cents: number; count: number }> }>) {
            map[row.key] = { latest_price_cents: row.latest_price_cents, latest_count: row.latest_count, counts: row.counts };
          }
        }
        setApprovedMap(map);
      })
      .catch(() => setApprovedMap({}));
  }, [rows]);

  // Auto-approve pending submissions that match the currently accepted price for their group
  useEffect(() => {
    if (!rows.length || !approvedMap) return;
    const toApprove: string[] = [];
    for (const r of rows) {
      const place_id = r.venues?.place_id || "";
      if (!place_id) continue;
      const prod = r.product_sizes?.products;
      const key = [
        place_id,
        prod?.category || "",
        prod?.brand || "",
        prod?.name || "",
        (prod as any)?.mixer || "",
        r.product_sizes?.size_label || "",
        r.product_sizes?.ml ?? "",
      ].join("||");
      const approved = approvedMap[key];
      if (approved && approved.latest_price_cents != null && approved.latest_price_cents === r.price_cents) {
        if (!autoApproved.current.has(r.id)) toApprove.push(r.id);
      }
    }
    if (!toApprove.length) return;
    (async () => {
      const results = await Promise.all(
        toApprove.map(async (rid) => {
          const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(rid)}/approve`, { method: "POST" });
          return { rid, ok: res.ok };
        })
      );
      const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.rid));
      for (const id of succeeded) autoApproved.current.add(id);
      if (succeeded.size) setRows((prev) => prev.filter((r) => !succeeded.has(r.id)));
    })();
  }, [approvedMap, rows]);

  function makeKeys(r: PendingRow) {
    const venueLabel = r.venues?.name || "Unknown venue";
    const addr = r.venues?.formatted_address || [r.venues?.suburb, r.venues?.state].filter(Boolean).join(", ");
    const prod = r.product_sizes?.products;
    const productKey = [prod?.category || "", prod?.brand || "", prod?.name || "", r.product_sizes?.size_label || "", r.product_sizes?.ml ?? ""].join("|");
    const venueKey = r.venues?.place_id || `${venueLabel}|${addr}`;
    return { venueKey, productKey };
  }

  async function approve(id: string) {
    // Approve all matching rows in same venue+product group with the same price
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const { venueKey, productKey } = makeKeys(target);
    const price = target.price_cents;
    const batch = rows.filter((r) => {
      const k = makeKeys(r);
      return k.venueKey === venueKey && k.productKey === productKey && r.price_cents === price;
    });
    const ids = Array.from(new Set(batch.map((r) => r.id)));
    if (!window.confirm(`Approve ${ids.length} submission${ids.length === 1 ? "" : "s"} at $${(price/100).toFixed(2)} for this venue/product?`)) return;
    const results = await Promise.all(
      ids.map(async (rid) => {
        const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(rid)}/approve`, { method: "POST" });
        return { rid, ok: res.ok, err: res.ok ? null : await res.json().catch(() => ({})) };
      })
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length) alert(`Some approvals failed (${failed.length}/${ids.length}).`);
    const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.rid));
    setRows((prev) => prev.filter((r) => !succeeded.has(r.id)));
  }

  async function reject(id: string) {
    const note = window.prompt("Optional: add a moderation note (applies to all in this price group)", "");
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const { venueKey, productKey } = makeKeys(target);
    const price = target.price_cents;
    const batch = rows.filter((r) => {
      const k = makeKeys(r);
      return k.venueKey === venueKey && k.productKey === productKey && r.price_cents === price;
    });
    const ids = Array.from(new Set(batch.map((r) => r.id)));
    if (!window.confirm(`Reject ${ids.length} submission${ids.length === 1 ? "" : "s"} at $${(price/100).toFixed(2)} for this venue/product?`)) return;
    const results = await Promise.all(
      ids.map(async (rid) => {
        const res = await fetch(`/api/admin/price-reports/${encodeURIComponent(rid)}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || null }),
        });
        return { rid, ok: res.ok, err: res.ok ? null : await res.json().catch(() => ({})) };
      })
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length) alert(`Some rejections failed (${failed.length}/${ids.length}).`);
    const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.rid));
    setRows((prev) => prev.filter((r) => !succeeded.has(r.id)));
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Pending price approvals</h1>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
      {!loading && !rows.length && !error && <div>No pending reports</div>}

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {groups.map((g) => (
          <div key={g.key} style={{ border: "1px solid #2a2e35", borderRadius: 8, background: "#0f1318" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #2a2e35", display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700 }}>{g.venueLabel}</div>
              <div style={{ color: "#aab" }}>{g.addr}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>{g.productLabel}{g.sizeLabel ? ` (${g.sizeLabel})` : ""}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {g.prices.map((p) => (
                    <span key={p.price_cents} style={chip} title={`${p.count} submission${p.count === 1 ? "" : "s"} at this price`}>
                      ${ (p.price_cents / 100).toFixed(2) } × {p.count}
                    </span>
                  ))}
                  {/* Show existing accepted baseline if any */}
                  {(() => {
                    const approved = approvedMap[[g.rows[0]?.venues?.place_id || "", (g.rows[0]?.product_sizes?.products?.category) || "", (g.rows[0]?.product_sizes?.products?.brand) || "", (g.rows[0]?.product_sizes?.products?.name) || "", (g.rows[0] as any)?.product_sizes?.products?.mixer || "", g.rows[0]?.product_sizes?.size_label || "", g.rows[0]?.product_sizes?.ml ?? ""].join("||")];
                    if (!approved || approved.latest_price_cents == null) return null;
                    return (
                      <span style={{ ...chip, background: "#1f2937", borderColor: "#334155" }} title={`Accepted price with ${approved.latest_count} approved submission(s)`}>
                        Accepted: ${ (approved.latest_price_cents / 100).toFixed(2) } × {approved.latest_count}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: 12 }}>
              {g.rows
                .slice()
                .sort((a, b) => (a.price_cents - b.price_cents) || (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
                .map((r) => {
                  const when = r.observed_at ? new Date(r.observed_at).toLocaleString() : "Unknown time";
                  return (
                    <div key={r.id} style={{ display: "grid", gap: 6, border: "1px dashed #2a2e35", borderRadius: 6, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${(r.price_cents / 100).toFixed(2)}</div>
                        <div style={{ color: "#889", fontSize: 12 }}>Observed: {when}</div>
                      </div>
                      {r.notes ? <div style={{ color: "#ccd" }}>Note: {r.notes}</div> : null}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => approve(r.id)} style={btnPrimary}>Approve</button>
                        <button type="button" onClick={() => reject(r.id)} style={btnDanger}>Reject</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
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

// Reusable chip style for price summary badges
const chip: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #2a2e35",
  background: "#0f1318",
  color: "#e8eaed",
  fontSize: 12,
  lineHeight: "18px",
};
