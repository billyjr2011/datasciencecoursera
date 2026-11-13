import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

export const DB_PATH = process.env.SYVIEF_DB || join(ROOT, 'syvief.db');

let db;

/** Open (or create) the database and apply the schema. Idempotent. */
export function getDb() {
  if (db) return db;
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  const schema = readFileSync(join(ROOT, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

export function closeDb() {
  if (db) { db.close(); db = undefined; }
}
