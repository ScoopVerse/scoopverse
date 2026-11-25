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

    if (!isInitial) {
      if (addr.resends >= RESEND_WAITS_SECONDS.length) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          error: "You've reached today's limit of verification emails for this address. Please try again tomorrow.",
          retryAfterSeconds: now.until_midnight,
        };
      }
      const wait = RESEND_WAITS_SECONDS[addr.resends];
      if (sinceLast !== null && sinceLast < wait) {
        await client.query('ROLLBACK');
        const left = Math.ceil(wait - sinceLast);
        return { ok: false, error: `Please wait ${formatWait(left)} before requesting another email.`, retryAfterSeconds: left };
      }
    }

    if (ipRow.count >= IP_DAILY_LIMIT) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        error: 'Too many emails have been requested from your network today. Please try again tomorrow.',
        retryAfterSeconds: now.until_midnight,
      };
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

export function formatWait(secs: number) {
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'}`;
  if (secs < 3600) {
    const m = Math.ceil(secs / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const h = Math.ceil(secs / 3600);
  return `${h} hour${h === 1 ? '' : 's'}`;
}
