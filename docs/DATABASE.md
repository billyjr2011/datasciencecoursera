# NdMED — Database Schema

PostgreSQL via Prisma. Source of truth: [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).

## Entity-relationship overview

```
User 1───* Consultation *───* Specialist        (via ConsultationSpecialist join)
```

- A **User** has a plan and many **Consultations**.
- A **Consultation** captures one triage run: the intake answers, the AI result, the
  model used, and the KNN-matched specialists (denormalised snapshot + join rows).
- **Specialist** is the seeded directory used by KNN matching and the maps UI.

## Tables

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `email` | text, unique | login identity |
| `passwordHash` | text | bcrypt |
| `name` | text, null | display name |
| `plan` | enum `Plan` | `FREE` \| `PRO` \| `CLINICAL` (default `FREE`) |
| `createdAt` / `updatedAt` | timestamptz | |

Indexes: unique(`email`).

### `consultations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `userId` | uuid (fk → users) | indexed |
| `plan` | enum `Plan` | plan at time of run |
| `answers` | jsonb | full intake payload |
| `result` | jsonb | parsed triage result |
| `triageColor` | text | RED/ORANGE/YELLOW/GREEN (denormalised for filtering) |
| `referralSpecialty` | text, null | |
| `model` | text | Claude model id used |
| `patientZone` | text, null | for KNN/maps |
| `createdAt` | timestamptz | indexed |

Indexes: (`userId`, `createdAt desc`), (`triageColor`).

### `specialists`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (pk) | e.g. `s001` |
| `name` | text | |
| `specialty` | text | |
| `subspecialty` | text, null | |
| `zone` / `city` | text | |
| `lat` / `lng` | double precision | KNN + maps |
| `facility` / `address` / `phone` / `email` / `available` | text | |
| `languages` | text[] | |
| `tags` | text[] | symptom keywords for tag-overlap scoring |

Indexes: (`city`), (`specialty`).

### `consultation_specialists` (join)

| Column | Type |
|--------|------|
| `consultationId` | uuid (fk) |
| `specialistId` | text (fk) |
| `rank` | int |
| `score` | double precision |
| `distanceKm` | int, null |

Primary key (`consultationId`, `specialistId`).

## Enums

```prisma
enum Plan {
  FREE
  PRO
  CLINICAL
}
```

## Why JSONB for `answers` / `result`

The intake question bank evolves and the AI result schema differs per plan. Storing them
as `jsonb` keeps the schema stable while preserving full auditability and allowing GIN
indexing on specific paths later if query patterns demand it.

## Migrations & seeding

```bash
npm run db:migrate -w server   # prisma migrate dev
npm run db:seed    -w server   # loads the 35-specialist directory
```
