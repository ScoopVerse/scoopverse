import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import express, { Router } from 'express';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';
import { pool } from './db';

// products/ = the cropped pictures the shop shows (public). originals/ = the full uploaded photos, kept so a
// crop can be redone; they may contain what the admin cropped out on purpose, so they are never served publicly.
const UPLOAD_ROOT = path.resolve('uploads');
export const PRODUCT_DIR = path.join(UPLOAD_ROOT, 'products');
const ORIGINAL_DIR = path.join(UPLOAD_ROOT, 'originals');
const UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
const NOT_FOUND = 'This product no longer exists.';
const NO_PICTURE = 'This picture no longer exists.';

// What kind of listing a product is. Perfumes and scoops have extra details; "other" has none.
const KINDS = ['perfume', 'scoop', 'other'];
type Notes = { top: string[]; heart: string[]; base: string[] };
type PerfumeDetails = { inspiredBy: string; concentration: 'EDP' | 'EDT'; hoursMin: number; hoursMax: number; tagline: string; notes: Notes };
// A scoop listing: the price column is the Live price; offlinePriceCents is the (lower) price for offline orders.
type ScoopDetails = { scoops: number; offlinePriceCents: number; beadsMin: number; beadsMax: number };
type Crop = { x: number; y: number; width: number; height: number }; // percent of the original picture
type ProductRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  image: string | null; // the cover picture (mirrors product_images position 0)
  active: boolean;
  kind: string;
  details: PerfumeDetails | ScoopDetails | null;
  created_at: Date;
};
const COLUMNS = 'id, name, description, price_cents, stock, image, active, kind, details, created_at';
const picUrl = (file: string) => `/uploads/products/${file}`;
const imageUrl = (p: ProductRow) => (p.image ? picUrl(p.image) : null);

type PictureRow = { id: string; product_id: string; image: string; image_original: string | null; image_crop: Crop | null; position: number };
const PIC_COLUMNS = 'id, product_id, image, image_original, image_crop, position';
const MAX_PICTURES = 6;
const pictureView = (x: PictureRow) => ({ id: x.id, url: picUrl(x.image), hasOriginal: x.image_original !== null, crop: x.image_crop });

const adminProduct = (p: ProductRow, pics: PictureRow[]) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  priceCents: p.price_cents,
  stock: p.stock,
  active: p.active,
  imageUrl: imageUrl(p),
  images: pics.map(pictureView),
  kind: p.kind,
  details: p.details,
});

// One product as the admin sees it, with its pictures in order. null when it doesn't exist.
async function adminProductById(id: string) {
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const pics = await pool.query<PictureRow>(`SELECT ${PIC_COLUMNS} FROM product_images WHERE product_id = $1 ORDER BY position, id`, [id]);
  return adminProduct(rows[0], pics.rows);
}

// Keeps products.image equal to the first picture (or null when there are none).
const syncCover = (productId: string) =>
  pool.query('UPDATE products SET image = (SELECT image FROM product_images WHERE product_id = $1 ORDER BY position, id LIMIT 1) WHERE id = $1', [productId]);
// What the public shop sees: no stock count, only whether it can be bought. The list leaves descriptions out
// (the grid doesn't show them); the single-product route includes it.
const publicProduct = (p: ProductRow, withDescription = false) => ({
  id: p.id,
  name: p.name,
  ...(withDescription && { description: p.description }),
  priceCents: p.price_cents,
  inStock: p.stock > 0,
  imageUrl: imageUrl(p),
  kind: p.kind,
  details: p.details,
});

