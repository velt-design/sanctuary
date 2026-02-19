import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { EmailProviderConfigError, resendQuote } from '@/lib/quotes/server';

export const runtime = 'nodejs';

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const to = parseRecipients(body.to);
  if (!to.length) return jsonError('Recipient email is required', 400);

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) return jsonError('Subject is required', 400);
  const personalNote = (() => {
    if (typeof body.personalNote === 'string') return body.personalNote;
    if (typeof body.manualNote === 'string') return body.manualNote;
    if (typeof body.bodyText === 'string') return body.bodyText;
    if (typeof body.body === 'string') return body.body;
    return '';
  })();

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const quoteVersion = await resendQuote(
      id,
      {
        to,
        cc: parseRecipients(body.cc),
        bcc: parseRecipients(body.bcc),
        subject,
        personalNote,
        bodyText: typeof body.bodyText === 'string' ? body.bodyText : undefined,
        bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : null,
      },
      actor,
    );
    return jsonOk({ quoteVersion });
  } catch (err) {
    if (err instanceof EmailProviderConfigError) {
      return jsonError(err.message, err.status);
    }
    const msg = err instanceof Error ? err.message : 'Failed to resend quote';
    return jsonError(msg, 500);
  }
}
