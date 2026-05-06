import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { EmailProviderConfigError, resendQuote } from '@/lib/quotes/server';

export const runtime = 'nodejs';

// Capped at ~4 MB to fit under Vercel's 4.5 MB serverless function body limit.
// Keep in sync with QuotesTab.tsx + serverEmail.ts.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

type AttachmentUpload = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function readFormText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function readFormRecipients(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((entry): entry is string => typeof entry === 'string')
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function fileExtension(filename: string): string {
  const trimmed = filename.trim().toLowerCase();
  const idx = trimmed.lastIndexOf('.');
  return idx >= 0 ? trimmed.slice(idx) : '';
}

function isAllowedUpload(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) return true;
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExtension(file.name));
}

async function parseSendPayload(
  req: Request,
): Promise<
  | { ok: true; body: Record<string, unknown>; attachments: AttachmentUpload[] }
  | { ok: false; status: number; error: string }
> {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: 'Invalid multipart form body' };
    }

    const uploads = form.getAll('attachments').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (uploads.length > MAX_ATTACHMENT_COUNT) {
      return { ok: false, status: 400, error: `A quote email can include at most ${MAX_ATTACHMENT_COUNT} attachments` };
    }
    const attachments: AttachmentUpload[] = [];
    for (const upload of uploads) {
      if (!isAllowedUpload(upload)) {
        return { ok: false, status: 400, error: `Attachment "${upload.name}" must be a PDF, JPG, PNG, or WEBP` };
      }
      if (upload.size > MAX_ATTACHMENT_BYTES) {
        return { ok: false, status: 400, error: `Attachment "${upload.name}" must be 4MB or smaller` };
      }
      const filename = upload.name.trim() || `attachment-${attachments.length + 1}.bin`;
      const contentTypeValue = upload.type.trim() || 'application/octet-stream';
      const content = Buffer.from(await upload.arrayBuffer());
      attachments.push({ filename, contentType: contentTypeValue, content });
    }

    const body: Record<string, unknown> = {
      to: readFormRecipients(form, 'to'),
      cc: readFormRecipients(form, 'cc'),
      bcc: readFormRecipients(form, 'bcc'),
      subject: readFormText(form, 'subject'),
      personalNote: readFormText(form, 'personalNote'),
      manualNote: readFormText(form, 'manualNote'),
      bodyText: readFormText(form, 'bodyText'),
      bodyHtml: readFormText(form, 'bodyHtml'),
      body: readFormText(form, 'body'),
    };
    return { ok: true, body, attachments };
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  return { ok: true, body: (parsed.body ?? {}) as Record<string, unknown>, attachments: [] };
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseSendPayload(req);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const { body, attachments } = parsed;

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
        attachments,
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