// Descriptions are formatted text (HTML from the editor) shown to every shopper, so only a short allow-list of
// tags survives: a stored description can never carry a script, an event handler, a link or an image.
const FONT_FAMILY_OK = /^[\w\s,"'-]{1,120}$/; // names and commas only: nothing that could close the style or add another
const FONT_SIZE_OK = /^\d{1,3}(\.\d{1,3})?(rem|em|px|%)$/;
const DESCRIPTION_MAX = 10_000; // characters of cleaned HTML

function cleanDescription(html: string) {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'span'],
    allowedAttributes: { span: ['style'] },
    allowedStyles: { span: { 'font-family': [FONT_FAMILY_OK], 'font-size': [FONT_SIZE_OK] } },
  })
    .replace(/(<p><\/p>|<p><br \/><\/p>)+$/, '') // empty lines left at the end by the editor
    .trim();
  // Nothing readable left (e.g. only empty paragraphs): store no description.
  if (!sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim()) return '';
  // The editor always sends blocks; plain text from elsewhere is wrapped so every stored description has one form
  // (the one-time conversion in db.ts looks for exactly that). shortcut: assumes no loose inline tags before a block.
  return /^<(p|ul|ol)[ >]/.test(clean) ? clean : `<p>${clean}</p>`;
}

const removeFile = (dir: string, file: string | null) => (file ? fs.rm(path.join(dir, file), { force: true }) : undefined);

// A crop is { x, y, width, height } in percent of the original, as the admin's crop screen reports it.
function parseCrop(v: any): Crop | null {
  const c = { x: Number(v?.x), y: Number(v?.y), width: Number(v?.width), height: Number(v?.height) };
  const ok =
    Object.values(c).every(Number.isFinite) && c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0 && c.x + c.width <= 100.5 && c.y + c.height <= 100.5;
  return ok ? c : null;
}

// The shop picture: the cropped part (or the whole original), at most 1200 px, as WebP.
async function renderShopImage(original: Buffer, crop: Crop | null) {
  let img = sharp(original);
  if (crop) {
    const { width = 0, height = 0 } = await img.metadata();
    const left = Math.min(Math.max(0, Math.round((crop.x / 100) * width)), width - 1);
    const top = Math.min(Math.max(0, Math.round((crop.y / 100) * height)), height - 1);
    img = img.extract({
      left,
      top,
      width: Math.max(1, Math.min(Math.round((crop.width / 100) * width), width - left)),
      height: Math.max(1, Math.min(Math.round((crop.height / 100) * height), height - top)),
    });
  }
  return img.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}

const newName = () => `${randomBytes(12).toString('hex')}.webp`;

// One line of plain text: any run of whitespace (line breaks included) becomes one space, so it can't break the layout.
const oneLine = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

const NOTES_MAX = 10; // notes per list
const NOTE_MAX_LENGTH = 30;

// Top / heart / base notes, each a list of short names. Missing lists are empty (older callers don't send notes).
function parseNotes(v: any): { value: Notes } | { error: string } {
  const out: Notes = { top: [], heart: [], base: [] };
  for (const key of ['top', 'heart', 'base'] as const) {
    const list = v?.[key] ?? [];
    if (!Array.isArray(list) || list.length > NOTES_MAX) return { error: `Each notes list can have up to ${NOTES_MAX} notes.` };
    const notes = list.map(oneLine).filter(Boolean);
    if (notes.some((n) => n.length > NOTE_MAX_LENGTH)) return { error: `Each note can be up to ${NOTE_MAX_LENGTH} characters.` };
    out[key] = notes;
  }
  return { value: out };
}

function parsePerfume(v: any): { value: PerfumeDetails } | { error: string } {
  const inspiredBy = oneLine(v?.inspiredBy);
  const tagline = oneLine(v?.tagline);
  const { concentration, hoursMin, hoursMax } = v ?? {};
  if (!inspiredBy || inspiredBy.length > 80) return { error: 'Please enter what the perfume is inspired by (max 80 characters).' };
  if (concentration !== 'EDP' && concentration !== 'EDT') return { error: 'Please choose EDP or EDT.' };
  const hoursOk = (h: unknown) => Number.isInteger(h) && (h as number) >= 1 && (h as number) <= 48;
  if (!hoursOk(hoursMin) || !hoursOk(hoursMax) || hoursMin > hoursMax) {
    return { error: 'Lasting time must be whole hours from 1 to 48, with the first number not above the second.' };
  }
  if (tagline.length > 140) return { error: 'The special line is too long (max 140 characters).' };
  const notes = parseNotes(v?.notes);
  if ('error' in notes) return notes;
  return { value: { inspiredBy, concentration, hoursMin, hoursMax, tagline, notes: notes.value } };
}

