export type PlanId = "free" | "pro" | "clinical";

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: PlanId;
}

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

export type QuestionType = "single" | "multi" | "scale" | "vitals" | "location";

export interface Question {
  id: string;
  section: string;
  q: string;
  type: QuestionType;
  opts?: string[];
  min?: number;
  max?: number;
}

export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  subspecialty: string | null;
  zone: string;
  city: string;
  lat: number;
  lng: number;
  facility: string;
  address: string;
  phone: string;
  email: string;
  available: string;
  languages: string[];
  tags: string[];
}

export interface KnnMatch {
  specialist: Specialist;
  rank: number;
  score: number;
  distanceKm: number | null;
  isRemote: boolean;
}

export interface Condition {
  name: string;
  probability: "High" | "Moderate" | "Low" | string;
  icd10?: string;
  icd11?: string;
  description?: string;
  source?: string;
  source_url?: string;
}

export interface TriageResult {
  triage_level?: string;
  triage_color?: "RED" | "ORANGE" | "YELLOW" | "GREEN" | string;
  triage_label?: string;
  possible_conditions?: Condition[];
  red_flags?: string[];
  immediate_actions?: string[];
  do_not?: string[];
  referral?: { specialty?: string; urgency_hours?: number | null; facility_type?: string; rationale?: string };
  first_aid?: string[];
  evidence_sources?: { title?: string; source?: string; url?: string; relevance?: string }[];
  lab_tests_recommended?: { test?: string; rationale?: string }[];
  drug_interactions?: string[];
  clinical_notes?: string;
  summary?: string;
  disclaimer?: string;
}

export interface Consultation {
  id: string;
  result: TriageResult;
  specialists: KnnMatch[];
  model: string;
  triageColor: string;
  createdAt: string;
}

// Shape returned by GET /consultations/:id — specialists are join rows.
export interface StoredConsultationSpecialist {
  specialistId: string;
  rank: number;
  score: number;
  distanceKm: number | null;
  specialist: Specialist;
}

export interface StoredConsultation {
  id: string;
  plan: string;
  result: TriageResult;
  patientZone: string | null;
  triageColor: string;
  referralSpecialty: string | null;
  model: string;
  answers: Answers;
  createdAt: string;
  specialists: StoredConsultationSpecialist[];
}

export type Answers = Record<string, unknown>;
