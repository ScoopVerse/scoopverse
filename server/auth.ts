import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { rateLimit, type AugmentedRequest, type Options } from 'express-rate-limit';
import { pool } from './db';
import { sendAlreadyRegisteredEmail, sendPasswordResetEmail, sendVerificationEmail } from './mailer';
import { consumeEmailQuota, formatWait, resendWaitSeconds } from './emailQuota';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

// Argon2id with the library defaults (64 MiB memory, 3 passes, 4 lanes); salt is random per hash.
function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(password: string, stored: string) {
  // Accounts created before the switch from scrypt can't log in; they can use "Forgot password?".
  if (!stored.startsWith('$argon2id$')) return false;
  return argon2.verify(stored, password);
}

// Hash of a random password, compared against when the email doesn't exist
// so login takes the same time either way (no account enumeration by timing).
const dummyHash = hashPassword(randomBytes(16).toString('hex'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How long a verification link stays valid. Set in .env (default 10 minutes).
const VERIFY_TTL_SECONDS = Number(process.env.VERIFY_TOKEN_TTL_SECONDS ?? 600);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// How long a password reset link stays valid. Set in .env (default 10 minutes).
const RESET_TTL_SECONDS = Number(process.env.RESET_TOKEN_TTL_SECONDS ?? 600);

// Creates a fresh single-use token for the user (invalidating older ones) and returns the raw token.
async function issueToken(table: 'email_verification_tokens' | 'password_reset_tokens', userId: string, ttl: number) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  await pool.query(
    `INSERT INTO ${table} (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [sha256(token), userId, ttl],
  );
  return token;
}
const issueVerificationToken = (userId: string) => issueToken('email_verification_tokens', userId, VERIFY_TTL_SECONDS);

// Emails are sent after the response so response time doesn't reveal which path ran.
function sendInBackground(p: Promise<unknown>) {
  p.catch((err) => console.error('Email send failed:', err));
}

// Limits are per IP address, kept in memory (reset when the server restarts).
const limiter = (
  limit: number,
  minutes: number,
  error: string,
  opts: Partial<Pick<Options, 'skipSuccessfulRequests' | 'requestWasSuccessful'>> = {},
) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...opts,
    handler: (req, res, _next, options) => {
      const resetTime = (req as AugmentedRequest).rateLimit.resetTime;
      const ms = resetTime ? resetTime.getTime() - Date.now() : options.windowMs;
      const wait = formatWait(Math.max(1, Math.ceil(ms / 1000)));
      res.status(options.statusCode).json({ error: `${error} Please try again in ${wait}.` });
    },
  });

// Register and resend are limited by consumeEmailQuota (server/emailQuota.ts) instead.
// Successful logins don't count, so only failed attempts can lock someone out.
// "Please verify your email" (403) is only returned for a correct password, so it isn't
// counted as a failed attempt either.
const loginLimiter = limiter(10, 15, 'Too many failed login attempts.', {
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode < 400 || res.statusCode === 403,
});
const verifyLimiter = limiter(30, 15, 'Too many verification attempts.');
const resetLimiter = limiter(30, 15, 'Too many password reset attempts.');

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

  const quota = await consumeEmailQuota(req.ip ?? '', email, 'register');
  if ('error' in quota) return res.status(429).json({ error: quota.error, retryAfterSeconds: quota.retryAfterSeconds });

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

  res.status(202).json({ message: CHECK_EMAIL_MESSAGE, nextResendInSeconds: quota.nextResendInSeconds });
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

authRouter.post('/resend-verification', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const quota = await consumeEmailQuota(req.ip ?? '', email, 'resend');
  if ('error' in quota) return res.status(429).json({ error: quota.error, retryAfterSeconds: quota.retryAfterSeconds });

  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, name FROM users WHERE lower(email) = lower($1) AND email_verified_at IS NULL',
    [email],
  );
  if (rows[0]) {
    const token = await issueVerificationToken(rows[0].id);
    sendInBackground(sendVerificationEmail(rows[0].email, rows[0].name, token, VERIFY_TTL_SECONDS));
  }
  // Same response whether or not the account exists.
  res.json({
    message: 'If that email has an unverified account, a new verification link is on its way.',
    nextResendInSeconds: quota.nextResendInSeconds,
  });
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
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      error: 'Please verify your email before logging in.',
      // So the UI shows this email's real resend countdown.
      resendInSeconds: await resendWaitSeconds(req.ip ?? '', user.email),
    });
  }
  await logIn(req, user.id);
  res.json({ user: publicUser(user) });
});

// --- Password reset ---

authRouter.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const quota = await consumeEmailQuota(req.ip ?? '', email, 'reset');
  if ('error' in quota) return res.status(429).json({ error: quota.error, retryAfterSeconds: quota.retryAfterSeconds });

  const { rows } = await pool.query<UserRow>('SELECT id, email, name FROM users WHERE lower(email) = lower($1)', [email]);
  if (rows[0]) {
    const token = await issueToken('password_reset_tokens', rows[0].id, RESET_TTL_SECONDS);
    sendInBackground(sendPasswordResetEmail(rows[0].email, rows[0].name, token, RESET_TTL_SECONDS));
  }
  // Same response whether or not the account exists.
  res.json({
    message: "If that email matches an account, we've sent a link to reset your password.",
    nextResendInSeconds: quota.nextResendInSeconds,
  });
});

// Read-only check so the reset page can say "expired" before the user types a new password.
authRouter.post('/reset-password/check', resetLimiter, async (req, res) => {
  const token = String(req.body?.token ?? '');
  const { rows } = await pool.query<{ expired: boolean }>(
    'SELECT expires_at < now() AS expired FROM password_reset_tokens WHERE token_hash = $1',
    [sha256(token)],
  );
  if (!rows[0]) return res.status(400).json({ code: 'INVALID', error: 'This reset link is invalid or has already been used.' });
  if (rows[0].expired) return res.status(410).json({ code: 'EXPIRED', error: 'This reset link has expired.' });
  res.json({ ok: true });
});

authRouter.post('/reset-password', resetLimiter, async (req, res) => {
  const token = String(req.body?.token ?? '');
  const password = String(req.body?.password ?? '');
  // Check the new password first, so a too-short password doesn't use up the link.
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const passwordHash = await hashPassword(password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Deleting the row makes the link single-use, even if two requests race.
    const { rows } = await client.query<{ user_id: string; expired: boolean }>(
      `DELETE FROM password_reset_tokens WHERE token_hash = $1
       RETURNING user_id, expires_at < now() AS expired`,
      [sha256(token)],
    );
    const row = rows[0];
    if (!row || row.expired) {
      await client.query('COMMIT'); // keep the expired token deleted
      return row
        ? res.status(410).json({ code: 'EXPIRED', error: 'This reset link has expired.' })
        : res.status(400).json({ code: 'INVALID', error: 'This reset link is invalid or has already been used.' });
    }
    // Clicking the emailed link proves the user owns the inbox, so the email counts as verified.
    await client.query(
      'UPDATE users SET password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1',
      [row.user_id, passwordHash],
    );
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [row.user_id]);
    // Log the account out everywhere, in case someone else had access.
    await client.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [row.user_id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  res.json({ message: 'Your password has been changed. You can now log in with your new password.' });
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
