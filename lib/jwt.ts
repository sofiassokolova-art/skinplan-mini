// lib/jwt.ts
// Edge-compatible JWT helpers using jose (replaces jsonwebtoken)

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ISSUER = 'skiniq-admin';
const AUDIENCE = 'skiniq-admin-ui';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export interface AdminTokenPayload extends JWTPayload {
  adminId: string | number;
  role?: string;
  source?: string;
  telegramId?: string;
}

export async function signAdminToken(payload: Omit<AdminTokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<{ valid: boolean; payload?: AdminTokenPayload; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { valid: true, payload: payload as AdminTokenPayload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Invalid token' };
  }
}

// For non-admin tokens (e.g. auth/telegram) without issuer/audience
export async function signToken(payload: JWTPayload, expiresIn = '7d'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ valid: boolean; payload?: JWTPayload; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Invalid token' };
  }
}
