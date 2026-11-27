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

type Crop = { x: number; y: number; width: number; height: number }; // percent of the original picture
type ProductRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  image: string | null;
  image_original: string | null;
  image_crop: Crop | null;
  active: boolean;
  created_at: Date;
};
const COLUMNS = 'id, name, description, price_cents, stock, image, image_original, image_crop, active, created_at';
const imageUrl = (p: ProductRow) => (p.image ? `/uploads/products/${p.image}` : null);

const adminProduct = (p: ProductRow) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  priceCents: p.price_cents,
  stock: p.stock,
  active: p.active,
  imageUrl: imageUrl(p),
  hasOriginal: p.image_original !== null,
  crop: p.image_crop,
});
// What the public shop sees: no stock count, only whether it can be bought. The list leaves descriptions out
// (the grid doesn't show them); the single-product route includes it.
const publicProduct = (p: ProductRow, withDescription = false) => ({
  id: p.id,
  name: p.name,
  ...(withDescription && { description: p.description }),
  priceCents: p.price_cents,
  inStock: p.stock > 0,
  imageUrl: imageUrl(p),
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

function parseProduct(body: any) {
  const name = String(body?.name ?? '').trim();
  const description = cleanDescription(String(body?.description ?? ''));
  const { priceCents, stock, active } = body ?? {};
  if (!name || name.length > 120) return { error: 'Please enter a product name (max 120 characters).' };
  if (description.length > DESCRIPTION_MAX) return { error: 'The description is too long. Please shorten it.' };
  if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99_999_999) {
    return { error: 'The price must be between 0.01 and 999,999.99.' };
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return { error: 'Stock must be a whole number from 0 to 1,000,000.' };
  if (typeof active !== 'boolean') return { error: 'Please choose whether the product is visible in the shop.' };
  return { value: { name, description, priceCents: priceCents as number, stock: stock as number, active } };
}

// --- Admin (mounted under /api/admin/products, after the admin login check) ---

export const productsAdminRouter = Router();
productsAdminRouter.param('id', (_req, res, next, id) => {
  if (!/^\d{1,18}$/.test(String(id))) return res.status(404).json({ error: NOT_FOUND });
  next();
});

productsAdminRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products ORDER BY created_at DESC, id DESC`);
  res.json({ products: rows.map(adminProduct) });
});

productsAdminRouter.post('/', async (req, res) => {
  const parsed = parseProduct(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const { rows } = await pool.query<ProductRow>(
    `INSERT INTO products (name, description, price_cents, stock, active) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
    [v.name, v.description, v.priceCents, v.stock, v.active],
  );
  res.status(201).json({ product: adminProduct(rows[0]) });
});

