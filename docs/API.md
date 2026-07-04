# NdMED — API Reference

Base URL: `${VITE_API_BASE_URL}` (default `http://localhost:4000/api`).
All bodies are JSON. Authenticated routes require `Authorization: Bearer <jwt>`.

## Conventions

- Success: `2xx` with a JSON object.
- Error: non-`2xx` with `{ "error": { "message": string, "code"?: string } }`.
- Validation errors: `400` with field details.

---

## Health

### `GET /health`
No auth. → `200 { "status": "ok", "uptime": number }`

---

## Auth

### `POST /api/auth/register`
```json
{ "email": "a@b.com", "password": "min8chars", "name": "Jane", "plan": "PRO" }
```
→ `201 { "token": "...", "user": { "id", "email", "name", "plan" } }`

### `POST /api/auth/login`
```json
{ "email": "a@b.com", "password": "..." }
```
→ `200 { "token": "...", "user": {...} }`

### `GET /api/auth/me`  *(auth)*
→ `200 { "user": {...} }`

---

## Plans

### `GET /api/plans`
No auth. Static plan catalogue (Free / Pro / Clinical) with features and pricing.
→ `200 { "plans": [ { "id", "name", "price", "period", "features": [...], "cta", "badge"? } ] }`

### `PATCH /api/users/me/plan`  *(auth)*
```json
{ "plan": "CLINICAL" }
```
→ `200 { "user": {...} }`  *(simulated upgrade — wire to a billing provider in production)*

---

## Questions

### `GET /api/questions`
No auth. The structured intake bank (sections, question types, options).
→ `200 { "questions": [...], "sections": [...] }`

---

## Specialists

### `GET /api/specialists`
No auth. The full directory (optionally filter by `?city=` / `?specialty=`).
→ `200 { "specialists": [...] }`

### `POST /api/specialists/match`  *(auth, PRO+)*
Run the KNN matcher without a full consultation (e.g. directory exploration).
```json
{ "specialty": "Cardiology", "zone": "Yaoundé Centre", "chiefComplaints": ["Chest pain"], "k": 6 }
```
→ `200 { "matches": [ { "specialist", "rank", "score", "distanceKm", "isRemote" } ] }`

---

## Consultations

### `POST /api/consultations`  *(auth)*
The core endpoint. Runs the full server-side triage pipeline.
```json
{
  "plan": "PRO",
  "answers": {
    "chief": ["Chest pain / tightness / pressure"],
    "duration": "1–6 hours",
    "severity": 7,
    "...": "...",
    "location": "Yaoundé Centre",
    "vitals": { "bp": "150/95", "hr": "98" }
  }
}
```
→ `201 { "consultation": { "id", "result": {...}, "specialists": [...], "model", "createdAt" } }`

`result` shape (fields gated by plan):
```json
{
  "triage_level": "URGENT",
  "triage_color": "ORANGE",
  "triage_label": "...",
  "possible_conditions": [ { "name", "probability", "icd10", "icd11?", "description", "source", "source_url" } ],
  "red_flags": ["..."],
  "immediate_actions": ["..."],
  "do_not": ["..."],
  "referral": { "specialty", "urgency_hours", "facility_type", "rationale" },
  "first_aid": ["..."],
  "evidence_sources": [ { "title", "source", "url", "relevance" } ],   // PRO+
  "lab_tests_recommended": [ { "test", "rationale" } ],                // CLINICAL
  "drug_interactions": ["..."],                                        // CLINICAL
  "clinical_notes": "...",
  "summary": "...",
  "disclaimer": "..."
}
```

Errors: `429` if rate-limited; `502` if the model returns unparseable output (the
client may retry without re-entering data).

### `GET /api/consultations`  *(auth)*
List the current user's consultations (most recent first, paginated `?page=&pageSize=`).
→ `200 { "consultations": [...], "page", "pageSize", "total" }`

### `GET /api/consultations/:id`  *(auth)*
→ `200 { "consultation": {...} }` (404 if not owned by the user)

---

## Rate limits

| Scope | Limit |
|-------|-------|
| Global per IP | 300 req / 15 min |
| `POST /api/consultations` per user | 30 / hour (Free), higher tiers configurable |

Exceeding returns `429 { "error": { "message": "Too many requests", "code": "rate_limited" } }`.
