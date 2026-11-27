import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool, migrate } from './db';
import { authRouter } from './auth';
import { adminRouter } from './admin';
import { cartRouter } from './cart';
import { productsPublicRouter, PRODUCT_DIR } from './products';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set (see .env.example)');
}

await migrate();

const app = express();
// Behind nginx / a reverse proxy on the server, so secure cookies work over HTTPS.
if (isProd) app.set('trust proxy', 1);

app.use(express.json({ limit: '64kb' })); // product descriptions are the biggest bodies (up to 10,000 characters of formatted text)

// CSRF guard: state-changing API calls must be JSON. Cross-site HTML forms
// can't send application/json without a CORS preflight, which we never allow.
app.use('/api', (req, res, next) => {
  // image/* is only read by the admin product image upload; cross-site pages can't send it without a CORS preflight.
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['content-type'] && !req.is(['application/json', 'image/*'])) {
    return res.status(415).json({ error: 'Expected application/json' });
  }
  next();
});

// Mounted before the customer session: the admin API has its own session cookie.
app.use('/api/admin', adminRouter);

// Keep the admin page (and the shop, until it launches: remove '/shop' then) out of search engines.
app.use(['/admin', '/shop'], (_req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Product photos: always WebP made by the server, random names, so they can be cached for good.
app.use(
  '/uploads/products',
  express.static(PRODUCT_DIR, {
    index: false,
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }),
);

const PgStore = connectPgSimple(session);
app.use(
  session({
    name: 'sv.sid',
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  }),
);

app.use('/api/auth', authRouter);
app.use('/api/products', productsPublicRouter);
app.use('/api/cart', cartRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

if (isProd) {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  // Vite serves any file under the project folder; keep the private original photos out of that
  // (the list below is Vite's default deny list plus uploads/originals).
  const vite = await createServer({
    server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/uploads/originals/**'] } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

// Express 5 forwards rejected async handlers here.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(port, () => {
  console.log(`ScoopVerse running on http://localhost:${port} (${isProd ? 'production' : 'development'})`);
});
