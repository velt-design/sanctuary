import { createStudioAuthoredRequest } from '@/lib/designStudio/createCommand.server';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return createStudioAuthoredRequest(request, (await context.params).projectId);
}
