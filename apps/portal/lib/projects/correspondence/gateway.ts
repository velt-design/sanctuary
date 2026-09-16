import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseStaffCorrespondence, STAFF_CORRESPONDENCE_PATH, STAFF_CORRESPONDENCE_VERSION } from './contract';

export type CorrespondenceGatewayConfig = { origin: string; secret: string };
export function correspondenceGatewayConfig(env: Readonly<Record<string, string | undefined>> = process.env): CorrespondenceGatewayConfig | null {
  if (env.PORTAL_STAFF_CORRESPONDENCE_ENABLED !== 'true') return null;
  const origin = new URL(env.PORTAL_VELT_CORRESPONDENCE_ORIGIN ?? '');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid correspondence destination.');
  }
  const secret = z.string().regex(/^[a-f0-9]{64}$/).parse(env.PORTAL_VELT_CORRESPONDENCE_SECRET);
  return { origin: origin.origin, secret };
}

async function boundedJson(response: Response) {
  if (!response.body || !response.headers.get('content-type')?.startsWith('application/json')) throw new Error('Invalid correspondence response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 262_144) throw new Error('Correspondence response too large.');
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

export async function readStaffCorrespondence(config: CorrespondenceGatewayConfig, input: { actorId: string; projectId: string; analyze?: boolean }, signal: AbortSignal,
  dependencies: { fetcher?: typeof fetch; now?: () => number; nonce?: () => string } = {}) {
  const actorId = z.uuid().parse(input.actorId), projectId = z.uuid().parse(input.projectId);
  const requestId = (dependencies.nonce ?? randomUUID)();
  const now = dependencies.now ?? Date.now;
  const timestamp = String(now());
  const destination = `${config.origin}${STAFF_CORRESPONDENCE_PATH}`;
  const body = JSON.stringify({ schemaVersion: STAFF_CORRESPONDENCE_VERSION, actorId, projectId, ...(input.analyze ? { analyze: true } : {}) });
  const signature = createHmac('sha256', Buffer.from(config.secret, 'hex'))
    .update(['v1', 'POST', destination, timestamp, requestId, body].join('\n')).digest('hex');
  signal.throwIfAborted();
  // Receiver must atomically claim requestId before provider/model work, audit
  // actorId, and preserve connection consent/stop/generation fencing.
  const response = await (dependencies.fetcher ?? fetch)(destination, {
    method: 'POST', cache: 'no-store', redirect: 'error', credentials: 'omit',
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    headers: { 'content-type': 'application/json', 'x-sanctuary-request-id': requestId,
      'x-sanctuary-timestamp': timestamp, 'x-sanctuary-signature': signature }, body,
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Correspondence read unavailable.'); }
  const result = parseStaffCorrespondence(await boundedJson(response), projectId, requestId, now());
  signal.throwIfAborted();
  return result;
}
