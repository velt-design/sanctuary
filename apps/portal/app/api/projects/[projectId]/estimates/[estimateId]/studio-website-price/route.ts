import { studioWebsitePriceRequest } from '@/lib/designStudio/websitePriceRequest.server';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ projectId: string; estimateId: string }> }) { return studioWebsitePriceRequest(request, await context.params); }
