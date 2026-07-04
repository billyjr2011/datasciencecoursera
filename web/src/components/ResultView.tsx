import { useState } from "react";
import { T, TRIAGE, SOURCES } from "../theme";
import { Chip, Crd } from "./ui";
import { SpecialistCard } from "./SpecialistCard";
import { GoogleMapModal } from "./GoogleMapModal";
import { generatePDFReport } from "../lib/pdf";
import type { KnnMatch, PlanId, Specialist, TriageResult } from "../types";

function listRows(arr?: string[]) {
  if (!arr || !arr.length) return <i style={{ fontSize: 10, color: T.dim }}>None noted.</i>;
  return (
    <ul style={{ margin: "4px 0 0 14px", padding: 0 }}>
      {arr.map((x, i) => (
        <li key={i} style={{ margin: "2px 0", fontSize: 11, color: T.dimLight }}>{x}</li>
      ))}
    </ul>
  );
}

export function ResultView({ result, plan, matches, patientZone, planName, onRestart }: {
  result: TriageResult;
  plan: PlanId;
  matches: KnnMatch[];
  patientZone: string;
  planName: string;
  onRestart: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [mapSp, setMapSp] = useState<Specialist | null>(null);
  const tr = TRIAGE[result.triage_color ?? "GREEN"] ?? TRIAGE.GREEN;
  const pro = plan === "pro" || plan === "clinical";
  const clin = plan === "clinical";

  const tabs = [
    { id: "overview", l: "Overview" }, { id: "conditions", l: "Conditions" }, { id: "actions", l: "Actions" },
    { id: "referral", l: "Referral" }, { id: "specialists", l: "🔍 Specialists" },
    ...(pro ? [{ id: "evidence", l: "Evidence" }] : []),
    ...(clin ? [{ id: "labs", l: "Labs & Drugs" }] : []),
  ];

  const srcIcon = (s?: string) => SOURCES.find((x) => s && s.toLowerCase().includes(x.name.toLowerCase()))?.icon ?? "📋";
  const downloadPdf = () => generatePDFReport(result, planName, patientZone, matches.map((m) => m.specialist));

  return (
    <div className="fu">
      {mapSp && <GoogleMapModal sp={mapSp} patientZone={patientZone} onClose={() => setMapSp(null)} />}

      {/* Triage banner */}
      <div style={{ background: `linear-gradient(135deg,${tr.bg}14,${tr.bg}06)`, border: `1.5px solid ${tr.bg}44`, borderRadius: 13, padding: "15px 17px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 26 }}>{tr.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, color: T.dim, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Triage</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: tr.bg, lineHeight: 1 }}>{tr.label}</div>
          <div style={{ fontSize: 10, color: T.dimLight, marginTop: 2 }}>{tr.desc}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Referral</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{result.referral?.facility_type ?? ""}</div>
          {result.referral?.urgency_hours != null && <div style={{ fontSize: 10, color: tr.bg, fontWeight: 700 }}>Within {result.referral.urgency_hours}h</div>}
        </div>
      </div>

      <Crd style={{ marginBottom: 11 }}>
        <p style={{ fontSize: 12, color: T.white, lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
      </Crd>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 11 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", border: tab === t.id ? `1px solid ${T.teal}` : "1px solid rgba(255,255,255,0.07)", background: tab === t.id ? "rgba(0,201,177,0.12)" : "transparent", color: tab === t.id ? T.teal : T.dim }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {!!result.red_flags?.length && (
            <div style={{ background: "rgba(232,57,74,0.08)", border: "1px solid rgba(232,57,74,0.28)", borderRadius: 11, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: T.red, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🚩 Red Flags Detected</div>
              {result.red_flags.map((f, i) => <div key={i} style={{ fontSize: 11, color: "#f8a8ae", marginBottom: 2 }}>• {f}</div>)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <Crd><div style={{ fontSize: 9, color: T.red, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Do NOT</div>{listRows(result.do_not)}</Crd>
            <Crd><div style={{ fontSize: 9, color: T.green, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>First Aid</div>{result.first_aid?.length ? listRows(result.first_aid) : <i style={{ fontSize: 10, color: T.dim }}>No immediate first aid required.</i>}</Crd>
          </div>
          {result.clinical_notes && (
            <Crd style={{ borderColor: "rgba(139,92,246,0.22)", background: "rgba(139,92,246,0.05)" }}>
              <div style={{ fontSize: 9, color: T.purple, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Clinical Commentary</div>
              <p style={{ fontSize: 11, color: T.dimLight, lineHeight: 1.65, margin: 0 }}>{result.clinical_notes}</p>
            </Crd>
          )}
        </div>
      )}

      {tab === "conditions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {result.possible_conditions?.map((c, i) => {
            const pc = c.probability === "High" ? T.red : c.probability === "Moderate" ? "#F6762B" : T.green;
            return (
              <Crd key={i}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: pc + "18", border: `1px solid ${pc}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: pc }}>{c.probability === "High" ? "HIGH" : c.probability === "Moderate" ? "MOD" : "LOW"}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{c.name}</span>
                      {c.icd10 && <Chip text={"ICD-10: " + c.icd10} color={T.dim} />}
                      {c.icd11 && pro && <Chip text={"ICD-11: " + c.icd11} color={T.purple} />}
                    </div>
                    {c.description && <p style={{ fontSize: 11, color: T.dimLight, lineHeight: 1.6, margin: "0 0 5px" }}>{c.description}</p>}
                    {pro && c.source_url ? (
                      <a href={c.source_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 600, background: "rgba(0,201,177,0.1)", border: "1px solid rgba(0,201,177,0.25)", color: T.teal, textDecoration: "none" }}>🔗 {c.source}</a>
                    ) : c.source ? (
                      <span style={{ display: "inline-flex", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 9, background: "rgba(0,201,177,0.08)", border: "1px solid rgba(0,201,177,0.2)", color: T.teal }}>📖 {c.source}</span>
                    ) : null}
                  </div>
                </div>
              </Crd>
            );
          })}
          <p style={{ fontSize: 10, color: T.dim, textAlign: "center", padding: "4px 0" }}>Indicative only. Only a licensed physician can diagnose.</p>
        </div>
      )}

      {tab === "actions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {result.immediate_actions?.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.navyCard, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px 13px" }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(0,201,177,0.12)", border: "1px solid rgba(0,201,177,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: T.teal, flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 12, color: T.white, lineHeight: 1.55 }}>{a}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "referral" && result.referral && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Crd>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Recommended Specialty</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.teal }}>{result.referral.specialty}</div>
              </div>
              <div><div style={{ fontSize: 8, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Facility</div><div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{result.referral.facility_type}</div></div>
              <div><div style={{ fontSize: 8, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Urgency</div><div style={{ fontSize: 13, fontWeight: 700, color: tr.bg }}>{result.referral.urgency_hours != null ? "Within " + result.referral.urgency_hours + " hours" : "At convenience"}</div></div>
              {result.referral.rationale && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 8, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Rationale</div><p style={{ fontSize: 11, color: T.dimLight, lineHeight: 1.6, margin: 0 }}>{result.referral.rationale}</p></div>}
            </div>
          </Crd>
          <div style={{ background: "rgba(246,166,35,0.07)", border: "1px solid rgba(246,166,35,0.22)", borderRadius: 9, padding: "10px 13px", fontSize: 10, color: "#f0c060", lineHeight: 1.7 }}>{result.disclaimer}</div>
        </div>
      )}

      {tab === "specialists" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Chip text="KNN Matched" color={T.teal} />
              {patientZone && <span style={{ fontSize: 10, color: T.dim }}>Near {patientZone}</span>}
              <span style={{ marginLeft: "auto", fontSize: 9, color: T.dim }}>{matches.length} specialists</span>
            </div>
            {!patientZone && (
              <div style={{ background: "rgba(246,166,35,0.08)", border: "1px solid rgba(246,166,35,0.25)", borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 11, color: "#f0c060" }}>
                ⚡ No zone entered — showing top specialty matches. Add your location at intake for proximity-aware KNN results.
              </div>
            )}
            {matches.map((r) => (
              <SpecialistCard key={r.specialist.id} sp={r.specialist} rank={r.rank} distKm={r.distanceKm} onMapOpen={setMapSp} />
            ))}
            {matches.length === 0 && <Crd><p style={{ color: T.dim, fontSize: 11, margin: 0 }}>No specialist matches. KNN matching is a Pro feature — upgrade to see proximity-ranked specialists.</p></Crd>}
          </div>
          <div style={{ background: "rgba(0,201,177,0.05)", border: "1px solid rgba(0,201,177,0.15)", borderRadius: 8, padding: "10px 13px", fontSize: 10, color: T.dim, lineHeight: 1.6 }}>
            🔍 KNN scores specialists on specialty match (40%), geographic proximity (35%), and symptom-tag overlap (25%). Click 🗺 Map/Route to open Google Maps navigation.
          </div>
        </div>
      )}

      {tab === "evidence" && pro && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Chip text="Live Clinical Evidence" color={T.teal} />
            <span style={{ fontSize: 10, color: T.dim }}>Curated from trusted health authorities</span>
          </div>
          {result.evidence_sources?.length ? result.evidence_sources.map((s, i) => (
            <Crd key={i}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{srcIcon(s.source)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.white, marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: T.teal, fontWeight: 600, marginBottom: 3 }}>{s.source}</div>
                  <p style={{ fontSize: 11, color: T.dimLight, lineHeight: 1.6, margin: "0 0 5px" }}>{s.relevance}</p>
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 4, padding: "2px 9px", borderRadius: 20, fontSize: 9, fontWeight: 600, background: "rgba(0,201,177,0.1)", border: "1px solid rgba(0,201,177,0.25)", color: T.teal, textDecoration: "none" }}>🔗 View Source</a>}
                </div>
              </div>
            </Crd>
          )) : <Crd><p style={{ color: T.dim, fontSize: 11, margin: 0 }}>No external sources retrieved for this session.</p></Crd>}
        </div>
      )}

      {tab === "labs" && clin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {!!result.lab_tests_recommended?.length && (
            <div>
              <div style={{ fontSize: 9, color: T.purple, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>Recommended Laboratory Tests</div>
              {result.lab_tests_recommended.map((l, i) => (
                <Crd key={i} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.white, marginBottom: 2 }}>{l.test}</div>
                  <div style={{ fontSize: 11, color: T.dimLight }}>{l.rationale}</div>
                </Crd>
              ))}
            </div>
          )}
          {!!result.drug_interactions?.length && (
            <div>
              <div style={{ fontSize: 9, color: T.amber, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>Drug Interaction Alerts</div>
              {result.drug_interactions.map((d, i) => (
                <div key={i} style={{ background: "rgba(246,166,35,0.07)", border: "1px solid rgba(246,166,35,0.22)", borderRadius: 9, padding: "9px 12px", marginBottom: 5, fontSize: 11, color: "#f0c060" }}>⚡ {d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
        <button onClick={downloadPdf} style={{ flex: 1, padding: "11px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", background: "linear-gradient(135deg,#00C9B1,#009E8D)", color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <span>⬇</span><span>PDF Report</span>
        </button>
        <button onClick={onRestart} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: T.dim, fontSize: 11, cursor: "pointer" }}>New Consultation</button>
      </div>
    </div>
  );
}
