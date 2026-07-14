import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './db.js';
import meta from './routes/meta.js';
import blocs from './routes/blocs.js';
import ucs from './routes/ucs.js';
import trees from './routes/trees.js';
import species from './routes/stats.js';
import alerts from './routes/alerts.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());

// Journalisation légère des requêtes API.
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    const t = Date.now();
    _res.on('finish', () =>
      console.log(`${req.method} ${req.originalUrl} ${_res.statusCode} ${Date.now() - t}ms`));
  }
  next();
});

app.get('/api/health', (_req, res) => {
  try {
    const n = getDb().prepare('SELECT COUNT(*) c FROM ucs').get().c;
    res.json({ ok: true, ucs: n, ts: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.use('/api', meta);
app.use('/api', blocs);
app.use('/api', ucs);
app.use('/api', trees);
app.use('/api', species);
app.use('/api', alerts);

// Sert le frontend compilé si présent (déploiement mono-conteneur).
const webDist = join(here, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'route inconnue' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'erreur interne', detail: err.message });
});

// Vérifie que la base est prête au démarrage.
try {
  const n = getDb().prepare('SELECT COUNT(*) c FROM ucs').get().c;
  if (n === 0) console.warn('⚠ base vide — lancez `npm run seed`.');
} catch {
  console.warn('⚠ base non initialisée — lancez `npm run seed`.');
}

app.listen(PORT, () => console.log(`SYVIEF API → http://localhost:${PORT}`));
