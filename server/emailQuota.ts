import { pool } from './db';

/*
 * Limits on sending verification emails. Counters reset at midnight Singapore time.
 *
 * Per IP:    5 emails per day. Registering and resending both count.
 * Per email: the registration email is free. Then each resend must wait after the
 *            previous email: 60s, 60s, 5 min, 5 min, 5 min. After 5 resends that
 *            email is blocked until tomorrow (from any IP).
 *
 * Tracked by email address whether or not an account exists, so responses never
 * reveal which emails are registered.
 */

export const IP_DAILY_LIMIT = 5;
export const RESEND_WAITS_SECONDS = [60, 60, 300, 300, 300];
const TZ = 'Asia/Singapore';

export type QuotaResult =
  | { ok: true; nextResendInSeconds: number }
  | { ok: false; error: string; retryAfterSeconds: number };

export async function consumeEmailQuota(ip: string, rawEmail: string, kind: 'register' | 'resend'): Promise<QuotaResult> {
  const email = rawEmail.trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [now] } = await client.query<{ today: string; until_midnight: number }>(
      `SELECT (now() AT TIME ZONE $1)::date::text AS today,
              ceil(extract(epoch FROM (date_trunc('day', now() AT TIME ZONE $1) + interval '1 day') - (now() AT TIME ZONE $1)))::int AS until_midnight`,
      [TZ],
    );

    // Lock (or create) both rows, resetting counters when the day has changed.
    const { rows: [ipRow] } = await client.query<{ count: number }>(
      `INSERT INTO email_quota_ip (ip, day, count) VALUES ($1, $2, 0)
       ON CONFLICT (ip) DO UPDATE
         SET count = CASE WHEN email_quota_ip.day = EXCLUDED.day THEN email_quota_ip.count ELSE 0 END,
             day = EXCLUDED.day
       RETURNING count`,
      [ip, now.today],
    );
    const { rows: [addr] } = await client.query<{ resends: number; since_last: number | null; is_new: boolean }>(
      `INSERT INTO email_quota_address (email, day, resends, last_sent_at) VALUES ($1, $2, 0, NULL)
       ON CONFLICT (email) DO UPDATE
         SET resends = CASE WHEN email_quota_address.day = EXCLUDED.day THEN email_quota_address.resends ELSE 0 END,
             day = EXCLUDED.day
       RETURNING resends, last_sent_at IS NULL AS is_new,
                 extract(epoch FROM now() - last_sent_at)::float AS since_last`,
      [email, now.today],
    );
    const sinceLast = addr.since_last; // seconds since the last email to this address

    // The very first email to an address (on registration) is free; anything after
    // that follows the resend schedule, including registering the same email again.
    const isInitial = kind === 'register' && addr.is_new;

    const blocked = checkRules(isInitial, addr.resends, sinceLast, ipRow.count, now.until_midnight);
    if (blocked) {
      await client.query('ROLLBACK');
      return { ok: false, ...blocked };
    }

    await client.query('UPDATE email_quota_ip SET count = count + 1 WHERE ip = $1', [ip]);
    const newResends = isInitial ? 0 : addr.resends + 1;
    await client.query('UPDATE email_quota_address SET resends = $2, last_sent_at = now() WHERE email = $1', [
      email,
      newResends,
    ]);
    await client.query('COMMIT');

    return { ok: true, nextResendInSeconds: RESEND_WAITS_SECONDS[newResends] ?? now.until_midnight };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// The limit rules, shared by consumeEmailQuota and resendWaitSeconds. Returns null if allowed.
function checkRules(
  isInitial: boolean,
  resendsToday: number,
  sinceLast: number | null,
  ipCountToday: number,
  untilMidnight: number,
): { error: string; retryAfterSeconds: number } | null {
  if (!isInitial) {
    if (resendsToday >= RESEND_WAITS_SECONDS.length) {
      return {
        error: "You've reached today's limit of verification emails for this address. Please try again tomorrow.",
        retryAfterSeconds: untilMidnight,
      };
    }
    const wait = RESEND_WAITS_SECONDS[resendsToday];
    if (sinceLast !== null && sinceLast < wait) {
      const left = Math.ceil(wait - sinceLast);
      return { error: `Please wait ${formatWait(left)} before requesting another email.`, retryAfterSeconds: left };
    }
  }
  if (ipCountToday >= IP_DAILY_LIMIT) {
    return {
      error: 'Too many emails have been requested from your network today. Please try again tomorrow.',
      retryAfterSeconds: untilMidnight,
    };
  }
  return null;
}

// Read-only: seconds until this IP may request a resend for this email (0 = allowed now).
// Changes nothing; used to show the right countdown without sending anything.
export async function resendWaitSeconds(ip: string, rawEmail: string): Promise<number> {
  const { rows: [r] } = await pool.query<{
    until_midnight: number;
    ip_count: number;
    resends: number;
    since_last: number | null;
  }>(
    `WITH t AS (SELECT (now() AT TIME ZONE $1)::date AS today)
     SELECT ceil(extract(epoch FROM (date_trunc('day', now() AT TIME ZONE $1) + interval '1 day') - (now() AT TIME ZONE $1)))::int AS until_midnight,
            coalesce((SELECT count FROM email_quota_ip, t WHERE ip = $2 AND day = t.today), 0) AS ip_count,
            coalesce((SELECT resends FROM email_quota_address, t WHERE email = $3 AND day = t.today), 0) AS resends,
            (SELECT extract(epoch FROM now() - last_sent_at)::float FROM email_quota_address WHERE email = $3) AS since_last`,
    [TZ, ip, rawEmail.trim().toLowerCase()],
  );
  const blocked = checkRules(false, r.resends, r.since_last, r.ip_count, r.until_midnight);
  return blocked ? blocked.retryAfterSeconds : 0;
}

export function formatWait(secs: number) {
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'}`;
  if (secs < 3600) {
    const m = Math.ceil(secs / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const h = Math.ceil(secs / 3600);
  return `${h} hour${h === 1 ? '' : 's'}`;
}
