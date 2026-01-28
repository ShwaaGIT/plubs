"use client";

import { useEffect, useMemo, useState } from "react";
import type { Place } from "@/components/MapView";

type Props = {
  place: Place;
  onClose: () => void;
  onApproved?: (price_cents: number) => void;
};

type Report = {
  id: string;
  status: "pending" | "approved" | string;
  price_cents: number;
  membership: boolean | null;
  observed_at: string | null;
  notes: string | null;
  created_at: string;
  moderated_at?: string | null;
  product_sizes?: { size_label?: string | null; ml?: number | null; products?: { brand?: string | null; name?: string | null; category?: string | null; mixer?: string | null } | null } | null;
};

export default function PlaceAdminModal({ place, onClose, onApproved }: Props) {
  const [tab, setTab] = useState<"submitted" | "edit">("submitted");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [category, setCategory] = useState<"beer" | "wine" | "spirits">("beer");
  const [productName, setProductName] = useState("");
  const [spirit, setSpirit] = useState("");
  const [mixer, setMixer] = useState("");
  const [sizeLabel, setSizeLabel] = useState("Schooner");
  const [price, setPrice] = useState("");
  const [membership, setMembership] = useState<"non-member" | "member">("non-member");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>(() => new Date().toISOString().slice(11, 16));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/price-reports/by-place?place_id=${encodeURIComponent(place.place_id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (Array.isArray(j?.results)) setReports(j.results as Report[]);
        else setReports([]);
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [place.place_id]);

  async function submitEdit() {
    setSubmitting(true);
    try {
      const price_cents = toCents(price);
      if (!price_cents) throw new Error("Valid price required");
      const body = {
        place: { place_id: place.place_id, name: place.name, address: place.address },
        product: { brand: "", name: category === "spirits" ? spirit : productName, category, mixer: category === "spirits" ? mixer || null : null },
        size: { size_label: sizeLabel || null, ml: category === "wine" ? (sizeLabel === "150ml" ? 150 : sizeLabel === "250ml" ? 250 : null) : null },
        price_cents,
        observed_at: new Date(`${date || new Date().toISOString().slice(0, 10)}T${(time || "12:00") + ":00"}`).toISOString(),
        notes: note || null,
        membership: membership === "member",
      };
      const res = await fetch("/api/admin/price-reports/upsert-approved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Edit failed");
      onApproved?.(price_cents);
      alert("Saved as approved.");
      onClose();
    } catch (e: any) {
      alert(e?.message || "Edit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; items: Report[] }>();
    for (const r of reports) {
      const p = r.product_sizes?.products;
      const key = [p?.category || "", p?.name || "", p?.mixer || "", r.product_sizes?.size_label || "", r.product_sizes?.ml ?? "", r.membership ? "member" : "non-member"].join("||");
      if (!map.has(key)) map.set(key, { key, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values());
  }, [reports]);

  return (
    <div role="dialog" aria-modal="true" style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{place.name}</h3>
          <button onClick={onClose} style={iconBtn} aria-label="Close">✕</button>
        </div>
        <div style={tabsRow}>
          <button onClick={() => setTab("submitted")} style={{ ...tabBtn, ...(tab === "submitted" ? tabActive : {}) }}>Submitted</button>
          <button onClick={() => setTab("edit")} style={{ ...tabBtn, ...(tab === "edit" ? tabActive : {}) }}>Edit</button>
        </div>
        {tab === "submitted" ? (
          <div style={{ maxHeight: "60vh", overflow: "auto", display: "grid", gap: 8 }}>
            {loading && <div>Loading…</div>}
            {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
            {!loading && !error && !reports.length && <div>No submissions yet</div>}
            {!loading && grouped.map((g) => (
              <div key={g.key} style={{ border: "1px solid #2a2e35", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6, color: "#aab" }}>
                  <span>{labelFor(g.items[0])}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.items.map((r) => (
                    <span key={r.id} style={chip(r.status === "approved" ? "#10b981" : "#f59e0b")} title={`${r.status} • ${(r.price_cents / 100).toFixed(2)} • ${r.created_at}`}>${(r.price_cents / 100).toFixed(2)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: "#aab" }}>Save an approved price for this place.</div>
            <label style={label}>Category
              <select value={category} onChange={(e) => { const c = e.target.value as any; setCategory(c); setSizeLabel(c === "beer" ? "Schooner" : c === "wine" ? "150ml" : "Half nip"); setProductName(""); setSpirit(""); setMixer(""); }} style={input}>
                <option value="beer">Beer</option>
                <option value="wine">Wine</option>
                <option value="spirits">Spirits</option>
              </select>
            </label>
            {category !== "spirits" ? (
              <label style={label}>Product<input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={category === "beer" ? "e.g. Gold" : "e.g. Shiraz"} style={input} /></label>
            ) : (
              <>
                <label style={label}>Spirit<input value={spirit} onChange={(e) => setSpirit(e.target.value)} placeholder="e.g. Jack Daniel's" style={input} /></label>
                <label style={label}>Mixer<input value={mixer} onChange={(e) => setMixer(e.target.value)} placeholder="e.g. Coke" style={input} /></label>
              </>
            )}
            <label style={label}>Size
              <select value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} style={input}>
                {category === "beer" && (<>
                  <option>Pot</option><option>Schooner</option><option>Pint</option><option>Jug</option><option>Stubbie</option><option>Can</option>
                </>)}
                {category === "wine" && (<>
                  <option>150ml</option><option>250ml</option><option>Piccolo</option><option>Bottle</option>
                </>)}
                {category === "spirits" && (<>
                  <option>Half nip</option><option>Full nip</option>
                </>)}
              </select>
            </label>
            <label style={label}>Price<input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$7.50" style={input} /></label>
            <label style={label}>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></label>
            <label style={label}>Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={input} /></label>
            <label style={label}>Price type
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button type="button" onClick={() => setMembership("non-member")} style={{ ...segBtn, ...(membership === "non-member" ? segBtnActive : {}) }} aria-pressed={membership === "non-member"}>Non-member</button>
                <button type="button" onClick={() => setMembership("member")} style={{ ...segBtn, ...(membership === "member" ? segBtnActive : {}) }} aria-pressed={membership === "member"}>Member</button>
              </div>
            </label>
            <label style={{ ...label }}>Notes<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" style={{ ...input, minHeight: 80, resize: "vertical" }} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={btn}>Cancel</button>
              <button onClick={submitEdit} style={btnPrimary} disabled={submitting}>{submitting ? "Saving…" : "Save approved"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function labelFor(r?: Report) {
  if (!r) return "";
  const p = r.product_sizes?.products;
  const parts = [p?.category, p?.name, p?.mixer, r.product_sizes?.size_label, r.product_sizes?.ml ? `${r.product_sizes?.ml}ml` : null, r.membership ? "member" : "non-member"].filter(Boolean);
  return parts.join(" • ");
}

function toCents(s: string): number | null {
  const digits = s.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 45, display: "grid", placeItems: "center", padding: 16 };
const modal: React.CSSProperties = { width: "min(720px, 96vw)", background: "#0f1318", color: "#e5e7eb", border: "1px solid #2a2e35", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", padding: 16, maxHeight: "80vh", overflow: "auto" };
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", color: "#9aa1a9", cursor: "pointer" };
const tabsRow: React.CSSProperties = { display: "flex", gap: 6, margin: "8px 0 12px" };
const tabBtn: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb", cursor: "pointer" };
const tabActive: React.CSSProperties = { background: "#111827", borderColor: "#475569" };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb" };
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, color: "#aab" };
const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #2a2e35", background: "#111827", color: "#e5e7eb", cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #08916a", background: "#10b981", color: "#04120d", cursor: "pointer" };
const segBtn: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb", cursor: "pointer" };
const segBtnActive: React.CSSProperties = { background: "#111827", borderColor: "#475569" };
const chip = (bg: string): React.CSSProperties => ({ padding: "4px 8px", borderRadius: 999, fontSize: 12, background: bg, color: "#0b0f14", fontWeight: 700 });

