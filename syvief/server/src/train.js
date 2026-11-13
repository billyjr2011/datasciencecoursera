// Entraîne le réseau de neurones de conformité SYVIEF sur le jeu de référence
// des 4 régions, puis sauvegarde le modèle (architecture, poids, normalisation,
// métriques) dans server/model.json. Lancer avec `npm run train`.
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MLP, rng } from './ml/nn.js';
import { fitNorm, vectorize, N_FEATURES, CONT_FEATURES } from './ml/features.js';
import { REGIONS } from './ml/regions.js';
import { generate } from './ml/generate-reference.js';

const here = dirname(fileURLToPath(import.meta.url));
const REF_DIR = join(here, '..', 'data', 'reference');
const MODEL_PATH = process.env.SYVIEF_MODEL || join(here, '..', 'model.json');

// Charge le jeu de référence (le génère s'il est absent).
function loadReference() {
  if (!existsSync(join(REF_DIR, 'index.json'))) {
    console.log('Jeu de référence absent — génération…');
    return generate().all;
  }
  const rows = [];
  for (const region of REGIONS) {
    const f = join(REF_DIR, `${region}.json`);
    if (existsSync(f)) rows.push(...JSON.parse(readFileSync(f, 'utf8')));
  }
  return rows;
}

function split(samples, ratio, seed) {
  const rand = rng(seed);
  const data = samples.slice();
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)); [data[i], data[j]] = [data[j], data[i]];
  }
  const n = Math.floor(data.length * ratio);
  return [data.slice(0, n), data.slice(n)];
}

function metrics(net, set, norm) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const s of set) {
    const p = net.predict(vectorize(s, norm))[0];
    const yhat = p >= 0.5 ? 1 : 0;
    if (s.label === 1 && yhat === 1) tp++;
    else if (s.label === 0 && yhat === 0) tn++;
    else if (yhat === 1) fp++; else fn++;
  }
  const acc = (tp + tn) / set.length;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { acc: +acc.toFixed(4), precision: +prec.toFixed(4), recall: +rec.toFixed(4),
    f1: +f1.toFixed(4), tp, tn, fp, fn };
}

function train() {
  const samples = loadReference();
  console.log(`Échantillons de référence : ${samples.length}`);
  const [trainSet, testSet] = split(samples, 0.8, 99);
  const norm = fitNorm(trainSet);

  const net = new MLP([N_FEATURES, 16, 8, 1], { seed: 42 });
  const data = trainSet.map((s) => ({ x: vectorize(s, norm), y: [s.label] }));

  let last = 0;
  net.fit(data, {
    epochs: 300, lr: 0.08, batchSize: 24, l2: 1e-4, seed: 7,
    cb: (e, loss) => { last = loss; if (e % 50 === 0 || e === 1) console.log(`  epoch ${e}  loss ${loss.toFixed(4)}`); },
  });

  const train = metrics(net, trainSet, norm);
  const test = metrics(net, testSet, norm);
  console.log(`Train  acc=${train.acc}  f1=${train.f1}`);
  console.log(`Test   acc=${test.acc}  f1=${test.f1}  precision=${test.precision}  recall=${test.recall}`);

  const model = {
    version: 1,
    trained_at: new Date().toISOString(),
    arch: [N_FEATURES, 16, 8, 1],
    features: { continuous: CONT_FEATURES, regions: REGIONS },
    norm,
    net: net.toJSON(),
    training: {
      samples: samples.length, train: trainSet.length, test: testSet.length,
      epochs: 300, final_loss: +last.toFixed(4),
    },
    metrics: { train, test },
  };
  writeFileSync(MODEL_PATH, JSON.stringify(model, null, 1));
  console.log(`Modèle sauvegardé → ${MODEL_PATH}`);
}

train();
