import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (see .env.example)');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Idempotent schema setup, run once at startup.
// The "session" table is created by connect-pg-simple (createTableIfMissing).
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT NOT NULL,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

    -- Only the SHA-256 of each token is stored; the raw token lives only in the email link.
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens (user_id);

    -- Password reset links: same scheme as verification (only the SHA-256 is stored).
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);

    -- Email-sending limits (see server/emailQuota.ts). "day" is the Singapore calendar day.
    CREATE TABLE IF NOT EXISTS email_quota_ip (
      ip    TEXT PRIMARY KEY,
      day   DATE NOT NULL,
      count INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS email_quota_address (
      email        TEXT PRIMARY KEY, -- lower-cased
      day          DATE NOT NULL,
      resends      INT NOT NULL DEFAULT 0,
      last_sent_at TIMESTAMPTZ
    );

    -- Admin accounts, separate from customers. Created only from the terminal (server/admin-cli.ts).
    CREATE TABLE IF NOT EXISTS admins (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT NOT NULL,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS admins_email_lower_idx ON admins (lower(email));

    -- Prices are whole cents (SGD). "image" is a file name inside uploads/products/.
    CREATE TABLE IF NOT EXISTS products (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INT NOT NULL CHECK (price_cents > 0),
      stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
      image       TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- The full uploaded photo (file name in uploads/originals/, never public) and the crop applied to it, in percent.
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_original TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_crop JSONB;
    -- Listing type: perfume (bottle), scoop (not built yet) or other. "details" holds the type's extra fields as JSON.
    ALTER TABLE products ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('perfume', 'scoop', 'other'));
    ALTER TABLE products ADD COLUMN IF NOT EXISTS details JSONB;
    -- Descriptions used to be plain text; they are now formatted text (HTML). Convert the old ones once:
    -- escape what HTML treats specially, drop carriage returns, turn line breaks into <br>.
    UPDATE products SET description = '<p>' || replace(replace(replace(replace(replace(trim(description),
        '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), chr(13), ''), chr(10), '<br>') || '</p>'
      WHERE description <> '' AND description !~ '^<(p|ul|ol)[ >]';
  `);
}
