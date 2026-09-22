import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'spa1_';
const TOKEN_PATTERN = /^spa1_[0-9a-f]{64}$/;

/** Return the secret once at issuance. Only its hash belongs in durable grant storage. */
export function issuePortalActionToken(): { token: string; tokenHash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('hex');
  return { token, tokenHash: hashPortalActionToken(token)! };
}

export function hashPortalActionToken(token: string): string | null {
  if (!TOKEN_PATTERN.test(token)) return null;
  return createHash('sha256').update('sanctuary.portal-actions.v1\0').update(token).digest('hex');
}

export function portalActionBearerHash(authorization: string | null): string | null {
  if (!authorization || authorization.length !== 76 || !authorization.startsWith('Bearer ')) return null;
  return hashPortalActionToken(authorization.slice(7));
}
