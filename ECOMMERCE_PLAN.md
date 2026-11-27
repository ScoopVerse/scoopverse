# ScoopVerse shop plan: products, cart, checkout, HitPay, EasyParcel

Status: plan only, nothing built yet. Written 2026-11-27 from the official HitPay and
EasyParcel docs. Items marked **VERIFY** were unclear or contradictory in the docs and must be
confirmed in a real sandbox test or with the provider before we rely on them.

## 1. The whole flow, in one picture

```
Customer                    Our server                       HitPay          EasyParcel
--------                    ----------                       ------          ----------
browse products  ------->   GET /api/products
add to cart      ------->   cart rows in our database
pick address     ------->   address book (their saved addresses)
press "Pay"      ------->   1. rebuild the total from OUR prices (never trust the browser)
                            2. create order  status = pending_payment
                            3. create payment request --------> hosted checkout page
                 <-------   send customer to HitPay's page
pays on HitPay   <------------------------------------------>  card / PayNow
                            webhook: payment completed <------  tells our server
                            4. verify it, mark order = paid
                            5. order shows in Admin > Orders: "Paid, waiting to ship"

Admin presses "Confirm shipment" in Orders
                            6. ask EasyParcel for courier prices -----------> quotation
                            7. admin picks courier, confirms -----------> submit order (charges
                                                                           your EasyParcel wallet)
                            8. save tracking number + label     <-------- AWB, label PDF, tracking
                            9. courier updates arrive           <-------- webhook / tracking call
                               order = shipped -> delivered
```

Rule that keeps this safe: **the server decides prices, totals and "is it paid".** The browser
only ever says "I want these items". A customer coming back to our page after paying is not
proof of payment; only HitPay telling our server (or our server asking HitPay) is.

## 2. HitPay (payment)

What it is: HitPay gives us a **hosted checkout page**. We never touch card numbers.
We create a "payment request" (amount, currency MYR, our order number), HitPay gives back a
URL, we send the customer there, HitPay tells us when they paid.

Sandbox (developer) mode, as you asked:
- HitPay has a separate **sandbox** world: `https://api.sandbox.hit-pay.com/v1/` with its
  **own** API key and salt. Sandbox keys do not work on the live API and the other way round.
