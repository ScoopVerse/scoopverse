import nodemailer from 'nodemailer';

// Dev: Mailpit on localhost:1025 (no auth). Server: Mailcow SMTP via the same env vars.
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

const from = process.env.MAIL_FROM ?? 'ScoopVerse <no-reply@scoopverse.local>';
export const appUrl = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, '');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#fdf9f3;font-family:Manrope,Arial,sans-serif;color:#1c1c18">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:24px;padding:36px;border:1px solid #efe7f5">
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    <p style="font-size:12px;color:#7b757e;margin-top:32px">ScoopVerse · Mystery Fragrance Scoops</p>
  </div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${href}" style="background:#695282;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:16px;display:inline-block">${label}</a></p>`;

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  return `${Math.round(seconds / 3600)} hours`;
}

export async function sendVerificationEmail(to: string, name: string, token: string, ttlSeconds: number) {
  const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const expires = formatDuration(ttlSeconds);
  await transport.sendMail({
    from,
    to,
    subject: 'Verify your ScoopVerse email',
    text: `Hi ${name},\n\nConfirm your email to activate your ScoopVerse account:\n${link}\n\nThis link expires in ${expires} and works once. If you didn't sign up, ignore this email.`,
    html: layout(
      'Verify your email',
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Confirm your email to activate your ScoopVerse account.</p>
       ${button(link, 'Verify my email')}
       <p style="font-size:13px;color:#4a454e">This link expires in <b>${expires}</b> and works once. If you didn't sign up, you can ignore this email.</p>
       <p style="font-size:12px;color:#7b757e;word-break:break-all">${link}</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string, ttlSeconds: number) {
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const expires = formatDuration(ttlSeconds);
  await transport.sendMail({
    from,
    to,
    subject: 'Reset your ScoopVerse password',
    text: `Hi ${name},\n\nWe received a request to reset your ScoopVerse password. Choose a new one here:\n${link}\n\nThis link expires in ${expires} and works once. If you didn't ask for this, ignore this email and your password stays the same.`,
    html: layout(
      'Reset your password',
      `<p>Hi ${escapeHtml(name)},</p>
       <p>We received a request to reset your ScoopVerse password.</p>
       ${button(link, 'Choose a new password')}
       <p style="font-size:13px;color:#4a454e">This link expires in <b>${expires}</b> and works once. If you didn't ask for this, you can ignore this email and your password stays the same.</p>
       <p style="font-size:12px;color:#7b757e;word-break:break-all">${link}</p>`,
    ),
  });
}

// Used by `npm run mail:test`: checks login to the SMTP server, then sends one test email.
export async function sendTestEmail(to: string) {
  await transport.verify();
  return transport.sendMail({
    from,
    to,
    subject: 'ScoopVerse test email',
    text: `This is a test email from the ScoopVerse website (${appUrl}). If you can read this, sending works.`,
    html: layout(
      'Test email',
      `<p>This is a test email from the ScoopVerse website.</p><p>If you can read this, sending works.</p>`,
    ),
  });
}

// Sent when someone registers with an email that already has a verified account,
// so the register response can stay identical either way (no account enumeration).
export async function sendAlreadyRegisteredEmail(to: string, name: string) {
  await transport.sendMail({
    from,
    to,
    subject: 'You already have a ScoopVerse account',
    text: `Hi ${name},\n\nSomeone (hopefully you) tried to register with this email, but it already has a ScoopVerse account. You can log in at ${appUrl}.\n\nIf this wasn't you, no action is needed.`,
    html: layout(
      'You already have an account',
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Someone (hopefully you) tried to register with this email, but it already has a ScoopVerse account.</p>
       ${button(appUrl, 'Go to ScoopVerse')}
       <p style="font-size:13px;color:#4a454e">If this wasn't you, no action is needed.</p>`,
    ),
  });
}
