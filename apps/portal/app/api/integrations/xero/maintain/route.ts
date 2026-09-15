import { equalSecret } from '@/lib/xero/security';
import { json } from '@/lib/xero/http';
import { verifyConnection } from '@/lib/xero/store';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return json({error:'Unauthorized'},401);
  if (process.env.XERO_ENABLED !== 'true') return json({ enabled:false });
  try { await verifyConnection(); return json({ verified:true }); }
  catch { return json({ error:'Connection requires developer attention' },503); }
}
