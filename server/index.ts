import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool, migrate } from './db';
import { authRouter } from './auth';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set (see .env.example)');
}

await migrate();

const app = express();
// Behind nginx / a reverse proxy on the server, so secure cookies work over HTTPS.
if (isProd) app.set('trust proxy', 1);

app.use(express.json({ limit: '10kb' }));

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

// CSRF guard: state-changing API calls must be JSON. Cross-site HTML forms
// can't send application/json without a CORS preflight, which we never allow.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['content-type'] && !req.is('application/json')) {
    return res.status(415).json({ error: 'Expected application/json' });
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

if (isProd) {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
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
