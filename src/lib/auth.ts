import * as jose from 'jose';
import bcrypt from 'bcryptjs';

function getJwtSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || 'super-secret-jwt-key-customer-support-bot-123456'
  );
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  name?: string;
}

/**
 * Signs a payload to generate a JWT token using HS256 algorithm.
 */
export async function signJWT(payload: TokenPayload, expiry: string = '7d'): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getJwtSecret());
}

/**
 * Verifies a JWT token and returns the payload. Returns null if invalid or expired.
 */
export async function verifyJWT(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Hashes a plaintext password using bcryptjs.
 */
export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

/**
 * Compares a plaintext password with a bcryptjs hash.
 */
export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
