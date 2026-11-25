import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  userType: 'PLATFORM' | 'SCHOOL';
  schoolId?: string;
  tenantId?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    issuer: 'school-saas-platform',
  });
}

export function signRefreshToken(payload: TokenPayload, family: string): string {
  return jwt.sign({ ...payload, family }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'school-saas-platform',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & { family: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload & { family: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
