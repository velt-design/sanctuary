import { handlePortalAction } from '@/lib/integrations/portalActions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return handlePortalAction(request, 'commands'); }
