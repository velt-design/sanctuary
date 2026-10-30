import { prepareStudioQuoteRequest } from '@/lib/designStudio/quotePrepare.server';
export async function POST(request: Request, context: { params: Promise<{ projectId: string; estimateId: string }> }) {
  return prepareStudioQuoteRequest(request, await context.params);
}
