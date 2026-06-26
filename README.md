# NdMED — LIWIMALA INITIATIVE

Intelligent **pre-clinical triage platform**. Patients answer a structured clinical
intake; an AI pipeline (Claude) produces a triage classification, ranked differential
diagnosis, red-flag detection, an action plan, and a KNN-matched specialist referral
with Google Maps navigation and a printable PDF report.

This repository was developed from a single-file React artifact into a **production-ready,
horizontally-scalable full-stack application**.

> ⚕️ **Medical disclaimer** — NdMED is a decision-support tool. It does **not** replace a
> licensed physician. In an emergency call **15 / 112 / 911** immediately.

---

## Why this rewrite

The original artifact called `api.anthropic.com` **directly from the browser**, which
leaks the API key to every user and cannot be rate-limited, billed per-tenant, audited,
or scaled. The platform below moves all secrets and inference **server-side**, adds
authentication, persistence, plan enforcement, and observability, and splits the UI into
a maintainable component tree.

## Architecture at a glance

```
┌────────────┐    HTTPS/JSON    ┌─────────────┐   Prisma    ┌──────────────┐
│  Web (SPA) │ ───────────────▶ │  API server │ ──────────▶ │  PostgreSQL  │
│ React/Vite │ ◀─────────────── │  Express/TS │             └──────────────┘
└────────────┘                  │             │   SDK       ┌──────────────┐
                                │             │ ──────────▶ │ Anthropic /  │
                                └─────────────┘             │ Claude API   │
                                                            └──────────────┘
```

The API key never reaches the browser. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```
.
├── server/          # Express + TypeScript API, Prisma, Anthropic integration
├── web/             # Vite + React + TypeScript single-page app
├── docs/            # Architecture, API reference, database schema
├── docker-compose.yml
└── .env.example
```

## Quick start

```bash
# 1. Install (npm workspaces)
npm install

# 2. Configure environment
cp .env.example .env
#   set ANTHROPIC_API_KEY=...  and  DATABASE_URL=...

# 3. Start Postgres (or use your own)
docker compose up -d db

# 4. Migrate + seed the specialist directory
npm run db:migrate --workspace server
npm run db:seed    --workspace server

# 5. Run both apps in dev
npm run dev
#   web  → http://localhost:5173
#   api  → http://localhost:4000
```

Full Docker stack: `docker compose up --build`.

## Tech stack

| Layer     | Choice                                            | Why |
|-----------|---------------------------------------------------|-----|
| Frontend  | React 18, Vite, TypeScript, React Router          | Fast HMR, typed, code-split |
| Backend   | Node 20, Express, TypeScript, Zod                 | Ubiquitous, typed request validation |
| Database  | PostgreSQL + Prisma ORM                           | Relational integrity, typed client, migrations |
| AI        | Claude via `@anthropic-ai/sdk` (server-side)      | Key stays private; model configurable |
| Auth      | JWT (access) + bcrypt password hashing            | Stateless, horizontally scalable |
| Infra     | Docker / docker-compose                           | Reproducible local + deploy parity |

## Scripts

| Command | Effect |
|---------|--------|
| `npm run dev` | Run web + api concurrently |
| `npm run build` | Build both workspaces |
| `npm run db:migrate -w server` | Apply Prisma migrations |
| `npm run db:seed -w server` | Seed specialist directory |
| `npm run typecheck` | Typecheck both workspaces |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, scaling, data flow
- [API reference](docs/API.md) — every endpoint, request/response shapes
- [Database schema](docs/DATABASE.md) — tables, relations, indexes
