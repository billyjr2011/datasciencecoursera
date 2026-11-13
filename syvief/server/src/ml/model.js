// Chargement du modèle entraîné et scoring de conformité d'une UC.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MLP } from './nn.js';
import { vectorize } from './features.js';

const here = dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = process.env.SYVIEF_MODEL || join(here, '..', '..', 'model.json');

let cache;

export function loadModel() {
  if (cache !== undefined) return cache;
  if (!existsSync(MODEL_PATH)) { cache = null; return null; }
  const raw = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));
  cache = { ...raw, _net: MLP.fromJSON(raw.net) };
  return cache;
}

export function modelInfo() {
  const m = loadModel();
  if (!m) return { trained: false };
  return {
    trained: true, version: m.version, trained_at: m.trained_at, arch: m.arch,
    features: m.features, training: m.training, metrics: m.metrics,
  };
}

// Interprétation lisible d'une probabilité de conformité.
function verdict(p) {
  if (p >= 0.8) return { level: 'conforme', label: 'Conforme au profil certifié' };
  if (p >= 0.5) return { level: 'a_surveiller', label: 'Écart modéré au profil certifié' };
  return { level: 'atypique', label: 'Profil atypique — contrôle recommandé' };
}

// Score une UC (ligne de la table `ucs`, éventuellement enrichie de `region`).
export function scoreUc(uc, region = 'Est') {
  const m = loadModel();
  if (!m) return null;
  const p = m._net.predict(vectorize({ ...uc, region }, m.norm))[0];
  const conformity = Math.round(p * 1000) / 10; // en %
  return { region, conformity, probability: +p.toFixed(4), ...verdict(p) };
}
