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
4. `npm run dev` → http://localhost:3000

Tables (`users`, `session`) are created automatically on startup.

## API

| Method | Path                 | Body                        |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/auth/register` | `{ name, email, password }` |
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
