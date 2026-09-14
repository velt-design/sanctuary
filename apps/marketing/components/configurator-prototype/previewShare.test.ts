import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT } from './previewDraft';
import { buildPreviewShareUrl, parsePreviewDesign, parsePreviewShareHash, serializePreviewDesign } from './previewShare';

describe('shareable preview design', () => {
  it.each(['mono', 'gable', 'box'] as const)('round-trips %s design choices', family => {
    const draft = { ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm: 7200, projectionMm: 4100, level: 'elevated' as const },
      roof: { family, orientation: 'away' as const, infills: true } };
    expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
  });
  it.each(['', '2.mono.6000.3000.ground.facade.parallel.0', '1.mono.6001.3000.ground.facade.parallel.0',
    '1.mono.1000.3000.ground.facade.parallel.0', '1.box.6000.9000.ground.facade.parallel.0',
    '1.other.6000.3000.ground.facade.parallel.0', '1.gable.6000.3000.ground.facade.away.true',
    '1.mono.6000.3000.ground.facade.parallel.0.private', '<script>', 'x'.repeat(101)])('rejects %s', value => {
    expect(parsePreviewDesign(value)).toBeNull();
  });
  it('normalizes unsupported attachment combinations through the existing boundary', () => {
    expect(parsePreviewDesign('1.box.6000.4100.ground.soffit.parallel.0')?.input.connection).toBe('facade');
  });
  it('excludes price, contact fields and incoming URL context', () => {
    const draft = { ...DEFAULT_PREVIEW_DRAFT, email: 'private@example.com', calculationRef: 'old-price' };
    expect(buildPreviewShareUrl('https://example.com/contact?email=private#anything', draft))
      .toBe('https://example.com/configurator-preview?open=1#design=1.mono.6000.3000.ground.facade.parallel.0');
  });
  it('adds the optional public preview access link only on Vercel', () => {
    expect(buildPreviewShareUrl('https://preview.vercel.app', DEFAULT_PREVIEW_DRAFT, 'public-preview')).toContain('_vercel_share=public-preview');
    expect(buildPreviewShareUrl('https://example.com', DEFAULT_PREVIEW_DRAFT, 'public-preview')).not.toContain('_vercel_share');
  });
  it('keeps display history separate from the design and accepts old links', () => {
    const draft = DEFAULT_PREVIEW_DRAFT;
    const url = new URL(buildPreviewShareUrl('https://example.com', draft, undefined, { basis: 'published', amountIncGst: 12000 }));
    expect(parsePreviewShareHash(url.hash)).toEqual({ draft, estimate: { basis: 'published', amountIncGst: 12000 } });
    expect(parsePreviewShareHash(`#design=${serializePreviewDesign(draft)}`)).toEqual({ draft, estimate: null });
    expect(parsePreviewShareHash(url.hash + '&estimate=published:1')).toEqual({ draft, estimate: null });
    expect(parsePreviewShareHash('#design=invalid&estimate=published:1')).toBeNull();
    expect(parsePreviewShareHash(`#design=${serializePreviewDesign(draft)}&estimate=<script>`)).toEqual({ draft, estimate: null });
  });
  it('round trips encoded v3 designs without double decoding when price history is present', () => {
    const draft = { ...DEFAULT_PREVIEW_DRAFT, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, finish: { material: 'solid' as const, layout: 'central' as const, acrylicBays: 2, profile: 'corrugated' as const, trayWidth: 400 as const, ceiling: 'thermopine-150' as const } } };
    const url = new URL(buildPreviewShareUrl('https://example.com', draft, undefined, { basis: 'draft', amountIncGst: 21000 }));
    expect(parsePreviewShareHash(url.hash)?.draft).toEqual(parsePreviewDraftForTest(draft));
  });
});

function parsePreviewDraftForTest(draft: Parameters<typeof serializePreviewDesign>[0]) {
  return parsePreviewDesign(serializePreviewDesign(draft));
}
