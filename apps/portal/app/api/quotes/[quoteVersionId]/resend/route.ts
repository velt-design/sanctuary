import { handleQuoteDeliveryRequest } from '../../_lib/quoteDeliveryRoute';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
) {
  return handleQuoteDeliveryRequest(request, context, 'resend');
}
