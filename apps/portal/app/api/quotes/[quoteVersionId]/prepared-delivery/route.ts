import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffSession,
} from '@/lib/api/staffApi';
import {
  COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE,
  isCommercialWorkflowSchemaNotReadyError,
} from '@/lib/commercial/emailIntent';
import {
  EmailProviderConfigError,
  getPreparedQuoteDelivery,
  retryPreparedQuoteDelivery,
} from '@/lib/quotes/server';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ quoteVersionId: string }>;
};

function deliveryMode(request: Request): 'send' | 'resend' | null {
  const mode = new URL(request.url).searchParams.get('mode') ?? 'send';
  return mode === 'send' || mode === 'resend' ? mode : null;
}

async function routeIdentity(
  request: Request,
  context: RouteContext,
): Promise<
  | {
      session: Awaited<ReturnType<typeof requireStaffSession>>;
      quoteVersionId: string;
      mode: 'send' | 'resend';
    }
  | Response
> {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);
  const { quoteVersionId } = await context.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);
  const mode = deliveryMode(request);
  if (!mode) return jsonError('Invalid delivery mode', 400);
  return { session, quoteVersionId: id, mode };
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const identity = await routeIdentity(request, context);
  if (identity instanceof Response) return identity;
  try {
    const delivery = await getPreparedQuoteDelivery(
      identity.quoteVersionId,
      identity.mode,
    );
    if (!delivery) return jsonError('No prepared delivery found', 404);
    return jsonOk({ delivery });
  } catch (error) {
    if (isCommercialWorkflowSchemaNotReadyError(error)) {
      return jsonError(error.message, 503, null, {
        code: COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE,
      });
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load prepared quote delivery';
    return jsonError(message, 500);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const identity = await routeIdentity(request, context);
  if (identity instanceof Response) return identity;
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const expectedCommercialRevision = Number(
    (parsed.body as Record<string, unknown>)?.expectedCommercialRevision,
  );
  if (
    !Number.isSafeInteger(expectedCommercialRevision) ||
    expectedCommercialRevision < 1
  ) {
    return jsonError('Quote commercial revision is required', 400);
  }
  const actor =
    typeof identity.session?.user?.email === 'string'
      ? identity.session.user.email.trim()
      : null;
  try {
    const quoteVersion = await retryPreparedQuoteDelivery(
      identity.quoteVersionId,
      identity.mode,
      expectedCommercialRevision,
      actor,
    );
    return jsonOk({ quoteVersion });
  } catch (error) {
    if (error instanceof EmailProviderConfigError) {
      return jsonError(error.message, error.status);
    }
    if (isCommercialWorkflowSchemaNotReadyError(error)) {
      return jsonError(error.message, 503, null, {
        code: COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE,
      });
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retry prepared quote delivery';
    const status =
      message.includes('changed after') ||
      message.includes('needs staff attention') ||
      message.includes('No prepared delivery')
        ? 409
        : 500;
    return jsonError(message, status);
  }
}
