import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Liste des blocs (assiettes de coupe) avec agrégats de contrôle.
router.get('/blocs', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT b.bloc, b.label, b.color,
           COUNT(u.uc_id)                               AS ucs,
           COALESCE(SUM(u.trees_total),0)               AS trees_total,
           COALESCE(SUM(u.grade_oa),0)                  AS grade_oa,
           COALESCE(SUM(u.suspect_count),0)             AS suspect_count,
           ROUND(AVG(u.suspect_rate_pct),2)             AS suspect_rate_pct,
           ROUND(AVG(u.mean_dbh_cm),1)                  AS mean_dbh_cm,
           SUM(CASE WHEN u.severity=2 THEN 1 ELSE 0 END) AS critical,
           SUM(CASE WHEN u.severity=1 THEN 1 ELSE 0 END) AS warning,
           SUM(CASE WHEN u.severity=0 THEN 1 ELSE 0 END) AS ok
    FROM blocs b
    LEFT JOIN ucs u ON u.bloc = b.bloc
    GROUP BY b.bloc
    ORDER BY b.bloc`).all();
  res.json(rows);
});

// Détail d'un bloc et ses UC.
router.get('/blocs/:bloc', (req, res) => {
  const db = getDb();
  const bloc = db.prepare('SELECT * FROM blocs WHERE bloc=?').get(req.params.bloc);
  if (!bloc) return res.status(404).json({ error: 'bloc introuvable' });
  const ucs = db.prepare(`
    SELECT u.*, COALESCE(s.status,'a_verifier') AS review_status
    FROM ucs u LEFT JOIN uc_status s ON s.uc_id = u.uc_id
    WHERE u.bloc=? ORDER BY u.uc_id`).all(req.params.bloc);
  res.json({ ...bloc, ucs });
});

export default router;
