import { equalSecret } from '@/lib/xero/security';
import { maintainMetaCredentials } from '@/lib/marketingIntegrations/metaCredentials/runtime';
export const runtime = 'nodejs';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return Response.json({ error: 'Unauthorized' }, { status: 403, headers });
  if (new URL(request.url).search || request.body) return Response.json({ error: 'No parameters accepted' }, { status: 400, headers });
  const result = await maintainMetaCredentials(AbortSignal.any([request.signal, AbortSignal.timeout(210000)]));
  return Response.json(result, { headers, status: Object.values(result).includes('review_required') ? 503 : 200 });
}
