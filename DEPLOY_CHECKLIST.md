# Deploy checklist: what must change before ScoopVerse goes on the server

Local note, kept up to date as we build. Tick items off when done. Items marked
**(when built)** only apply once that feature exists. Written 2026-11-27.

Golden rule: the live site (www.scoopverse.asia on GitHub Pages, repo `ScoopVerse.github.io`)
must stay untouched until we choose to switch it. Test the server on a **separate subdomain**
first (e.g. `test.scoopverse.asia`).

## 1. Temporary testing settings to undo (the easy ones to forget)

- [ ] `.env`: `VERIFY_TOKEN_TTL_SECONDS=30` -> `600` (10 minutes). Remove the "TESTING" comment.
- [ ] Delete `server/reset-email-limits.ts`, the `reset-limits` line in `package.json`, and the
      "TEMPORARY ... reset-limits" line in `README.md`. The email limits must stay on.
- [ ] Use a **fresh production database**, not this PC's one. It holds test data: dummy
      customers on `@example.test`, test accounts, test products. The tables are created
      automatically on first start.
- [ ] Create the real admin on the server (see section 6). Don't copy the PC's admin account.
- [ ] Delete leftover test files: `uploads/` on the PC is not copied to the server.

## 2. `.env` on the server (never commit it, never paste secrets in chat)

