import crypto from 'node:crypto';

export function generateAcceptToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashAcceptToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

