import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { ReportQuery } from './report/report';

export function ga4Delegation(request: Request, query: ReportQuery, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const value = z.object({ operation: z.uuid(), binding: z.string().regex(/^[a-f0-9]{64}$/), query: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse({
    operation: request.headers.get('x-velt-ga4-operation'), binding: request.headers.get('x-velt-ga4-binding'), query: request.headers.get('x-velt-ga4-query'),
  });
  const key = z.string().min(43).max(256).parse(process.env.SANCTUARY_GA4_VELT_AUTHORITY_KEY);
  const signature = createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
  const supplied = z.string().regex(/^[a-f0-9]{64}$/).parse(request.headers.get('x-velt-ga4-proof'));
  const expected = createHash('sha256').update(JSON.stringify({ kind: 'marketing/ga4', action: 'refresh', query, retain: true })).digest('hex');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(supplied)) || value.query !== expected) throw new Error('Delegation unavailable.');
  return async () => {
    signal.throwIfAborted();
    const response = await fetcher('https://velt.systems/api/connections/sanctuary-ga4/authority', {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      headers: { 'content-type': 'application/json', 'x-velt-ga4-proof': signature }, body: JSON.stringify(value),
    });
    await response.body?.cancel();
    if (response.status !== 204) throw new Error('Delegation revoked.');
  };
}
