import { z } from 'zod';
import { metaSaleEventSchema, type MetaSaleEvent } from './sales';
export class MetaSaleFailure extends Error {
  constructor(readonly code: string, readonly retryable = false, readonly diagnostics: { httpStatus?: number; providerCode?: number; subcode?: number } = {}) { super(code); }
}
const safeCode = z.number().int().nonnegative().max(2147483647);
/** One frozen event, no redirects, no test_event_code or arbitrary destination. */
export async function sendMetaSale(input: { datasetId: string; token: string; signal: AbortSignal; before: () => Promise<void>; fetcher?: typeof fetch }, event: MetaSaleEvent) {
  if (!/^[1-9]\d{0,19}$/.test(input.datasetId)) throw new MetaSaleFailure('DESTINATION_INVALID');
  metaSaleEventSchema.parse(event);
  await input.before();
  let response: Response;
  try { response = await (input.fetcher ?? fetch)(`https://graph.facebook.com/v26.0/${input.datasetId}/events`, {
    method: 'POST', cache: 'no-store', redirect: 'error', headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(20000)]), body: JSON.stringify({ data: [event] }) }); }
  catch { throw new MetaSaleFailure('TRANSPORT_UNCERTAIN', true); }
  let body: unknown;
  try {
    if (!response.body) throw new Error();
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 32768) throw new Error(); chunks.push(part.value); } } finally { await reader.cancel(); }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new MetaSaleFailure('RESPONSE_UNCONFIRMED', true, { httpStatus: response.status }); }
  const failure = z.object({ error: z.object({ code: safeCode, error_subcode: safeCode.optional(), is_transient: z.boolean().optional() }) }).safeParse(body);
  if (failure.success) {
    const error = failure.data.error;
    throw new MetaSaleFailure('META_REJECTED', error.is_transient === true || [4, 17, 32, 613, 80004].includes(error.code),
      { httpStatus: response.status, providerCode: error.code, ...(error.error_subcode === undefined ? {} : { subcode: error.error_subcode }) });
  }
  if (!response.ok) throw new MetaSaleFailure('HTTP_UNCONFIRMED', response.status === 429 || response.status >= 500, { httpStatus: response.status });
  const result = z.object({ events_received: z.literal(1), fbtrace_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), messages: z.array(z.string().max(4096)).max(100).optional() }).safeParse(body);
  if (!result.success || (body && typeof body === 'object' && 'error' in body)) throw new MetaSaleFailure('RESPONSE_UNCONFIRMED', true);
  return { receiptId: result.data.fbtrace_id, warningCount: result.data.messages?.length ?? 0 };
}
