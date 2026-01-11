"use client";

import { useMemo, useState } from "react";
import type { Place } from "@/components/MapView";

type Props = {
  place: Place;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function AddPriceModal({ place, onClose, onSubmitted }: Props) {
  // Category selector: beer | wine | spirits
  const [category, setCategory] = useState<"beer" | "wine" | "spirits">("beer");

  // Product fields (vary by category)
  const [productName, setProductName] = useState(""); // for beer & wine
  const [spirit, setSpirit] = useState(""); // for spirits
  const [mixer, setMixer] = useState(""); // for spirits

  // Size selection (by category)
  const [sizeLabel, setSizeLabel] = useState<string>("Schooner");
  const [price, setPrice] = useState("");
  const [membership, setMembership] = useState<"member" | "non-member">("non-member");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>(() => new Date().toISOString().slice(11, 16));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isoWhen = useMemo(() => {
    if (!date) return null;
    const t = time || "12:00";
    // Local time to ISO; let server store as string
    const dt = new Date(`${date}T${t}:00`);
    return dt.toISOString();
  }, [date, time]);

  async function submit() {
    setError(null);
    const priceNum = toCents(price);
    // Validate required fields by category
    if (!priceNum) return setError("Price is required");
    if (category === "beer" || category === "wine") {
      if (!productName) return setError("Product is required");
    } else if (category === "spirits") {
      if (!spirit || !mixer) return setError("Spirit and mixer are required");
    }
    setSubmitting(true);
    try {
      // Map size -> ml depending on category
      let ml: number | null = null;
      if (category === "wine") {
        if (sizeLabel === "150ml") ml = 150;
        else if (sizeLabel === "250ml") ml = 250;
        else ml = null; // bottle
      } else {
        ml = null; // beer and spirits: no mL recorded
      }

      // Map product fields to backend shape (spirits separate mixer column)
      const name = category === "spirits" ? spirit : productName;
      const productMixer = category === "spirits" ? (mixer || null) : null;
      const payload = {
        place: { place_id: place.place_id, name: place.name, address: place.address },
        // brand removed in UI: send empty string
        product: { brand: "", name, category, mixer: productMixer },
        size: { size_label: sizeLabel || null, ml },
        price_cents: priceNum,
        observed_at: isoWhen,
        notes: notes || null,
        membership: membership === "member",
      };
      const res = await fetch("/api/price-reports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Submit failed");
      onSubmitted?.();
      onClose();
      alert("Thanks! Your price was submitted for approval.");
    } catch (e: any) {
      setError(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={headerRow}>
          <h3 style={{ margin: 0 }}>Add a price</h3>
          <button onClick={onClose} style={iconBtn} aria-label="Close">✕</button>
        </div>
        <div style={{ marginBottom: 8, color: "#aab" }}>{place.name}</div>
        {error && <div style={{ color: "#ff6b6b", marginBottom: 8 }}>{error}</div>}
        <div style={grid}>
          <label style={label}>
            Category
            <select
              value={category}
              onChange={(e) => {
                const c = e.target.value as "beer" | "wine" | "spirits";
                setCategory(c);
                // Reset fields on category change for clarity
                setSizeLabel(c === "beer" ? "Schooner" : c === "wine" ? "150ml" : "Half nip");
                setProductName("");
                setSpirit("");
                setMixer("");
              }}
              style={input}
            >
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

          <label style={label}>
            Size
            <select value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} style={input}>
              {category === "beer" && (
                <>
                  <option>Pot</option>
                  <option>Schooner</option>
                  <option>Pint</option>
                  <option>Jug</option>
                  <option>Stubbie</option>
                  <option>Can</option>
                </>
              )}
              {category === "wine" && (
                <>
                  <option>150ml</option>
                  <option>250ml</option>
                  <option>Piccolo</option>
                  <option>Bottle</option>
                </>
              )}
              {category === "spirits" && (
                <>
                  <option>Half nip</option>
                  <option>Full nip</option>
                </>
              )}
            </select>
          </label>

          <label style={label}>Price<input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$7.50" style={input} /></label>
          <label style={label}>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></label>
          <label style={label}>Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={input} /></label>
          <label style={label}>
            Price type
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button type="button" onClick={() => setMembership("non-member")} style={{ ...segBtn, ...(membership === "non-member" ? segBtnActive : {}) }} aria-pressed={membership === "non-member"}>Non-member</button>
              <button type="button" onClick={() => setMembership("member")} style={{ ...segBtn, ...(membership === "member" ? segBtnActive : {}) }} aria-pressed={membership === "member"}>Member</button>
            </div>
          </label>
          <label style={{ ...label, gridColumn: "1 / span 2" }}>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details" style={{ ...input, minHeight: 80, resize: "vertical" }} /></label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btn}>Cancel</button>
          <button onClick={submit} style={btnPrimary} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
}

function toCents(s: string): number | null {
  const digits = s.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, display: "grid", placeItems: "center", padding: 16 };
const modal: React.CSSProperties = { width: "min(640px, 95vw)", background: "#0f1318", color: "#e5e7eb", border: "1px solid #2a2e35", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", padding: 16 };
const headerRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 };
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", color: "#9aa1a9", cursor: "pointer" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, color: "#aab" };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb" };
const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #2a2e35", background: "#111827", color: "#e5e7eb", cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #08916a", background: "#10b981", color: "#04120d", cursor: "pointer" };
const segBtn: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb", cursor: "pointer" };
const segBtnActive: React.CSSProperties = { background: "#111827", borderColor: "#475569" };
