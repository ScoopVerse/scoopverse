import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

// Argon2id with the library defaults (64 MiB memory, 3 passes, 4 lanes); salt is random per hash.
export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, stored: string) {
  // Accounts created before the switch from scrypt can't log in; they can use "Forgot password?".
  if (!stored.startsWith('$argon2id$')) return false;
  return argon2.verify(stored, password);
}

// Hash of a random password, compared against when the email doesn't exist
// so login takes the same time either way (no account enumeration by timing).
export const dummyHash = hashPassword(randomBytes(16).toString('hex'));
