import { developer, json, sameOrigin } from '@/lib/xero/http';
import { readAccounting } from '@/lib/xero/store';
import { reviewQuery } from '@/lib/xero/review';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!await developer()) return json({ error: 'Forbidden' },403);
  try {
    if (!sameOrigin(request)) return json({ error: 'Forbidden' },403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.kind !== 'string' || typeof body.value !== 'string') return json({ error:'Invalid search' },400);
    const query = reviewQuery(body.kind,body.value);
    const records = await readAccounting(query.resource,query.where);
    return json({ records, checkedAt: new Date().toISOString(), limited: records.length === 20,
      note: 'Candidate records only. No payment or project status has been changed. No result does not prove no payment exists.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_QUERY') return json({ error:'Use an exact invoice number or customer name (3-100 characters).' },400);
    return json({ error:'Read unavailable. Check the connection and try again. No accounting records were changed.' },503);
  }
}
