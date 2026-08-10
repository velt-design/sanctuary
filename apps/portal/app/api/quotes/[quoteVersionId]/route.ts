import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { requireAdminSession } from '@/lib/api/adminApi';
import { deleteDraftQuoteVersion, getQuoteVersionDetail, updateDraftQuoteVersion } from '@/lib/quotes/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function quoteLockedResponse(message = 'Quote is locked') {
  return NextResponse.json({ error: message, code: 'QUOTE_LOCKED' }, { status: 423 });
}

function quoteErrorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  if (message === 'Quote not found') return jsonError(message, 404);
  if (message === 'QUOTE_STALE') {
    return NextResponse.json(
      {
        error:
          'This quote changed on the server. Reload it before saving or sending.',
        code: 'QUOTE_STALE',
      },
      { status: 409 },
    );
  }
  if (message === 'Quote is locked' || message === 'Only drafts can be deleted') return quoteLockedResponse(message);
  return jsonError(message, 500);
}

export async function GET(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const detail = await getQuoteVersionDetail(id);
  if (!detail) return jsonError('Quote not found', 404);
  return jsonOk({ quoteVersion: detail });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const expectedCommercialRevision = Number(body.expectedCommercialRevision);
  if (
    !Number.isSafeInteger(expectedCommercialRevision) ||
    expectedCommercialRevision < 1
  ) {
    return jsonError('Quote commercial revision is required', 400);
  }

  try {
    const updated = await updateDraftQuoteVersion(id, {
      reference: typeof body.reference === 'string' ? body.reference : body.reference === null ? null : undefined,
      introText: typeof body.introText === 'string' ? body.introText : body.introText === null ? null : undefined,
      termsText: typeof body.termsText === 'string' ? body.termsText : body.termsText === null ? null : undefined,
      depositPercent: typeof body.depositPercent === 'number'
        ? body.depositPercent
        : typeof body.depositPercent === 'string'
          ? Number(body.depositPercent)
          : undefined,
      paymentTerms: Array.isArray(body.paymentTerms) ? body.paymentTerms : undefined,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : body.expiresAt === null ? null : undefined,
      lineItems: Array.isArray(body.lineItems) ? body.lineItems : undefined,
      expectedCommercialRevision,
    });
    return jsonOk({ quoteVersion: updated });
  } catch (err) {
    return quoteErrorResponse(err, 'Failed to update quote');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  try {
    await deleteDraftQuoteVersion(id, auth.session.user.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return quoteErrorResponse(err, 'Failed to delete quote');
  }
}
