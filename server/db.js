import { DatabaseSync } from 'node:sqlite';

export function openDb(path) {
  let db;
  try {
    db = new DatabaseSync(path);
  } catch (err) {
    const uid = process.getuid?.() ?? '?';
    throw new Error(
      `Impossible d'ouvrir la base ${path} (${err.message}). Le dossier doit être accessible en écriture pour l'UID ${uid} ` +
        '(en Docker : PUID/PGID, ou propriétaire du volume monté sur /data).',
      { cause: err },
    );
  }
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL DEFAULT '',
      salt TEXT NOT NULL DEFAULT '',
      settings TEXT NOT NULL DEFAULT '{"maxRarity":1,"bonus":0}',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      target INTEGER,
      step INTEGER NOT NULL DEFAULT 1,
      excluded TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, job_id)
    );
  `);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  return db;
}
