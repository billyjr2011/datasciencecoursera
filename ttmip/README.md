# TTMIP — Tropical Timber Market Intelligence Platform

A production-ready, horizontally scalable platform that gives the **Cameroon
Ministry of Forests & Wildlife** and licensed timber exporters a single source of
truth for tropical-timber **market prices, international demand, price indices,
ESG performance, certification status, deforestation alerts, EUDR due-diligence,
and the international regulatory landscape**.

This repository turns the `TTMIP v8` single-file prototype into a real
full-stack system: a typed REST API backed by PostgreSQL, seeded with the
domain's reference data, and the polished operator dashboard wired to that API
with a graceful offline fallback.

> **Scope note.** The frontend (`web/`) is the existing TTMIP v8 dashboard,
> preserved intact and hydrated from the live API when reachable. The backend
> (`server/`) is the new, production-grade data plane. The integration seam is
> documented in §5.

---

## 1. System Architecture

```
                          ┌────────────────────┐
                          │      Browser       │
                          │  TTMIP Dashboard   │  (15 modules, charts, maps)
                          └─────────┬──────────┘
                                    │ HTTPS / JSON
                                    ▼
                          ┌────────────────────┐
                          │   Reverse Proxy    │   nginx / cloud LB + TLS
                          └─────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
      │  API node 1  │      │  API node 2  │  ... │  API node N  │   stateless
      │ Express + TS │      │ Express + TS │      │ Express + TS │
      └───────┬──────┘      └──────┬───────┘      └──────┬───────┘
              │                    │                     │
              └────────────┬───────┴──────────┬──────────┘
                           ▼                  ▼
                   ┌───────────────┐  ┌───────────────┐
                   │  PostgreSQL   │  │     Redis     │
                   │ (primary +    │  │ cache / rate  │
                   │  read repl  ) │  │ limit / jobs  │
                   └───────┬───────┘  └───────────────┘
                           ▲
                   ┌───────┴────────────────────────────────┐
                   │  Ingestion workers (future)             │
                   │  Fastmarkets · ITTO MIS · SPOTT/WWF ·   │
                   │  BVRio · Global Forest Watch · EUR-Lex  │
                   └─────────────────────────────────────────┘
```

**Why this scales to millions of users**

| Concern             | Decision                                                          |
| ------------------- | ---------------------------------------------------------------- |
| Compute             | **Stateless** API nodes → scale horizontally behind a LB.        |
| Sessions            | **JWT access + refresh tokens** → no server-side session store.  |
| Data                | PostgreSQL primary + **read replicas**; indexes on hot queries.  |
| Read-heavy traffic  | Market data is read-mostly → **cache layer** (Redis) ready.      |
| Ingestion           | External feeds isolated as **workers** writing to the DB.        |
| Deploys             | One **Docker image per service**; 12-factor config via env.      |
| Schema evolution    | **Prisma migrations**, versioned and reviewable.                 |
| Observability       | Structured JSON logs (pino) + `/healthz` & `/readyz` probes.     |
| Boundaries          | **Modular monolith** — each domain is a folder, ready to split.  |

The system starts as a **modular monolith** (cheapest to operate) but every
domain (`prices`, `alerts`, `regulatory`, …) is isolated behind a service layer,
so any module — e.g. the deforestation-alert ingestion pipeline — can be
extracted into its own deployable without touching callers.

---

## 2. File Structure

