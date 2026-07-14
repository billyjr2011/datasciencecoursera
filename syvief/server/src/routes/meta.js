import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(
  readFileSync(join(here, '..', '..', 'data', 'meta.json'), 'utf8'));

const router = Router();

// Étendue cartographique et garde-fou géographique de la concession.
router.get('/meta', (_req, res) => {
  res.json({
    project: 'SYVIEF',
    title: "Vérification d'inventaire d'exploitation forestière",
    crs: 'UTM zone 33N',
    extent: meta.extent,
    geoGuard: meta.geo_guard,
  });
});

export default router;
