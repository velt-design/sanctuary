import { parsePreviewDraft, type PreviewDraft } from './previewDraft';

/** A versioned design snapshot; never serialize a caller's whole object. */
export function serializePreviewDesign(draft: PreviewDraft): string {
  const safe = parsePreviewDraft(draft);
  if (!safe) throw new Error('Invalid preview design');
  const { input, roof } = safe;
  return [1, roof.family, input.widthMm, input.projectionMm, input.level, input.connection,
    roof.orientation, roof.infills ? 1 : 0].join('.');
}

export function parsePreviewDesign(value: string): PreviewDraft | null {
  if (value.length > 100) return null;
  const parts = value.split('.');
  if (parts.length !== 8 || parts[0] !== '1' || !/^\d{4,5}$/.test(parts[2])
    || !/^\d{4,5}$/.test(parts[3]) || !/^[01]$/.test(parts[7])) return null;
  return parsePreviewDraft({ version: 1,
    input: { widthMm: Number(parts[2]), projectionMm: Number(parts[3]), level: parts[4], connection: parts[5] },
    roof: { family: parts[1], orientation: parts[6], infills: parts[7] === '1' },
  });
}

export function buildPreviewShareUrl(origin: string, draft: PreviewDraft, previewAccess?: string): string {
  const url = new URL('/configurator-preview?open=1', origin);
  // Optional public Vercel share-link token, scoped to the preview deployment.
  if (previewAccess && url.hostname.endsWith('.vercel.app')) url.searchParams.set('_vercel_share', previewAccess);
  url.hash = `design=${serializePreviewDesign(draft)}`;
  return url.href;
}
