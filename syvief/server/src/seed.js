// Charge les fichiers JSON extraits du rapport de conformité dans la base SQLite.
// Idempotent : purge puis réinsère. Lancer avec `npm run seed`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb, closeDb, DB_PATH } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, '..', 'data');
const load = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

function seed() {
  const db = getDb();
  const ucs = load('ucs.json');
  const trees = load('trees.json');
  const blocs = load('blocs.json');
  const alerts = load('alerts.json');

  db.exec('BEGIN');
  try {
    for (const t of ['verifications', 'alerts', 'trees', 'ucs', 'blocs'])
      db.exec(`DELETE FROM ${t};`);

    const insBloc = db.prepare(
      `INSERT INTO blocs (bloc,label,color) VALUES (?,?,?)`);
    for (const b of blocs) insBloc.run(b.b, `Assiette ${b.b}`, b.col ?? null);

    const insUc = db.prepare(`INSERT INTO ucs
      (uc_id,bloc,x_utm,y_utm,trees_total,grade_oa,grade_oc,
       suspect_rate_pct,suspect_count,tally,severity,mean_dbh_cm,edge_flag)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const u of ucs)
      insUc.run(u.uc_id, u.bloc, u.x_utm, u.y_utm, u.trees_total,
        u.grade_oa, u.grade_oc, u.suspect_rate_pct, u.suspect_count,
        u.tally, u.severity, u.mean_dbh_cm, u.edge_flag);

    const insTree = db.prepare(`INSERT INTO trees
      (tag_id,uc_id,species,dbh_cm,grade,lat,lon,x_utm,y_utm)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    let skipped = 0;
    for (const t of trees) {
      // Le rapport source contient de rares doublons d'étiquette ; on les ignore.
      try {
        insTree.run(t.tag_id, t.uc_id, t.species, t.dbh_cm, t.grade,
          t.lat, t.lon, t.x_utm, t.y_utm);
      } catch { skipped++; }
    }

    const insAlert = db.prepare(
      `INSERT INTO alerts (uc_id,species,distance_m) VALUES (?,?,?)`);
    for (const a of alerts) {
      const dist = Number(String(a.dist).replace(',', '.'));
      insAlert.run(a.buc, a.sp, Number.isFinite(dist) ? dist : null);
    }

    // Amorce un dossier de vérification "à vérifier" pour chaque UC.
    const insVerif = db.prepare(
      `INSERT INTO verifications (uc_id,status,decision,note,inspector)
       VALUES (?, 'a_verifier', NULL, 'Dossier ouvert automatiquement.', 'système')`);
    for (const u of ucs) insVerif.run(u.uc_id);

    db.exec('COMMIT');
    const n = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
    console.log(`SYVIEF seed → ${DB_PATH}`);
    console.log(`  blocs=${n('blocs')} ucs=${n('ucs')} trees=${n('trees')}` +
      `${skipped ? ` (${skipped} doublons ignorés)` : ''}` +
      ` alerts=${n('alerts')} verifications=${n('verifications')}`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    closeDb();
  }
}

seed();
