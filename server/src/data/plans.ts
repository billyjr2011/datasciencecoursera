// Plan catalogue. `id` maps to the Prisma `Plan` enum (uppercased).

export type PlanId = "free" | "pro" | "clinical";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  color: string;
  icon: string;
  badge?: string;
  features: string[];
  cta: string;
}

export const PLANS: PlanDef[] = [
  {
    id: "free", name: "Basic", price: "Free", period: "", color: "#A8BCCF", icon: "🩺",
    features: ["1 consultation/day", "Standard symptom triage", "Basic condition list", "Emergency referral", "Specialist directory"],
    cta: "Start Free",
  },
  {
    id: "pro", name: "Pro", price: "$9", period: "/month", color: "#00C9B1", icon: "⚕️", badge: "Most Popular",
    features: ["Unlimited consultations", "Live evidence: WHO, NIH, Mayo Clinic", "KNN specialist matching", "Google Maps integration", "PDF report download", "Drug interaction alerts"],
    cta: "Start Pro — $9/mo",
  },
  {
    id: "clinical", name: "Clinical", price: "$29", period: "/month", color: "#8B5CF6", icon: "🏥",
    features: ["Everything in Pro", "ICD-11 full mapping", "Lab test recommendations", "Differential ranking", "Multi-patient management", "API / EMR integration"],
    cta: "Start Clinical — $29/mo",
  },
];

export const PLAN_IDS: PlanId[] = ["free", "pro", "clinical"];

/** Map the UI plan id to the Prisma enum value. */
export function toPlanEnum(id: string): "FREE" | "PRO" | "CLINICAL" {
  const v = id.toUpperCase();
  if (v === "FREE" || v === "PRO" || v === "CLINICAL") return v;
  return "FREE";
}

/** Map the Prisma enum back to the UI plan id. */
export function fromPlanEnum(plan: string): PlanId {
  return plan.toLowerCase() as PlanId;
}
