// Prompt construction + defensive JSON extraction for the triage pipeline.

import { getRelevantSources } from "../data/evidence.js";
import type { PlanId } from "../data/plans.js";

export function buildPrompt(answers: Record<string, unknown>, plan: PlanId): string {
  const pro = plan === "pro" || plan === "clinical";
  const clin = plan === "clinical";
  const sources = getRelevantSources(answers);
  const srcText = sources.map((s, i) => `${i + 1}. ${s.source} — ${s.url} (${s.note})`).join("\n");

  const schema = {
    triage_level: "EMERGENCY",
    triage_color: "RED",
    triage_label: "concise triage label",
    possible_conditions: [{ name: "", probability: "High|Moderate|Low", icd10: "", icd11: "", description: "2 sentences", source: "", source_url: "" }],
    red_flags: ["critical sign if present"],
    immediate_actions: ["action step"],
    do_not: ["contraindication"],
    referral: { specialty: "", urgency_hours: 2, facility_type: "ER|Hospital|Clinic|Telemedicine|Primary Care", rationale: "" },
    first_aid: ["step if applicable"],
    evidence_sources: pro ? [{ title: "", source: "", url: "", relevance: "" }] : [],
    lab_tests_recommended: clin ? [{ test: "", rationale: "" }] : [],
    drug_interactions: clin ? [""] : [],
    clinical_notes: "2-3 sentences synthesis",
    summary: "2-3 sentences to patient",
    disclaimer:
      "This pre-clinical assessment is AI-generated and does not constitute medical advice. Only a licensed healthcare professional can diagnose and treat. In an emergency call 15/112/911 immediately.",
  };

  return (
    "You are NdMED, a pre-clinical triage AI by the LIWIMALA INITIATIVE, deployed in Cameroon (Central Africa).\n\n" +
    "REGIONAL & POPULATION CONTEXT:\n" +
    "- The patient is most likely of Black African ancestry, living in Cameroon.\n" +
    "- Weight your differential toward regionally prevalent conditions (malaria, typhoid, tuberculosis, " +
    "schistosomiasis, sickle-cell disease/trait, HIV, viral hepatitis) alongside non-communicable disease.\n" +
    "- Prefer clinical evidence, reference ranges and risk data validated in Black African / African-ancestry " +
    "cohorts (e.g. WHO AFRO, Africa CDC, H3Africa, Pan African Medical Journal, Cameroon MINSANTE). Where a " +
    "guideline, lab reference range or risk score is derived mainly from European/North-American populations, " +
    "say so in clinical_notes and adjust accordingly. Apply these well-established, population-specific points " +
    "when relevant:\n" +
    "  · Use race-free eGFR (2021 CKD-EPI); do NOT apply the legacy race coefficient.\n" +
    "  · Pulse oximetry overestimates SaO2 in darker skin — treat a borderline SpO2 as potentially worse than shown.\n" +
    "  · Duffy-null (benign ethnic) neutropenia: a mildly low neutrophil count can be a normal baseline — do not over-call it.\n" +
    "  · Screen/consider G6PD deficiency before oxidative drugs (primaquine, dapsone, some sulfonamides), which are common in this population.\n" +
    "  · For hypertension, calcium-channel blockers or thiazide diuretics are generally first-line over ACE inhibitors/ARBs as monotherapy, and ACE-inhibitor cough/angioedema is more frequent.\n" +
    "  · Describe skin findings for brown/black skin (erythema may look violaceous/grey; look for induration, warmth, hyper/hypopigmentation).\n\n" +
    "TRUSTED CLINICAL SOURCES:\n" + srcText + "\n\n" +
    "PATIENT INTAKE DATA:\n" + JSON.stringify(answers, null, 2) + "\n\n" +
    "PLAN: " + plan.toUpperCase() + "\n\n" +
    "INSTRUCTIONS:\n" +
    "1. Analyse all patient data using your clinical training and the REGIONAL & POPULATION CONTEXT above.\n" +
    "2. Return ONLY a JSON object. No markdown. No text before or after.\n" +
    "3. Response must begin with { and end with }.\n" +
    "4. Replace ALL placeholder values with real clinical content.\n" +
    "5. For possible_conditions list at least 3 differentials ranked by probability, reflecting local epidemiology.\n" +
    "6. Consider the patient's age, sex, lifestyle, medications, allergies, and family history.\n" +
    "7. Flag any drug interactions or allergy contraindications explicitly.\n" +
    "8. In clinical_notes, note any point where standard (non-African-derived) evidence was adjusted for this population.\n\n" +
    "JSON SCHEMA:\n" + JSON.stringify(schema, null, 2) +
    "\n\nRespond with the completed JSON:"
  );
}

export function extractJSON(text: string): Record<string, unknown> {
  if (!text || !text.trim()) throw new Error("Empty response received");
  const t = text.replace(/^```[a-zA-Z]*\n?/m, "").replace(/```\s*$/m, "").trim();
  const start = t.indexOf("{");
  if (start === -1) throw new Error("No JSON in response: " + text.slice(0, 200));
  let depth = 0;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("JSON not properly closed");
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    throw new Error("JSON parse failed: " + (e as Error).message);
  }
}
