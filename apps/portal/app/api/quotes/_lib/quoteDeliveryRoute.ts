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
  resendQuote,
  sendQuote,
} from '@/lib/quotes/server';

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

type QuoteDeliveryMode = 'send' | 'resend';

type AttachmentUpload = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
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
  const index = trimmed.lastIndexOf('.');
  return index >= 0 ? trimmed.slice(index) : '';
}

function isAllowedUpload(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  return (
    ALLOWED_ATTACHMENT_MIME_TYPES.has(mime) ||
    ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExtension(file.name))
  );
}

async function parseDeliveryPayload(
  request: Request,
): Promise<
  | {
      ok: true;
      body: Record<string, unknown>;
      attachments: AttachmentUpload[];
    }
  | { ok: false; status: number; error: string }
> {
  const contentType = (
    request.headers.get('content-type') ?? ''
  ).toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return { ok: false, status: 400, error: parsed.error };
    }
    return {
      ok: true,
      body: (parsed.body ?? {}) as Record<string, unknown>,
      attachments: [],
    };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, error: 'Invalid multipart form body' };
  }

  const uploads = form
    .getAll('attachments')
    .filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );
  if (uploads.length > MAX_ATTACHMENT_COUNT) {
    return {
      ok: false,
      status: 400,
      error: `A quote email can include at most ${MAX_ATTACHMENT_COUNT} attachments`,
    };
  }

  const attachments: AttachmentUpload[] = [];
  for (const upload of uploads) {
    if (!isAllowedUpload(upload)) {
      return {
        ok: false,
        status: 400,
        error: `Attachment "${upload.name}" must be a PDF, JPG, PNG, or WEBP`,
      };
    }
    if (upload.size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        status: 400,
        error: `Attachment "${upload.name}" must be 4MB or smaller`,
      };
    }
    attachments.push({
      filename:
        upload.name.trim() || `attachment-${attachments.length + 1}.bin`,
      contentType: upload.type.trim() || 'application/octet-stream',
      content: Buffer.from(await upload.arrayBuffer()),
    });
  }

  return {
    ok: true,
    body: {
      to: readFormRecipients(form, 'to'),
      cc: readFormRecipients(form, 'cc'),
      bcc: readFormRecipients(form, 'bcc'),
      subject: readFormText(form, 'subject'),
      personalNote: readFormText(form, 'personalNote'),
      manualNote: readFormText(form, 'manualNote'),
      bodyText: readFormText(form, 'bodyText'),
      bodyHtml: readFormText(form, 'bodyHtml'),
      body: readFormText(form, 'body'),
      intentId: readFormText(form, 'intentId'),
      expectedCommercialRevision: readFormText(
        form,
        'expectedCommercialRevision',
      ),
    },
    attachments,
  };
}

export async function handleQuoteDeliveryRequest(
  request: Request,
  context: { params: Promise<{ quoteVersionId: string }> },
  mode: QuoteDeliveryMode,
): Promise<Response> {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await context.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const parsed = await parseDeliveryPayload(request);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const { body, attachments } = parsed;

  const to = parseRecipients(body.to);
  if (!to.length) return jsonError('Recipient email is required', 400);
  const subject =
    typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject) return jsonError('Subject is required', 400);
  const intentId =
    typeof body.intentId === 'string' ? body.intentId.trim() : '';
  if (!/^[A-Za-z0-9._:/-]{8,128}$/.test(intentId)) {
    return jsonError('A valid delivery intent is required', 400);
  }
  const expectedCommercialRevision = Number(body.expectedCommercialRevision);
  if (
    !Number.isSafeInteger(expectedCommercialRevision) ||
    expectedCommercialRevision < 1
  ) {
    return jsonError('Quote commercial revision is required', 400);
  }

  const personalNote = (() => {
    if (typeof body.personalNote === 'string') return body.personalNote;
    if (typeof body.manualNote === 'string') return body.manualNote;
    if (typeof body.bodyText === 'string') return body.bodyText;
    if (typeof body.body === 'string') return body.body;
    return '';
  })();
  const actor =
    typeof session.user?.email === 'string'
      ? session.user.email.trim()
      : null;
  const deliver = mode === 'send' ? sendQuote : resendQuote;

  try {
    const quoteVersion = await deliver(
      id,
      {
        intentId,
        expectedCommercialRevision,
        to,
        cc: parseRecipients(body.cc),
        bcc: parseRecipients(body.bcc),
        subject,
        personalNote,
        bodyText:
          typeof body.bodyText === 'string' ? body.bodyText : undefined,
        bodyHtml:
          typeof body.bodyHtml === 'string' ? body.bodyHtml : null,
        attachments,
      },
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
        : mode === 'send'
          ? 'Failed to send quote'
          : 'Failed to resend quote';
    if (
      message.includes('changed after this delivery review') ||
      message.includes('superseded') ||
      message.includes('no longer available for delivery') ||
      message.includes('already prepared') ||
      message.includes('prior delivery') ||
      message.includes('needs staff attention')
    ) {
      return jsonError(message, 409);
    }
    return jsonError(message, 500);
  }
}
