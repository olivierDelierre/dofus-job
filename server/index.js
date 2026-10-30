import express from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';

const scrypt = promisify(scryptCb);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.API_PORT ?? 3001);
const SESSION_DAYS = 30;
const COOKIE = 'dj_session';

const db = openDb(process.env.DB_PATH ?? join(ROOT, 'server/data.db'));
const app = express();
// Derrière un reverse proxy (TrueNAS, Traefik, Nginx…), req.secure suit X-Forwarded-Proto.
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return { hash, salt };
}

function startSession(req, res, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Cookie sécurisé seulement en HTTPS : l'app doit rester utilisable en HTTP sur le réseau local.
    secure: req.secure,
    maxAge: SESSION_DAYS * 86400_000,
  });
}

function auth(req, res, next) {
  const token = req.cookies[COOKIE];
  const row = token && db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);
  if (!row || row.expires_at < Date.now()) return res.status(401).json({ error: 'Non connecté' });
  req.userId = row.user_id;
  next();
}

const publicUser = (u) => ({ id: u.id, username: u.username, settings: JSON.parse(u.settings) });

function validCredentials(body) {
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!/^[\p{L}\p{N}_\-.]{3,24}$/u.test(username)) return { error: 'Pseudo : 3 à 24 caractères (lettres, chiffres, _ - .)' };
  if (password.length < 6 || password.length > 200) return { error: 'Mot de passe : 6 caractères minimum' };
  return { username, password };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/register', async (req, res) => {
  const c = validCredentials(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  if (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(c.username)) {
    return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  }
  const { hash, salt } = await hashPassword(c.password);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .run(c.username, hash, salt, Date.now());
  startSession(req, res, Number(lastInsertRowid));
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)));
});

app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  const { hash } = await hashPassword(password, user?.salt ?? 'x'.repeat(32));
  if (!user || !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
    return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  }
  startSession(req, res, user.id);
  res.json(publicUser(user));
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)));
});

app.put('/api/settings', auth, (req, res) => {
  const s = req.body ?? {};
  const settings = {
    maxRarity: [0, 1, 2].includes(s.maxRarity) ? s.maxRarity : 1,
    bonus: clampInt(s.bonus, 0, 500, 0),
    craftSubs: s.craftSubs !== false,
    sort: ['default', 'alpha', 'level'].includes(s.sort) ? s.sort : 'default',
    hidden: Array.isArray(s.hidden) ? s.hidden.filter(Number.isInteger).slice(0, 100) : [],
  };
  db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(settings), req.userId);
  res.json(settings);
});

app.get('/api/progress', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM progress WHERE user_id = ?').all(req.userId);
  res.json(
    Object.fromEntries(
      rows.map((r) => [
        r.job_id,
        { level: r.level, target: r.target, step: r.step, excluded: JSON.parse(r.excluded), updatedAt: r.updated_at },
      ]),
    ),
  );
});

app.put('/api/progress/:jobId', auth, (req, res) => {
  const jobId = clampInt(req.params.jobId, 1, 10_000, null);
  if (jobId === null) return res.status(400).json({ error: 'Métier invalide' });
  const b = req.body ?? {};
  const level = clampInt(b.level, 1, 200, 1);
  // target null = pas d'objectif, on vise 200.
  const target = b.target === null ? null : clampInt(b.target, 1, 200, null);
  const step = clampInt(b.step, 1, 50, 1);
  const excluded = Array.isArray(b.excluded) ? b.excluded.filter(Number.isInteger).slice(0, 2000) : [];
  db.prepare(
    `INSERT INTO progress (user_id, job_id, level, target, step, excluded, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, job_id) DO UPDATE SET level = excluded.level, target = excluded.target, step = excluded.step,
       excluded = excluded.excluded, updated_at = excluded.updated_at`,
  ).run(req.userId, jobId, level, target, step, JSON.stringify(excluded), Date.now());
  res.json({ ok: true });
});

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const dist = join(ROOT, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
