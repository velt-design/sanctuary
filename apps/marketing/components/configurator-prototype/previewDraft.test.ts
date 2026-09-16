import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft } from './previewDraft';

describe('representative preview draft boundary', () => {
  it('keeps only supported design choices, excluding contact data and signed prices', () => {
    expect(parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, calculationRef: 'old-ref', name: 'Private',
      input: { ...DEFAULT_PREVIEW_DRAFT.input, price: 123 }, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, unknown: true } }))
      .toEqual(DEFAULT_PREVIEW_DRAFT);
  });

  it.each([null, [], {}, { ...DEFAULT_PREVIEW_DRAFT, version: 2 },
    { ...DEFAULT_PREVIEW_DRAFT, roof: { family: 'gable' } },
    { ...DEFAULT_PREVIEW_DRAFT, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, infills: 'true' } },
    ...[1000, 6201, 10100, NaN, '6000'].map(widthMm => ({ ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm } })),
  ])('rejects malformed, out-of-bounds or unsupported drafts: %j', value => {
    expect(parsePreviewDraft(value)).toBeNull();
  });

  it('rechecks attachment restrictions when restoring', () => {
    const input = { ...DEFAULT_PREVIEW_DRAFT.input, connection: 'soffit', projectionMm: 4100 };
    expect(parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, input })?.input.connection).toBe('fascia');
    expect(parsePreviewDraft({ ...DEFAULT_PREVIEW_DRAFT, input, roof: { family: 'box', orientation: 'parallel', infills: false } })?.input.connection).toBe('facade');
  });
});
