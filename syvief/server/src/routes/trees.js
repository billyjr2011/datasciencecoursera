import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Tiges irrégulières, filtrables par espèce / qualité / UC / bloc.
router.get('/trees', (req, res) => {
  const db = getDb();
  const where = [];
  const params = {};
  if (req.query.species) { where.push('t.species = $sp'); params.$sp = req.query.species; }
  if (req.query.grade) { where.push('t.grade = $g'); params.$g = req.query.grade; }
  if (req.query.uc) { where.push('t.uc_id = $uc'); params.$uc = req.query.uc; }
  if (req.query.bloc) { where.push('u.bloc = $b'); params.$b = req.query.bloc; }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(req.query.limit) || 200, 2000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const base = `FROM trees t JOIN ucs u ON u.uc_id = t.uc_id ${clause}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(params).c;
  const items = db.prepare(`SELECT t.*, u.bloc ${base}
    ORDER BY t.dbh_cm DESC LIMIT $limit OFFSET $offset`)
    .all({ ...params, $limit: limit, $offset: offset });
  res.json({ total, limit, offset, items });
});

export default router;
