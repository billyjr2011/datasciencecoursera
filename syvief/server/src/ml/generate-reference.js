// Génère le jeu de référence des sociétés certifiées pour les 4 régions.
// Sortie : server/data/reference/<region>.json + reference/index.json.
//
// Chaque région produit :
//  - des UC CONFORMES (label 1) : paramètres tirés autour du profil régional ;
//  - des UC NON CONFORMES (label 0) : mêmes profils perturbés par des anomalies
//    typiques d'un inventaire douteux (sur-déclaration, densité aberrante,
//    DBH hors gabarit, taux d'anomalie élevé).
//
// Déterministe (graine fixe) → reproductible. Remplacer ce fichier par un
// import des inventaires réels certifiés ne change rien au reste du pipeline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REGIONS, profile } from './regions.js';
import { rng } from './nn.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'data', 'reference');

const PER_REGION_CONFORME = 220;
const PER_REGION_ANOMALIE = 110;

// Tirage gaussien (Box-Muller) borné à [min, ∞ ou plafond].
function gauss(rand, mean, std, min = 0, max = Infinity) {
  const u = Math.max(rand(), 1e-9), v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(max, Math.max(min, mean + z * std));
}

function conforme(rand, region) {
  const p = profile(region);
  const density = gauss(rand, p.density[0], p.density[1], 0.4);
  return {
    region, label: 1,
    density: +density.toFixed(3),
    trees: Math.round(density * 25),
    dbh: +gauss(rand, p.dbh[0], p.dbh[1], 60, 160).toFixed(1),
    oa_ratio: +gauss(rand, p.oaRatio[0], p.oaRatio[1], 0, 0.6).toFixed(3),
    suspect: +gauss(rand, p.suspect[0], p.suspect[1], 0, 12).toFixed(2),
    tally_ratio: +gauss(rand, 0.985, 0.02, 0.9, 1).toFixed(3),
    edge: rand() < 0.12 ? 1 : 0,
  };
}

function anomalie(rand, region) {
  const p = profile(region);
  const kind = Math.floor(rand() * 4);
  // On part d'un profil conforme puis on injecte une anomalie dominante.
  const s = conforme(rand, region);
  s.label = 0;
  if (kind === 0) s.suspect = +gauss(rand, 22, 8, 12, 100).toFixed(2);          // sur-déclaration
  else if (kind === 1) s.density = +gauss(rand, p.density[0] * 2.4, 0.7, 3).toFixed(3); // densité aberrante
  else if (kind === 2) s.dbh = +gauss(rand, 78, 6, 40, 92).toFixed(1);          // DBH sous gabarit
  else s.oa_ratio = +gauss(rand, 0.45, 0.1, 0.3, 0.9).toFixed(3);               // excès de qualité OA
  s.trees = Math.round(s.density * 25);
  if (kind !== 1) s.tally_ratio = +gauss(rand, 0.82, 0.06, 0.55, 0.95).toFixed(3);
  return s;
}

export function generate() {
  mkdirSync(OUT, { recursive: true });
  const rand = rng(2024);
  const index = { generated_at: new Date().toISOString(), regions: {}, total: 0 };
  const all = [];
  for (const region of REGIONS) {
    const rows = [];
    for (let i = 0; i < PER_REGION_CONFORME; i++) rows.push(conforme(rand, region));
    for (let i = 0; i < PER_REGION_ANOMALIE; i++) rows.push(anomalie(rand, region));
    writeFileSync(join(OUT, `${region}.json`), JSON.stringify(rows, null, 1));
    index.regions[region] = {
      conforme: PER_REGION_CONFORME, anomalie: PER_REGION_ANOMALIE, total: rows.length,
    };
    index.total += rows.length;
    all.push(...rows);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  return { index, all };
}

// Exécution directe : `node src/ml/generate-reference.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { index } = generate();
  console.log(`Jeu de référence généré → ${OUT}`);
  console.log(`  ${index.total} UC de référence`,
    Object.entries(index.regions).map(([r, v]) => `${r}=${v.total}`).join(' '));
}
