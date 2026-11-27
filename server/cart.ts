import { Router, type Request, type Response, type NextFunction } from 'express';
import { pool } from './db';

// The signed-in customer's cart (mounted at /api/cart). Prices are never taken from the browser: every response
// is built from the products table, so a price change shows up in the cart straight away.

const MAX_QTY = 10; // per line; must match the CHECK in cart_items
type Mode = 'live' | 'offline' | 'standard';

type Row = {
  id: string;
  product_id: string;
  mode: Mode;
  quantity: number;
  name: string;
  image: string | null;
  kind: string;
  price_cents: number;
  stock: number;
  active: boolean;
  details: { offlinePriceCents?: number } | null;
};

async function liveOn() {
  const { rows } = await pool.query<{ value: boolean }>(`SELECT value FROM settings WHERE key = 'live'`);
  return rows[0]?.value === true;
}

// The cart as the shop shows it: current prices, and a `problem` on any line that can't be bought as it stands.
async function cartOf(userId: string) {
  const live = await liveOn();
  const { rows } = await pool.query<Row>(
    `SELECT c.id, c.product_id, c.mode, c.quantity, p.name, p.image, p.kind, p.price_cents, p.stock, p.active, p.details
       FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = $1 ORDER BY c.created_at, c.id`,
    [userId],
  );
  // Stock is shared by every line of the same product (a scoop in Live and in Offline both draw on it).
  const wanted = new Map<string, number>();
  for (const r of rows) wanted.set(r.product_id, (wanted.get(r.product_id) ?? 0) + r.quantity);

  const items = rows.map((r) => {
    const unitCents = r.mode === 'offline' ? (r.details?.offlinePriceCents ?? r.price_cents) : r.price_cents;
    let problem: string | null = null;
    if (!r.active) problem = 'No longer available';
    else if (r.stock <= 0) problem = 'Sold out';
    else if (r.mode === 'live' && !live) problem = 'Live ordering is closed';
    else if ((wanted.get(r.product_id) ?? 0) > r.stock) problem = `Only ${r.stock} left`;
    return {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      imageUrl: r.image ? `/uploads/products/${r.image}` : null,
      kind: r.kind,
      mode: r.mode,
      unitCents,
      quantity: r.quantity,
      problem,
    };
  });
  const ok = items.filter((i) => !i.problem);
  return {
    items,
    subtotalCents: ok.reduce((n, i) => n + i.unitCents * i.quantity, 0),
    count: items.reduce((n, i) => n + i.quantity, 0),
    canCheckout: items.length > 0 && ok.length === items.length,
  };
}

export const cartRouter = Router();

cartRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
});

cartRouter.get('/', async (req, res) => {
  res.json(await cartOf(req.session.userId!));
});

const isId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,18}$/.test(v);
const isQty = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_QTY;

// Adds `quantity` (default 1) of a product, or raises the line that is already there.
cartRouter.post('/', async (req, res) => {
  const userId = req.session.userId!;
  const { productId, mode, quantity = 1 } = req.body ?? {};
  if (!isId(productId) || !isQty(quantity)) return res.status(400).json({ error: 'That item could not be added.' });
  const { rows } = await pool.query<{ kind: string; stock: number }>('SELECT kind, stock FROM products WHERE id = $1 AND active', [productId]);
  const product = rows[0];
  if (!product) return res.status(404).json({ error: 'That product is no longer available.' });
  const allowed: Mode[] = product.kind === 'scoop' ? ['live', 'offline'] : ['standard'];
  if (!allowed.includes(mode)) return res.status(400).json({ error: 'Please choose how you want to order this.' });
  if (mode === 'live' && !(await liveOn())) return res.status(409).json({ error: 'Live ordering is closed right now.' });
  if (product.stock <= 0) return res.status(409).json({ error: 'Sorry, this is sold out.' });

  // Check and write in one transaction, locking this customer's row, so two quick taps can't pass the limit together.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const have = await client.query<{ mode: string; quantity: number }>('SELECT mode, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    const total = have.rows.reduce((n, r) => n + r.quantity, 0) + quantity;
    const line = (have.rows.find((r) => r.mode === mode)?.quantity ?? 0) + quantity;
    if (total > product.stock || line > MAX_QTY) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: total > product.stock ? `Only ${product.stock} available.` : `You can order up to ${MAX_QTY} of one item.` });
    }
    await client.query(
      `INSERT INTO cart_items (user_id, product_id, mode, quantity) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, product_id, mode) DO UPDATE SET quantity = cart_items.quantity + $4`,
      [userId, productId, mode, quantity],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json(await cartOf(userId));
});

// Sets one line's quantity.
cartRouter.patch('/:id', async (req, res) => {
  const userId = req.session.userId!;
  const { quantity } = req.body ?? {};
  if (!isId(req.params.id) || !isQty(quantity)) return res.status(400).json({ error: 'That quantity is not valid.' });
  const line = await pool.query<{ product_id: string; stock: number }>(
    'SELECT c.product_id, p.stock FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.id = $1 AND c.user_id = $2',
    [req.params.id, userId],
  );
  if (!line.rows[0]) return res.status(404).json({ error: 'That item is not in your cart.' });
  const others = await pool.query<{ n: string }>(
    'SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE user_id = $1 AND product_id = $2 AND id <> $3',
    [userId, line.rows[0].product_id, req.params.id],
  );
  if (Number(others.rows[0].n) + quantity > line.rows[0].stock) {
    return res.status(409).json({ error: line.rows[0].stock > 0 ? `Only ${line.rows[0].stock} available.` : 'Sorry, this is sold out.' });
  }
  await pool.query('UPDATE cart_items SET quantity = $3 WHERE id = $1 AND user_id = $2', [req.params.id, userId, quantity]);
  res.json(await cartOf(userId));
});

cartRouter.delete('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'That item is not in your cart.' });
  await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.json(await cartOf(req.session.userId!));
});
