import { RESEND_API_ENDPOINT } from './contracts';

const API_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAILBOX = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const MESSAGE_ID = /^<[^<>\s@]+@[^<>\s@]+>$/;
const MAX_BYTES = 262_144;

export type SentEmailIdentityResult =
  | { state: 'verified'; providerMessageId: string; internetMessageId: string }
  | { state: 'unavailable'; reason: 'invalid_input' | 'denied' | 'not_found' | 'rate_limited' | 'provider_error' | 'invalid_response' | 'aborted' };

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Missing response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BYTES) throw new Error('Response limit.');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/** Server-only evidence read. Caller must resolve ID/recipients from an authorized project send log.
 * Returns no message body, headers, recipient list or provider error text. Never sends or retries.
 */
export function createResendSentEmailReader(config: { apiKey: string; fetch?: typeof fetch; timeoutMs?: number }) {
  const timeoutMs = config.timeoutMs ?? 5_000;
  if (!config.apiKey.trim() || /[\r\n]/.test(config.apiKey) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new Error('Invalid sent-email reader configuration.');
  }
  const fetcher = config.fetch ?? fetch;
  return async (input: { providerMessageId: string; expectedRecipients: readonly string[] }, signal?: AbortSignal): Promise<SentEmailIdentityResult> => {
    const unavailable = (reason: Extract<SentEmailIdentityResult, { state: 'unavailable' }>['reason']): SentEmailIdentityResult => ({ state: 'unavailable', reason });
    if (!API_ID.test(input.providerMessageId) || input.expectedRecipients.length < 1 || input.expectedRecipients.length > 100
      || input.expectedRecipients.some(value => value.length > 254 || !MAILBOX.test(value))) return unavailable('invalid_input');
    const expected = [...new Set(input.expectedRecipients.map(value => value.toLowerCase()))].sort();
    const boundedSignal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    try {
      boundedSignal.throwIfAborted();
      const response = await fetcher(`${RESEND_API_ENDPOINT}/${input.providerMessageId}`, {
        method: 'GET', headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
        redirect: 'error', cache: 'no-store', signal: boundedSignal,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return unavailable(response.status === 401 || response.status === 403 ? 'denied'
          : response.status === 404 ? 'not_found' : response.status === 429 ? 'rate_limited' : 'provider_error');
      }
      let value: unknown;
      try { value = await readBoundedJson(response); } catch { return unavailable(boundedSignal.aborted ? 'aborted' : 'invalid_response'); }
      boundedSignal.throwIfAborted();
      if (!value || typeof value !== 'object') return unavailable('invalid_response');
      const record = value as Record<string, unknown>;
      if (record.object !== 'email' || record.id !== input.providerMessageId
        || typeof record.message_id !== 'string' || record.message_id.length > 998
        || !/^[\x21-\x7e]+$/.test(record.message_id) || !MESSAGE_ID.test(record.message_id)
        || !Array.isArray(record.to) || record.to.length > 100
        || record.to.some(item => typeof item !== 'string' || item.length > 254 || !MAILBOX.test(item))) return unavailable('invalid_response');
      const actual = [...new Set((record.to as string[]).map(value => value.toLowerCase()))].sort();
      if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) return unavailable('invalid_response');
      return { state: 'verified', providerMessageId: input.providerMessageId, internetMessageId: record.message_id };
    } catch { return unavailable(boundedSignal.aborted ? 'aborted' : 'provider_error'); }
  };
}
