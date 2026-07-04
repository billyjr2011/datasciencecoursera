// Typed fetch wrapper around the NdMED API. Holds the JWT and base URL.

import type { Consultation, KnnMatch, PlanDef, Question, Specialist, StoredConsultation, User, Answers, PlanId } from "../types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:4000/api";
const TOKEN_KEY = "ndmed.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.code);
  }
  return body as T;
}

export const api = {
  // auth
  register: (data: { email: string; password: string; name?: string; plan?: PlanId }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request<{ user: User }>("/auth/me"),

  // catalogue
  plans: () => request<{ plans: PlanDef[] }>("/plans"),
  questions: () => request<{ questions: Question[]; sections: string[] }>("/questions"),
  specialists: (q?: { city?: string; specialty?: string }) => {
    const qs = new URLSearchParams(q as Record<string, string>).toString();
    return request<{ specialists: Specialist[] }>(`/specialists${qs ? `?${qs}` : ""}`);
  },

  // plan change
  setPlan: (plan: PlanId) =>
    request<{ user: User }>("/users/me/plan", { method: "PATCH", body: JSON.stringify({ plan }) }),

  // consultations
  createConsultation: (data: { plan: PlanId; answers: Answers }) =>
    request<{ consultation: Consultation }>("/consultations", { method: "POST", body: JSON.stringify(data) }),
  getConsultation: (id: string) => request<{ consultation: StoredConsultation }>(`/consultations/${id}`),
  listConsultations: (page = 1, pageSize = 10) =>
    request<{ consultations: { id: string; triageColor: string; referralSpecialty: string | null; plan: string; createdAt: string }[]; page: number; pageSize: number; total: number }>(
      `/consultations?page=${page}&pageSize=${pageSize}`,
    ),
  matchSpecialists: (data: { specialty: string; zone: string; chiefComplaints: string[]; k?: number }) =>
    request<{ matches: KnnMatch[] }>("/specialists/match", { method: "POST", body: JSON.stringify(data) }),
};
