import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Alertes automatiques d'isolement (tige éloignée de ses congénères).
router.get('/alerts', (req, res) => {
  const db = getDb();
  const where = [];
  const params = {};
  if (req.query.bloc) { where.push('u.bloc = $b'); params.$b = req.query.bloc; }
  if (req.query.species) { where.push('a.species = $s'); params.$s = req.query.species; }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT a.*, u.bloc, u.severity
    FROM alerts a JOIN ucs u ON u.uc_id = a.uc_id ${clause}
    ORDER BY a.distance_m DESC`).all(params);
  res.json(rows);
});

export default router;
