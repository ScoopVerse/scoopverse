import { Router } from 'express';
import { pool } from './db';
import { malaysianPhone } from './addresses';
import { WEST_ONLY_MESSAGE, deliversTo, stateForPostcode } from '../src/malaysia';

// Shipping settings the admin controls (mounted inside the admin router at /api/admin/shipping): where parcels are
// picked up from, and the order total above which delivery is free (0 = never free). The delivery fee itself is not a
// setting: it comes from EasyParcel's price for each parcel.

type Pickup = { name: string; phone: string; line1: string; line2: string; city: string; postcode: string };
type Shipping = { pickup: Pickup; freeOverCents: number };

// Placeholders until the admin saves real details (the sandbox only needs a real postcode, which is 56000, Cheras).
// shortcut: the placeholder pickup name, phone and street are made up. Replace them with the real ones before going live.
const DEFAULTS: Shipping = {
  pickup: { name: 'ScoopVerse (test)', phone: '+60123456789', line1: '1 Jalan Test', line2: '', city: 'Kuala Lumpur', postcode: '56000' },
  freeOverCents: 15000,
};

// The settings as saved (or the placeholders), with the pickup state worked out from its postcode.
export async function getShipping() {
  const { rows } = await pool.query<{ value: Shipping }>(`SELECT value FROM settings WHERE key = 'shipping'`);
  const shipping = rows[0]?.value ?? DEFAULTS;
  return { ...shipping, state: stateForPostcode(shipping.pickup.postcode), saved: rows.length > 0 };
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// The cleaned settings, or the message to show the admin.
function clean(body: Record<string, unknown>): { error: string } | Shipping {
  const p = (typeof body.pickup === 'object' && body.pickup !== null ? body.pickup : {}) as Record<string, unknown>;
  const name = text(p.name);
  const line1 = text(p.line1);
  const line2 = text(p.line2);
  const city = text(p.city);
  const postcode = text(p.postcode);
  if (!name || name.length > 60) return { error: 'Please enter the sender name (up to 60 letters).' };
  const phone = malaysianPhone(text(p.phone));
  if (!phone) return { error: 'Please enter a Malaysian phone number for pickup, like 012-345 6789.' };
  if (!line1 || line1.length > 100) return { error: 'Please enter the pickup street address (up to 100 letters).' };
  if (line2.length > 100) return { error: 'The second address line is too long (up to 100 letters).' };
  if (!city || city.length > 50) return { error: 'Please enter the pickup city or town.' };
  if (!/^\d{5}$/.test(postcode)) return { error: 'The pickup postcode must be 5 digits.' };
  const state = stateForPostcode(postcode);
  if (!state) return { error: `We don't recognise ${postcode} as a Malaysian postcode. Please check it.` };
  if (!deliversTo(state)) return { error: `The pickup must be in West Malaysia for now. ${WEST_ONLY_MESSAGE}` };
  const free = body.freeOverCents;
  if (typeof free !== 'number' || !Number.isInteger(free) || free < 0 || free > 10_000_000) return { error: 'Please enter the free delivery amount in RM (0 for never free).' };
  return { pickup: { name, phone, line1, line2, city, postcode }, freeOverCents: free };
}

export const shippingAdminRouter = Router();

shippingAdminRouter.get('/', async (_req, res) => {
  res.json(await getShipping());
});

shippingAdminRouter.put('/', async (req, res) => {
  const s = clean(req.body ?? {});
  if ('error' in s) return res.status(400).json({ error: s.error });
  await pool.query(`INSERT INTO settings (key, value) VALUES ('shipping', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [JSON.stringify(s)]);
  res.json(await getShipping());
});