- Sandbox money is fake. Card and PayNow can be tested there; other methods (FPX, DuitNow,
  Touch 'n Go, GCash and so on) may only work live (one secondary source says so).
- You need a **separate sandbox account** (a secondary source gives
  `dashboard.sandbox.hit-pay.com`; **VERIFY** in HitPay's dashboard). It is not your real
  account. Copy its API key and its webhook salt into `.env`; I never see them.
- The HitPay connector in this Claude app is attached to your **real** account. I will not use
  it for checkout. Our code reads `HITPAY_ENV=sandbox` and the sandbox key from `.env`.
  Going live later = swap three `.env` values, no code change.

How we use it:
- `POST /v1/payment-requests` with `amount`, `currency=MYR`, `reference_number` = our order
  number, `redirect_url` = our order page, `payment_methods[]` (`paynow_online`, `card`),
  `email`, `name`. Response has `id` and `url`.
- Send the customer to `url`. After paying, HitPay sends them back to `redirect_url`.
- **Do not trust the redirect.** Mark the order paid only from the webhook, or by our server
  asking `GET /v1/payment-requests/{id}` and seeing `completed` with the right amount.
- Webhook event `payment_request.completed`: registered in the HitPay dashboard, HTTPS only,
  must be a public address. HitPay signs it (`Hitpay-Signature`, HMAC-SHA256 of the raw body
  with that webhook's salt); we check it with a constant-time compare.
- **VERIFY:** HitPay's two doc pages disagree on whether payment-request webhooks use the
  `Hitpay-Signature` header or an older `hmac` field. We test against a real sandbox delivery
  and implement what actually arrives.
- Local testing problem: HitPay cannot call `localhost`. Two answers:
  (a) on the redirect page our server calls `GET /v1/payment-requests/{id}` itself, which works
  on localhost and is also our safety net in production; (b) a free tunnel (cloudflared/ngrok)
  to test the real webhook. We do (a) first.
- Safety checks on every "paid" event: order exists, amount and currency match our order,
  order not already paid (webhooks can repeat), then mark paid inside one database transaction.
- Not covered by the docs we read (check before building): refund API, minimum amounts,
  webhook retry rules, HitPay's fees. Refunds can be done by hand in the HitPay dashboard at first.

## 3. EasyParcel (shipping)

Two API versions exist. EasyParcel's developer site says **new integrations should use the
"NextGen" API** (OAuth login, current path `/open_api/2026-09/`). The older "Public API" is
key-based and has an unpaid-order expiry rule. We use NextGen.

What NextGen gives us:
- **Quotation:** postcode + weight (+ size) -> list of couriers with prices.
- **Submit order:** needs sender, receiver, parcel size, item list and a chosen courier
  service. It **charges your EasyParcel wallet immediately**. The docs describe no
  "create now, pay later" step. So the **"confirm the delivery" step must live in our admin**:
  Orders -> "Confirm shipment" -> pick courier -> confirm. Only that click calls Submit order.
  This matches what you asked for (you stay in control, nothing ships by itself).
- Result: AWB (tracking) number, label PDF links (A4/A5/A6), tracking URL. Label may arrive a
  little after submit for some couriers.
- **Cancel** works only before the courier processes it (and within 7 days of collection);
  the refund goes back to your wallet.
- **Tracking:** webhooks (`shipment.status.update` and others) or asking for status by AWB
  number. Status codes: to be collected, collected, in transit, delivered, returned, on hold.
- **Sandbox:** free, with test credit, same address as live; you choose it by connecting a
  *sandbox* account in their Developer Hub. Limits: shipment status never updates, and no
  tracking messages are sent. So delivery updates must be simulated while testing.
- Webhooks are signed (`Easyparcel-Signature`, HMAC-SHA256 with the app secret) and must be
  answered with 200 within 3 seconds.
- Limits are generous for us (hundreds of requests a minute).

**VERIFY before building the EasyParcel part (the docs are Malaysia-focused):**
1. Which Malaysian couriers and service IDs appear in the NextGen sandbox/live for our account?
   (Customers are in Malaysia for now; every example in the docs is Malaysia too.)
2. The sandbox web address is given two ways (`.my` and `.sg` hosts) in different
   places. Ask EasyParcel support which is right (we need the Malaysia one).
3. **Are perfumes allowed?** Fragrances (alcohol, sometimes aerosols) are often restricted by
   couriers, especially by air. Check the prohibited-items rules of the couriers you plan to
   use *before* investing in this. Mystery "scoops" may be a different form, but confirm.
4. Account steps: create a Developer Hub app, verify email, fund the wallet for live use.

## 4. How the shop should be built (order matters)

Each phase ends with something you can click and test, and is safe on its own.

**Phase 1: Product listing** (what you asked for now)
- `products` table: name, description, price in **cents** (integer, never decimals), stock,
  images, active on/off, created date.
- Admin > Products tab: list, add, edit, hide/show, delete, with the same look as Customers.
- Public shop page: grid of active products, with a product detail view.
- Images: need an upload feature. Decide where they live (section 6).

**Phase 2: Cart**
- Cart saved in the database per logged-in customer, so it follows them across devices.
- Guests: browse freely; asked to log in when they press Checkout (they already have verified
  accounts, which also gives us a real email for receipts).
- Prices are always read again from the database at checkout.

**Phase 3: Address book**
- `addresses` table per customer: name, phone, street, unit, postcode, one marked default.
- Customers list "Phone Number" and "Address Book" placeholders get real data. The phone shown
  is the default (first) address's phone, as you described.
- Malaysian address format: street/unit, area, city, state, 5-digit postcode (customers are in Malaysia for now).

**Phase 4: Orders + HitPay (sandbox)**
- `orders` + `order_items` tables. Item names and prices are **copied** into the order, so
  later price changes or deleting a product never rewrite history.
- Order statuses: `pending_payment` -> `paid` -> `processing` -> `shipped` -> `delivered`;
  also `cancelled` (expired or admin), `refunded`. These feed the "Current Order status" in
  your Customers list, replacing "No New Order".
- Stock: reserve when the order is created, release if unpaid after 30 minutes, so two people
  cannot buy the last item.
- Admin > Orders tab: list with filters by status, open an order to see items and address.
- Customer "My orders" page.

**Phase 5: EasyParcel**
- Admin: "Confirm shipment" button as described in section 3, then label download, tracking
  number, and status updates.
- Customer: tracking number and link on their order.

**Phase 6: Go live**
- "Is Live Now" switch controls whether checkout is open.
- Swap sandbox keys for live keys, deploy to the OVH server, set `APP_URL`, set up the webhook
  addresses (HitPay and EasyParcel) to the real HTTPS site.
- Security headers, remove `npm run reset-limits`, verification link back to 10 minutes.

## 5. Shipping fee to the customer (decision needed)

| Option | Good | Bad |
|---|---|---|
| **Flat fee or free over $X** (recommended first) | Simple, predictable, works now | You may lose or gain a little per parcel |
| Live courier price at checkout | Exact | Needs weight and size on every product, and Malaysian couriers confirmed; adds waiting time at checkout |

Recommendation: start with a flat fee. The real EasyParcel price is still shown to you when you
confirm the shipment, so you can see your margin. Switch to live prices later if needed.

## 6. Decisions

Decided (2026-11-27):
- Not GST-registered: no tax handling.
- One price per product, no variants.
- Shipping fee and free-shipping threshold are set by the admin in a Settings area (Phase 4).
- Product images: uploaded to our server (JPG/PNG/WebP, max 5 MB, real file type checked,
  random file names, resized with `sharp`, `uploads/` kept out of Git and included in backups).
  One main image per product first.
- Build order: products, cart, address book, orders + HitPay, EasyParcel. Each phase includes
  its customer-facing design. `/shop` stays unlinked from the homepage until launch.

Still open:
- Courier rules for perfume (section 3, point 3).

Original questions, kept for reference:

1. **GST:** are you GST-registered? If yes, prices and receipts need GST handling.
2. **Product images:** upload files to the server (needs disk space and size limits; simple on
   your OVH server) or paste image links? Recommended: upload, one main image first.
3. **Variants:** is each product one item with one price, or do products have options
   (size, scent)? Mystery scoops may be simply "one item, stock count".
4. **Shipping fee:** flat fee amount, and free-shipping threshold, if any.
5. **Courier rules for perfume** (section 3, point 3).

## 7. Safety notes that apply to all phases

- Money is stored in cents as whole numbers. Totals are calculated on the server.
- Every admin action stays behind the admin login; shop actions stay behind the customer login.
- Payment and shipping secrets live only in `.env` (never in chat or Git).
- Webhooks: verify the signature, ignore repeats, answer fast.
- An **admin action log** (who deleted or changed what, when) is worth adding before real
  orders, because order and customer history will matter.
- Deleting a customer must keep their past orders (store the order's name/address on the order).