| Variable | Server value |
|---|---|
| `NODE_ENV` | `production` (secure cookies, trusts the proxy, serves `dist/`) |
| `PORT` | e.g. `3000` (only nginx talks to it) |
| `APP_URL` | the real public address, `https://test.scoopverse.asia` first. Used inside every email link. Wrong value = broken verify and reset links |
| `DATABASE_URL` | the server's Postgres, with its own user and a strong password |
| `SESSION_SECRET` | a **new** long random value (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). Not the PC's. Changing it later logs everyone out |
| `VERIFY_TOKEN_TTL_SECONDS` | `600` |
| `RESET_TOKEN_TTL_SECONDS` | `600` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Mailcow hostname, `465`, `true` (or the server's internal address) |
| `SMTP_USER` / `SMTP_PASS` | `no-reply@scoopverse.asia` and its **app password** (SMTP only) |
| `MAIL_FROM` | `ScoopVerse <no-reply@scoopverse.asia>` |

- `GEMINI_API_KEY` in `.env.example` is a leftover from the original template. Nothing in
  `src/` uses it. Not needed.
- Check `.env` is not world-readable (`chmod 600`).

## 3. Server setup

- [ ] Node 22+, PostgreSQL 14+ (the PC runs 17), nginx, and something to keep Node running
      (systemd or pm2).
- [ ] Database: create a user and database; give the app user only that database.
- [ ] Get the code: `git clone` of `ScoopVerse/scoopverse` (branch `main` after merging
      `feature/auth`). Then `npm ci` **on the server**. `argon2` and `sharp` are native
      packages: they must be installed on the server's own OS, never copied from the PC.
- [ ] The first start on the server runs the one-time description conversion in `server/db.ts`; it only touches
      descriptions that are not yet formatted text, so it is safe to run again.
- [ ] Keep dev dependencies installed (plain `npm ci`, not `--omit=dev`), because
      `npm run admin:create` runs through `tsx`, which is a dev dependency.
- [ ] `npm run build` (makes `dist/` and `server.js`), then `npm start`.
- [ ] **Working directory matters.** The app looks for `dist/` and `uploads/` relative to where
      it is started. Set `WorkingDirectory=` to the app folder in systemd/pm2.
- [ ] **Run exactly one Node process** (no pm2 cluster mode). The login, admin-login, verify
      and reset limits are counted in memory per process: two processes would double the
      allowed attempts, and a restart clears them. (The email-sending limits are in
      Postgres and are fine.) To scale later, move these counters to Postgres.

## 4. nginx and HTTPS

- [ ] HTTPS certificate (Let's Encrypt) for the site's hostname.
- [ ] Proxy to `127.0.0.1:PORT` and pass `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`.
- [ ] **Raise the upload limit.** nginx's default `client_max_body_size` is 1 MB, which would
      break product photos (up to 30 MB). Set `client_max_body_size 32m;`.
- [ ] The app uses `trust proxy = 1`: correct for exactly one proxy (nginx). If Cloudflare or
      another proxy sits **in front of nginx**, the real visitor IP is lost and every rate
      limit would treat everyone as one person. Tell me if that applies, and we adjust.
- [ ] Optional: let nginx serve `/uploads/products/` directly (long cache). Node also serves it.
      **Never expose `uploads/originals/`** (full uncropped photos, admin only): point nginx only
      at the `products` folder, not the whole `uploads` folder.
- [ ] Firewall: only 80/443 open to the world; the Node port and Postgres closed.

## 5. Pictures and backups

- [ ] `uploads/` (`products/` = public cropped pictures, `originals/` = private full photos) lives
      on the server's disk, is **not in Git**, and `npm run build` / `git pull` don't touch it. The
      user running Node needs write permission to it.
- [ ] Back up **both** the Postgres database and `uploads/` (nightly dump plus a copy off the
      server). Losing `uploads/` loses every product picture and original.

## 6. Admin account

- [ ] On the server: `npm run admin:create -- you@scoopverse.asia "Your Name"` (password is
      typed hidden, 12+ characters). Forgotten password: `npm run admin:password -- <email>`.
- [ ] Recommended before real customers: two-factor login for admins, and an admin action log
      (who deleted or changed what). Not built yet.
- [ ] `/admin` is hidden from search engines and not linked anywhere. Keep it that way.

## 7. Email (Mailcow)

Already working from the PC. On the server confirm:
- [ ] SPF, DKIM, DMARC pass and PTR is set for both the IPv4 and IPv6 of the Mailcow server
      (done 2026-11-26; re-check after any DNS or IP change).
- [ ] DMARC: starts at `p=none`. Move to `p=quarantine` once reports look clean.
- [ ] Send a real test (`npm run mail:test -- your@gmail.com`) from the server itself.
- [ ] Registering, resending and forgot-password each send one real email, and the links open
      the right address.

## 8. Going public (the switch)

- [ ] Merge `feature/auth` into `main` of `ScoopVerse/scoopverse` (not the GitHub Pages repo).
- [ ] Shop: `server/index.ts` sends `noindex` for `/shop`. **Remove `'/shop'` from that
      list** at launch, link the shop from the homepage, and hide or replace the "Under
      Development" screen. Keep `/admin` noindex.
- [ ] The "Is Live Now" switch (to build) should decide whether checkout is open.
- [ ] Point `www.scoopverse.asia` at the server only when ready. That is the moment GitHub
      Pages stops serving the old site: plan it, keep the old repo as a fallback, and lower
      the DNS TTL beforehand. This repo deliberately has no `CNAME` file or Pages workflow, so
      it can't claim the domain by accident.
- [ ] Add security headers (helmet): not done yet.
- [ ] Update `APP_URL` to the final domain and restart (old email links keep the old address).

## 9. Payments: HitPay (when built)

- [ ] Sandbox -> live: swap the three `.env` values (environment, API key, webhook salt);
      sandbox keys never work live.
- [ ] Register the webhook in the **live** HitPay dashboard: event `payment_request.completed`,
      public HTTPS address on our real domain. HitPay can't reach `localhost`.
- [ ] Re-test one real small payment end to end, then refund it by hand.
- [ ] Not in a code file, ever: API key and salts only in `.env`.

## 10. Shipping: EasyParcel (when built)

- [ ] Developer Hub app: set the real OAuth redirect address (our domain).
- [ ] Connect the **live** account (not sandbox) and top up the wallet; check the balance
      alert so confirmed shipments don't fail for lack of credit.
- [ ] Register the webhook address (public HTTPS, must answer 200 within 3 seconds).
- [ ] Confirm Malaysian couriers, and that perfumes are allowed by the couriers we use.

## 11. Final check on the server

- [ ] Register a new customer, verify by email, log in, log out.
- [ ] Forgot password works end to end.
- [ ] Admin login works; Products and Customers tabs load; upload a photo (a 6+ MB one, to test the nginx limit).
- [ ] The cookies are `Secure` (browser dev tools), and the site loads only over HTTPS.
- [ ] Restart the server: the site comes back by itself.
- [ ] A backup of the database and `uploads/` restores cleanly on a spare machine or folder.
