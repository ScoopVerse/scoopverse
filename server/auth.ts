import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { rateLimit, type AugmentedRequest } from 'express-rate-limit';
import { pool } from './db';
import { sendAlreadyRegisteredEmail, sendVerificationEmail } from './mailer';

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

// How long a verification link stays valid. Set in .env (default 10 minutes).
const VERIFY_TTL_SECONDS = Number(process.env.VERIFY_TOKEN_TTL_SECONDS ?? 600);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Creates a fresh single-use token for the user (invalidating older ones) and returns the raw token.
async function issueVerificationToken(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await pool.query(
    `INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [sha256(token), userId, VERIFY_TTL_SECONDS],
  );
  return token;
}

// Emails are sent after the response so response time doesn't reveal which path ran.
function sendInBackground(p: Promise<unknown>) {
  p.catch((err) => console.error('Email send failed:', err));
}

// Limits are per IP address, kept in memory (reset when the server restarts).
// Set RATE_LIMIT=off in .env to disable them while testing locally.
const rateLimitOff = process.env.RATE_LIMIT === 'off';
if (rateLimitOff) console.warn('Rate limiting is OFF (RATE_LIMIT=off). Never use this in production.');

function formatWait(ms: number) {
  const secs = Math.max(1, Math.ceil(ms / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'}`;
  const mins = Math.ceil(secs / 60);
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}

const limiter = (limit: number, minutes: number, error: string, opts: { skipSuccessfulRequests?: boolean } = {}) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => rateLimitOff,
    ...opts,
    handler: (req, res, _next, options) => {
      const resetTime = (req as AugmentedRequest).rateLimit.resetTime;
      const wait = formatWait(resetTime ? resetTime.getTime() - Date.now() : options.windowMs);
      res.status(options.statusCode).json({ error: `${error} Please try again in ${wait}.` });
    },
  });

const registerLimiter = limiter(10, 60, 'Too many sign-up attempts.');
// Successful logins don't count, so only failed attempts can lock someone out.
const loginLimiter = limiter(10, 15, 'Too many login attempts.', { skipSuccessfulRequests: true });
const resendLimiter = limiter(5, 15, 'Too many verification emails requested.');
const verifyLimiter = limiter(30, 15, 'Too many verification attempts.');

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

const CHECK_EMAIL_MESSAGE = 'Check your email for a link to verify your account.';

authRouter.post('/register', registerLimiter, async (req, res) => {
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
  const inserted = await pool.query<UserRow>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT ((lower(email))) DO NOTHING
     RETURNING id, email, name`,
    [email, name, passwordHash],
  );

  if (inserted.rows[0]) {
    const user = inserted.rows[0];
    const token = await issueVerificationToken(user.id);
    sendInBackground(sendVerificationEmail(user.email, user.name, token, VERIFY_TTL_SECONDS));
  } else {
    // Email already registered: same response, but email the owner instead.
    // The existing password is never changed here.
    const { rows } = await pool.query<UserRow & { email_verified_at: Date | null }>(
      'SELECT id, email, name, email_verified_at FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    const existing = rows[0];
    if (existing && existing.email_verified_at) {
      sendInBackground(sendAlreadyRegisteredEmail(existing.email, existing.name));
    } else if (existing) {
      const token = await issueVerificationToken(existing.id);
      sendInBackground(sendVerificationEmail(existing.email, existing.name, token, VERIFY_TTL_SECONDS));
    }
  }

  res.status(202).json({ message: CHECK_EMAIL_MESSAGE });
});

authRouter.post('/verify-email', verifyLimiter, async (req, res) => {
  const token = String(req.body?.token ?? '');
  if (!token) return res.status(400).json({ code: 'INVALID', error: 'This verification link is invalid.' });

  // Deleting the row makes the link single-use, even if two requests race.
  const { rows } = await pool.query<{ user_id: string; expired: boolean }>(
    `DELETE FROM email_verification_tokens WHERE token_hash = $1
     RETURNING user_id, expires_at < now() AS expired`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) {
    return res.status(400).json({ code: 'INVALID', error: 'This verification link is invalid or has already been used.' });
  }
  if (row.expired) {
    return res.status(410).json({ code: 'EXPIRED', error: 'This verification link has expired.' });
  }

  await pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1 AND email_verified_at IS NULL', [
    row.user_id,
  ]);
  res.json({ message: 'Your email is verified. You can now log in.' });
});

authRouter.post('/resend-verification', resendLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, name FROM users WHERE lower(email) = lower($1) AND email_verified_at IS NULL',
    [email],
  );
  if (rows[0]) {
    const token = await issueVerificationToken(rows[0].id);
    sendInBackground(sendVerificationEmail(rows[0].email, rows[0].name, token, VERIFY_TTL_SECONDS));
  }
  // Same response whether or not the account exists.
  res.json({ message: 'If that email has an unverified account, a new verification link is on its way.' });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');

  const { rows } = await pool.query<UserRow & { password_hash: string; email_verified_at: Date | null }>(
    'SELECT id, email, name, password_hash, email_verified_at FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const ok = await verifyPassword(password, user ? user.password_hash : await dummyHash);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  // Only revealed after a correct password, so it doesn't leak which emails exist.
  if (!user.email_verified_at) {
    return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', error: 'Please verify your email before logging in.' });
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
