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

Tables (`users`, `session`, `email_verification_tokens`, products, carts, …) are created automatically on startup.

## Email verification

Registering sends a one-time link to `/verify-email?token=…`. Only the SHA-256 of the
token is stored, the link expires after `VERIFY_TOKEN_TTL_SECONDS` (default 600 = 10 min),
works once, and requesting a new link invalidates older ones. Unverified accounts can't
log in. Register and resend always return the same message, so they don't reveal which
emails have accounts.

## Password reset

"Forgot password?" in the login modal emails a single-use link to `/reset-password?token=…`
(only its SHA-256 is stored; expires after `RESET_TOKEN_TTL_SECONDS`, default 10 min).
The response is the same whether or not the email has an account. Setting a new password
logs the account out on every device and marks the email as verified.

### Limits

Days are Singapore calendar days (reset at midnight Asia/Singapore). Stored in Postgres.

- **Per IP:** 5 verification emails per day (registering and resending both count).
- **Per email address:** the registration email is free. Each resend must wait after the
  previous email: 60s, 60s, 5 min, 5 min, 5 min. After 5 resends the address is blocked
  until midnight, from any IP. The schedule starts over the next day.
- **Password reset emails:** count toward the same IP limit, with their own per-email
  timer: first request immediate, then 60s, 5 min, 5 min, 5 min, then blocked until midnight.
- **Login:** 10 failed attempts per IP per 15 min. **Verify link:** 30 per IP per 15 min
  (in memory; reset on server restart).

TEMPORARY for local testing: `npm run reset-limits` clears all email limits.

## Admin

The admin dashboard is at `/admin`. Admin accounts are separate from customer accounts
and can only be created from the terminal (the password is typed hidden, at least 12 characters):

```sh
npm run admin:create -- admin@example.com "Full Name"
npm run admin:password -- admin@example.com   # set a new password; logs that admin out everywhere
```

Admin logins use their own cookie (`sv.admin`, sent only to `/api/admin`, `SameSite=Strict`,
12 hours), so customer and admin logins never affect each other. 5 failed admin logins per IP
per 15 min. Every admin API route except login/logout requires an admin session.

## Shop and product pictures

`/shop` lists the products marked Visible in Admin → Products (it is not linked from the
homepage yet, and sends `noindex`). Prices are stored as whole sen (MYR, Malaysian ringgit).

Product descriptions are formatted text (bold, italic, underline, font, size, lists), written in the
admin's text editor (Tiptap) and stored as HTML. The server cleans every description before saving
(`sanitize-html`): only those tags and font/size styles survive, so a description can't carry a script,
link or image. Old plain-text descriptions were converted once at startup.

Every product has a listing type, chosen in the admin form: **Perfume**, **Scoop** or **Other** (a scoop is a plain listing for now). A perfume also has
its own box in the shop: what it is inspired by, EDP or EDT, how many hours it lasts (1 to 48), and an optional one-line pitch.
A second, optional box shows the top, heart and base notes (up to 10 per row, 30 characters each, typed as comma-separated text).
They are stored in the `kind` and `details` (JSON) columns; the server checks them, and the shop shows them as plain text.

A product has up to **6 pictures** (the `product_images` table), in an order the admin sets by drag and drop;
the first is the cover the shop tiles show. Each picture keeps **one original** (the uploaded photo, max 2400 px,
`uploads/originals/`, never served publicly) and **one cropped shop picture** (max 1200 px, `uploads/products/`).
Cropping again replaces the shop picture; the crop settings are saved so the crop screen reopens as it was. Both
are WebP with random names. `products.image` mirrors the cover so the shop's list needs no join. `uploads/` is not in Git: **include it in server backups** and keep it on the
same disk when deploying (`npm run build` does not touch it).

## Cart

A customer's cart lives in the database (`cart_items`), so it follows them across devices. Only logged-in customers
have one: pressing "Add to cart" while logged out opens the login window and then adds the item. Prices are never
sent by the browser; every cart response is built from the `products` table, so price changes show straight away.
Scoops are added as **live** or **offline** (their two prices; Go Live only while the Live switch is on), everything
else as `standard`. Up to 10 of one line, and never more than the product's stock (a scoop's live and offline lines
share its stock). A line the shop can't sell as it stands (hidden, sold out, not enough stock, live closed) is
flagged with a `problem`, left out of the subtotal, and `canCheckout` turns false. Checkout itself comes in the
orders phase. The cart button is on `/shop` only for now.

## Address book

A logged-in customer can save up to 5 delivery addresses (`addresses`), one marked default (the first is default
automatically; deleting the default passes it to the oldest left). Malaysia only: the state is one of 16 ISO 3166-2:MY
codes (`MY-01`…`MY-16`, names in `src/malaysia.ts`), the postcode is 5 digits and the phone is stored as `+60…`
(mobile or landline; `012-345 6789`, `+60 12 3456789` and `60123456789` are all accepted). It opens from the pin icon
in the `/shop` top bar. The state is never chosen: it follows from the postcode (list in `src/malaysia.ts`). The form shows it
read-only and the server works it out again, ignoring any state sent; a postcode not on the list is refused. An optional
delivery note (up to 200 letters) goes to the courier. Address autocomplete is logged as a `shortcut:` debt in `server/addresses.ts`. The admin sees each customer's addresses (and the default's phone number) on their card in the
Customers tab, and can edit them there (same checks as in the shop). These fields are what EasyParcel's order and quote calls ask for.

## Delivery area, pickup and free delivery