function parseScoop(v: any, priceCents: unknown): { value: ScoopDetails } | { error: string } {
  const { scoops, offlinePriceCents, beadsMin, beadsMax } = v ?? {};
  const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
  if (!int(scoops, 1, 20)) return { error: 'The number of scoops must be a whole number from 1 to 20.' };
  if (!int(offlinePriceCents, 1, 99_999_999) || !Number.isInteger(priceCents) || offlinePriceCents > (priceCents as number)) {
    return { error: 'The offline price must be above 0 and not higher than the live price.' };
  }
  if (!int(beadsMin, 1, 500) || !int(beadsMax, 1, 500) || beadsMin > beadsMax) {
    return { error: 'Perfumes must be whole numbers from 1 to 500, with the first number not above the second.' };
  }
  return { value: { scoops, offlinePriceCents, beadsMin, beadsMax } };
}

function parseProduct(body: any) {
  const name = String(body?.name ?? '').trim();
  const description = cleanDescription(String(body?.description ?? ''));
  const { priceCents, stock, active } = body ?? {};
  const kind = body?.kind ?? 'other'; // callers that don't send a type get a plain listing
  if (!KINDS.includes(kind)) return { error: 'Please choose a listing type.' };
  let details: PerfumeDetails | ScoopDetails | null = null;
  if (kind === 'perfume' || kind === 'scoop') {
    const p = kind === 'perfume' ? parsePerfume(body?.details) : parseScoop(body?.details, body?.priceCents);
    if ('error' in p) return p;
    details = p.value;
  }
  if (!name || name.length > 120) return { error: 'Please enter a product name (max 120 characters).' };
  if (description.length > DESCRIPTION_MAX) return { error: 'The description is too long. Please shorten it.' };
  if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99_999_999) {
    return { error: 'The price must be between 0.01 and 999,999.99.' };
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return { error: 'Stock must be a whole number from 0 to 1,000,000.' };
  if (typeof active !== 'boolean') return { error: 'Please choose whether the product is visible in the shop.' };
  return { value: { name, description, priceCents: priceCents as number, stock: stock as number, active, kind: kind as string, details } };
}

// --- Admin (mounted under /api/admin/products, after the admin login check) ---

export const productsAdminRouter = Router();
productsAdminRouter.param('id', (_req, res, next, id) => {
  if (!/^\d{1,18}$/.test(String(id))) return res.status(404).json({ error: NOT_FOUND });
  next();
});

productsAdminRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products ORDER BY created_at DESC, id DESC`);
  const pics = await pool.query<PictureRow>(`SELECT ${PIC_COLUMNS} FROM product_images ORDER BY position, id`);
  res.json({ products: rows.map((p) => adminProduct(p, pics.rows.filter((x) => x.product_id === p.id))) });
});

productsAdminRouter.post('/', async (req, res) => {
  const parsed = parseProduct(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const { rows } = await pool.query<ProductRow>(
    `INSERT INTO products (name, description, price_cents, stock, active, kind, details) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
    [v.name, v.description, v.priceCents, v.stock, v.active, v.kind, v.details && JSON.stringify(v.details)],
  );
  res.status(201).json({ product: adminProduct(rows[0], []) });
});

