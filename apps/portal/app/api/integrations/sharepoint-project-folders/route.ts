import { equalSecret } from '@/lib/xero/security';
import { filesError, filesJson } from '@/lib/projects/sharePointFiles/http';
import { provisionProjectFolder } from '@/lib/projects/sharePointFiles/provision';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return filesJson({ error: 'Unauthorized' }, 401);
  if (new URL(request.url).search) return filesJson({ error: 'Invalid request' }, 400);
  if (process.env.SANCTUARY_SHAREPOINT_ENABLED !== 'true' || process.env.SANCTUARY_SHAREPOINT_PROVISION_ENABLED !== 'true') return filesJson({ enabled: false });
  try { return filesJson(await provisionProjectFolder(request.headers.get('x-vercel-oidc-token') ?? '')); }
  catch (error) { return filesError(error); }
}