Delivery is **West Malaysia only** for now: a postcode in Sabah, Sarawak or Labuan is refused in the address form with
"Sorry, we only deliver to West Malaysia for now." (the list is `EAST_MALAYSIA` in `src/malaysia.ts`; take a code out to
open it). The admin Overview page has a **Pickup and free delivery** card (`settings` key `shipping`, API
`GET/PUT /api/admin/shipping`): the pickup address couriers collect from (West Malaysia, state from the postcode) and the
order total at or above which delivery is free (0 = never free). Until it is saved, placeholders are used (pickup
postcode 56000, free from RM150): replace them before going live. The delivery fee itself is not a setting, it comes from
EasyParcel's price per parcel. Planned: one parcel per 2 items by default (3kg, flat rate), the admin can repack.

## EasyParcel link

The shop links to one EasyParcel account through EasyParcel's newer API (OAuth). Set `EASYPARCEL_CLIENT_ID` and
`EASYPARCEL_CLIENT_SECRET` in `.env`, register `APP_URL + /api/easyparcel/callback` as the app's Redirect URI, then an
admin clicks **Connect EasyParcel** on the Overview page and allows access. A Sandbox account gives test mode, a Live
account real shipments (a token can't be converted between them). Tokens are kept in the `settings` table, refreshed
automatically and never sent to the browser. The callback is trusted by a one-time `state` (10 minutes) made when the
admin clicks Connect, because the admin cookie is not sent to `/api/easyparcel`. `server/easyparcel.ts` exports
`easyparcel(path, init)` for the later quote and booking calls.

## API

| Method | Path                 | Body                        |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/auth/register` | `{ name, email, password }` |
| POST   | `/api/auth/verify-email` | `{ token }`             |
| POST   | `/api/auth/resend-verification` | `{ email }`      |
| POST   | `/api/auth/forgot-password` | `{ email }`          |
| POST   | `/api/auth/reset-password/check` | `{ token }`     |
| POST   | `/api/auth/reset-password` | `{ token, password }` |
| POST   | `/api/auth/login`    | `{ email, password }`       |
| POST   | `/api/auth/logout`   | —                           |
| GET    | `/api/auth/me`       | — → `{ user \| null }`      |
| POST   | `/api/admin/login`   | `{ email, password }`       |
| POST   | `/api/admin/logout`  | —                           |
| GET    | `/api/admin/me`      | — → `{ admin }` or 401      |
| GET    | `/api/admin/customers?q=&offset=` | — → `{ customers, total, pageSize }` |
| PATCH  | `/api/admin/customers/:id` | `{ name, email }` (new email → unverified, logged out) |
| DELETE | `/api/admin/customers/:id` | — (permanent; logs the customer out) |
| GET    | `/api/products`, `/api/products/:id` | public shop: visible products only (`inStock`, no stock count); the list has no descriptions, `/:id` has |
| GET/POST | `/api/admin/products` | admin: list all / `{ name, description, priceCents, stock, active, kind, details }` (`kind` = `perfume` or `other`; a perfume needs `details`: `{ inspiredBy, concentration, hoursMin, hoursMax, tagline, notes: { top, heart, base } }`) |
| PATCH  | `/api/admin/products/:id/active` | `{ active }`: show or hide a product, changes nothing else |
| POST   | `/api/admin/products/batch-delete` | `{ ids }` (1–100) → `{ deleted }`; removes the products and their picture files |
| PATCH/DELETE | `/api/admin/products/:id` | admin: same body as create / delete (also removes its pictures) |
| POST   | `/api/admin/products/:id/images?crop=x,y,w,h` | admin: adds a picture at the end (max 6); raw JPG/PNG/WebP photo (`Content-Type: image/*`, max 30 MB); crop in percent, optional → `{ product }` |
| PUT    | `/api/admin/products/:id/images/order` | admin: `{ ids }` lists every picture id of the product in the new order |
| PUT    | `/api/admin/products/:id/images/:imageId?crop=` | admin: replaces that picture's photo (same body as adding) |
| PUT    | `/api/admin/products/:id/images/:imageId/crop` | admin: `{ x, y, width, height }` re-crops the saved original; replaces the shop picture |
| GET    | `/api/admin/products/:id/images/:imageId/original` | admin only: the full saved photo (for the crop screen) |
| DELETE | `/api/admin/products/:id/images/:imageId` | admin: removes one picture and its files |
| GET    | `/api/cart` | customer: `{ items, subtotalCents, count, canCheckout }` (401 when logged out) |
| POST   | `/api/cart` | customer: `{ productId, mode, quantity? }` adds (or raises the line); `mode` = `live`, `offline` (scoops) or `standard` → the cart |
| PATCH  | `/api/cart/:id` | customer: `{ quantity }` (1–10) sets one line → the cart |
| DELETE | `/api/cart/:id` | customer: removes one line → the cart |
| GET    | `/api/addresses` | customer: `{ addresses }`, default first (401 when logged out) |
| POST   | `/api/addresses` | customer: `{ name, phone, line1, line2?, city, postcode, state, isDefault? }` (max 5) → `{ addresses }` |
| PUT    | `/api/addresses/:id` | customer: same body, edits one address → `{ addresses }` |
| PUT    | `/api/admin/customers/:id/addresses/:addressId` | admin: same body as above, edits one of that customer's addresses → `{ addresses }` |
| DELETE | `/api/addresses/:id` | customer: removes one address → `{ addresses }` |
| POST   | `/api/admin/customers/batch-delete` | `{ ids }` (1–50) → `{ deleted }` |
| POST   | `/api/admin/customers/batch-reset` | `{ ids }` (1–20) → `{ sent, failed }`; 10 requests per 15 min |

Passwords are hashed with Argon2id. Sessions live in Postgres and are referenced by an
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
