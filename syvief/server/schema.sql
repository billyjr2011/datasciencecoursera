-- SYVIEF — schéma SQLite
-- Système de Vérification d'Inventaire d'Exploitation Forestière.
-- Conventions : unités métriques, coordonnées UTM zone 33N, DBH en cm.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','inspector','viewer')),
  pass_hash  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assiette de coupe / bloc (regroupe des UC contiguës).
CREATE TABLE IF NOT EXISTS blocs (
  bloc     TEXT PRIMARY KEY,           -- ex. "A1"
  label    TEXT,
  color    TEXT
);

-- Unité de comptage (UC) : cellule de 500 m × 500 m de l'inventaire d'exploitation.
CREATE TABLE IF NOT EXISTS ucs (
  uc_id            TEXT PRIMARY KEY,          -- ex. "A1-409"
  bloc             TEXT NOT NULL REFERENCES blocs(bloc),
  x_utm            INTEGER NOT NULL,          -- coin sud-ouest, UTM 33N
  y_utm            INTEGER NOT NULL,
  trees_total      INTEGER NOT NULL,
  grade_oa         INTEGER NOT NULL DEFAULT 0,
  grade_oc         INTEGER NOT NULL DEFAULT 0,
  suspect_rate_pct REAL    NOT NULL DEFAULT 0, -- % de tiges présentant une anomalie (PBV)
  suspect_count    INTEGER NOT NULL DEFAULT 0,
  tally            INTEGER NOT NULL DEFAULT 0, -- tiges retenues après contrôle de saisie
  severity         INTEGER NOT NULL DEFAULT 0 CHECK (severity IN (0,1,2)), -- 0 conforme, 1 vigilance, 2 critique
  mean_dbh_cm      REAL,
  edge_flag        INTEGER NOT NULL DEFAULT 0  -- UC en bordure de l'assiette de coupe
);
CREATE INDEX IF NOT EXISTS idx_ucs_bloc     ON ucs(bloc);
CREATE INDEX IF NOT EXISTS idx_ucs_severity ON ucs(severity);

-- Tiges signalées irrégulières lors de l'analyse de conformité.
CREATE TABLE IF NOT EXISTS trees (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id   TEXT NOT NULL UNIQUE,              -- numéro de marteau / étiquette DF10
  uc_id    TEXT NOT NULL REFERENCES ucs(uc_id),
  species  TEXT NOT NULL,
  dbh_cm   INTEGER NOT NULL,
  grade    TEXT NOT NULL,                     -- qualité déclarée : OA, OB, OC
  lat      REAL, lon REAL,
  x_utm    INTEGER, y_utm INTEGER,
  status   TEXT NOT NULL DEFAULT 'suspect' CHECK (status IN ('suspect','confirme','ecarte'))
);
CREATE INDEX IF NOT EXISTS idx_trees_uc      ON trees(uc_id);
CREATE INDEX IF NOT EXISTS idx_trees_species ON trees(species);

-- Alertes automatiques (ex. individu isolé à distance anormale de ses congénères).
CREATE TABLE IF NOT EXISTS alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uc_id      TEXT NOT NULL REFERENCES ucs(uc_id),
  species    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'isolement', -- type d'anomalie
  distance_m REAL,                              -- distance au congénère le plus proche (m)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_uc ON alerts(uc_id);

-- Dossier de vérification par UC : le cœur métier de SYVIEF.
-- Chaque UC porte un statut de contrôle qui évolue via des décisions horodatées.
CREATE TABLE IF NOT EXISTS verifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uc_id       TEXT NOT NULL REFERENCES ucs(uc_id),
  status      TEXT NOT NULL CHECK (status IN ('a_verifier','en_cours','valide','rejete')),
  decision    TEXT,                              -- conclusion de l'inspecteur
  note        TEXT,
  inspector   TEXT NOT NULL DEFAULT 'système',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_verif_uc ON verifications(uc_id);

-- Vue du statut courant : dernière décision enregistrée pour chaque UC.
CREATE VIEW IF NOT EXISTS uc_status AS
SELECT v.uc_id, v.status, v.decision, v.note, v.inspector, v.created_at
FROM verifications v
JOIN (
  SELECT uc_id, MAX(id) AS max_id FROM verifications GROUP BY uc_id
) last ON last.uc_id = v.uc_id AND last.max_id = v.id;
