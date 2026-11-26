// Admin accounts are managed only from the terminal (there is no admin sign-up page).
//   npm run admin:create -- admin@example.com "Full Name"
//   npm run admin:password -- admin@example.com
// The password is asked for with hidden typing, so it never appears on screen or in shell history.
import 'dotenv/config';
import { pool, migrate } from './db';
import { hashPassword } from './passwords';

const MIN_LENGTH = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function askHidden(question: string) {
  const stdin = process.stdin;
  if (!stdin.isTTY) fail('Run this command in a terminal so the password can be typed.');
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  return new Promise<string>((resolve) => {
    let typed = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(typed);
        }
        if (ch === '\u0003') {
          process.stdout.write('\n');
          process.exit(130); // Ctrl+C
        }
        if (ch === '\u007f' || ch === '\b') typed = typed.slice(0, -1);
        else typed += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function askNewPassword() {
  const pw = await askHidden(`New password (at least ${MIN_LENGTH} characters): `);
  if (pw.length < MIN_LENGTH || pw.length > 200) fail(`Password must be ${MIN_LENGTH}-200 characters.`);
  if ((await askHidden('Type it again: ')) !== pw) fail("The passwords don't match. Nothing was changed.");
  return hashPassword(pw);
}

const [command, rawEmail, ...nameParts] = process.argv.slice(2);
const email = (rawEmail ?? '').trim();
if (!EMAIL_RE.test(email)) {
  fail(
    'Usage:\n  npm run admin:create -- admin@example.com "Full Name"\n  npm run admin:password -- admin@example.com',
  );
}

await migrate();

if (command === 'create') {
  const name = nameParts.join(' ').trim();
  if (!name || name.length > 80) fail('Give the admin a name (max 80 characters), in quotes.');
  const exists = await pool.query('SELECT 1 FROM admins WHERE lower(email) = lower($1)', [email]);
  if (exists.rowCount) fail(`An admin with ${email} already exists. To change its password: npm run admin:password -- ${email}`);
  const hash = await askNewPassword();
  await pool.query('INSERT INTO admins (email, name, password_hash) VALUES ($1, $2, $3)', [email, name, hash]);
  console.log(`Admin ${email} created. Log in at /admin.`);
} else if (command === 'password') {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM admins WHERE lower(email) = lower($1)', [email]);
  if (!rows[0]) fail(`No admin with ${email}.`);
  const hash = await askNewPassword();
  await pool.query('UPDATE admins SET password_hash = $2 WHERE id = $1', [rows[0].id, hash]);
  // Log this admin out everywhere.
  await pool.query(`DELETE FROM session WHERE sess->>'adminId' = $1`, [rows[0].id]);
  console.log(`Password changed for ${email}. Logged out of all admin sessions.`);
} else {
  fail('Unknown command. Use admin:create or admin:password.');
}

await pool.end();
