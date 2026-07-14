import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Indicateurs de synthèse pour le tableau de bord.
router.get('/stats/overview', (_req, res) => {
  const db = getDb();
  const g = db.prepare(`SELECT
      COUNT(*)                                       AS ucs,
      COALESCE(SUM(trees_total),0)                   AS trees_total,
      COALESCE(SUM(suspect_count),0)                 AS suspect_count,
      COALESCE(SUM(grade_oa),0)                      AS grade_oa,
      ROUND(AVG(suspect_rate_pct),2)                 AS suspect_rate_pct,
      ROUND(AVG(mean_dbh_cm),1)                       AS mean_dbh_cm,
      SUM(CASE WHEN severity=2 THEN 1 ELSE 0 END)    AS critical,
      SUM(CASE WHEN severity=1 THEN 1 ELSE 0 END)    AS warning,
      SUM(CASE WHEN severity=0 THEN 1 ELSE 0 END)    AS ok,
      SUM(edge_flag)                                 AS edge
    FROM ucs`).get();
  const review = db.prepare(`
    SELECT COALESCE(s.status,'a_verifier') AS status, COUNT(*) AS n
    FROM ucs u LEFT JOIN uc_status s ON s.uc_id = u.uc_id
    GROUP BY COALESCE(s.status,'a_verifier')`).all();
  const alerts = db.prepare('SELECT COUNT(*) c FROM alerts').get().c;
  const species = db.prepare('SELECT COUNT(DISTINCT species) c FROM trees').get().c;
  res.json({ ...g, alerts, species, review });
});

// Répartition par espèce (calculée sur les tiges irrégulières relevées).
router.get('/stats/species', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT species,
           COUNT(*)                                    AS n,
           SUM(CASE WHEN grade='OA' THEN 1 ELSE 0 END) AS oa,
           ROUND(AVG(dbh_cm),1)                        AS mean_dbh_cm
    FROM trees GROUP BY species ORDER BY n DESC`).all();
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  res.json(rows.map(r => ({ ...r, pct: Math.round((r.n / total) * 1000) / 10 })));
});

// Histogramme des DBH par classe de 10 cm.
router.get('/stats/dbh', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT (dbh_cm/10)*10 AS bin, COUNT(*) AS n
    FROM trees GROUP BY bin ORDER BY bin`).all();
  res.json(rows.map(r => ({ from: r.bin, to: r.bin + 10, n: r.n })));
});

// Les UC les plus problématiques (taux d'anomalie le plus élevé).
router.get('/stats/worst', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const rows = getDb().prepare(`
    SELECT uc_id, bloc, suspect_rate_pct, suspect_count, tally, trees_total, severity
    FROM ucs WHERE trees_total > 0
    ORDER BY suspect_rate_pct DESC, suspect_count DESC LIMIT ?`).all(limit);
  res.json(rows);
});

export default router;
