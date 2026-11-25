// Checks the SMTP settings in .env and sends one test email.
// Usage: npm run mail:test -- you@example.com
import 'dotenv/config';
import { sendTestEmail } from './mailer';

const to = process.argv[2];
if (!to) {
  console.error('Usage: npm run mail:test -- you@example.com');
  process.exit(1);
}

const where = `${process.env.SMTP_HOST ?? 'localhost'}:${process.env.SMTP_PORT ?? 1025}`;
console.log(`Connecting to ${where} as ${process.env.SMTP_USER || '(no login)'}...`);
try {
  const info = await sendTestEmail(to);
  console.log(`Sent to ${to}. Server replied: ${info.response}`);
} catch (err) {
  const e = err as { code?: string; responseCode?: number; message: string; errors?: Error[] };
  // Connection failures arrive as an AggregateError with an empty message.
  const detail = e.message || e.errors?.map((x) => x.message).join('; ') || String(err);
  console.error(`FAILED (${e.code ?? e.responseCode ?? 'error'}): ${detail}`);
  process.exit(1);
}
