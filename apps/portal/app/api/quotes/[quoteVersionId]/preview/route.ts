import { jsonError, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { previewQuoteEmail } from '@/lib/quotes/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type QuoteEmailMode = 'send' | 'resend';

type QuoteEmailPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  personalNote?: string | null;
  bodyText?: string;
  attachmentNames?: string[];
};

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function parseMode(value: unknown): QuoteEmailMode | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'send' || raw === 'resend') return raw;
  return null;
}

function parsePayload(body: Record<string, unknown>): QuoteEmailPayload {
  return {
    to: parseRecipients(body.to),
    cc: parseRecipients(body.cc),
    bcc: parseRecipients(body.bcc),
    subject: typeof body.subject === 'string' ? body.subject : '',
    personalNote:
      typeof body.personalNote === 'string'
        ? body.personalNote
        : typeof body.bodyText === 'string'
          ? body.bodyText
          : null,
    bodyText: typeof body.bodyText === 'string' ? body.bodyText : undefined,
    attachmentNames: parseRecipients(body.attachmentNames),
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const startedAt = performance.now();
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = (parsed.body ?? {}) as Record<string, unknown>;

  const mode = parseMode(body.mode);
  if (!mode) return jsonError('Invalid mode', 400);

  try {
    const rendered = await previewQuoteEmail(id, parsePayload(body), mode);
    const response = NextResponse.json({
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    response.headers.set(
      'server-timing',
      `total;dur=${(performance.now() - startedAt).toFixed(1)}, previewcache;desc="${rendered.cacheHit ? 'hit' : 'miss'}"`,
    );
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to render quote preview';
    if (msg === 'Quote not found') return jsonError(msg, 404);
    if (msg === 'Quote is locked' || msg === 'Quote must be sent first') return jsonError(msg, 400);
    return jsonError(msg, 500);
  }
}
