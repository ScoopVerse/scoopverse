import { Router, type Request, type Response, type NextFunction } from 'express';
import { pool } from './db';
import { WEST_ONLY_MESSAGE, deliversTo, stateForPostcode } from '../src/malaysia';

// The signed-in customer's saved delivery addresses (mounted at /api/addresses). Malaysia only.

const MAX_ADDRESSES = 5;

export type Row = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  state: string;
  note: string;
  is_default: boolean;
};

export const shape = (r: Row) => ({ id: r.id, name: r.name, phone: r.phone, line1: r.line1, line2: r.line2, city: r.city, postcode: r.postcode, state: r.state, note: r.note, isDefault: r.is_default });

export async function listOf(userId: string) {
  const { rows } = await pool.query<Row>('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at, id', [userId]);
  return rows.map(shape);
}

// "012-345 6789", "+6012 3456789" and "60123456789" all become "+60123456789". Mobile (01x) or landline (03 to 09) only.
export function malaysianPhone(raw: string): string | null {
  let d = raw.replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith('60')) d = '0' + d.slice(2);
  return /^0(1\d{8,9}|[3-9]\d{7,8})$/.test(d) ? '+60' + d.slice(1) : null;
}

// Returns the cleaned fields, or the message to show the customer. The state is never taken from the browser:
// it is worked out from the postcode (ISO 3166-2:MY code, the form EasyParcel's newer API uses).
// shortcut: addresses are typed by hand, so a wrong street or town gets through (only the postcode is checked).
// Fix: address autocomplete (Google Places or similar) so the customer picks a real address. Do it once wrong-address
// deliveries show up; it needs a paid key and extra code on the form.
function clean(body: Record<string, unknown>): { error: string } | { name: string; phone: string; line1: string; line2: string; city: string; postcode: string; state: string; note: string } {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  const name = text(body.name);
  const line1 = text(body.line1);
  const line2 = text(body.line2);
  const city = text(body.city);
  const postcode = text(body.postcode);
  const note = text(body.note);
  if (note.length > 200) return { error: 'The delivery note is too long (up to 200 letters).' };
  if (!name || name.length > 60) return { error: 'Please enter the receiver’s name (up to 60 letters).' };
  const phone = malaysianPhone(text(body.phone));
  if (!phone) return { error: 'Please enter a Malaysian phone number, like 012-345 6789.' };
  if (!line1 || line1.length > 100) return { error: 'Please enter the street address (up to 100 letters).' };
  if (line2.length > 100) return { error: 'The second address line is too long (up to 100 letters).' };
  if (!city || city.length > 50) return { error: 'Please enter the city or town.' };
  if (!/^\d{5}$/.test(postcode)) return { error: 'The postcode must be 5 digits.' };
  const state = stateForPostcode(postcode);
  if (!state) return { error: `We don't recognise ${postcode} as a Malaysian postcode. Please check it.` };
  if (!deliversTo(state)) return { error: WEST_ONLY_MESSAGE };
  return { name, phone, line1, line2, city, postcode, state, note };
}

export const addressesRouter = Router();

addressesRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
});

addressesRouter.get('/', async (req, res) => {
  res.json({ addresses: await listOf(req.session.userId!) });
});

const isId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,18}$/.test(v);

// Runs `job` in a transaction that holds this customer's row, so two quick taps can't pass the limit or leave two defaults.
async function locked(userId: string, job: (q: (sql: string, args?: unknown[]) => Promise<Row[]>) => Promise<string | null>): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const problem = await job(async (sql, args) => (await client.query<Row>(sql, args)).rows);
    await client.query(problem ? 'ROLLBACK' : 'COMMIT');
    return problem;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

addressesRouter.post('/', async (req, res) => {
  const userId = req.session.userId!;
  const a = clean(req.body ?? {});
  if ('error' in a) return res.status(400).json({ error: a.error });
  const wantsDefault = req.body?.isDefault === true;
  const problem = await locked(userId, async (q) => {
    const have = await q('SELECT id FROM addresses WHERE user_id = $1', [userId]);
    if (have.length >= MAX_ADDRESSES) return `You can save up to ${MAX_ADDRESSES} addresses. Please delete one first.`;
    const makeDefault = wantsDefault || have.length === 0;
    if (makeDefault) await q('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    await q(
      'INSERT INTO addresses (user_id, name, phone, line1, line2, city, postcode, state, note, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [userId, a.name, a.phone, a.line1, a.line2, a.city, a.postcode, a.state, a.note, makeDefault],
    );
    return null;
  });
  if (problem) return res.status(409).json({ error: problem });
  res.status(201).json({ addresses: await listOf(userId) });
});

// Edits one of a customer's addresses (the customer from the shop, or the admin from the Customers tab).
// Returns null when it worked, otherwise the status and message to send back.
export async function updateAddress(userId: string, addressId: string, body: Record<string, unknown>): Promise<{ status: number; error: string } | null> {
  const a = clean(body);
  if ('error' in a) return { status: 400, error: a.error };
  const wantsDefault = body.isDefault === true;
  const problem = await locked(userId, async (q) => {
    const mine = await q('SELECT id FROM addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
    if (!mine[0]) return 'That address was not found.';
    if (wantsDefault) await q('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    await q(
      `UPDATE addresses SET name = $3, phone = $4, line1 = $5, line2 = $6, city = $7, postcode = $8, state = $9, note = $10, is_default = is_default OR $11
        WHERE id = $1 AND user_id = $2`,
      [addressId, userId, a.name, a.phone, a.line1, a.line2, a.city, a.postcode, a.state, a.note, wantsDefault],
    );
    return null;
  });
  return problem ? { status: 404, error: problem } : null;
}

addressesRouter.put('/:id', async (req, res) => {
  const userId = req.session.userId!;
  if (!isId(req.params.id)) return res.status(404).json({ error: 'That address was not found.' });
  const bad = await updateAddress(userId, req.params.id, req.body ?? {});
  if (bad) return res.status(bad.status).json({ error: bad.error });
  res.json({ addresses: await listOf(userId) });
});

// Deleting the default hands "default" to the oldest address that is left.
addressesRouter.delete('/:id', async (req, res) => {
  const userId = req.session.userId!;
  if (!isId(req.params.id)) return res.status(404).json({ error: 'That address was not found.' });
  await locked(userId, async (q) => {
    await q('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    await q(
      `UPDATE addresses SET is_default = true
        WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at, id LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = $1 AND is_default)`,
      [userId],
    );
    return null;
  });
  res.json({ addresses: await listOf(userId) });
});
