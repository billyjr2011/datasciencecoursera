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
    "You are NdMED, a pre-clinical triage AI by the LIWIMALA INITIATIVE.\n\n" +
    "TRUSTED CLINICAL SOURCES:\n" + srcText + "\n\n" +
    "PATIENT INTAKE DATA:\n" + JSON.stringify(answers, null, 2) + "\n\n" +
    "PLAN: " + plan.toUpperCase() + "\n\n" +
    "INSTRUCTIONS:\n" +
    "1. Analyse all patient data using your clinical training.\n" +
    "2. Return ONLY a JSON object. No markdown. No text before or after.\n" +
    "3. Response must begin with { and end with }.\n" +
    "4. Replace ALL placeholder values with real clinical content.\n" +
    "5. For possible_conditions list at least 3 differentials ranked by probability.\n" +
    "6. Consider the patient's age, sex, lifestyle, medications, allergies, and family history.\n" +
    "7. Flag any drug interactions or allergy contraindications explicitly.\n\n" +
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
