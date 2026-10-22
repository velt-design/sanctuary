import 'server-only';
import { createHash } from 'node:crypto';
import type { SharePointConfig } from './config';
import { ProjectFilesError } from './types';

type Token = { value: string; expiresAt: number };
type Entry = { promise: Promise<Token>; token?: Token };
type Bearer = { value: string; invalidate: () => void };
const MAX_ENTRIES = 8;
const EXPIRY_MARGIN_MS = 60_000;
const exchanges = new WeakMap<typeof fetch, Map<string, Entry>>();

function assertionExpiry(assertion: string): number | null {
  try {
    const parts = assertion.split('.');
    if (parts.length !== 3) return null;
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const exp = (payload as { exp?: unknown })?.exp;
    return typeof exp === 'number' && Number.isSafeInteger(exp) && exp > 0 ? exp * 1000 : null;
  } catch { return null; }
}

function waitForCaller<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

/** Reuse only an assertion previously accepted by Entra, never a new assertion's decoded claims. */
export async function graphAccessToken(
  cfg: SharePointConfig,
  assertion: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
  exchange: (signal: AbortSignal) => Promise<Record<string, unknown>>,
): Promise<Bearer> {
  signal.throwIfAborted();
  const assertionExpiresAt = assertionExpiry(assertion);
  const reusable = assertionExpiresAt !== null && assertionExpiresAt - EXPIRY_MARGIN_MS > Date.now();
  const readToken = async (exchangeSignal: AbortSignal): Promise<Token> => {
    const startedAt = Date.now();
    const response = await exchange(exchangeSignal);
    if (typeof response.access_token !== 'string' || !response.access_token || response.token_type !== 'Bearer') throw new ProjectFilesError('source_invalid');
    // Graph tokens are opaque. The token endpoint's expires_in is the supported lifetime.
    const lifetime = response.expires_in;
    const expiresAt = reusable && typeof lifetime === 'number' && Number.isFinite(lifetime) && lifetime > 0 && lifetime <= 86_400
      ? Math.min(startedAt + lifetime * 1000, assertionExpiresAt!) - EXPIRY_MARGIN_MS : 0;
    return { value: response.access_token, expiresAt };
  };
  // Missing/unusable assertion expiry preserves direct exchange behavior without caching.
  if (!reusable) return { value: (await readToken(signal)).value, invalidate: () => undefined };
  let entries = exchanges.get(fetcher);
  if (!entries) { entries = new Map(); exchanges.set(fetcher, entries); }
  const key = JSON.stringify([cfg.tenantId, cfg.clientId, cfg.binding, createHash('sha256').update(assertion).digest('hex')]);
  for (const [id, entry] of entries) if (entry.token && entry.token.expiresAt <= Date.now()) entries.delete(id);
  let entry = entries.get(key);
  if (!entry) {
    while (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    const pending: Entry = { promise: Promise.resolve({ value: '', expiresAt: 0 }) };
    entry = pending;
    // One caller cancelling must not cancel another caller's shared token exchange.
    pending.promise = readToken(AbortSignal.timeout(45_000)).then(token => {
      pending.token = token;
      if (token.expiresAt <= Date.now() && entries.get(key) === pending) entries.delete(key);
      return token;
    }, error => { if (entries.get(key) === pending) entries.delete(key); throw error; });
    entries.set(key, pending);
  }
  const current = entry;
  const token = await waitForCaller(current.promise, signal);
  return { value: token.value, invalidate: () => { if (entries.get(key) === current) entries.delete(key); } };
}
