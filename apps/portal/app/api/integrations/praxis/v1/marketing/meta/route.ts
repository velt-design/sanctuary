import { sanctuaryMetaResponse } from '../../../../../../../lib/marketingIntegrations/meta/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = (request: Request) => sanctuaryMetaResponse(request);
export const DELETE = (request: Request) => sanctuaryMetaResponse(request);