productsAdminRouter.patch('/:id', async (req, res) => {
  const parsed = parseProduct(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const { rows } = await pool.query<ProductRow>(
    `UPDATE products SET name = $2, description = $3, price_cents = $4, stock = $5, active = $6, kind = $7, details = $8
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [req.params.id, v.name, v.description, v.priceCents, v.stock, v.active, v.kind, v.details && JSON.stringify(v.details)],
  );
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product: await adminProductById(req.params.id) });
});

// The one-click "Live now" switch (read by the public shop at GET /api/products/live). Stored so it survives a restart.
productsAdminRouter.put('/live', async (req, res) => {
  if (typeof req.body?.live !== 'boolean') return res.status(400).json({ error: 'Please choose on or off.' });
  await pool.query(`INSERT INTO settings (key, value) VALUES ('live', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [JSON.stringify(req.body.live)]);
  res.json({ live: req.body.live });
});

// The visible/hidden switch changes only that column, so it can never write old stock or price back.
productsAdminRouter.patch('/:id/active', async (req, res) => {
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'Please choose whether the product is visible in the shop.' });
  const { rowCount } = await pool.query('UPDATE products SET active = $2 WHERE id = $1', [req.params.id, req.body.active]);
  if (!rowCount) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product: await adminProductById(req.params.id) });
});

// Pictures. A photo is sent as the raw file (Content-Type: image/*), optionally with ?crop=x,y,width,height (percent of
// the photo). It is decoded, checked and re-saved as WebP under random names, so what was uploaded is never served as-is:
// one private original (max 2400 px) and one public shop picture (the crop, max 1200 px). A listing has up to
// MAX_PICTURES pictures in a set order; the first is the cover.
const tooBig = (err: { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) =>
  err?.type === 'entity.too.large' ? res.status(413).json({ error: 'That image is too big (max 30 MB).' }) : next(err);
const rawPhoto = express.raw({ type: 'image/*', limit: UPLOAD_MAX_BYTES });

productsAdminRouter.param('imageId', (_req, res, next, id) => {
  if (!/^\d{1,18}$/.test(String(id))) return res.status(404).json({ error: NO_PICTURE });
  next();
});

// Turns the uploaded body into the private original and the cropped shop picture. On bad input it sends the error
// reply itself and returns null.
async function readPhoto(req: express.Request, res: express.Response) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: 'Please choose an image (JPG, PNG or WebP).' });
    return null;
  }
  let crop: Crop | null = null;
  if (req.query.crop !== undefined) {
    const [x, y, width, height] = String(req.query.crop).split(',');
    crop = parseCrop({ x, y, width, height });
    if (!crop) {
      res.status(400).json({ error: 'The crop area is not valid.' });
      return null;
    }
  }
  try {
    const img = sharp(req.body, { limitInputPixels: 40_000_000 });
    const { format } = await img.metadata();
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error('unsupported format');
    const original = await img.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    return { crop, original, shop: await renderShopImage(original, crop) };
  } catch {
    res.status(400).json({ error: 'That file is not a valid JPG, PNG or WebP image.' });
    return null;
  }
}

async function storePhoto(p: { original: Buffer; shop: Buffer }) {
  const shopFile = newName();
  const originalFile = newName();
  await fs.mkdir(PRODUCT_DIR, { recursive: true });
  await fs.mkdir(ORIGINAL_DIR, { recursive: true });
  await fs.writeFile(path.join(PRODUCT_DIR, shopFile), p.shop);
  await fs.writeFile(path.join(ORIGINAL_DIR, originalFile), p.original);
  return { shopFile, originalFile };
}
const dropFiles = (shopFile: string | null, originalFile: string | null) =>
  Promise.all([removeFile(PRODUCT_DIR, shopFile), removeFile(ORIGINAL_DIR, originalFile)]);

// Rows are written with the product id as a parameter, so a product deleted mid-upload shows up as a foreign-key error.
const isMissingProduct = (err: unknown) => (err as { code?: string })?.code === '23503';

