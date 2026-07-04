# NdMED — System Architecture

## 1. Goals & constraints

| Goal | Implication |
|------|-------------|
| Keep the Anthropic API key secret | All inference is server-side; the browser never sees it |
| Scale to millions of users | Stateless API tier behind a load balancer; Postgres as the single source of truth; no in-process session state |
| Per-plan feature gating & billing | Plan stored on the user; enforced in the triage service |
| Auditability (medical context) | Every consultation is persisted with inputs, outputs, model, and timestamp |
| Maintainable UI | Single-file artifact decomposed into a typed component tree |

## 2. Component diagram

```
                        ┌──────────────────────────────────────────┐
                        │                Clients                    │
                        │   Browser SPA  ·  (future) mobile app     │
                        └───────────────┬──────────────────────────┘
                                        │ HTTPS (JSON, Bearer JWT)
                          ┌─────────────▼─────────────┐
                          │       Load Balancer        │
                          └─────────────┬─────────────┘
                ┌───────────────────────┼───────────────────────┐
        ┌───────▼───────┐       ┌───────▼───────┐       ┌────────▼──────┐
        │  API instance │  ...  │  API instance │  ...  │  API instance │   (stateless, N replicas)
        └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
                │                       │                        │
        ┌───────▼────────────────────────────────────┐   ┌──────▼───────────┐
        │             PostgreSQL (primary)            │   │  Anthropic API   │
        │   users · consultations · specialists       │   │  (Claude model)  │
        └─────────────────────────────────────────────┘   └──────────────────┘
```

The **API tier is stateless** — any instance can serve any request. Horizontal scaling is
adding replicas behind the load balancer. The only shared state is Postgres (and the
external Claude API).

## 3. Request lifecycle — a consultation

```
1. POST /api/auth/register|login        → user row + JWT
2. GET  /api/questions                  → intake question bank (static, cacheable)
3. GET  /api/plans                       → plan catalogue
4. POST /api/consultations              → body: { answers, plan }
       │
       ├─ auth middleware verifies JWT, loads user
       ├─ rate-limit middleware (per-IP + per-user)
       ├─ Zod validates the answers payload
       ├─ triageService.run():
       │     a. getRelevantSources(answers)      (evidence KB)
       │     b. buildPrompt(answers, plan)
       │     c. anthropic.messages.create(...)   ← API key lives here only
       │     d. extractJSON(response)
       │     e. knnMatchSpecialists(...)         (specialist directory)
       ├─ persist Consultation row (inputs, result, model, specialists)
       └─ 201 → { consultation }
5. GET  /api/consultations/:id           → re-fetch (PDF, history)
```

## 4. The triage pipeline (server-side)

The intelligence that previously lived in the browser now runs in
`server/src/services/triage.ts`:

- **Evidence retrieval** — `getRelevantSources()` maps chief complaints to curated
  authority links (WHO, NIH, Mayo, CDC…).
- **Prompt construction** — `buildPrompt()` assembles the intake JSON, evidence, plan
  tier, and a strict JSON schema instruction.
- **Inference** — `@anthropic-ai/sdk` `messages.create` with `ANTHROPIC_MODEL`
  (default `claude-opus-4-8`). Non-streaming, `max_tokens: 4096`.
- **Parsing** — `extractJSON()` defensively extracts the first balanced JSON object.
- **KNN specialist matching** — `knnMatchSpecialists()` scores the specialist directory
  on specialty match (40%), Haversine geographic proximity (35%), and symptom-tag
  overlap (25%); returns the top *K*.

Plan gating: `free` gets triage only; `pro` adds evidence sources + KNN + maps; `clinical`
adds ICD-11, lab recommendations, and drug-interaction alerts. The service trims the
schema and response per plan.

## 5. Security

- **Secrets** — `ANTHROPIC_API_KEY`, `JWT_SECRET`, `DATABASE_URL` are environment-only,
  never bundled. Vite only exposes `VITE_*`.
- **Auth** — bcrypt-hashed passwords; short-lived JWT access tokens (`Authorization:
  Bearer`).
- **Validation** — every request body is validated with Zod before use.
- **Rate limiting** — `express-rate-limit` caps inference calls per user/IP to bound cost.
- **CORS** — explicit allow-list via `CORS_ORIGINS`.
- **Helmet** — sane security headers.
- **No PHI in logs** — the logger redacts intake answers.

## 6. Scaling notes

| Concern | Strategy |
|---------|----------|
| API throughput | Stateless replicas; scale horizontally |
| DB reads (specialists, questions) | Largely static → cache in-process / CDN / Redis |
| Inference cost & latency | Per-plan rate limits; prompt caching on the static system prefix; queue + async for batch |
| Hot specialist queries | Precomputed KNN candidates; optional PostGIS for geo at scale |
| Multi-region | Read replicas; pin inference region via SDK config |

## 7. Why these choices

- **Express + Prisma** — smallest mature, typed stack a single team can own end-to-end.
- **JWT over sessions** — no sticky sessions, trivial horizontal scale.
- **Postgres** — relational integrity for users↔consultations↔specialists; JSON columns
  for the flexible intake/result blobs.
- **Server-side Claude** — the single most important fix vs. the original artifact.
