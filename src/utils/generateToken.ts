import jwt, { SignOptions } from 'jsonwebtoken';

// Sprint 1 / BUG-B-001: Hard-fail if JWT_SECRET is missing.
// Never sign tokens with a literal fallback — that would let anyone forge admin tokens.
// Sprint 6 / BUG-B-028: expiry now configurable via JWT_EXPIRES_IN env var
// (defaults to '7d'). Accept the standard zeit/ms style strings (`30m`, `12h`,
// `7d`) plus raw numbers in seconds.
const generateToken = (id: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'JWT_SECRET is missing or too short (must be ≥16 chars). Refusing to issue token.'
    );
  }
  const raw = process.env.JWT_EXPIRES_IN || '7d';
  // Numeric? treat as seconds.
  const expiresIn: SignOptions['expiresIn'] = /^\d+$/.test(raw)
    ? Number(raw)
    : (raw as SignOptions['expiresIn']);
  return jwt.sign({ id }, secret, { expiresIn });
};

export default generateToken;
