import {
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/api/staffApi';
import {
  isWebsiteAutoresponderPreviewLayout,
  isWebsiteAutoresponderPreviewVariant,
} from '@/lib/sharedEmails';
import {
  renderWebsiteAutoresponderPreviewPayload,
} from '@/lib/emailPreviews/websiteAutoresponderPreviewRenderer';

export const runtime = 'nodejs';

const QA_RECIPIENT = 'jordan@sanctuarypergolas.co.nz';

function privateNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function fixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

function unavailable() {
  return privateNoStore(
    jsonError('Email preview QA fixture is unavailable.', 404, null, {
      code: 'EMAIL_PREVIEW_QA_DISABLED',
    }),
  );
}

export async function GET(req: Request) {
  if (!fixturesEnabled()) return unavailable();
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

  const rendered = await renderWebsiteAutoresponderPreviewPayload(variant);
  return privateNoStore(
    jsonOk({
      ...rendered,
      recipient: QA_RECIPIENT,
      environment: 'Local QA fixture',
      deliveryMode: 'QA simulation · no provider or writes',
      sendReady: true,
      configurationReason: 'ready',
    }),
  );
}

export async function POST(req: Request) {
  if (!fixturesEnabled()) return unavailable();
  const parsed = await parseJsonBody(req);
  if (
    !parsed.ok
    || !parsed.body
    || typeof parsed.body !== 'object'
    || Array.isArray(parsed.body)
  ) {
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
    || !isWebsiteAutoresponderPreviewVariant(parsed.body.variant)
    || !isWebsiteAutoresponderPreviewLayout(parsed.body.layout)
  ) {
    return privateNoStore(
      jsonError('Only a governed fixture and layout may be supplied.', 400, null, {
        code: 'EMAIL_PREVIEW_BODY_INVALID',
      }),
    );
  }

  const rendered = await renderWebsiteAutoresponderPreviewPayload(
    parsed.body.variant,
  );
  const layout = rendered.layouts.find(
    (candidate) => candidate.id === parsed.body.layout,
  )!;
  return privateNoStore(
    jsonOk({
      ok: true,
      variant: parsed.body.variant,
      layout: parsed.body.layout,
      recipient: QA_RECIPIENT,
      subject: layout.sendSubject,
      customerSubject: layout.subject,
      preheader: layout.preheader,
      providerMessageId: `qa-simulated-${parsed.body.layout}`,
    }),
  );
}
