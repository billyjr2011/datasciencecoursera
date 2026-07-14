import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from '../db.js';
import { modelInfo, scoreUc } from '../ml/model.js';
import { REGIONS, PROFILES } from '../ml/regions.js';

const here = dirname(fileURLToPath(import.meta.url));
const REF_INDEX = join(here, '..', '..', 'data', 'reference', 'index.json');

const router = Router();

// Informations sur le réseau de neurones entraîné (architecture, métriques).
router.get('/ml/model', (_req, res) => res.json(modelInfo()));

// Régions de référence et leurs profils écologiques (+ effectifs du jeu de réf.).
router.get('/ml/regions', (_req, res) => {
  let ref = null;
  if (existsSync(REF_INDEX)) ref = JSON.parse(readFileSync(REF_INDEX, 'utf8'));
  res.json(REGIONS.map((r) => ({
    region: r, ...PROFILES[r], reference: ref?.regions?.[r] ?? null,
  })));
});

// Score de conformité d'une UC existante (région tirée de son bloc).
router.get('/ucs/:id/score', (req, res) => {
  const db = getDb();
  const uc = db.prepare(`SELECT u.*, b.region FROM ucs u
    JOIN blocs b ON b.bloc = u.bloc WHERE u.uc_id=?`).get(req.params.id);
  if (!uc) return res.status(404).json({ error: 'UC introuvable' });
  const score = scoreUc(uc, uc.region);
  if (!score) return res.status(503).json({ error: 'modèle non entraîné (npm run train)' });
  res.json(score);
});

// Score d'une UC hypothétique (simulateur) — corps libre.
router.post('/ml/score', (req, res) => {
  const b = req.body ?? {};
  const region = b.region && REGIONS.includes(b.region) ? b.region : 'Est';
  const score = scoreUc(b, region);
  if (!score) return res.status(503).json({ error: 'modèle non entraîné (npm run train)' });
  res.json(score);
});

// Passe l'ensemble des UC au modèle et renvoie la distribution des verdicts.
router.get('/ml/scan', (_req, res) => {
  const info = modelInfo();
  if (!info.trained)
    return res.status(503).json({ error: 'modèle non entraîné (npm run train)' });
  const db = getDb();
  const ucs = db.prepare(`SELECT u.*, b.region FROM ucs u
    JOIN blocs b ON b.bloc = u.bloc`).all();
  const dist = { conforme: 0, a_surveiller: 0, atypique: 0 };
  const flagged = [];
  for (const u of ucs) {
    const s = scoreUc(u, u.region);
    dist[s.level]++;
    if (s.level === 'atypique')
      flagged.push({ uc_id: u.uc_id, bloc: u.bloc, region: u.region,
        conformity: s.conformity, severity: u.severity, suspect_rate_pct: u.suspect_rate_pct });
  }
  flagged.sort((a, b2) => a.conformity - b2.conformity);
  res.json({ total: ucs.length, distribution: dist, flagged: flagged.slice(0, 25) });
});

export default router;