```
ttmip/
├── docker-compose.yml          # postgres + api + web
├── .env.example                # root compose env
├── .github/workflows/ci.yml    # typecheck + test on every push
│
├── server/                     # Backend — Express + TypeScript + Prisma
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma        # full timber-domain schema (source of truth)
│   │   └── seed.ts              # reference + market data from TTMIP v8
│   ├── tests/
│   │   └── api.test.ts          # supertest integration tests
│   └── src/
│       ├── index.ts             # entrypoint (boot + graceful shutdown)
│       ├── app.ts               # Express wiring (security, routes, static web)
│       ├── routes.ts            # /api/v1 router composition
│       ├── config/env.ts        # validated environment config
│       ├── lib/{prisma,logger}.ts
│       ├── middleware/{auth,error,validate,rateLimit}.ts
│       ├── utils/{jwt,password,httpError,asyncHandler}.ts
│       └── modules/
│           ├── auth/            # register, login, refresh, me
│           ├── reference/       # species, markets, platforms, companies
│           ├── prices/          # price records + filters
│           ├── indices/         # GSPI & ESPI time series
│           ├── esg/             # ESG scores
│           ├── certificates/    # FSC / PEFC certification tracking
│           ├── alerts/          # deforestation alerts
│           ├── ddra/            # EUDR due-diligence records
│           ├── regulatory/      # regulatory frameworks
│           └── dashboard/       # cross-domain KPI aggregation
│
└── web/                        # Frontend — TTMIP v8 dashboard
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html               # the full dashboard UI (15 modules)
    └── js/api.js                # typed API client + offline fallback
```

---

## 3. Database Schema

PostgreSQL via Prisma. Full definition in
[`server/prisma/schema.prisma`](server/prisma/schema.prisma).

```
                    ┌────────────┐
        ┌──────────►│  Company   │◄────────────┬───────────────┐
        │           └─────┬──────┘             │               │
        │                 │                    │               │
   ┌────┴─────┐     ┌──────┴──────┐      ┌──────┴─────┐   ┌──────┴──────┐
   │ EsgScore │     │ Certificate │      │ DdraRecord │   │ PriceRecord │
   └──────────┘     └─────────────┘      └────────────┘   └──┬───┬───┬──┘
                                                            │   │   │
                              ┌─────────────────────────────┘   │   └───────────┐
                         ┌────┴────┐                       ┌─────┴────┐    ┌──────┴────┐
                         │ Species │                       │ Platform │    │  Market   │
                         └─────────┘                       └──────────┘    └───────────┘

   PriceIndex ──< IndexPoint      Regulation (standalone)      DeforestationAlert (standalone)
```

| Table                  | Purpose                                       | Key columns / indexes                              |
| ---------------------- | --------------------------------------------- | -------------------------------------------------- |
| `users`                | Operator accounts & credentials               | `email` (unique)                                   |
| `species`              | 30 tracked tropical species                   | `name` (unique)                                    |
| `markets`              | 15 international destination markets           | `code` (unique), `region`                          |
| `platforms`            | Price data sources (Fastmarkets, ITTO …)      | `name` (unique)                                     |
| `companies`            | Concession holders / exporters                | `name` (unique)                                     |
| `price_records`        | Multi-platform price observations             | index(`species_id`), index(`market_id`), `recorded_at` |
| `price_indices`        | GSPI / ESPI index definitions                 | `code` (unique)                                    |
| `index_points`         | Index time-series values                      | index(`index_id`,`date`)                           |
| `esg_scores`           | E/S/G assessment per company                  | index(`company_id`,`assessed_at`)                  |
| `certificates`         | FSC / PEFC certification per concession       | `code` (unique), index(`status`)                   |
| `deforestation_alerts` | Satellite alerts (GFW/WRI/NASA/EU JRC)        | index(`severity`,`alert_date`)                     |
| `ddra_records`         | EUDR due-diligence risk assessments           | `code` (unique), index(`status`)                   |
| `regulations`          | International regulatory frameworks           | `code` (unique), index(`region`)                   |

Enums: `Quality`, `AlertSeverity`, `EsgRisk`, `CertType`, `CertStatus`,
`DdraStatus`.

---

## 4. API Endpoints

