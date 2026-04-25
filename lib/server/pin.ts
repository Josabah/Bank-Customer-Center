import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PIN_HASH_PREFIX = 'sha256';

function hashWithSalt(pin: string, salt: string) {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

export function createPinHash(pin: string) {
  const salt = randomBytes(16).toString('hex');
  return `${PIN_HASH_PREFIX}:${salt}:${hashWithSalt(pin, salt)}`;
}

export function verifyPin(pin: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split(':');
  if (prefix !== PIN_HASH_PREFIX || !salt || !hash) return false;

  const candidate = Buffer.from(hashWithSalt(pin, salt), 'hex');
  const expected = Buffer.from(hash, 'hex');

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
