import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { EmailProviderConfigError, sendQuote } from '@/lib/quotes/server';

export const runtime = 'nodejs';
const MAX_DESIGN_PDF_BYTES = 20 * 1024 * 1024;

type DesignPdfUpload = {
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

function isPdfUpload(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime === 'application/pdf') return true;
  return file.name.trim().toLowerCase().endsWith('.pdf');
}

async function parseSendPayload(
  req: Request,
): Promise<{ ok: true; body: Record<string, unknown>; designPdf: DesignPdfUpload | null } | { ok: false; status: number; error: string }> {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: 'Invalid multipart form body' };
    }

    const upload = form.get('design_pdf');
    let designPdf: DesignPdfUpload | null = null;
    if (upload instanceof File && upload.size > 0) {
      if (!isPdfUpload(upload)) {
        return { ok: false, status: 400, error: 'Design document must be a PDF' };
      }
      if (upload.size > MAX_DESIGN_PDF_BYTES) {
        return { ok: false, status: 400, error: 'Design document must be 20MB or smaller' };
      }
      const filename = upload.name.trim() || 'design-document.pdf';
      const contentTypeValue = upload.type.trim() || 'application/pdf';
      const content = Buffer.from(await upload.arrayBuffer());
      designPdf = { filename, contentType: contentTypeValue, content };
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
    return { ok: true, body, designPdf };
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  return { ok: true, body: (parsed.body ?? {}) as Record<string, unknown>, designPdf: null };
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseSendPayload(req);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const { body, designPdf } = parsed;

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
    const quoteVersion = await sendQuote(
      id,
      {
        to,
        cc: parseRecipients(body.cc),
        bcc: parseRecipients(body.bcc),
        subject,
        personalNote,
        bodyText: typeof body.bodyText === 'string' ? body.bodyText : undefined,
        bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : null,
        designPdf,
      },
      actor,
    );
    return jsonOk({ quoteVersion });
  } catch (err) {
    if (err instanceof EmailProviderConfigError) {
      return jsonError(err.message, err.status);
    }
    const msg = err instanceof Error ? err.message : 'Failed to send quote';
    return jsonError(msg, 500);
  }
}
