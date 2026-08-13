import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffSession,
} from '@/lib/api/staffApi';
import {
  isWebsiteAutoresponderPreviewLayout,
  isWebsiteAutoresponderPreviewVariant,
} from '@/lib/sharedEmails';
import {
  getWebsiteAutoresponderPreviewAvailability,
  sendWebsiteAutoresponderPreview,
  WebsiteAutoresponderPreviewError,
} from '@/lib/sharedEmailPreviewSender';
import {
  renderWebsiteAutoresponderPreviewPayload,
} from '@/lib/emailPreviews/websiteAutoresponderPreviewRenderer';

export const runtime = 'nodejs';

function privateNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function previewEnvironmentLabel(): string {
  if (process.env.VERCEL_ENV === 'preview') return 'Vercel Preview';
  if (process.env.VERCEL_ENV === 'production') return 'Vercel Production';
  if (process.env.NODE_ENV === 'development') return 'Local development';
  if (process.env.NODE_ENV === 'test') return 'Automated test';
  return 'Production';
}

function unavailableResponse() {
  return privateNoStore(
    jsonError(
      'Website autoresponder previews are unavailable.',
      404,
      null,
      { code: 'EMAIL_PREVIEW_DISABLED' },
    ),
  );
}

async function requirePreviewStaff() {
  const session = await requireStaffSession();
  if (!session) {
    return {
      ok: false as const,
      response: privateNoStore(jsonError('Unauthorized', 401)),
    };
  }
  const availability = getWebsiteAutoresponderPreviewAvailability();
  if (
    !availability.available
    && availability.reason !== 'environment_not_allowed'
  ) {
    return {
      ok: false as const,
      response: unavailableResponse(),
    };
  }
  return { ok: true as const, availability };
}

export async function GET(req: Request) {
  const access = await requirePreviewStaff();
  if (!access.ok) return access.response;

  const variant =
    new URL(req.url).searchParams.get('variant')
    ?? 'residential-pitched-without-blinds';
  if (!isWebsiteAutoresponderPreviewVariant(variant)) {
    return privateNoStore(
      jsonError('Invalid email preview variant.', 400, null, {
        code: 'EMAIL_PREVIEW_VARIANT_INVALID',
      }),
    );
  }

  let rendered;
  try {
    rendered = await renderWebsiteAutoresponderPreviewPayload(variant);
  } catch {
    return privateNoStore(
      jsonError('Email preview image metadata is unavailable.', 500, null, {
        code: 'EMAIL_PREVIEW_RENDER_INVALID',
      }),
    );
  }

  return privateNoStore(
    jsonOk({
      ...rendered,
      recipient: access.availability.recipient,
      environment: previewEnvironmentLabel(),
      deliveryMode: 'Preview-only Resend · exact fixture · no writes',
      sendReady: access.availability.sendReady,
      configurationReason: access.availability.reason,
    }),
  );
}

export async function POST(req: Request) {
  const access = await requirePreviewStaff();
  if (!access.ok) return access.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok || !parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) {
    return privateNoStore(
      jsonError('Invalid JSON body.', 400, null, {
        code: 'EMAIL_PREVIEW_BODY_INVALID',
      }),
    );
  }

  const keys = Object.keys(parsed.body);
  if (
    (keys.length !== 2 && keys.length !== 3)
    || !keys.includes('variant')
    || !keys.includes('layout')
    || keys.some((key) => !['variant', 'layout', 'clientIntentId'].includes(key))
  ) {
    return privateNoStore(
      jsonError('Only the fixture variant and preview layout may be supplied.', 400, null, {
        code: 'EMAIL_PREVIEW_BODY_INVALID',
      }),
    );
  }
  if (!isWebsiteAutoresponderPreviewVariant(parsed.body.variant)) {
    return privateNoStore(
      jsonError('Invalid email preview variant.', 400, null, {
        code: 'EMAIL_PREVIEW_VARIANT_INVALID',
      }),
    );
  }
  if (!isWebsiteAutoresponderPreviewLayout(parsed.body.layout)) {
    return privateNoStore(
      jsonError('Invalid email preview layout.', 400, null, {
        code: 'EMAIL_PREVIEW_LAYOUT_INVALID',
      }),
    );
  }
  const clientIntentId = parsed.body.clientIntentId;
  if (clientIntentId !== undefined && (
    typeof clientIntentId !== 'string'
    || clientIntentId.trim().length < 8
    || clientIntentId.trim().length > 128
  )) {
    return privateNoStore(
      jsonError('Invalid email preview client intent.', 400, null, {
        code: 'EMAIL_PREVIEW_BODY_INVALID',
      }),
    );
  }
  if (!access.availability.sendReady) {
    return privateNoStore(
      jsonError(
        'Website autoresponder preview sending is not configured.',
        503,
        null,
        {
          code: 'EMAIL_PREVIEW_CONFIGURATION_MISSING',
          configurationReason: access.availability.reason,
        },
      ),
    );
  }

  try {
    const sent = typeof clientIntentId === 'string'
      ? await sendWebsiteAutoresponderPreview(parsed.body.variant, parsed.body.layout, clientIntentId.trim())
      : await sendWebsiteAutoresponderPreview(parsed.body.variant, parsed.body.layout);
    return privateNoStore(
      jsonOk({
        ok: true,
        variant: sent.variant,
        layout: sent.layout,
        recipient: sent.recipient,
        subject: sent.subject,
        customerSubject: sent.customerSubject,
        preheader: sent.preheader,
        providerMessageId: sent.providerMessageId,
      }),
    );
  } catch (error) {
    const code =
      error instanceof WebsiteAutoresponderPreviewError
        ? error.code
        : 'EMAIL_PREVIEW_SEND_FAILED';
    const status =
      code === 'EMAIL_PREVIEW_UNAVAILABLE'
        ? 404
        : code === 'EMAIL_PREVIEW_CONFIGURATION_MISSING'
          ? 503
          : 502;
    return privateNoStore(
      jsonError('Website autoresponder preview sending failed.', status, null, { code }),
    );
  }
}
