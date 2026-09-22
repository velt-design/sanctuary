import { handlePortalAction } from '@/lib/integrations/portalActions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handlePortalAction(request, 'projects'); }
