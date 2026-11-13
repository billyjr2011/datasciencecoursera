import { Router } from 'express';
import { getDb } from '../db.js';
import { scoreUc } from '../ml/model.js';

const router = Router();
const STATUSES = ['a_verifier', 'en_cours', 'valide', 'rejete'];

// Liste filtrable et paginée des unités de comptage.
// Filtres : bloc, severity (0|1|2), status, edge (0|1), q (id partiel).
router.get('/ucs', (req, res) => {
  const db = getDb();
  const where = [];
  const params = {};
  if (req.query.bloc) { where.push('u.bloc = $bloc'); params.$bloc = req.query.bloc; }
  if (req.query.severity !== undefined) {
    where.push('u.severity = $sev'); params.$sev = Number(req.query.severity);
  }
  if (req.query.edge !== undefined) {
    where.push('u.edge_flag = $edge'); params.$edge = Number(req.query.edge);
  }
  if (req.query.status) {
    where.push("COALESCE(s.status,'a_verifier') = $status");
    params.$status = req.query.status;
  }
  if (req.query.q) { where.push('u.uc_id LIKE $q'); params.$q = `%${req.query.q}%`; }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const base = `FROM ucs u LEFT JOIN uc_status s ON s.uc_id = u.uc_id ${clause}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(params).c;
  const rows = db.prepare(`
    SELECT u.*, COALESCE(s.status,'a_verifier') AS review_status
    ${base} ORDER BY u.suspect_rate_pct DESC, u.uc_id
    LIMIT $limit OFFSET $offset`).all({ ...params, $limit: limit, $offset: offset });

  res.json({ total, limit, offset, items: rows });
});

// Détail d'une UC : mesures, tiges irrégulières, alertes, statut de contrôle.
router.get('/ucs/:id', (req, res) => {
  const db = getDb();
  const uc = db.prepare(`SELECT u.*, b.region FROM ucs u
    JOIN blocs b ON b.bloc = u.bloc WHERE u.uc_id=?`).get(req.params.id);
  if (!uc) return res.status(404).json({ error: 'UC introuvable' });
  const trees = db.prepare(
    'SELECT * FROM trees WHERE uc_id=? ORDER BY dbh_cm DESC').all(req.params.id);
  const alerts = db.prepare('SELECT * FROM alerts WHERE uc_id=?').all(req.params.id);
  const status = db.prepare('SELECT * FROM uc_status WHERE uc_id=?').get(req.params.id)
    || { status: 'a_verifier' };
  res.json({ ...uc, review: status, trees, alerts, ml: scoreUc(uc, uc.region) });
});

// Tiges irrégulières d'une UC.
router.get('/ucs/:id/trees', (req, res) => {
  const rows = getDb().prepare(
    'SELECT * FROM trees WHERE uc_id=? ORDER BY dbh_cm DESC').all(req.params.id);
  res.json(rows);
});

// Historique des décisions de contrôle.
router.get('/ucs/:id/verifications', (req, res) => {
  const rows = getDb().prepare(
    'SELECT * FROM verifications WHERE uc_id=? ORDER BY id DESC').all(req.params.id);
  res.json(rows);
});

// Enregistre une décision de contrôle (fait avancer le workflow de l'UC).
router.post('/ucs/:id/verifications', (req, res) => {
  const db = getDb();
  const uc = db.prepare('SELECT uc_id FROM ucs WHERE uc_id=?').get(req.params.id);
  if (!uc) return res.status(404).json({ error: 'UC introuvable' });

  const { status, decision, note, inspector } = req.body ?? {};
  if (!STATUSES.includes(status))
    return res.status(400).json({ error: `status invalide (${STATUSES.join(', ')})` });

  const info = db.prepare(`INSERT INTO verifications
    (uc_id,status,decision,note,inspector) VALUES (?,?,?,?,?)`).run(
    req.params.id, status, decision ?? null, note ?? null,
    (inspector && String(inspector).trim()) || 'inspecteur');
  const row = db.prepare('SELECT * FROM verifications WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

export default router;
