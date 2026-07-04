import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { T, GBL, TRIAGE } from "../theme";
import { wrapStyle, panelStyle, Chip } from "../components/ui";

interface Row { id: string; triageColor: string; referralSpecialty: string | null; plan: string; createdAt: string; }

export function HistoryPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listConsultations(1, 25).then((r) => setRows(r.consultations)).finally(() => setLoading(false));
  }, []);

  return (
    <div style={wrapStyle}><style>{GBL}</style>
      <div style={{ ...panelStyle, maxHeight: "94vh", overflowY: "auto" }} className="fu">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12 }}>⚕️</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.teal }}>NdMED</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Consultation History</span>
          <button onClick={() => nav("/")} style={{ marginLeft: "auto", fontSize: 10, color: T.dim, background: "none", border: "none", cursor: "pointer" }}>← Dashboard</button>
        </div>

        {loading && <p style={{ color: T.dim, fontSize: 12 }}>Loading…</p>}
        {!loading && rows.length === 0 && <p style={{ color: T.dim, fontSize: 12 }}>No consultations yet. Start one from the dashboard.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map((r) => {
            const tr = TRIAGE[r.triageColor] ?? TRIAGE.GREEN;
            return (
              <button key={r.id} onClick={() => nav(`/result/${r.id}`)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: T.navyCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer" }}>
                <span style={{ fontSize: 18 }}>{tr.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: tr.bg }}>{tr.label}</div>
                  <div style={{ fontSize: 10, color: T.dim }}>{r.referralSpecialty ?? "General"} · {new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <Chip text={r.plan} color={T.teal} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
