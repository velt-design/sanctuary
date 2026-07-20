import type {
  EmailAttachmentInput,
  EmailMessageInput,
  NormalizedEmailAttachment,
  NormalizedEmailMessage,
  NormalizedEmailTag,
} from './contracts';

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const EMAIL_LIKE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const DISPLAY_EMAIL_LIKE = /^.{1,128}\s<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/;
const MEDIA_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EFFECT_REF = /^[0-9a-f]{64}$/;

export type EmailProviderContractErrorCode =
  | 'EMAIL_ADDRESS_INVALID'
  | 'EMAIL_ATTACHMENT_INVALID'
  | 'EMAIL_BODY_MISSING'
  | 'EMAIL_FIELD_INVALID'
  | 'EMAIL_RECIPIENT_MISSING';

export class EmailProviderContractError extends Error {
  readonly code: EmailProviderContractErrorCode;

  constructor(code: EmailProviderContractErrorCode) {
    super(code);
    this.name = 'EmailProviderContractError';
    this.code = code;
  }
}

function contractError(code: EmailProviderContractErrorCode): never {
  throw new EmailProviderContractError(code);
}

function normalizedString(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') contractError('EMAIL_FIELD_INVALID');
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || CONTROL_CHARACTER.test(normalized)) {
    contractError('EMAIL_FIELD_INVALID');
  }
  return normalized;
}

function normalizedAddress(value: unknown): string {
  const normalized = normalizedString(value, 320);
  if (!EMAIL_LIKE.test(normalized) && !DISPLAY_EMAIL_LIKE.test(normalized)) {
    contractError('EMAIL_ADDRESS_INVALID');
  }
  return normalized;
}

function normalizedAddresses(
  value: string | readonly string[] | undefined,
  required: boolean,
): readonly string[] | readonly [string, ...string[]] | undefined {
  if (value === undefined) {
    if (required) contractError('EMAIL_RECIPIENT_MISSING');
    return undefined;
  }
  const source = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(source)) contractError('EMAIL_FIELD_INVALID');
  const addresses = source.map(normalizedAddress);
  if (addresses.length === 0) {
    if (required) contractError('EMAIL_RECIPIENT_MISSING');
    return undefined;
  }
  return Object.freeze(addresses);
}

function normalizeBase64(value: string): string {
  if (!value || value.length % 4 !== 0 || !BASE64.test(value)) {
    contractError('EMAIL_ATTACHMENT_INVALID');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== value) {
    contractError('EMAIL_ATTACHMENT_INVALID');
  }
  return value;
}

function normalizeAttachment(
  attachment: EmailAttachmentInput | NormalizedEmailAttachment,
): NormalizedEmailAttachment {
  if (!attachment || typeof attachment !== 'object') contractError('EMAIL_ATTACHMENT_INVALID');
  const filename = normalizedString(attachment.filename, 255);
  const rawContent = 'contentBase64' in attachment ? attachment.contentBase64 : attachment.content;
  let contentBase64: string;
  if (typeof rawContent === 'string') {
    contentBase64 = normalizeBase64(rawContent);
  } else if (rawContent instanceof Uint8Array && rawContent.byteLength > 0) {
    contentBase64 = Buffer.from(rawContent).toString('base64');
  } else {
    contractError('EMAIL_ATTACHMENT_INVALID');
  }

  const rawContentType = attachment.contentType;
  let contentType: string | undefined;
  if (rawContentType !== undefined) {
    contentType = normalizedString(rawContentType, 255).toLowerCase();
    if (!MEDIA_TYPE.test(contentType)) contractError('EMAIL_ATTACHMENT_INVALID');
  }

  return Object.freeze({
    filename,
    contentBase64,
    ...(contentType ? { contentType } : {}),
  });
}

function optionalBody(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') contractError('EMAIL_FIELD_INVALID');
  return value;
}

export function normalizeEmailMessage(
  input: EmailMessageInput | NormalizedEmailMessage,
): NormalizedEmailMessage {
  if (!input || typeof input !== 'object') contractError('EMAIL_FIELD_INVALID');

  const from = normalizedAddress(input.from);
  const to = normalizedAddresses(input.to, true) as readonly [string, ...string[]];
  const cc = normalizedAddresses(input.cc, false);
  const bcc = normalizedAddresses(input.bcc, false);
  const replyTo = normalizedAddresses(input.replyTo, false);
  const subject = normalizedString(input.subject, 998);
  const html = optionalBody(input.html);
  const text = optionalBody(input.text);
  if ((html === undefined || html.length === 0) && (text === undefined || text.length === 0)) {
    contractError('EMAIL_BODY_MISSING');
  }

  const rawAttachments = input.attachments;
  const attachments = rawAttachments?.length
    ? Object.freeze(rawAttachments.map((attachment) => normalizeAttachment(attachment)))
    : undefined;

  return Object.freeze({
    from,
    to,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject,
    ...(html !== undefined ? { html } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(attachments ? { attachments } : {}),
  });
}

export function freezeTags(tags: readonly NormalizedEmailTag[]): readonly [NormalizedEmailTag, NormalizedEmailTag] {
  if (
    tags.length !== 2 ||
    tags[0]?.name !== 'job_id' ||
    !UUID.test(tags[0].value) ||
    tags[1]?.name !== 'effect_ref' ||
    !EFFECT_REF.test(tags[1].value)
  ) {
    contractError('EMAIL_FIELD_INVALID');
  }
  return Object.freeze([
    Object.freeze({ name: 'job_id', value: tags[0].value }),
    Object.freeze({ name: 'effect_ref', value: tags[1].value }),
  ]);
}
