import 'server-only';

import {
  createResendEmailGateway,
  type EmailMessageInput,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';

const EMAIL_TIMEOUT_MS = 15_000;

type RejectedResendDispatchOutcome = Exclude<ResendDispatchOutcome, { outcome: 'accepted' }>;

let resendGateway: ResendEmailGateway | null = null;
let resendGatewayApiKey: string | null = null;

type EmailDeliveryFailureSummary = Readonly<{
  code:
    | RejectedResendDispatchOutcome['code']
    | 'EMAIL_DELIVERY_UNEXPECTED'
    | 'EMAIL_PROVIDER_ADAPTER_FAILED'
    | 'EMAIL_PROVIDER_CONFIGURATION_INVALID'
    | 'EMAIL_PROVIDER_CONFIGURATION_MISSING';
  outcome: RejectedResendDispatchOutcome['outcome'] | 'adapter_error' | 'configuration_error';
  statusCode: number | null;
}>;

export class EmailDeliveryError extends Error {
  readonly code: EmailDeliveryFailureSummary['code'];
  readonly outcome: EmailDeliveryFailureSummary['outcome'];
  readonly statusCode: number | null;

  constructor(failure: EmailDeliveryFailureSummary) {
    super(`Email delivery failed (${failure.code}).`);
    this.name = 'EmailDeliveryError';
    this.code = failure.code;
    this.outcome = failure.outcome;
    this.statusCode = failure.statusCode;
  }
}

function getResendGateway(): ResendEmailGateway {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new EmailDeliveryError({
      code: 'EMAIL_PROVIDER_CONFIGURATION_MISSING',
      outcome: 'configuration_error',
      statusCode: null,
    });
  }
  if (!resendGateway || resendGatewayApiKey !== apiKey) {
    try {
      resendGateway = createResendEmailGateway({ apiKey });
      resendGatewayApiKey = apiKey;
    } catch {
      throw new EmailDeliveryError({
        code: 'EMAIL_PROVIDER_CONFIGURATION_INVALID',
        outcome: 'configuration_error',
        statusCode: null,
      });
    }
  }
  return resendGateway;
}

export function getEmailDeliveryFailureSummary(error: unknown): EmailDeliveryFailureSummary {
  if (error instanceof EmailDeliveryError) {
    return {
      code: error.code,
      outcome: error.outcome,
      statusCode: error.statusCode,
    };
  }
  return {
    code: 'EMAIL_DELIVERY_UNEXPECTED',
    outcome: 'adapter_error',
    statusCode: null,
  };
}

type SendEmailArgs = EmailMessageInput &
  Readonly<{
    idempotencyKey?: string;
    signal?: AbortSignal;
  }>;

type SendEmailResult = Readonly<{
  provider: 'resend';
  providerMessageId: string;
}>;

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const { idempotencyKey, signal, ...message } = args;
  let outcome: ResendDispatchOutcome;
  try {
    outcome = await getResendGateway().dispatchLegacy(message, {
      timeoutMs: EMAIL_TIMEOUT_MS,
      ...(signal ? { signal } : {}),
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    throw new EmailDeliveryError({
      code: 'EMAIL_PROVIDER_ADAPTER_FAILED',
      outcome: 'adapter_error',
      statusCode: null,
    });
  }

  if (outcome.outcome !== 'accepted') {
    throw new EmailDeliveryError({
      code: outcome.code,
      outcome: outcome.outcome,
      statusCode: outcome.statusCode,
    });
  }

  return {
    provider: outcome.provider,
    providerMessageId: outcome.messageId,
  };
}
