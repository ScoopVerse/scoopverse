import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { pool } from './db';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Hash of a random password, compared against when the email doesn't exist
// so login takes the same time either way (no account enumeration by timing).
const dummyHash = hashPassword(randomBytes(16).toString('hex'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserRow = { id: string; email: string; name: string };
const publicUser = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name });

// Start a fresh session for the user (prevents session fixation).
function logIn(req: import('express').Request, userId: string) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'Please enter your name (max 80 characters).' });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const passwordHash = await hashPassword(password);
  try {
    const { rows } = await pool.query<UserRow>(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name, passwordHash],
    );
    await logIn(req, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');

  const { rows } = await pool.query<UserRow & { password_hash: string }>(
    'SELECT id, email, name, password_hash FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const ok = await verifyPassword(password, user ? user.password_hash : await dummyHash);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  await logIn(req, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sv.sid');
    res.status(204).end();
  });
});

authRouter.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const { rows } = await pool.query<UserRow>('SELECT id, email, name FROM users WHERE id = $1', [
    req.session.userId,
  ]);
  res.json({ user: rows[0] ? publicUser(rows[0]) : null });
});
