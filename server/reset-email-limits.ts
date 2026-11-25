// TEMPORARY testing helper: clears all email-sending limits (IP daily counts and
// per-email resend timers). Run with: npm run reset-limits
// Delete this file and the "reset-limits" script in package.json before launch.
import 'dotenv/config';
import { pool } from './db';

const ips = await pool.query('DELETE FROM email_quota_ip');
const emails = await pool.query('DELETE FROM email_quota_address');
console.log(`Email limits reset: cleared ${ips.rowCount} IP counter(s) and ${emails.rowCount} email timer(s).`);
await pool.end();
