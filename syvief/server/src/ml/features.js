// Transformation d'une UC (mesurée ou de référence) en vecteur de caractéristiques
// normalisé pour le réseau. Les statistiques de normalisation sont figées dans le
// modèle entraîné afin que l'inférence reproduise exactement le prétraitement.
import { REGIONS, REGION_INDEX } from './regions.js';

export const UC_AREA_HA = 25; // 1000 m × 250 m

// Caractéristiques continues (avant one-hot région).
export const CONT_FEATURES = ['density', 'dbh', 'oa_ratio', 'suspect', 'tally_ratio', 'edge'];

// Extrait les caractéristiques brutes (non normalisées) d'un enregistrement UC.
// Accepte aussi bien une ligne de la table `ucs` qu'un échantillon de référence.
export function rawFeatures(uc) {
  const trees = uc.trees_total ?? uc.trees ?? 0;
  const density = uc.density ?? (trees / UC_AREA_HA);
  const dbh = uc.mean_dbh_cm ?? uc.dbh ?? 100;
  const oa = uc.oa_ratio ?? (trees > 0 ? (uc.grade_oa ?? 0) / trees : 0);
  const suspect = (uc.suspect ?? uc.suspect_rate_pct ?? 0) / 100;
  const tally = uc.tally_ratio ?? (trees > 0 ? (uc.tally ?? trees) / trees : 1);
  const edge = uc.edge ?? uc.edge_flag ?? 0;
  return { density, dbh, oa_ratio: oa, suspect, tally_ratio: tally, edge };
}

// Calcule moyenne/écart-type de chaque caractéristique continue sur un jeu.
export function fitNorm(samples) {
  const raw = samples.map(rawFeatures);
  const norm = {};
  for (const f of CONT_FEATURES) {
    const xs = raw.map((r) => r[f]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    norm[f] = { mean, std: Math.sqrt(varr) || 1 };
  }
  return norm;
}

// Vecteur final : caractéristiques continues normalisées + one-hot région.
export function vectorize(uc, norm) {
  const r = rawFeatures(uc);
  const cont = CONT_FEATURES.map((f) => (r[f] - norm[f].mean) / norm[f].std);
  const region = uc.region ?? 'Est';
  const oneHot = REGIONS.map((_, i) => (i === REGION_INDEX[region] ? 1 : 0));
  return cont.concat(oneHot);
}

export const N_FEATURES = CONT_FEATURES.length + REGIONS.length;
