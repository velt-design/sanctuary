import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT } from './previewDraft';
import { buildPreviewShareUrl, parsePreviewDesign, serializePreviewDesign } from './previewShare';

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
});
