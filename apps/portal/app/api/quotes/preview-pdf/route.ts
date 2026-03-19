import { jsonError, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { generateQuotePdfBytes } from '@/lib/quotes/pdf';
import type { QuoteVersionDetail } from '@/lib/quotes/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isQuoteVersionDetail(value: unknown): value is QuoteVersionDetail {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.quoteRef === 'string' &&
    typeof record.projectId === 'string' &&
    Array.isArray(record.lineItems) &&
    !!record.contact &&
    !!record.project
  );
}

export async function POST(req: Request) {
  const startedAt = performance.now();
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};
  const quoteVersion = (body as { quoteVersion?: unknown }).quoteVersion;
  if (!isQuoteVersionDetail(quoteVersion)) {
    return jsonError('quoteVersion is required', 400);
  }

  try {
    const bytes = await generateQuotePdfBytes(quoteVersion);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/pdf',
        'server-timing': `total;dur=${(performance.now() - startedAt).toFixed(1)}`,
        'x-frame-options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render quote preview';
    return jsonError(message, 500);
  }
}
