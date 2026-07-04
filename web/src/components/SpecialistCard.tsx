import { T } from "../theme";
import { Chip } from "./ui";
import type { Specialist } from "../types";

function iconFor(specialty: string): string {
  const s = specialty;
  if (s.includes("Cardio")) return "🫀";
  if (s.includes("Neuro")) return "🧠";
  if (s.includes("Pediatr")) return "👶";
  if (s.includes("Gynec") || s.includes("Obstet") || s.includes("Maternal")) return "🤱";
  if (s.includes("Oncol")) return "🎗️";
  if (s.includes("Ortho")) return "🦴";
  if (s.includes("Derma")) return "🩹";
  if (s.includes("Ophthal")) return "👁️";
  if (s.includes("Psychiat")) return "🧘";
  if (s.includes("Nephro") || s.includes("Renal")) return "🫘";
  if (s.includes("Gastro")) return "🫃";
  if (s.includes("Pneumo") || s.includes("Pulmo")) return "🫁";
  if (s.includes("Endocr")) return "⚗️";
  if (s.includes("Surgery") || s.includes("Surg")) return "🔬";
  if (s.includes("Infect")) return "🦠";
  if (s.includes("Urol")) return "🚹";
  if (s.includes("Telemedicine")) return "💻";
  return "⚕️";
}

export function SpecialistCard({ sp, rank, distKm, onMapOpen }: { sp: Specialist; rank: number; distKm: number | null; onMapOpen: (sp: Specialist) => void }) {
  const isRemote = sp.zone === "Online / Remote";
  const rankColor = rank === 1 ? T.amber : rank === 2 ? T.dimLight : T.dim;
  return (
    <div style={{ background: T.navyCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(0,201,177,0.1)", border: "1px solid rgba(0,201,177,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {iconFor(sp.specialty)}
          </div>
          <div style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: rankColor, color: T.navy, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{rank}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{sp.name}</span>
            {isRemote && <Chip text="TELEMEDICINE" color={T.purple} />}
          </div>
          <div style={{ fontSize: 10, color: T.teal, fontWeight: 600, marginBottom: 2 }}>
            {sp.specialty}{sp.subspecialty ? " · " + sp.subspecialty : ""}
          </div>
          <div style={{ fontSize: 10, color: T.dim, marginBottom: 6 }}>
            📍 {sp.facility} · {sp.zone}
            {!isRemote && distKm != null && <span style={{ marginLeft: 6, color: T.green, fontWeight: 600 }}>~{distKm} km</span>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <a href={"tel:" + sp.phone} style={pill(T.green, "rgba(33,201,122,0.12)", "rgba(33,201,122,0.3)")}>📞 {sp.phone}</a>
            <a href={"mailto:" + sp.email} style={pill(T.teal, "rgba(0,201,177,0.1)", "rgba(0,201,177,0.25)")}>✉ Email</a>
            <button onClick={() => onMapOpen(sp)} style={{ ...pill("#6baaf8", "rgba(66,133,244,0.12)", "rgba(66,133,244,0.3)"), cursor: "pointer" }}>
              {isRemote ? "💻 Connect" : "🗺 Map / Route"}
            </button>
          </div>
          <div style={{ fontSize: 9, color: T.dim, marginTop: 5 }}>🕐 {sp.available} · 🗣 {sp.languages.join(", ")}</div>
        </div>
      </div>
    </div>
  );
}

function pill(color: string, bg: string, border: string) {
  return { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: bg, border: `1px solid ${border}`, color, textDecoration: "none" } as const;
}