Base path `/api/v1`. Reads are public for the MVP demo; writes require
`Authorization: Bearer <accessToken>`. Responses use
`{ data }` / `{ error: { code, message, details? } }`.

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/healthz`                    | Liveness probe                           |
| GET    | `/readyz`                     | Readiness (checks DB)                    |
| POST   | `/api/v1/auth/register`       | Create operator account → tokens         |
| POST   | `/api/v1/auth/login`          | Login → access + refresh tokens          |
| POST   | `/api/v1/auth/refresh`        | Exchange refresh → new access token      |
| GET    | `/api/v1/auth/me`             | Current user                             |
| GET    | `/api/v1/reference/species`   | 30 tracked species                       |
| GET    | `/api/v1/reference/markets`   | 15 destination markets                   |
| GET    | `/api/v1/reference/platforms` | Data-source platforms                    |
| GET    | `/api/v1/reference/companies` | Concession holders                       |
| GET    | `/api/v1/prices`              | Price records (filters: species, destination, quality, platform, q, limit) |
| GET    | `/api/v1/indices`             | GSPI & ESPI with latest value            |
| GET    | `/api/v1/indices/:code`       | Index detail + full time series          |
| GET    | `/api/v1/esg`                 | ESG scores by company                    |
| GET    | `/api/v1/certificates`        | Certificates (filter: type, status)      |
| GET    | `/api/v1/alerts`              | Deforestation alerts (filter: severity)  |
| GET    | `/api/v1/ddra`                | DDRA records (filter: status)            |
| GET    | `/api/v1/regulations`         | Regulatory frameworks (filter: region)   |
| GET    | `/api/v1/regulations/:code`   | Single framework with full detail        |
| GET    | `/api/v1/dashboard/summary`   | KPIs + aggregations for the landing page |

---

## 5. UI Architecture & Integration

- **`web/index.html`** is the complete TTMIP v8 dashboard — 15 modules
  (Dashboard, Prices, Markets, Indices, ESG, Certs, Alerts, Due Diligence,
  Regulatory, Trading, Technical, Publications, Fundamentals, FAQ, AI
  Intelligence), rendered with vanilla JS + canvas charts + SVG maps. Zero build
  step, instant load.
- **`web/js/api.js`** is the single network boundary: a typed client
  (`TTMIP.api.*`) plus `TTMIP.hydrate()`, which loads reference data, prices,
  alerts, ESG, certificates and DDRA from the API at startup.
- **Graceful degradation:** if the API is unreachable, the dashboard falls back
  to its built-in deterministic data generators, so the UI is always functional
  (demos, offline, API outages). A small badge reflects `LIVE` vs `DEMO`.
- The API returns the **same shapes** the UI already consumes, so hydration is a
  straight assignment to the module's data arrays — no re-rendering rewrite.
- Ready to evolve into a component framework (React/Vue) behind the same
  `js/api.js` contract when interactivity grows.

---

## 6. Running it

### Quick start (Docker — recommended)

```bash
cd ttmip
cp .env.example .env
docker compose up --build
# web  → http://localhost:8080
# api  → http://localhost:4000/healthz
```

The API container runs migrations and seeds the timber-domain data on boot.
Demo login: **analyst@minfof.cm** / **password123**.

### Local dev (without Docker)

```bash
# 1. Start Postgres, set DATABASE_URL
cd ttmip/server
cp .env.example .env          # edit DATABASE_URL
npm install
npm run prisma:migrate        # create schema
npm run seed                  # load reference + market data
npm run dev                   # api on :4000 (also serves web/)

# open http://localhost:4000
```

### Tests

```bash
cd ttmip/server && npm test
```

---

## 7. Production checklist

- [x] Stateless API, JWT auth, horizontal scaling
- [x] Full relational schema with indexes on hot paths
- [x] Input validation (zod) on every endpoint
- [x] Central error handling + structured logging
- [x] Rate limiting (in-memory, Redis-swappable)
- [x] Health & readiness probes
- [x] Dashboard wired to live API with offline fallback
- [x] Dockerized services + CI pipeline
- [ ] Ingestion workers for Fastmarkets / ITTO / GFW / EUR-Lex feeds
- [ ] Move cache + rate limiter to Redis (interface ready)
- [ ] Read-replica routing + OpenTelemetry tracing
```
