import { reviewStudioSavedRequest } from '@/lib/designStudio/reviewRequest.server';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ projectId: string; estimateId: string }> }) {
  return reviewStudioSavedRequest(request, await context.params);
}
