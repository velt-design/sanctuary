import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  createResendEmailGateway,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';
import {
  getWebsiteAutoresponderPreviewFixture,
  type WebsiteAutoresponderPreviewVariant,
} from '../websiteAutoresponderPreviewFixtures';
import {
  renderWebsiteAutoresponderAlternative,
  type WebsiteAutoresponderPreviewLayout,
} from '../websiteAutoresponderAlternatives';

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const EMAIL_TIMEOUT_MS = 15_000;
const SINGLE_EMAIL_ADDRESS = /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/;

type PreviewEnvironment = Readonly<
  Partial<
    Record<
      | 'NODE_ENV'
      | 'VERCEL_ENV'
      | 'EMAIL_PREVIEW_ENABLED'
      | 'EMAIL_PREVIEW_TO'
      | 'RESEND_API_KEY_PREVIEW',
      string
    >
  >
>;

type WebsiteAutoresponderPreviewAvailability = Readonly<{
  available: boolean;
  sendReady: boolean;
  recipient: string | null;
  reason:
    | 'ready'
    | 'disabled'
    | 'environment_not_allowed'
    | 'missing_api_key'
    | 'missing_recipient'
    | 'invalid_recipient';
}>;

export class WebsiteAutoresponderPreviewError extends Error {
  readonly code:
    | 'EMAIL_PREVIEW_UNAVAILABLE'
    | 'EMAIL_PREVIEW_CONFIGURATION_MISSING'
    | 'EMAIL_PREVIEW_SEND_FAILED';

  constructor(
    code: WebsiteAutoresponderPreviewError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'WebsiteAutoresponderPreviewError';
    this.code = code;
  }
}

function isAllowedPreviewEnvironment(env: PreviewEnvironment): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'preview';
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

export function getWebsiteAutoresponderPreviewAvailability(
  env: PreviewEnvironment = process.env,
): WebsiteAutoresponderPreviewAvailability {
  if (!isAllowedPreviewEnvironment(env)) {
    return {
      available: false,
      sendReady: false,
      recipient: null,
      reason: 'environment_not_allowed',
    };
  }
  if (env.EMAIL_PREVIEW_ENABLED?.trim() !== 'true') {
    return {
      available: false,
      sendReady: false,
      recipient: null,
      reason: 'disabled',
    };
  }

  const recipient = env.EMAIL_PREVIEW_TO?.trim() ?? '';
  if (!recipient) {
    return {
      available: true,
      sendReady: false,
      recipient: null,
      reason: 'missing_recipient',
    };
  }
  if (!SINGLE_EMAIL_ADDRESS.test(recipient)) {
    return {
      available: true,
      sendReady: false,
      recipient: null,
      reason: 'invalid_recipient',
    };
  }
  if (!env.RESEND_API_KEY_PREVIEW?.trim()) {
    return {
      available: true,
      sendReady: false,
      recipient,
      reason: 'missing_api_key',
    };
  }

  return {
    available: true,
    sendReady: true,
    recipient,
    reason: 'ready',
  };
}

let gateway: ResendEmailGateway | null = null;
let gatewayApiKey: string | null = null;

function previewGateway(apiKey: string): ResendEmailGateway {
  if (!gateway || gatewayApiKey !== apiKey) {
    gateway = createResendEmailGateway({ apiKey });
    gatewayApiKey = apiKey;
  }
  return gateway;
}

export async function sendWebsiteAutoresponderPreview(
  variant: WebsiteAutoresponderPreviewVariant,
  layout: WebsiteAutoresponderPreviewLayout,
) {
  const availability = getWebsiteAutoresponderPreviewAvailability();
  if (!availability.available) {
    throw new WebsiteAutoresponderPreviewError(
      'EMAIL_PREVIEW_UNAVAILABLE',
      'Website autoresponder preview sending is unavailable.',
    );
  }
  if (!availability.sendReady || !availability.recipient) {
    throw new WebsiteAutoresponderPreviewError(
      'EMAIL_PREVIEW_CONFIGURATION_MISSING',
      'Website autoresponder preview sending is not configured.',
    );
  }

  const apiKey = process.env.RESEND_API_KEY_PREVIEW!.trim();
  const fixture = getWebsiteAutoresponderPreviewFixture(variant);
  const rendered = await renderWebsiteAutoresponderAlternative(
    fixture.templateId,
    fixture.variables as unknown as Record<string, unknown>,
    layout,
  );

  let outcome: ResendDispatchOutcome;
  try {
    outcome = await previewGateway(apiKey).dispatchLegacy(
      {
        from: FROM,
        to: availability.recipient,
        replyTo: REPLY_TO,
        subject: rendered.sendSubject,
        html: rendered.html,
        text: rendered.text,
      },
      {
        timeoutMs: EMAIL_TIMEOUT_MS,
        idempotencyKey: `website-autoresponder-preview:${variant}:${layout}:${randomUUID()}`,
      },
    );
  } catch {
    throw new WebsiteAutoresponderPreviewError(
      'EMAIL_PREVIEW_SEND_FAILED',
      'Website autoresponder preview sending failed.',
    );
  }

  if (outcome.outcome !== 'accepted') {
    throw new WebsiteAutoresponderPreviewError(
      'EMAIL_PREVIEW_SEND_FAILED',
      'Website autoresponder preview sending failed.',
    );
  }

  return {
    variant,
    layout,
    recipient: availability.recipient,
    subject: rendered.sendSubject,
    customerSubject: rendered.subject,
    preheader: rendered.preheader,
    providerMessageId: outcome.messageId,
  };
}