// Add a picture at the end.
productsAdminRouter.post('/:id/images', rawPhoto, tooBig, async (req, res) => {
  const id = req.params.id;
  const count = await pool.query<{ n: string; found: boolean }>(
    'SELECT (SELECT count(*) FROM product_images WHERE product_id = $1) AS n, EXISTS (SELECT 1 FROM products WHERE id = $1) AS found',
    [id],
  );
  if (!count.rows[0].found) return res.status(404).json({ error: NOT_FOUND });
  if (Number(count.rows[0].n) >= MAX_PICTURES) return res.status(409).json({ error: `A listing can have up to ${MAX_PICTURES} pictures.` });
  const photo = await readPhoto(req, res);
  if (!photo) return;
  const files = await storePhoto(photo);
  try {
    await pool.query(
      `INSERT INTO product_images (product_id, image, image_original, image_crop, position)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT max(position) + 1 FROM product_images WHERE product_id = $1), 0))`,
      [id, files.shopFile, files.originalFile, photo.crop && JSON.stringify(photo.crop)],
    );
    await syncCover(id);
  } catch (err) {
    await dropFiles(files.shopFile, files.originalFile); // nothing points at the new files
    if (isMissingProduct(err)) return res.status(404).json({ error: NOT_FOUND });
    throw err;
  }
  res.status(201).json({ product: await adminProductById(id) });
});

// New order: body { ids: ["picture id", ...] } must list every picture of the product exactly once.
productsAdminRouter.put('/:id/images/order', async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string' && /^\d{1,18}$/.test(x)) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'The picture order is not valid.' });
  }
  const current = await pool.query<{ id: string }>('SELECT id FROM product_images WHERE product_id = $1', [req.params.id]);
  if (current.rows.length !== ids.length || !current.rows.every((r) => ids.includes(r.id))) {
    return res.status(409).json({ error: 'The pictures changed. Please reload and try again.' });
  }
  await pool.query(
    `UPDATE product_images SET position = o.pos
     FROM unnest($2::bigint[]) WITH ORDINALITY AS o(id, pos)
     WHERE product_images.id = o.id AND product_images.product_id = $1`,
    [req.params.id, ids],
  );
  await syncCover(req.params.id);
  const product = await adminProductById(req.params.id);
  if (!product) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product });
});

// Replace one picture's photo (a new upload, with its crop).
productsAdminRouter.put('/:id/images/:imageId', rawPhoto, tooBig, async (req, res) => {
  const existing = await pool.query<{ image: string; image_original: string | null }>(
    'SELECT image, image_original FROM product_images WHERE id = $1 AND product_id = $2',
    [req.params.imageId, req.params.id],
  );
  if (!existing.rows[0]) return res.status(404).json({ error: NO_PICTURE });
  const photo = await readPhoto(req, res);
  if (!photo) return;
  const files = await storePhoto(photo);
  const upd = await pool
    .query('UPDATE product_images SET image = $2, image_original = $3, image_crop = $4 WHERE id = $1', [
      req.params.imageId,
      files.shopFile,
      files.originalFile,
      photo.crop && JSON.stringify(photo.crop),
    ])
    .catch(async (err) => {
      await dropFiles(files.shopFile, files.originalFile);
      throw err;
    });
  if (!upd.rowCount) {
    await dropFiles(files.shopFile, files.originalFile); // deleted while uploading
    return res.status(404).json({ error: NO_PICTURE });
  }
  await syncCover(req.params.id);
  await dropFiles(existing.rows[0].image, existing.rows[0].image_original);
  res.json({ product: await adminProductById(req.params.id) });
});

// Re-crop from the stored original: the new cropped picture replaces the old one (only one is ever kept).
productsAdminRouter.put('/:id/images/:imageId/crop', async (req, res) => {
  const crop = parseCrop(req.body);
  if (!crop) return res.status(400).json({ error: 'The crop area is not valid.' });
  const existing = await pool.query<{ image: string; image_original: string | null }>(
    'SELECT image, image_original FROM product_images WHERE id = $1 AND product_id = $2',
    [req.params.imageId, req.params.id],
  );
  if (!existing.rows[0]) return res.status(404).json({ error: NO_PICTURE });
  if (!existing.rows[0].image_original) {
    return res.status(409).json({ error: 'This picture has no saved original photo. Upload the photo again to crop it.' });
  }

  const shop = await renderShopImage(await fs.readFile(path.join(ORIGINAL_DIR, existing.rows[0].image_original)), crop);
  const shopFile = newName(); // new name, because shop pictures are cached for good
  await fs.writeFile(path.join(PRODUCT_DIR, shopFile), shop);
  const upd = await pool
    .query('UPDATE product_images SET image = $2, image_crop = $3 WHERE id = $1', [req.params.imageId, shopFile, JSON.stringify(crop)])
    .catch(async (err) => {
      await removeFile(PRODUCT_DIR, shopFile);
      throw err;
    });
  if (!upd.rowCount) {
    await removeFile(PRODUCT_DIR, shopFile);
    return res.status(404).json({ error: NO_PICTURE });
  }
  await syncCover(req.params.id);
  await removeFile(PRODUCT_DIR, existing.rows[0].image);
  res.json({ product: await adminProductById(req.params.id) });
});

