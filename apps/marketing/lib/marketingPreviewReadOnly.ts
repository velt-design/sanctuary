import 'server-only';

export const MARKETING_PREVIEW_MESSAGE = 'This preview cannot send enquiries or upload files. Your draft is still here for review.';
export function marketingPreviewReadOnly(): Response | null {
  return process.env.MARKETING_PREVIEW_READ_ONLY === 'true'
    ? Response.json({ ok: false, error: MARKETING_PREVIEW_MESSAGE }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    : null;
}
