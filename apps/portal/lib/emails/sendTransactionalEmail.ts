import 'server-only';

import {
  createResendEmailGateway,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';

const EMAIL_TIMEOUT_MS = 15_000;

type RejectedResendDispatchOutcome = Exclude<ResendDispatchOutcome, { outcome: 'accepted' }>;

let resendGateway: ResendEmailGateway | null = null;
let resendGatewayApiKey: string | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new TransactionalEmailDeliveryError({
    code: 'EMAIL_PROVIDER_CONFIGURATION_MISSING',
    outcome: 'configuration_error',
    statusCode: null,
  });
}

function parseEmailList(value: string | undefined, fallback: string): string[] {
  const source = (value ?? fallback).trim();
  if (!source) return [];
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeEmailLists(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const raw of list ?? []) {
      const email = raw.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(email);
    }
  }

  return out;
}

function getResendGateway(): ResendEmailGateway {
  const apiKey = requiredEnv('RESEND_API_KEY');
  if (!resendGateway || resendGatewayApiKey !== apiKey) {
    try {
      resendGateway = createResendEmailGateway({ apiKey });
      resendGatewayApiKey = apiKey;
    } catch {
      throw new TransactionalEmailDeliveryError({
        code: 'EMAIL_PROVIDER_CONFIGURATION_INVALID',
        outcome: 'configuration_error',
        statusCode: null,
      });
    }
  }
  return resendGateway;
}

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'info@sanctuarypergolas.co.nz';
const DEFAULT_BCC = parseEmailList(process.env.EMAIL_BCC, 'info@sanctuarypergolas.co.nz');

type TransactionalEmailFailure = Readonly<{
  code:
    | RejectedResendDispatchOutcome['code']
    | 'EMAIL_PROVIDER_ADAPTER_FAILED'
    | 'EMAIL_PROVIDER_CONFIGURATION_INVALID'
    | 'EMAIL_PROVIDER_CONFIGURATION_MISSING'
    | 'EMAIL_RECIPIENT_MISSING';
  outcome: RejectedResendDispatchOutcome['outcome'] | 'adapter_error' | 'configuration_error';
  statusCode: number | null;
}>;

export class TransactionalEmailDeliveryError extends Error {
  readonly code: TransactionalEmailFailure['code'];
  readonly outcome: TransactionalEmailFailure['outcome'];
  readonly statusCode: number | null;

  constructor(failure: TransactionalEmailFailure) {
    super(
      failure.code === 'EMAIL_PROVIDER_CONFIGURATION_MISSING'
        ? 'Missing env var: RESEND_API_KEY'
        : failure.code === 'EMAIL_PROVIDER_CONFIGURATION_INVALID'
          ? 'Invalid RESEND_API_KEY configuration'
          : `Transactional email delivery failed (${failure.code}).`,
    );
    this.name = 'TransactionalEmailDeliveryError';
    this.code = failure.code;
    this.outcome = failure.outcome;
    this.statusCode = failure.statusCode;
  }
}

type SendTransactionalEmailArgs = Readonly<{
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}>;

type SendTransactionalEmailResult = Readonly<{
  data: Readonly<{ id: string }>;
  error: null;
  provider: 'resend';
  providerMessageId: string;
}>;

export async function sendTransactionalEmail(
  args: SendTransactionalEmailArgs,
): Promise<SendTransactionalEmailResult> {
  const to = Array.isArray(args.to)
    ? args.to.map((value) => value.trim()).filter(Boolean)
    : [args.to.trim()].filter(Boolean);
  if (!to.length) {
    throw new TransactionalEmailDeliveryError({
      code: 'EMAIL_RECIPIENT_MISSING',
      outcome: 'adapter_error',
      statusCode: null,
    });
  }

  const cc = mergeEmailLists(args.cc);
  const bcc = mergeEmailLists(DEFAULT_BCC, args.bcc);

  let outcome: ResendDispatchOutcome;
  try {
    outcome = await getResendGateway().dispatchLegacy(
      {
        from: EMAIL_FROM,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        replyTo: EMAIL_REPLY_TO,
        subject: args.subject,
        html: args.html,
        ...(args.text !== undefined ? { text: args.text } : {}),
        ...(args.attachments?.length
          ? {
              attachments: args.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
              })),
            }
          : {}),
      },
      {
        timeoutMs: EMAIL_TIMEOUT_MS,
        ...(args.signal ? { signal: args.signal } : {}),
        ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
      },
    );
  } catch (error) {
    if (error instanceof TransactionalEmailDeliveryError) throw error;
    throw new TransactionalEmailDeliveryError({
      code: 'EMAIL_PROVIDER_ADAPTER_FAILED',
      outcome: 'adapter_error',
      statusCode: null,
    });
  }

  if (outcome.outcome !== 'accepted') {
    throw new TransactionalEmailDeliveryError({
      code: outcome.code,
      outcome: outcome.outcome,
      statusCode: outcome.statusCode,
    });
  }

  return {
    data: { id: outcome.messageId },
    error: null,
    provider: outcome.provider,
    providerMessageId: outcome.messageId,
  };
}
