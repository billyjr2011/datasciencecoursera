// Triage orchestrator: build prompt → call Claude → parse → KNN match → gate by plan.

import { complete } from "../lib/anthropic.js";
import { env } from "../config/env.js";
import { buildPrompt, extractJSON } from "./prompt.js";
import { knnMatchSpecialists, KnnMatch } from "./knn.js";
import type { PlanId } from "../data/plans.js";
import type { SpecialistSeed } from "../data/specialists.js";

export interface TriageResult {
  result: Record<string, unknown>;
  specialists: KnnMatch[];
  model: string;
  triageColor: string;
  referralSpecialty: string | null;
  patientZone: string;
}

export class TriageError extends Error {
  constructor(message: string, public readonly code = "triage_failed") {
    super(message);
  }
}

/** Strip plan-gated fields so a Free/Pro user can never receive Clinical data. */
function gateResultByPlan(result: Record<string, unknown>, plan: PlanId): Record<string, unknown> {
  const pro = plan === "pro" || plan === "clinical";
  const clin = plan === "clinical";
  const out = { ...result };
  if (!pro) out.evidence_sources = [];
  if (!clin) {
    out.lab_tests_recommended = [];
    out.drug_interactions = [];
  }
  return out;
}

export async function runTriage(
  answers: Record<string, unknown>,
  plan: PlanId,
  specialists: SpecialistSeed[],
): Promise<TriageResult> {
  const prompt = buildPrompt(answers, plan);

  let raw: string;
  try {
    raw = await complete(prompt, 4096);
  } catch (e) {
    throw new TriageError(`Model request failed: ${(e as Error).message}`, "model_error");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJSON(raw);
  } catch (e) {
    throw new TriageError(`Could not parse model output: ${(e as Error).message}`, "parse_error");
  }

  const result = gateResultByPlan(parsed, plan);

  const patientZone = typeof answers.location === "string" ? answers.location : "";
  const chief = Array.isArray(answers.chief) ? (answers.chief as string[]) : [];
  const referral = (result.referral ?? {}) as { specialty?: string };
  const referralSpecialty = referral.specialty || null;

  // KNN matching is a PRO+ feature; Free plans still get the result, just no matches.
  const matches =
    plan === "free"
      ? []
      : knnMatchSpecialists(specialists, referralSpecialty ?? "", patientZone, chief, 6);

  return {
    result,
    specialists: matches,
    model: env.anthropicModel,
    triageColor: typeof result.triage_color === "string" ? result.triage_color : "GREEN",
    referralSpecialty,
    patientZone,
  };
}