// Admin only: the full photo, for the crop screen.
productsAdminRouter.get('/:id/images/:imageId/original', async (req, res) => {
  const { rows } = await pool.query<{ image_original: string | null }>('SELECT image_original FROM product_images WHERE id = $1 AND product_id = $2', [
    req.params.imageId,
    req.params.id,
  ]);
  if (!rows[0]?.image_original) return res.status(404).json({ error: 'No original photo saved.' });
  res.sendFile(path.join(ORIGINAL_DIR, rows[0].image_original), { cacheControl: false });
});

productsAdminRouter.delete('/:id/images/:imageId', async (req, res) => {
  const { rows } = await pool.query<{ image: string; image_original: string | null }>(
    'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING image, image_original',
    [req.params.imageId, req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: NO_PICTURE });
  await syncCover(req.params.id);
  await dropFiles(rows[0].image, rows[0].image_original);
  res.json({ product: await adminProductById(req.params.id) });
});

// The files of these products' pictures, read before the products are deleted (the rows go with them).
const pictureFiles = (ids: string[]) =>
  pool.query<{ image: string; image_original: string | null }>('SELECT image, image_original FROM product_images WHERE product_id = ANY($1::bigint[])', [ids]);

// Body { ids: ["1", "2", ...] }: deletes up to BATCH_MAX products and their picture files. Ids that no longer exist are skipped.
const BATCH_MAX = 100;
productsAdminRouter.post('/batch-delete', async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > BATCH_MAX || !ids.every((id) => typeof id === 'string' && /^\d{1,18}$/.test(id))) {
    return res.status(400).json({ error: `Select between 1 and ${BATCH_MAX} products.` });
  }
  const unique = [...new Set(ids)];
  const files = await pictureFiles(unique);
  const { rowCount } = await pool.query('DELETE FROM products WHERE id = ANY($1::bigint[])', [unique]);
  await Promise.all(files.rows.map((r) => dropFiles(r.image, r.image_original)));
  res.json({ deleted: rowCount });
});

productsAdminRouter.delete('/:id', async (req, res) => {
  const files = await pictureFiles([req.params.id]);
  const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: NOT_FOUND });
  await Promise.all(files.rows.map((r) => dropFiles(r.image, r.image_original)));
  res.status(204).end();
});

// --- Public shop (mounted under /api/products) ---

export const productsPublicRouter = Router();

productsPublicRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE active ORDER BY created_at DESC, id DESC`);
  res.json({ products: rows.map((p) => publicProduct(p)) });
});

productsPublicRouter.get('/live', async (_req, res) => {
  const { rows } = await pool.query<{ value: boolean }>(`SELECT value FROM settings WHERE key = 'live'`);
  res.json({ live: rows[0]?.value === true });
});

productsPublicRouter.get('/:id', async (req, res) => {
  if (!/^\d{1,18}$/.test(req.params.id)) return res.status(404).json({ error: NOT_FOUND });
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE id = $1 AND active`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  // All pictures in order (the cover first), for the pop-up's gallery.
  const pics = await pool.query<{ image: string }>('SELECT image FROM product_images WHERE product_id = $1 ORDER BY position, id', [req.params.id]);
  res.json({ product: { ...publicProduct(rows[0], true), images: pics.rows.map((x) => picUrl(x.image)) } });
});
