# NdMED prototype

`NdMedPrototype.jsx` is a single-file, from-scratch rebuild of the NdMED triage
application for **testing the full UX standalone** — no backend, no API key.

## Engine

A pluggable triage engine (top of the file, `ENGINE.mode`):

- **`"mock"` (default)** — deterministic, rule-based triage that produces the same
  JSON shape as the production pipeline. Red-flag answers force EMERGENCY;
  severity/onset drive URGENT/SEMI-URGENT; chief complaints select the
  differential, referral specialty, evidence and labs. Every result is
  contextualised for a **Black African population in Cameroon** (race-free eGFR,
  pulse-oximetry caveat on darker skin, Duffy-null neutropenia, G6PD before
  oxidative drugs, CCB/thiazide-first hypertension, sickle-cell priors).
- **`"api"`** — POSTs to the production backend in this repo
  (`{ENGINE.apiBase}/consultations`, JWT from `localStorage`).

## Preview

An interactive, self-contained preview (React inlined, no CDN) can be built with:

```bash
npm install            # once, from the repo root
./prototype/build-preview.sh
open prototype/preview.html   # or drag it into any browser
```

`preview.html` and the intermediate build files are generated (git-ignored) —
regenerate them whenever `NdMedPrototype.jsx` changes.

## Using it in a React app

The file default-exports `<App/>`. Drop it into any React 18 project, or paste it
into a browser sandbox that provides React (e.g. a Claude artifact).
