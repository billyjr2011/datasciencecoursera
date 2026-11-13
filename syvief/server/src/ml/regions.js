// Profils écologiques de référence des quatre régions forestières du Cameroun
// couvertes par SYVIEF. Ces valeurs paramètrent la génération du jeu de référence
// (voir generate-reference.js) qui sert à entraîner le réseau de neurones.
//
// ⚠ Données de référence SYNTHÉTIQUES : elles reproduisent les ordres de grandeur
// documentés des massifs camerounais (densité de tiges exploitables, DBH moyen,
// essences dominantes). Elles constituent une amorce à remplacer par les
// inventaires réels des sociétés certifiées — le pipeline d'entraînement
// (train.js) relit simplement le contenu de server/data/reference/.
//
// UC de référence : 25 ha (1000 m × 250 m).

export const REGIONS = ['Sud', 'Centre', 'Est', 'Littoral'];
export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r, i]));

// Pour chaque région (société certifiée = comportement « conforme ») :
//  density  : tiges exploitables par ha (moyenne, écart-type)
//  dbh      : DBH moyen des tiges inventoriées en cm (moyenne, écart-type)
//  oaRatio  : proportion de tiges de qualité OA (moyenne, écart-type)
//  suspect  : taux d'anomalie de comptage attendu chez un certifié (%) (moyenne, écart-type)
//  species  : essences dominantes (documentation / affichage)
export const PROFILES = {
  Sud: {
    label: 'Sud — forêt sempervirente atlantique',
    density: [2.4, 0.5], dbh: [108, 9], oaRatio: [0.14, 0.05], suspect: [3.0, 1.4],
    species: ['Azobé', 'Moabi', 'Movingui', 'Bibolo', 'Padouk Rouge'],
  },
  Centre: {
    label: 'Centre — forêt semi-décidue de transition',
    density: [2.0, 0.5], dbh: [102, 8], oaRatio: [0.12, 0.05], suspect: [3.6, 1.6],
    species: ['Ayous', 'Sapelli', 'Tali', 'Fraké', 'Iroko'],
  },
  Est: {
    label: 'Est — forêt dense semi-décidue (bassin du Congo)',
    density: [2.6, 0.6], dbh: [105, 8], oaRatio: [0.15, 0.05], suspect: [3.2, 1.5],
    species: ['Sapelli', 'Tali', 'Padouk Rouge', 'Kossipo', 'Sipo'],
  },
  Littoral: {
    label: 'Littoral — forêt côtière et marécageuse',
    density: [1.7, 0.5], dbh: [98, 9], oaRatio: [0.11, 0.05], suspect: [4.0, 1.7],
    species: ['Azobé', 'Ilomba', 'Fraké', 'Bongo', 'Longhi'],
  },
};

export function profile(region) {
  const p = PROFILES[region];
  if (!p) throw new Error(`région inconnue : ${region}`);
  return p;
}
