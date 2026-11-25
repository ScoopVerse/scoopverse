# Sending ScoopVerse emails through Mailcow

The website sends email over standard SMTP. Switching from Mailpit (local test inbox)
to Mailcow only changes settings in `.env`; no code changes are needed.

Menu names below may differ slightly between Mailcow versions.

`mail.example-host` below means **your Mailcow hostname**: the address you open the
Mailcow admin page on (the `MAILCOW_HOSTNAME` it was installed with).

---

## 1. In Mailcow (admin page)

1. **Domain.** *E-Mail → Configuration → Domains*. Make sure `scoopverse.asia` is listed.
   If not, **Add domain**.
2. **DKIM key.** *System → Configuration → Options → ARC/DKIM keys*. Check that
   `scoopverse.asia` has a key (selector `dkim`, 2048-bit). If not, generate one.
3. **Mailbox.** *E-Mail → Configuration → Mailboxes → Add mailbox*:
   - Username `no-reply`, domain `scoopverse.asia`
   - Full name `ScoopVerse`
   - A long random password (store it in your password manager)
4. **App password (recommended).** Log in to the Mailcow web page as
   `no-reply@scoopverse.asia`, open *App passwords*, create one named
   "ScoopVerse website" and allow **SMTP** only. Use this in `.env` instead of the
   mailbox's main password, so the website never holds the real password and you can
   revoke it on its own.

## 2. DNS records for scoopverse.asia

Mailcow lists the exact records it expects, and whether each one is correct:
*E-Mail → Configuration → Domains → **DNS*** button next to `scoopverse.asia`.
Add them where the domain's DNS is managed.

| Record | Name | Value | Notes |
|---|---|---|---|
| A | `mail.example-host` | OVH server IP | Probably already exists |
| TXT (SPF) | `scoopverse.asia` | `v=spf1 mx a:mail.example-host ~all` | Only **one** SPF record is allowed. If one exists already (e.g. for another email provider), add `a:mail.example-host` into it instead of creating a second |
| TXT (DKIM) | `dkim._domainkey.scoopverse.asia` | Copy from Mailcow | Long value starting `v=DKIM1; k=rsa; p=…` |
| TXT (DMARC) | `_dmarc.scoopverse.asia` | `v=DMARC1; p=none; rua=mailto:YOUR-ADDRESS` | Start with `p=none`; change to `p=quarantine` once reports look clean |
| MX | `scoopverse.asia` | `mail.example-host` | **Only if Mailcow should receive scoopverse.asia mail.** Changing MX moves *all* incoming mail for the domain. Not needed just to send |

**Reverse DNS (PTR)** — in the OVH control panel, set the server IP's reverse to
`mail.example-host`. It must match the A record and the hostname Mailcow announces.
Gmail and Outlook often reject or spam mail without it.

**Port 25** — Mailcow delivers to Gmail/Outlook over port 25. OVH dedicated servers
normally allow it; if mail queues up and never leaves, check that OVH hasn't blocked it.

## 3. Point the website at Mailcow (`.env` on the PC)

Replace the Mailpit SMTP lines with:

```
SMTP_HOST="mail.example-host"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="no-reply@scoopverse.asia"
SMTP_PASS="the app password from step 1.4"
MAIL_FROM="ScoopVerse <no-reply@scoopverse.asia>"
```

- `MAIL_FROM` must be `no-reply@scoopverse.asia`; Mailcow refuses to send as an address
  the login doesn't own.
- `.env` is never committed to Git. Don't paste the password anywhere else.
- Restart the dev server after editing `.env`.

To go back to Mailpit: `SMTP_HOST="localhost"`, `SMTP_PORT=1025`, `SMTP_SECURE=false`,
and empty `SMTP_USER` / `SMTP_PASS`.

## 4. Test

1. **Connection + one email:**
   ```
   npm run mail:test -- your.own@gmail.com
   ```
   Success prints `Sent to … Server replied: 250 …`.
2. **Authentication check:** in Gmail open the email → ⋮ → *Show original*.
   SPF, DKIM and DMARC should all say **PASS**.
3. **Spam score:** send to the address shown on mail-tester.com
   (`npm run mail:test -- that-address`) and aim for 9/10 or better.
4. **Real flows:** register, resend and forgot-password on http://localhost:3000.
   While testing locally the links inside the emails point to `localhost`, so open them
   on this PC. On the server, set `APP_URL` to the real site address.

### If something fails

| Message from `mail:test` | Likely cause |
|---|---|
| `ETIMEDOUT` / `ECONNREFUSED` | Wrong `SMTP_HOST`/port, or a firewall blocks 465. Try `SMTP_PORT=587` with `SMTP_SECURE=false` |
| `535` authentication failed | Wrong password, or `SMTP_USER` isn't the full address |
| `553` / sender not owned | `MAIL_FROM` doesn't match `SMTP_USER` |
| Certificate / TLS error | `SMTP_HOST` must match the name on Mailcow's certificate (use the hostname, not the IP) |
| Sent, but lands in spam | Missing SPF/DKIM/DMARC/PTR, or the IP is new. Fallback in the project plan: a sending service such as Brevo or Postmark, same SMTP settings |
