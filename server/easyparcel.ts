import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db';
import { appUrl } from './mailer';
import { limiter } from './auth';

// The link to EasyParcel's newer API (OAuth). The shop connects ONE EasyParcel account, started by an admin from the
// Overview page. The environment (Sandbox or Live) is whichever account type the admin authorizes, so there is no
// separate switch here. Tokens stay on the server (settings table) and are never sent to the browser.

const CLIENT_ID = process.env.EASYPARCEL_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.EASYPARCEL_CLIENT_SECRET ?? '';
const OAUTH = 'https://api.easyparcel.com/oauth';
const API = 'https://api.easyparcel.com/open_api/2026-09';
// Must be exactly the Redirect URI registered on the EasyParcel developer app.
const REDIRECT_URI = `${appUrl}/api/easyparcel/callback`;
const STATE_MINUTES = 10;

type Tokens = { accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number };

const getSetting = async <T>(key: string) => (await pool.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key])).rows[0]?.value;
const putSetting = (key: string, value: unknown) =>
  pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)]);

const configured = () => CLIENT_ID !== '' && CLIENT_SECRET !== '';

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== 'string') {
    // Only the status and EasyParcel's own reply (a failed reply holds no tokens): never the request, which holds the secret.
    throw new Error(`EasyParcel token request failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : '',
    accessExpiresAt: now + (Number(data.expires_in) || 3600) * 1000,
    refreshExpiresAt: now + (Number(data.refresh_token_expires_in) || 0) * 1000,
  };
}

// Thrown when no EasyParcel account has been connected yet.
export class NotConnected extends Error {}

let refreshing: Promise<string> | null = null; // so two requests at once refresh only once

// A working access token, refreshed first when it is about to run out.
export async function getAccessToken(): Promise<string> {
  const t = await getSetting<Tokens>('easyparcel');
  if (!t) throw new NotConnected();
  if (t.accessExpiresAt - Date.now() > 60_000) return t.accessToken;
  refreshing ??= (async () => {
    try {
      const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refreshToken, redirect_uri: REDIRECT_URI });
      await putSetting('easyparcel', { ...fresh, refreshToken: fresh.refreshToken || t.refreshToken });
      return fresh.accessToken;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// One call to the EasyParcel API as the connected account.
export async function easyparcel(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await getAccessToken()}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => null);
  // EasyParcel can answer HTTP 200 with its own "status_code" inside the body, so that one wins.
  return { status: typeof data?.status_code === 'number' ? (data.status_code as number) : res.status, data };
}

// Admin side (mounted inside the admin router, so it is already behind the admin login).
export const easyparcelAdminRouter = Router();

// Is it set up, is it connected, and does a test call work (the wallet, which also shows the test credit).
easyparcelAdminRouter.get('/', async (_req, res) => {
  if (!configured()) return res.json({ configured: false, connected: false });
  try {
    const { status, data } = await easyparcel('/wallet');
    if (status === 200) return res.json({ configured: true, connected: true, wallet: data?.data ?? null });
    res.json({ configured: true, connected: false, problem: status === 401 ? 'The connection has expired. Please connect again.' : `EasyParcel answered with an error (${status}).` });
  } catch (err) {
    if (err instanceof NotConnected) return res.json({ configured: true, connected: false });
    console.error(err instanceof Error ? err.message : err);
    res.json({ configured: true, connected: false, problem: 'Could not reach EasyParcel. Please try again, or connect again.' });
  }
});

// Starts the connection: remembers a one-time secret (state) and returns EasyParcel's login address for the browser to open.
easyparcelAdminRouter.post('/connect', async (_req, res) => {
  if (!configured()) return res.status(400).json({ error: 'EasyParcel keys are missing in the server settings.' });
  const state = randomBytes(24).toString('base64url');
  await putSetting('easyparcel_pending', { state, expiresAt: Date.now() + STATE_MINUTES * 60_000 });
  const query = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state });
  res.json({ url: `${OAUTH}/login?${query}` });
});

// Where EasyParcel sends the browser back to. The admin cookie is not sent here (it is limited to /api/admin and
// "strict"), so this is trusted only by the one-time state made in /connect above: used once, and only for 10 minutes.
export const easyparcelCallbackRouter = Router();

easyparcelCallbackRouter.get('/callback', limiter(20, 15, 'Too many attempts. Please wait.'), async (req, res) => {
  const done = (ok: boolean) => res.redirect(`/admin?easyparcel=${ok ? 'ok' : 'failed'}#overview`);
  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') return done(false);
  // Checking the state and removing it is one step, so it can only be used once, and a wrong guess removes nothing.
  const used = await pool.query(
    `DELETE FROM settings WHERE key = 'easyparcel_pending' AND value->>'state' = $1 AND (value->>'expiresAt')::bigint > $2`,
    [state, Date.now()],
  );
  if (used.rowCount !== 1) return done(false);
  try {
    await putSetting('easyparcel', await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }));
    done(true);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    done(false);
  }
});
