import { equalSecret } from '@/lib/xero/security';
import { googleConnectionRuntime } from '@/lib/marketingIntegrations/googleAds/runtime';
export const runtime = 'nodejs';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return Response.json({ error: 'Unauthorized' }, { status: 403, headers });
  const params = new URL(request.url).searchParams, lane = params.get('lane');
  if ([...params.keys()].some(key => key !== 'lane') || params.getAll('lane').length !== 1 || (lane !== 'report' && lane !== 'sales')) return Response.json({ error: 'Invalid lane' }, { status: 400, headers });
  const flag = lane === 'report' ? process.env.SANCTUARY_GOOGLE_ADS_REPORTS_ENABLED : process.env.SANCTUARY_GOOGLE_ADS_UPLOADS_ENABLED;
  if (flag !== 'true') return Response.json({ enabled: false }, { headers });
  try { return Response.json(await googleConnectionRuntime(lane, AbortSignal.any([request.signal, AbortSignal.timeout(210000)])), { headers }); }
  catch { return Response.json({ error: 'Google connection requires review' }, { status: 503, headers }); }
}
