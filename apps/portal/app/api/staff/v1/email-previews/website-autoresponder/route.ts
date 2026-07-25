import {
  jsonError,
  jsonOk,
  parseJsonBody,
  requireStaffSession,
} from '@/lib/api/staffApi';
import {
  getWebsiteAutoresponderPreviewFixture,
  isWebsiteAutoresponderPreviewLayout,
  isWebsiteAutoresponderPreviewVariant,
  renderWebsiteAutoresponderAlternative,
  WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS,
} from '@/lib/sharedEmails';
import {
  getWebsiteAutoresponderPreviewAvailability,
  sendWebsiteAutoresponderPreview,
  WebsiteAutoresponderPreviewError,
} from '@/lib/sharedEmailPreviewSender';

export const runtime = 'nodejs';

function privateNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
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
  if (!availability.available) {
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

  const fixture = getWebsiteAutoresponderPreviewFixture(variant);
  const layouts = await Promise.all(
    WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS.map(async (layout) => {
      const [light, dark] = await Promise.all([
        renderWebsiteAutoresponderAlternative(
          fixture.templateId,
          fixture.variables as unknown as Record<string, unknown>,
          layout.id,
          { previewTheme: 'light' },
        ),
        renderWebsiteAutoresponderAlternative(
          fixture.templateId,
          fixture.variables as unknown as Record<string, unknown>,
          layout.id,
          { previewTheme: 'dark' },
        ),
      ]);
      return {
        id: layout.id,
        name: layout.name,
        description: layout.description,
        bestFor: layout.bestFor,
        subject: light.subject,
        sendSubject: light.sendSubject,
        preheader: light.preheader,
        htmlLight: light.html,
        htmlDark: dark.html,
        text: light.text,
      };
    }),
  );

  return privateNoStore(
    jsonOk({
      variant,
      label: fixture.label,
      layouts,
      recipient: access.availability.recipient,
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
    keys.length !== 2
    || !keys.includes('variant')
    || !keys.includes('layout')
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
    const sent = await sendWebsiteAutoresponderPreview(
      parsed.body.variant,
      parsed.body.layout,
    );
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
