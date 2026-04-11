const crypto = require('crypto');

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a plaintext password → "salt:hash"
 */
function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plaintext, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify plaintext against stored "salt:hash"
 */
function verifyPassword(plaintext, stored) {
  // Support legacy plaintext passwords during migration
  if (!stored.includes(':')) return plaintext === stored;
  const [salt, hash] = stored.split(':');
  const derived = crypto.pbkdf2Sync(plaintext, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
}

module.exports = { hashPassword, verifyPassword };
