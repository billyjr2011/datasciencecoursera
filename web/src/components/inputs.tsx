import { useMemo, useState } from "react";
import { T } from "../theme";

export function ScaleInput({ min, max, val, onCh }: { min: number; max: number; val: number | null; onCh: (n: number) => void }) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const col = (n: number) => (n <= 3 ? T.green : n <= 6 ? T.amber : T.red);
  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {nums.map((n) => {
          const sel = val === n;
          return (
            <button
              key={n}
              onClick={() => onCh(n)}
              style={{ width: 38, height: 38, borderRadius: 7, fontSize: 13, cursor: "pointer", border: sel ? `2px solid ${col(n)}` : "1px solid rgba(255,255,255,0.07)", background: sel ? col(n) + "1A" : "rgba(255,255,255,0.03)", color: sel ? col(n) : T.dim, fontWeight: sel ? 800 : 400, transition: "all 0.12s" }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
        <span style={{ color: T.green }}>1 — Mild</span>
        <span style={{ color: T.amber }}>5 — Moderate</span>
        <span style={{ color: T.red }}>10 — Severe</span>
      </div>
    </div>
  );
}

export type Vitals = Record<string, string>;

export function VitalsIn({ val, onCh }: { val: Vitals; onCh: (v: Vitals) => void }) {
  const fields = [
    { k: "bp", l: "Blood Pressure", ph: "e.g. 120/80 mmHg" }, { k: "hr", l: "Heart Rate", ph: "e.g. 72 bpm" },
    { k: "temp", l: "Temperature", ph: "e.g. 37.2 °C" }, { k: "spo2", l: "SpO₂", ph: "e.g. 98 %" },
    { k: "rr", l: "Resp. Rate", ph: "e.g. 16 /min" }, { k: "bgl", l: "Blood Glucose", ph: "e.g. 5.5 mmol/L" },
    { k: "weight", l: "Weight (kg)", ph: "e.g. 70" }, { k: "height", l: "Height (cm)", ph: "e.g. 175" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 8 }}>
        {fields.map((f) => (
          <div key={f.k}>
            <label style={{ fontSize: 9, color: T.dim, display: "block", marginBottom: 3, fontWeight: 600 }}>{f.l}</label>
            <input
              placeholder={f.ph}
              value={val[f.k] ?? ""}
              onChange={(e) => onCh({ ...val, [f.k]: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: T.white, outline: "none" }}
              onFocus={(e) => (e.target.style.borderColor = T.teal)}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
            />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 9, color: T.dim, fontStyle: "italic" }}>
        Leave blank if unavailable. Weight+Height allow BMI calculation for metabolic risk.
      </p>
    </div>
  );
}

export function LocationInput({ zones, val, onCh }: { zones: string[]; val: string; onCh: (z: string) => void }) {
  const [search, setSearch] = useState(val || "");
  const filtered = useMemo(
    () => (search.length >= 1 ? zones.filter((z) => z.toLowerCase().includes(search.toLowerCase())) : zones),
    [search, zones],
  );
  return (
    <div>
      <input
        placeholder="Type your city or zone (e.g. Yaoundé Bastos, Douala Akwa...)"
        value={search}
        onChange={(e) => { setSearch(e.target.value); onCh(e.target.value); }}
        style={{ width: "100%", padding: "11px 14px", borderRadius: 9, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,201,177,0.3)", color: T.white, outline: "none", marginBottom: 10 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, maxHeight: 200, overflowY: "auto" }}>
        {filtered.map((z) => {
          const sel = val === z;
          return (
            <button
              key={z}
              onClick={() => { onCh(z); setSearch(z); }}
              style={{ padding: "7px 10px", borderRadius: 7, fontSize: 11, textAlign: "left", cursor: "pointer", border: sel ? `1.5px solid ${T.teal}` : "1px solid rgba(255,255,255,0.07)", background: sel ? "rgba(0,201,177,0.1)" : "rgba(255,255,255,0.025)", color: sel ? T.teal : T.white, fontWeight: sel ? 700 : 400, transition: "all 0.12s" }}
            >
              {z}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 9, color: T.dim, marginTop: 8, fontStyle: "italic" }}>
        Your zone powers the KNN specialist matching algorithm and Google Maps directions.
      </p>
    </div>
  );
}

export { ZONES } from "../data/zones";
