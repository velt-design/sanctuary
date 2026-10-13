import { equalSecret } from '@/lib/xero/security';
import { metaSalesRuntime } from '@/lib/marketingIntegrations/metaSales/runtime';
export const runtime = 'nodejs';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return Response.json({ error: 'Unauthorized' }, { status: 403, headers });
  if (new URL(request.url).search || request.body) return Response.json({ error: 'No parameters accepted' }, { status: 400, headers });
  if (process.env.SANCTUARY_META_SALES_ENABLED !== 'true') return Response.json({ enabled: false }, { headers });
  try { return Response.json(await metaSalesRuntime(AbortSignal.any([request.signal, AbortSignal.timeout(210000)])), { headers }); }
  catch { return Response.json({ error: 'Meta sale connection requires review' }, { status: 503, headers }); }
}
