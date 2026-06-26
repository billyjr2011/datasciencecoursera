import { T } from "../theme";
import type { Specialist } from "../types";
import { ZONE_COORDS } from "../data/zones";

// Fallback origin if the patient zone is unknown.
const DEFAULT_ORIGIN = { lat: 3.8667, lng: 11.5167 };

export function GoogleMapModal({ sp, patientZone, onClose }: { sp: Specialist; patientZone: string; onClose: () => void }) {
  const origin = ZONE_COORDS[patientZone] ?? DEFAULT_ORIGIN;
  const dest = { lat: sp.lat, lng: sp.lng };
  const isRemote = sp.zone === "Online / Remote";

  const mapSrc = `https://maps.google.com/maps?q=${dest.lat},${dest.lng}&hl=en&z=15&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${dest.lat},${dest.lng}`;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(7,24,46,0.9)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 650, background: T.navyMid, border: "1px solid rgba(0,201,177,0.3)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "14px 18px", background: "#0B1F3A", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.white, marginBottom: 2 }}>{sp.name}</div>
            <div style={{ fontSize: 10, color: T.teal }}>📍 {sp.facility} · {sp.zone}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: T.dimLight, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>

        {!isRemote ? (
          <iframe src={mapSrc} width="100%" height={280} frameBorder="0" allowFullScreen loading="lazy" title="Specialist location" style={{ border: "none", flexShrink: 0 }} />
        ) : (
          <div style={{ height: 180, background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(0,201,177,0.1))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontSize: 40 }}>💻</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Telemedicine Consultation</div>
            <div style={{ fontSize: 11, color: T.dim }}>Available worldwide via video / phone</div>
          </div>
        )}

        <div style={{ padding: "14px 18px", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <InfoCell label="Specialty" value={sp.specialty.split(" — ")[0]} sub={sp.subspecialty ?? ""} />
            <InfoCell label="Hours" value={sp.available} sub={"🗣 " + sp.languages.join(", ")} />
            <div style={{ gridColumn: "1/-1" }}>
              <InfoCell label="Address" value={`${sp.facility} — ${sp.address}`} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={"tel:" + sp.phone} style={btn("linear-gradient(135deg,#21C97A,#1aa866)", T.navy)}>📞 {sp.phone}</a>
            <a href={"mailto:" + sp.email} style={btn("rgba(0,201,177,0.12)", T.teal, "1px solid rgba(0,201,177,0.3)")}>✉ Email</a>
            {!isRemote ? (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" style={btn("rgba(66,133,244,0.15)", "#6baaf8", "1px solid rgba(66,133,244,0.35)")}>🗺 Directions</a>
            ) : (
              <a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer" style={btn("rgba(139,92,246,0.15)", T.purple, "1px solid rgba(139,92,246,0.35)")}>💻 Video Call</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: T.navyCard, borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 8, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.teal }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.dimLight }}>{sub}</div>}
    </div>
  );
}

function btn(bg: string, color: string, border = "none") {
  return { flex: 1, minWidth: 120, padding: "10px", borderRadius: 9, background: bg, border, color, textDecoration: "none", fontWeight: 700, fontSize: 12, textAlign: "center", display: "block" } as const;
}
