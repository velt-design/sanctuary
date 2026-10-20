import { saveStudioAuthoredRequest } from '@/lib/designStudio/saveCommand.server';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ estimateId: string }> }) {
  return saveStudioAuthoredRequest(request, (await context.params).estimateId);
}
