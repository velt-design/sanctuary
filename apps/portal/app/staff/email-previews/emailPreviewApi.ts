import { previewConfigurationErrorMessage } from './emailPreviewOptions';
import type {
  LayoutPreview,
  PreviewResponse,
  PreviewSendResult,
} from './emailPreviewTypes';
import type {
  PreviewLayoutId,
  PreviewVariant,
} from './emailPreviewOptions';

const STAFF_EMAIL_PREVIEW_ENDPOINT =
  '/api/staff/v1/email-previews/website-autoresponder';

function responseMessage(body: unknown, fallback: string): string {
  const configurationMessage = previewConfigurationErrorMessage(body);
  if (configurationMessage) return configurationMessage;
  if (
    body
    && typeof body === 'object'
    && typeof (body as Record<string, unknown>).error === 'string'
  ) {
    return String((body as Record<string, unknown>).error);
  }
  return fallback;
}

export async function loadEmailPreview(
  variant: PreviewVariant,
  signal: AbortSignal,
  endpoint = STAFF_EMAIL_PREVIEW_ENDPOINT,
): Promise<PreviewResponse> {
  const response = await fetch(
    `${endpoint}?variant=${encodeURIComponent(variant)}`,
    {
      cache: 'no-store',
      signal,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      responseMessage(body, 'Unable to load these email previews.'),
    );
  }
  return body as PreviewResponse;
}

export async function sendEmailPreview(
  variant: PreviewVariant,
  layout: LayoutPreview | PreviewLayoutId,
  clientIntentId: string,
  endpoint = STAFF_EMAIL_PREVIEW_ENDPOINT,
): Promise<PreviewSendResult> {
  const layoutId = typeof layout === 'string' ? layout : layout.id;
  const response = await fetch(
    endpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variant, layout: layoutId, clientIntentId }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      responseMessage(body, 'Unable to send this email preview.'),
    );
  }
  return body as PreviewSendResult;
}
