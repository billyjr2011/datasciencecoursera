import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { T, GBL } from "../theme";
import { wrapStyle, panelStyle, Chip } from "../components/ui";

export function LandingPage() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [qCount, setQCount] = useState(18);
  const [sectionCount, setSectionCount] = useState(8);

  useEffect(() => {
    api.questions().then((r) => { setQCount(r.questions.length); setSectionCount(r.sections.length); }).catch(() => {});
  }, []);

  const features = [
    { i: "🧠", t: "AI Differential Diagnosis", d: "Multi-condition ranking with ICD codes" },
    { i: "🗺️", t: "Google Maps Navigation", d: "Route to nearest specialist" },
    { i: "🔍", t: "KNN Specialist Matching", d: "Weighted 3-factor algorithm" },
    { i: "📋", t: `${qCount}-Question Intake`, d: "Demographics · history · lifestyle · vitals" },
  ];

  return (
    <div style={wrapStyle}>
      <style>{GBL}</style>
      <div style={{ ...panelStyle, textAlign: "center" }} className="fu">
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg,#00C9B1,#009E8D)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>⚕️</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 5 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.white, margin: 0 }}>NdMED</h1>
          {user && <Chip text={user.plan} color={T.teal} />}
        </div>
        <div style={{ fontSize: 9, color: T.teal, letterSpacing: 2, fontWeight: 700, marginBottom: 9 }}>LIWIMALA INITIATIVE</div>
        <p style={{ fontSize: 11, color: T.dimLight, maxWidth: 420, margin: "0 auto 16px", lineHeight: 1.7 }}>
          Answer {qCount} clinical questions spanning {sectionCount} domains. Receive AI triage with KNN specialist matching and Google Maps navigation.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16, textAlign: "left" }}>
          {features.map((f) => (
            <div key={f.t} style={{ background: T.navyCard, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 10px" }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{f.i}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.white, marginBottom: 1 }}>{f.t}</div>
              <div style={{ fontSize: 9, color: T.dim }}>{f.d}</div>
            </div>
          ))}
        </div>
        <button onClick={() => nav("/consult")} style={{ width: "100%", padding: "12px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#00C9B1,#009E8D)", color: T.navy, border: "none", cursor: "pointer", marginBottom: 7 }}>
          Begin Pre-Consultation →
        </button>
        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => nav("/history")} style={ghost()}>History</button>
          <button onClick={() => nav("/plans")} style={ghost()}>Change plan</button>
          <button onClick={logout} style={ghost()}>Log out</button>
        </div>
        <p style={{ fontSize: 9, color: T.dim, marginTop: 10, lineHeight: 1.6 }}>
          Does not replace a licensed physician. In a life-threatening emergency, call 15/112/911 immediately.
        </p>
      </div>
    </div>
  );
}

function ghost() {
  return { flex: 1, padding: "9px", borderRadius: 9, fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: T.dim, cursor: "pointer" } as const;
}
