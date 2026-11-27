import { Router, type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import { dummyHash, verifyPassword } from './passwords';
import { EMAIL_RE, limiter, sendPasswordResetTo } from './auth';
import { productsAdminRouter } from './products';

declare module 'express-session' {
  interface SessionData {
    adminId: string;
  }
}

const isProd = process.env.NODE_ENV === 'production';
const PgStore = connectPgSimple(session);

// Admin sessions use their own cookie, sent only to /api/admin, so logging in or out
// as a customer never touches the admin login (and the other way round).
const adminSession = session({
  name: 'sv.admin',
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/api/admin',
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
  },
});

// Only failed attempts count.
const adminLoginLimiter = limiter(5, 15, 'Too many failed login attempts.', { skipSuccessfulRequests: true });

type AdminRow = { id: string; email: string; name: string };
const publicAdmin = (a: AdminRow) => ({ id: a.id, email: a.email, name: a.name });

// Every admin-only route goes through this. It re-checks the database, so a deleted
// admin loses access immediately.
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.adminId) {
    const { rows } = await pool.query<AdminRow>('SELECT id, email, name FROM admins WHERE id = $1', [req.session.adminId]);
    if (rows[0]) {
      res.locals.admin = rows[0];
      return next();
    }
  }
  res.status(401).json({ error: 'Please log in as an admin.' });
}

export const adminRouter = Router();
adminRouter.use(adminSession);
// Admin responses must never be cached by the browser or a proxy.
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminRouter.post('/login', adminLoginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');

  const { rows } = await pool.query<AdminRow & { password_hash: string }>(
    'SELECT id, email, name, password_hash FROM admins WHERE lower(email) = lower($1)',
    [email],
  );
  const admin = rows[0];
  const ok = await verifyPassword(password, admin ? admin.password_hash : await dummyHash);
  if (!admin || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  // Fresh session id on login (prevents session fixation).
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.adminId = admin.id;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    }),
  );
  await pool.query('UPDATE admins SET last_login_at = now() WHERE id = $1', [admin.id]);
  res.json({ admin: publicAdmin(admin) });
});

adminRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sv.admin', { path: '/api/admin' });
    res.status(204).end();
  });
});

// Everything below requires an admin login.
adminRouter.use(requireAdmin);

adminRouter.get('/me', (_req, res) => {
  res.json({ admin: publicAdmin(res.locals.admin) });
});

adminRouter.use('/products', productsAdminRouter);

// --- Customers ---

const CUSTOMERS_PAGE_SIZE = 15;
const BATCH_MAX = 50;

type CustomerRow = { id: string; name: string; email: string; created_at: Date; email_verified_at: Date | null };
const publicCustomer = (c: CustomerRow) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  joinedAt: c.created_at,
  emailVerified: c.email_verified_at !== null,
});

// Customer ids are numbers; anything else can't match a customer.
adminRouter.param('id', (req, res, next, id) => {
  if (!/^\d{1,18}$/.test(String(id))) return res.status(404).json({ error: 'This customer no longer exists.' });
  next();
});

// Newest first. ?q= searches name and email; ?verified=yes|no limits to verified or
// unverified emails (anything else: both); ?offset= pages through the results.
adminRouter.get('/customers', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const verified = String(req.query.verified ?? '');
  const offset = Math.max(0, Number.parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const conditions: string[] = [];
  const params: string[] = [];
  if (q) {
    // Escape LIKE wildcards so a search for "_" or "%" matches literally.
    params.push(`%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
    conditions.push('(name ILIKE $1 OR email ILIKE $1)');
  }
  if (verified === 'yes') conditions.push('email_verified_at IS NOT NULL');
  if (verified === 'no') conditions.push('email_verified_at IS NULL');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [list, count] = await Promise.all([
    pool.query<CustomerRow>(
      `SELECT id, name, email, created_at, email_verified_at FROM users ${where}
       ORDER BY created_at DESC, id DESC LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}`,
      params,
    ),
    pool.query<{ total: string }>(`SELECT count(*) AS total FROM users ${where}`, params),
  ]);
  res.json({ customers: list.rows.map(publicCustomer), total: Number(count.rows[0].total), pageSize: CUSTOMERS_PAGE_SIZE });
});

adminRouter.patch('/customers/:id', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim();
  if (!name || name.length > 80) return res.status(400).json({ error: 'Please enter a name (max 80 characters).' });
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<CustomerRow>(
      'SELECT id, name, email, created_at, email_verified_at FROM users WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'This customer no longer exists.' });
    }
    const emailChanged = rows[0].email.toLowerCase() !== email.toLowerCase();
    if (emailChanged) {
      const taken = await client.query('SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2', [email, req.params.id]);
      if (taken.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Another account already uses this email.' });
      }
    }
    // A new email address must be verified again. Links already sent to the old address stop
    // working, and the customer is logged out everywhere.
    const updated = await client.query<CustomerRow>(
      `UPDATE users SET name = $2, email = $3,
         email_verified_at = CASE WHEN $4 THEN NULL ELSE email_verified_at END
       WHERE id = $1 RETURNING id, name, email, created_at, email_verified_at`,
      [req.params.id, name, email, emailChanged],
    );
    if (emailChanged) {
      await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [req.params.id]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [req.params.id]);
      await client.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [req.params.id]);
    }
    await client.query('COMMIT');
    res.json({ customer: publicCustomer(updated.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// Permanently deletes the account (its tokens go with it via ON DELETE CASCADE) and logs it out.
adminRouter.delete('/customers/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await client.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [req.params.id]);
    await client.query('COMMIT');
    if (!deleted.rowCount) return res.status(404).json({ error: 'This customer no longer exists.' });
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// --- Batch actions on ticked customers ---

// Body { ids: ["1", "2", ...] }: 1 to BATCH_MAX customer ids, duplicates removed.
function batchIds(body: unknown, max = BATCH_MAX): string[] | null {
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (!ids.every((id) => typeof id === 'string' && /^\d{1,18}$/.test(id))) return null;
  const unique = [...new Set(ids as string[])];
  return unique.length <= max ? unique : null;
}
const BATCH_ERROR = `Select between 1 and ${BATCH_MAX} customers.`;
// Resets are emailed one by one while the admin waits; more than this can outlast a proxy's 60 second timeout.
const RESET_MAX = 20;

adminRouter.post('/customers/batch-delete', async (req, res) => {
  const ids = batchIds(req.body);
  if (!ids) return res.status(400).json({ error: BATCH_ERROR });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = await client.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
    await client.query(`DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])`, [ids]);
    await client.query('COMMIT');
    res.json({ deleted: deleted.rowCount });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// Admin-sent resets skip the customers' per-IP email quota, so they have their own limit.
const batchResetLimiter = limiter(10, 15, 'Too many batch password reset requests.');

adminRouter.post('/customers/batch-reset', batchResetLimiter, async (req, res) => {
  const ids = batchIds(req.body, RESET_MAX);
  if (!ids) return res.status(400).json({ error: `Select between 1 and ${RESET_MAX} customers to send password resets.` });
  const { rows } = await pool.query<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE id = ANY($1::bigint[])',
    [ids],
  );
  const failed: string[] = [];
  // One at a time, so the mail server isn't flooded and failures can be reported per customer.
  for (const user of rows) {
    try {
      await sendPasswordResetTo(user);
    } catch (err) {
      console.error(`Password reset email to ${user.email} failed:`, err);
      failed.push(user.email);
    }
  }
  res.json({ sent: rows.length - failed.length, failed });
});
