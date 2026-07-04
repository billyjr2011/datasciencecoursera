import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T, GBL } from "../theme";
import { wrapStyle, panelStyle, Chip, ProgBar, SectionBadge, Spin, Dot } from "../components/ui";
import { ScaleInput, VitalsIn, LocationInput, ZONES, type Vitals } from "../components/inputs";
import type { Answers, Question } from "../types";

const ASTEP_LABELS = [
  "Parsing expanded symptom profile", "Evaluating red flag combinations",
  "Querying WHO clinical guidelines", "Searching Mayo Clinic database",
  "Cross-referencing NIH MedlinePlus", "Running KNN zone-matching algorithm",
  "Computing differential diagnosis", "Scoring triage classification",
  "Analysing medication interactions", "Generating referral pathway", "Compiling evidence report",
];

export function IntakePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [curAns, setCurAns] = useState<unknown>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aSteps, setASteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.questions().then((r) => setQuestions(r.questions)).catch(() => setError("Could not load intake questions."));
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Drive the analyzing animation while the request is in flight.
  useEffect(() => {
    if (!analyzing) return;
    setASteps([]);
    const timers = ASTEP_LABELS.map((_, i) => setTimeout(() => setASteps((p) => [...p, i]), i * 700));
    return () => timers.forEach(clearTimeout);
  }, [analyzing]);

  if (!questions.length) {
    return (
      <div style={wrapStyle}><style>{GBL}</style>
        <div style={{ ...panelStyle, textAlign: "center" }}>{error ?? "Loading intake…"}</div>
      </div>
    );
  }

  const q = questions[step];

  async function submit(finalAnswers: Answers) {
    if (!user) return;
    setAnalyzing(true);
    setError(null);
    try {
      const { consultation } = await api.createConsultation({ plan: user.plan, answers: finalAnswers });
      nav(`/result/${consultation.id}`, { state: { consultation } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Analysis failed. Your answers are saved — retry.");
      setAnalyzing(false);
    }
  }

  function next() {
    const skippable = q.type === "vitals" || q.type === "location";
    const empty = curAns == null || curAns === "" || (Array.isArray(curAns) && curAns.length === 0);
    if (!skippable && empty) return;
    const na = { ...answers, [q.id]: curAns };
    setAnswers(na);
    setCurAns(null);
    if (step + 1 < questions.length) setStep(step + 1);
    else submit(na);
  }

  function back() {
    const prev = step - 1;
    setStep(prev);
    setCurAns(answers[questions[prev].id] ?? null);
  }

  if (analyzing) {
    return (
      <div style={wrapStyle}><style>{GBL}</style>
        <div style={{ ...panelStyle, textAlign: "center" }} className="fi">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,201,177,0.1)", border: "2px solid rgba(0,201,177,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Spin /></div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 4 }}>Analysing your profile</h2>
          <p style={{ fontSize: 10, color: T.dim, marginBottom: 18, lineHeight: 1.6 }}>Running an {ASTEP_LABELS.length}-step clinical pipeline including KNN matching. Takes 15–30 seconds.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
            {ASTEP_LABELS.map((s, i) => {
              const done = aSteps.includes(i);
              const cur = aSteps.length === i + 1;
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 11px", borderRadius: 7, background: done ? "rgba(0,201,177,0.05)" : T.navyCard, border: `1px solid ${done ? "rgba(0,201,177,0.18)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.3s" }}>
                  {cur ? <Spin /> : done ? <Dot size={8} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "inline-block", flexShrink: 0 }} />}
                  <span style={{ fontSize: 10, color: done ? T.dimLight : T.dim }}>{s}</span>
                  {done && !cur && <span style={{ marginLeft: "auto", fontSize: 9, color: T.teal }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const canMulti = Array.isArray(curAns) && curAns.length > 0;
  const can = q.type === "vitals" || q.type === "location" || (q.type === "scale" && curAns != null) || (q.type === "single" && curAns != null && curAns !== "") || (q.type === "multi" && canMulti);

  return (
    <div style={wrapStyle}><style>{GBL}</style>
      <div ref={ref} style={{ ...panelStyle, maxHeight: "94vh", overflowY: "auto" }} className="fu">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
          <span style={{ fontSize: 12 }}>⚕️</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: T.teal }}>NdMED</span>
          {user && <Chip text={user.plan} color={T.teal} />}
          <button onClick={() => nav("/plans")} style={{ marginLeft: "auto", fontSize: 9, color: T.dim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Change plan</button>
        </div>

        <ProgBar cur={step} tot={questions.length} questions={questions} />

        <div style={{ marginBottom: 14 }}>
          <SectionBadge text={q.section} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: T.white, lineHeight: 1.45, margin: 0 }}>{q.q}</h2>
        </div>

        {q.type === "single" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {q.opts?.map((o) => {
              const sel = curAns === o;
              return (
                <button key={o} onClick={() => setCurAns(o)} style={optBtn(sel)}>{o}</button>
              );
            })}
          </div>
        )}

        {q.type === "multi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {q.opts?.map((o) => {
              const sel = Array.isArray(curAns) && curAns.includes(o);
              return (
                <button key={o} onClick={() => {
                  const p = Array.isArray(curAns) ? (curAns as string[]) : [];
                  setCurAns(sel ? p.filter((x) => x !== o) : [...p, o]);
                }} style={{ ...optBtn(sel), display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${sel ? T.teal : "rgba(0,201,177,0.2)"}`, background: sel ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: T.navy, fontWeight: 800 }}>{sel ? "✓" : ""}</span>
                  {o}
                </button>
              );
            })}
            <p style={{ fontSize: 9, color: T.dim, marginTop: 3 }}>Select all that apply</p>
          </div>
        )}

        {q.type === "scale" && <ScaleInput min={q.min ?? 1} max={q.max ?? 10} val={curAns as number | null} onCh={(n) => setCurAns(n)} />}
        {q.type === "vitals" && <VitalsIn val={(curAns as Vitals) ?? {}} onCh={(v) => setCurAns(v)} />}
        {q.type === "location" && <LocationInput zones={ZONES} val={(curAns as string) ?? ""} onCh={(z) => setCurAns(z)} />}

        {error && <div style={{ background: "rgba(232,57,74,0.08)", border: "1px solid rgba(232,57,74,0.25)", borderRadius: 8, padding: "8px 11px", fontSize: 11, color: "#f8a8ae", marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
          {step > 0 && <button onClick={back} style={{ padding: "10px 14px", borderRadius: 8, fontSize: 11, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: T.dim, cursor: "pointer" }}>← Back</button>}
          <button onClick={next} disabled={!can} style={{ flex: 1, padding: "11px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: can ? "pointer" : "not-allowed", border: "none", background: can ? "linear-gradient(135deg,#00C9B1,#009E8D)" : "rgba(255,255,255,0.05)", color: can ? T.navy : T.dim, transition: "all 0.15s" }}>
            {step + 1 === questions.length ? "Analyse My Symptoms →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function optBtn(sel: boolean) {
  return { width: "100%", textAlign: "left", borderRadius: 8, padding: "9px 12px", fontSize: 11, cursor: "pointer", border: sel ? `1.5px solid ${T.teal}` : "1px solid rgba(255,255,255,0.07)", background: sel ? "rgba(0,201,177,0.09)" : "rgba(255,255,255,0.025)", color: sel ? T.teal : T.white, fontWeight: sel ? 600 : 400, transition: "all 0.1s" } as const;
}
