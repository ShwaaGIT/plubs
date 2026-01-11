"use client";

import { useEffect, useMemo, useState } from "react";

export type Category = "beer" | "wine" | "spirits";
export type Selection = {
  category: Category;
  product_name?: string | null; // beer/wine
  spirit?: string | null; // spirits
  mixer?: string | null; // spirits
  size_label?: string | null;
  ml?: number | null; // only used for wine sizes 150/250
  membership?: "member" | "non-member"; // viewing toggle
};

type Props = {
  value: Selection;
  onChange: (sel: Selection) => void;
};

export default function PriceFilterMenu({ value, onChange }: Props) {
  const [category, setCategory] = useState<Category>(value.category);
  const [membership, setMembership] = useState<"member" | "non-member">(value.membership || "non-member");
  const [products, setProducts] = useState<string[]>([]); // beer/wine names
  const [spirits, setSpirits] = useState<string[]>([]);
  const [mixers, setMixers] = useState<string[]>([]);

  const [productName, setProductName] = useState<string>(value.product_name || "");
  const [spirit, setSpirit] = useState<string>(value.spirit || "");
  const [mixer, setMixer] = useState<string>(value.mixer || "");
  const [sizeLabel, setSizeLabel] = useState<string>(value.size_label || defaultSize(category));

  useEffect(() => {
    // Load options when category changes
    if (category === "beer" || category === "wine") {
      fetch(`/api/products/list?category=${category}`)
        .then((r) => r.json())
        .then((d) => {
          const list: string[] = Array.isArray(d?.products) ? d.products : [];
          setProducts(list);
          const nextProd = list[0] || "";
          setProductName(nextProd);
          setSizeLabel(defaultSize(category));
          // set ml for wine if glass size
          const ml = category === "wine" ? sizeToMl(defaultSize("wine")) : null;
          onChange({ category, product_name: nextProd || null, size_label: defaultSize(category), ml, membership });
        })
        .catch(() => {
          setProducts([]);
          setProductName("");
          onChange({ category, product_name: null, size_label: defaultSize(category), ml: category === "wine" ? sizeToMl(defaultSize("wine")) : null, membership });
        });
    } else if (category === "spirits") {
      fetch(`/api/products/list?category=spirits`)
        .then((r) => r.json())
        .then((d) => {
          const list: string[] = Array.isArray(d?.spirits) ? d.spirits : [];
          setSpirits(list);
          const s = list[0] || "";
          setSpirit(s);
          setSizeLabel(defaultSize("spirits"));
          if (s) {
            fetch(`/api/products/list?category=spirits&spirit=${encodeURIComponent(s)}`)
              .then((r) => r.json())
              .then((dj) => {
                const mx: string[] = Array.isArray(dj?.mixers) ? dj.mixers : [];
                setMixers(mx);
                const m = mx[0] || "";
                setMixer(m);
                onChange({ category, spirit: s || null, mixer: m || null, size_label: defaultSize("spirits"), ml: null, membership });
              })
              .catch(() => {
                setMixers([]);
                setMixer("");
                onChange({ category, spirit: s || null, mixer: null, size_label: defaultSize("spirits"), ml: null, membership });
              });
          } else {
            setMixers([]);
            setMixer("");
            onChange({ category, spirit: null, mixer: null, size_label: defaultSize("spirits"), ml: null, membership });
          }
        })
        .catch(() => {
          setSpirits([]);
          setMixers([]);
          setSpirit("");
          setMixer("");
          onChange({ category, spirit: null, mixer: null, size_label: defaultSize("spirits"), ml: null, membership });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Handle cascading changes
  useEffect(() => {
    if (category === "beer" || category === "wine") {
      const ml = category === "wine" ? sizeToMl(sizeLabel) : null;
      onChange({ category, product_name: productName || null, size_label: sizeLabel, ml, membership });
    } else {
      onChange({ category, spirit: spirit || null, mixer: mixer || null, size_label: sizeLabel, ml: null, membership });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName, spirit, mixer, sizeLabel]);

  // When membership toggles, propagate selection without changing other fields
  useEffect(() => {
    if (category === "beer" || category === "wine") {
      const ml = category === "wine" ? sizeToMl(sizeLabel) : null;
      onChange({ category, product_name: productName || null, size_label: sizeLabel, ml, membership });
    } else {
      onChange({ category, spirit: spirit || null, mixer: mixer || null, size_label: sizeLabel, ml: null, membership });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership]);

  return (
    <div style={wrap}>
      <div style={row}>
        <label style={lbl}>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={inp}>
            <option value="beer">Beer</option>
            <option value="wine">Wine</option>
            <option value="spirits">Spirits</option>
          </select>
        </label>

        <label style={lbl}>
          Show member prices
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={membership === "member"}
              onChange={(e) => setMembership(e.target.checked ? "member" : "non-member")}
              aria-label="Show member prices"
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 12, color: "#cbd5e1" }}>{membership === "member" ? "On" : "Off"}</span>
          </div>
        </label>

        {category === "beer" || category === "wine" ? (
          <label style={lbl}>
            Product
            <select value={productName} onChange={(e) => setProductName(e.target.value)} style={inp}>
              {products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label style={lbl}>
              Spirit
              <select
                value={spirit}
                onChange={(e) => {
                  const s = e.target.value;
                  setSpirit(s);
                  // Reload mixers for this spirit
                  if (s) {
                    fetch(`/api/products/list?category=spirits&spirit=${encodeURIComponent(s)}`)
                      .then((r) => r.json())
                      .then((dj) => {
                        const mx: string[] = Array.isArray(dj?.mixers) ? dj.mixers : [];
                        setMixers(mx);
                        const m = mx[0] || "";
                        setMixer(m);
                      })
                      .catch(() => {
                        setMixers([]);
                        setMixer("");
                      });
                  } else {
                    setMixers([]);
                    setMixer("");
                  }
                }}
                style={inp}
              >
                {spirits.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label style={lbl}>
              Mixer
              <select value={mixer} onChange={(e) => setMixer(e.target.value)} style={inp}>
                {mixers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <label style={lbl}>
          Size
          <select value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} style={inp}>
            {category === "beer" && BEER_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {category === "wine" && WINE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {category === "spirits" && SPIRIT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

const BEER_SIZES = ["Pot", "Schooner", "Pint", "Jug", "Stubbie", "Can"];
const WINE_SIZES = ["150ml", "250ml", "Piccolo", "Bottle"];
const SPIRIT_SIZES = ["Half nip", "Full nip"];

function defaultSize(c: Category): string {
  if (c === "beer") return "Schooner";
  if (c === "wine") return "150ml";
  return "Full nip";
}

function sizeToMl(label?: string | null): number | null {
  if (!label) return null;
  if (label === "150ml") return 150;
  if (label === "250ml") return 250;
  return null;
}

const wrap: React.CSSProperties = {
  position: "absolute",
  right: 16,
  top: 16,
  zIndex: 12,
  background: "#0f1318",
  color: "#e5e7eb",
  border: "1px solid #2a2e35",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  padding: 10,
  minWidth: 260,
};
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const lbl: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "#aab" };
const inp: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb" };
const segBtn: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2e35", background: "#0b0f14", color: "#e5e7eb", cursor: "pointer" };
const segBtnActive: React.CSSProperties = { background: "#111827", borderColor: "#475569" };