productsAdminRouter.patch('/:id', async (req, res) => {
  const parsed = parseProduct(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const { rows } = await pool.query<ProductRow>(
    `UPDATE products SET name = $2, description = $3, price_cents = $4, stock = $5, active = $6
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [req.params.id, v.name, v.description, v.priceCents, v.stock, v.active],
  );
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product: adminProduct(rows[0]) });
});

// The visible/hidden switch changes only that column, so it can never write old stock or price back.
productsAdminRouter.patch('/:id/active', async (req, res) => {
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'Please choose whether the product is visible in the shop.' });
  const { rows } = await pool.query<ProductRow>(`UPDATE products SET active = $2 WHERE id = $1 RETURNING ${COLUMNS}`, [req.params.id, req.body.active]);
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product: adminProduct(rows[0]) });
});

// The photo is sent as the raw file (Content-Type: image/*), optionally with ?crop=x,y,width,height (percent of the
// photo). It is decoded, checked and re-saved as WebP under random names, so what was uploaded is never served as-is:
// one private original (max 2400 px) and one public shop picture (the crop, max 1200 px).
const tooBig = (err: { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) =>
  err?.type === 'entity.too.large' ? res.status(413).json({ error: 'That image is too big (max 30 MB).' }) : next(err);

productsAdminRouter.put('/:id/image', express.raw({ type: 'image/*', limit: UPLOAD_MAX_BYTES }), tooBig, async (req, res) => {
  const existing = await pool.query<{ image: string | null; image_original: string | null }>(
    'SELECT image, image_original FROM products WHERE id = $1',
    [req.params.id],
  );
  if (!existing.rows[0]) return res.status(404).json({ error: NOT_FOUND });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Please choose an image (JPG, PNG or WebP).' });
  }
  let crop: Crop | null = null;
  if (req.query.crop !== undefined) {
    const [x, y, width, height] = String(req.query.crop).split(',');
    crop = parseCrop({ x, y, width, height });
    if (!crop) return res.status(400).json({ error: 'The crop area is not valid.' });
  }

  let original: Buffer;
  let shop: Buffer;
  try {
    const img = sharp(req.body, { limitInputPixels: 40_000_000 });
    const { format } = await img.metadata();
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error('unsupported format');
    original = await img.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    shop = await renderShopImage(original, crop);
  } catch {
    return res.status(400).json({ error: 'That file is not a valid JPG, PNG or WebP image.' });
  }

  const shopFile = newName();
  const originalFile = newName();
  await fs.mkdir(PRODUCT_DIR, { recursive: true });
  await fs.mkdir(ORIGINAL_DIR, { recursive: true });
  await fs.writeFile(path.join(PRODUCT_DIR, shopFile), shop);
  await fs.writeFile(path.join(ORIGINAL_DIR, originalFile), original);
  const { rows } = await pool
    .query<ProductRow>(`UPDATE products SET image = $2, image_original = $3, image_crop = $4 WHERE id = $1 RETURNING ${COLUMNS}`, [
      req.params.id,
      shopFile,
      originalFile,
      crop && JSON.stringify(crop),
    ])
    .catch(async (err) => {
      // The database refused: don't leave the new files behind with nothing pointing at them.
      await Promise.all([removeFile(PRODUCT_DIR, shopFile), removeFile(ORIGINAL_DIR, originalFile)]);
      throw err;
    });
  if (!rows[0]) {
    // product was deleted while uploading
    await Promise.all([removeFile(PRODUCT_DIR, shopFile), removeFile(ORIGINAL_DIR, originalFile)]);
    return res.status(404).json({ error: NOT_FOUND });
  }
  await Promise.all([removeFile(PRODUCT_DIR, existing.rows[0].image), removeFile(ORIGINAL_DIR, existing.rows[0].image_original)]);
  res.json({ product: adminProduct(rows[0]) });
});

// Re-crop from the stored original: the new cropped picture replaces the old one (only one is ever kept).
productsAdminRouter.put('/:id/crop', async (req, res) => {
  const crop = parseCrop(req.body);
  if (!crop) return res.status(400).json({ error: 'The crop area is not valid.' });
  const existing = await pool.query<{ image: string | null; image_original: string | null }>(
    'SELECT image, image_original FROM products WHERE id = $1',
    [req.params.id],
  );
  if (!existing.rows[0]) return res.status(404).json({ error: NOT_FOUND });
  if (!existing.rows[0].image_original) {
    return res.status(409).json({ error: 'This product has no saved original photo. Upload the photo again to crop it.' });
  }

  const shop = await renderShopImage(await fs.readFile(path.join(ORIGINAL_DIR, existing.rows[0].image_original)), crop);
  const shopFile = newName(); // new name, because shop pictures are cached for good
  await fs.writeFile(path.join(PRODUCT_DIR, shopFile), shop);
  const { rows } = await pool
    .query<ProductRow>(`UPDATE products SET image = $2, image_crop = $3 WHERE id = $1 RETURNING ${COLUMNS}`, [req.params.id, shopFile, JSON.stringify(crop)])
    .catch(async (err) => {
      await removeFile(PRODUCT_DIR, shopFile);
      throw err;
    });
  if (!rows[0]) {
    await removeFile(PRODUCT_DIR, shopFile);
    return res.status(404).json({ error: NOT_FOUND });
  }
  await removeFile(PRODUCT_DIR, existing.rows[0].image);
  res.json({ product: adminProduct(rows[0]) });
});

// Admin only: the full photo, for the crop screen.
productsAdminRouter.get('/:id/original', async (req, res) => {
  const { rows } = await pool.query<{ image_original: string | null }>('SELECT image_original FROM products WHERE id = $1', [req.params.id]);
  if (!rows[0]?.image_original) return res.status(404).json({ error: 'No original photo saved.' });
  res.sendFile(path.join(ORIGINAL_DIR, rows[0].image_original), { cacheControl: false });
});

productsAdminRouter.delete('/:id', async (req, res) => {
  const { rows } = await pool.query<{ image: string | null; image_original: string | null }>(
    'DELETE FROM products WHERE id = $1 RETURNING image, image_original',
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  await Promise.all([removeFile(PRODUCT_DIR, rows[0].image), removeFile(ORIGINAL_DIR, rows[0].image_original)]);
  res.status(204).end();
});

// --- Public shop (mounted under /api/products) ---

export const productsPublicRouter = Router();

productsPublicRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE active ORDER BY created_at DESC, id DESC`);
  res.json({ products: rows.map((p) => publicProduct(p)) });
});

productsPublicRouter.get('/:id', async (req, res) => {
  if (!/^\d{1,18}$/.test(req.params.id)) return res.status(404).json({ error: NOT_FOUND });
  const { rows } = await pool.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE id = $1 AND active`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: NOT_FOUND });
  res.json({ product: publicProduct(rows[0], true) });
});
