import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { T, GBL } from "../theme";
import { wrapStyle, panelStyle, Chip } from "../components/ui";
import { ResultView } from "../components/ResultView";
import type { KnnMatch, PlanId, StoredConsultation } from "../types";

const PLAN_NAMES: Record<PlanId, string> = { free: "Basic", pro: "Pro", clinical: "Clinical" };

export function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [consultation, setConsultation] = useState<StoredConsultation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getConsultation(id)
      .then((r) => setConsultation(r.consultation))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load consultation"));
  }, [id]);

  const matches: KnnMatch[] = useMemo(() => {
    if (!consultation) return [];
    return consultation.specialists.map((s) => ({
      specialist: s.specialist,
      rank: s.rank,
      score: s.score,
      distanceKm: s.distanceKm,
      isRemote: s.specialist.zone === "Online / Remote",
    }));
  }, [consultation]);

  if (error) {
    return (
      <div style={wrapStyle}><style>{GBL}</style>
        <div style={{ ...panelStyle, textAlign: "center" }}>
          <p style={{ color: "#f8a8ae", fontSize: 12, marginBottom: 12 }}>{error}</p>
          <button onClick={() => nav("/")} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#00C9B1,#009E8D)", color: T.navy, fontWeight: 700, cursor: "pointer" }}>← Dashboard</button>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return <div style={wrapStyle}><style>{GBL}</style><div style={{ ...panelStyle, textAlign: "center" }}>Loading report…</div></div>;
  }

  const plan = consultation.plan.toLowerCase() as PlanId;
  const planName = PLAN_NAMES[plan];

  return (
    <div style={wrapStyle}><style>{GBL}</style>
      <div style={{ ...panelStyle, maxHeight: "94vh", overflowY: "auto" }} className="fu">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 13 }}>⚕️</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.teal }}>NdMED</span>
          <Chip text={planName} color={T.teal} />
          <span style={{ marginLeft: "auto", fontSize: 9, color: T.dim }}>Pre-Clinical Report</span>
        </div>
        <ResultView
          result={consultation.result}
          plan={plan}
          matches={matches}
          patientZone={consultation.patientZone ?? ""}
          planName={planName}
          onRestart={() => nav("/consult")}
        />
      </div>
    </div>
  );
}
