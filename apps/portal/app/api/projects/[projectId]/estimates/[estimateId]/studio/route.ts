import { loadStudioAuthoringRequest } from '@/lib/designStudio/authoringRequest.server';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ projectId: string; estimateId: string }> }) {
  return loadStudioAuthoringRequest(request, await context.params);
}
