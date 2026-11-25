# ScoopVerse

Mystery fragrance scoops — landing site with user accounts.

**Stack:** React 19 + Vite 6 + Tailwind 4 (frontend), Express 5 + TypeScript (backend),
PostgreSQL (users + server-side sessions via `express-session` / `connect-pg-simple`).
One Node process serves both the site and the `/api` routes.

## Run locally

Prerequisites: Node.js 22+, PostgreSQL 14+.

1. Create a database and user:
   ```sql
   CREATE USER scoopverse WITH PASSWORD 'choose-a-password';
   CREATE DATABASE scoopverse OWNER scoopverse;
   ```
2. `cp .env.example .env` and fill in `DATABASE_URL` and `SESSION_SECRET`.
3. `npm install`
4. Start [Mailpit](https://mailpit.axllent.org/) (local test inbox):
   `mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025` → inbox at http://localhost:8025
5. `npm run dev` → http://localhost:3000

Tables (`users`, `session`, `email_verification_tokens`) are created automatically on startup.

## Email verification

Registering sends a one-time link to `/verify-email?token=…`. Only the SHA-256 of the
token is stored, the link expires after `VERIFY_TOKEN_TTL_SECONDS` (default 600 = 10 min),
works once, and requesting a new link invalidates older ones. Unverified accounts can't
log in. Register and resend always return the same message, so they don't reveal which
emails have accounts.

### Limits

Days are Singapore calendar days (reset at midnight Asia/Singapore). Stored in Postgres.

- **Per IP:** 5 verification emails per day (registering and resending both count).
- **Per email address:** the registration email is free. Each resend must wait after the
  previous email: 60s, 60s, 5 min, 5 min, 5 min. After 5 resends the address is blocked
  until midnight, from any IP. The schedule starts over the next day.
- **Login:** 10 failed attempts per IP per 15 min. **Verify link:** 30 per IP per 15 min
  (in memory; reset on server restart).

TEMPORARY for local testing: `npm run reset-limits` clears all email limits.

## API

| Method | Path                 | Body                        |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/auth/register` | `{ name, email, password }` |
| POST   | `/api/auth/verify-email` | `{ token }`             |
| POST   | `/api/auth/resend-verification` | `{ email }`      |
| POST   | `/api/auth/login`    | `{ email, password }`       |
| POST   | `/api/auth/logout`   | —                           |
| GET    | `/api/auth/me`       | — → `{ user \| null }`      |

Passwords are hashed with scrypt. Sessions live in Postgres and are referenced by an
`httpOnly`, `SameSite=Lax` cookie (`sv.sid`), `Secure` in production.

## Deploy (dedicated server)

```sh
npm ci
npm run build                     # builds dist/ and server.js
NODE_ENV=production npm start     # or set NODE_ENV in .env
```

Run it behind nginx (or similar) terminating HTTPS and proxying to `PORT`,
and keep it alive with systemd or pm2. `NODE_ENV=production` is required so cookies
are marked `Secure` and the proxy's `X-Forwarded-*` headers are trusted.
