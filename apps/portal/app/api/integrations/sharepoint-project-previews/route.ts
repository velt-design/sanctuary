import { equalSecret } from '@/lib/xero/security';
import { filesError, filesJson } from '@/lib/projects/sharePointFiles/http';
import { cleanupProjectPreviews, reconcileProjectPreviews } from '@/lib/projects/sharePointFiles/previews/sync';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return filesJson({ error: 'Unauthorized' }, 401);
  if (new URL(request.url).search) return filesJson({ error: 'Invalid request' }, 400);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
  try {
    if (process.env.SANCTUARY_SHAREPOINT_ENABLED !== 'true' || process.env.SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED !== 'true') return filesJson({ enabled: false, removed: await cleanupProjectPreviews(signal) });
    return filesJson(await reconcileProjectPreviews(request.headers.get('x-vercel-oidc-token') ?? '', signal));
  }
  catch (error) { return filesError(error); }
}
