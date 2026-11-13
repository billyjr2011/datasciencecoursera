// Tests d'intégration de l'API SYVIEF (node:test, sans dépendance externe).
// Utilise une base temporaire seedée à la volée.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const DB = join(tmpdir(), `syvief-test-${process.pid}.db`);
const env = { ...process.env, SYVIEF_DB: DB, PORT: '4099' };
let server, base;

before(async () => {
  spawnSync('node', ['src/seed.js'], { env, stdio: 'ignore' });
  server = spawn('node', ['src/server.js'], { env });
  base = 'http://localhost:4099';
  await new Promise((r) => setTimeout(r, 1200));
});

after(() => {
  server?.kill();
  try { rmSync(DB); rmSync(DB + '-wal'); rmSync(DB + '-shm'); } catch { /* noop */ }
});

const get = (p) => fetch(base + p).then((r) => r.json());

test('health répond', async () => {
  const h = await get('/api/health');
  assert.equal(h.ok, true);
  assert.equal(h.ucs, 127);
});

test('overview agrège correctement', async () => {
  const o = await get('/api/stats/overview');
  assert.equal(o.ucs, 127);
  assert.equal(o.critical + o.warning + o.ok, 127);
});

test('blocs renvoie les 4 assiettes', async () => {
  const b = await get('/api/blocs');
  assert.equal(b.length, 4);
  assert.ok(b.find((x) => x.bloc === 'A1').ucs === 81);
});

test('filtre de sévérité sur les UC', async () => {
  const r = await get('/api/ucs?severity=2&limit=5');
  assert.ok(r.total > 0);
  assert.ok(r.items.every((u) => u.severity === 2));
});

test('détail UC avec tiges et statut', async () => {
  const u = await get('/api/ucs/A1-417');
  assert.equal(u.uc_id, 'A1-417');
  assert.ok(Array.isArray(u.trees));
  assert.equal(u.review.status, 'a_verifier');
});

test('workflow de vérification', async () => {
  const res = await fetch(base + '/api/ucs/A1-417/verifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'valide', decision: 'OK', inspector: 'test' }),
  });
  assert.equal(res.status, 201);
  const u = await get('/api/ucs/A1-417');
  assert.equal(u.review.status, 'valide');
});

test('statut invalide rejeté', async () => {
  const res = await fetch(base + '/api/ucs/A1-417/verifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'nope' }),
  });
  assert.equal(res.status, 400);
});

test('le réseau XOR apprend (rétropropagation)', async () => {
  const { MLP } = await import('../src/ml/nn.js');
  const data = [{ x: [0, 0], y: [0] }, { x: [0, 1], y: [1] },
    { x: [1, 0], y: [1] }, { x: [1, 1], y: [0] }];
  const net = new MLP([2, 8, 1], { seed: 1 });
  net.fit(data, { epochs: 1500, lr: 0.1, batchSize: 4, l2: 0 });
  for (const d of data)
    assert.equal(net.predict(d.x)[0] >= 0.5 ? 1 : 0, d.y[0]);
});

test('modèle de conformité entraîné et exposé', async () => {
  const m = await get('/api/ml/model');
  assert.equal(m.trained, true);
  assert.ok(m.metrics.test.acc > 0.9, 'exactitude test > 0.9');
  assert.deepEqual(m.arch.slice(-1), [1]);
});

test('les 4 régions de référence sont exposées', async () => {
  const r = await get('/api/ml/regions');
  assert.deepEqual(r.map((x) => x.region), ['Sud', 'Centre', 'Est', 'Littoral']);
});

test('score de conformité d’une UC', async () => {
  const s = await get('/api/ucs/A1-417/score');
  assert.equal(s.region, 'Est');
  assert.ok(s.conformity >= 0 && s.conformity <= 100);
  assert.ok(['conforme', 'a_surveiller', 'atypique'].includes(s.level));
});

test('UC détail inclut le score IA et la région', async () => {
  const u = await get('/api/ucs/A1-417');
  assert.equal(u.region, 'Est');
  assert.ok(u.ml && typeof u.ml.conformity === 'number');
});
