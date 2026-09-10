import { parsePreviewDraft, type PreviewDraft } from './previewDraft';

/** A versioned design snapshot; never serialize a caller's whole object. */
export function serializePreviewDesign(draft: PreviewDraft): string {
  const safe = parsePreviewDraft(draft);
  if (!safe) throw new Error('Invalid preview design');
  const { input, roof } = safe;
  if(roof.roofBattens||roof.blinds?.length||roof.sidePanels?.length) return '3~'+encodeURIComponent(JSON.stringify(safe));
  const parts: (string | number)[] = [roof.finish ? 2 : 1, roof.family, input.widthMm, input.projectionMm, input.level, input.connection,
    roof.orientation, roof.infills ? 1 : 0];
  if (roof.finish) parts.push(roof.finish.material, roof.finish.layout, roof.finish.acrylicBays, roof.finish.profile, roof.finish.trayWidth);
  return parts.join('.');
}

export function parsePreviewDesign(value: string): PreviewDraft | null {
  if(value.startsWith('3~')) {
    if(value.length>12000) return null;
    try { return parsePreviewDraft(JSON.parse(decodeURIComponent(value.slice(2)))); } catch { return null; }
  }
  if (value.length > 100) return null;
  const parts = value.split('.');
  const extended = parts[0] === '2' && parts.length === 13;
  if (extended && !/^(300|400|500)$/.test(parts[12])) return null;
  if ((!extended && (parts.length !== 8 || parts[0] !== '1')) || !/^\d{4,5}$/.test(parts[2])
    || !/^\d{4,5}$/.test(parts[3]) || !/^[01]$/.test(parts[7])) return null;
  return parsePreviewDraft({ version: 1,
    input: { widthMm: Number(parts[2]), projectionMm: Number(parts[3]), level: parts[4], connection: parts[5] },
    roof: { family: parts[1], orientation: parts[6], infills: parts[7] === '1',
      ...(extended ? { finish: { material: parts[8], layout: parts[9], acrylicBays: /^\d+$/.test(parts[10]) ? Number(parts[10]) : null, profile: parts[11], trayWidth: Number(parts[12]) } } : {}) },
  });
}

export function buildPreviewShareUrl(origin: string, draft: PreviewDraft, previewAccess?: string): string {
  const url = new URL('/configurator-preview?open=1', origin);
  // Optional public Vercel share-link token, scoped to the preview deployment.
  if (previewAccess && url.hostname.endsWith('.vercel.app')) url.searchParams.set('_vercel_share', previewAccess);
  url.hash = `design=${serializePreviewDesign(draft)}`;
  return url.href;
}
