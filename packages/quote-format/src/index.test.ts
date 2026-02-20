import { describe, expect, it } from 'vitest';
import { formatQuoteLineDescription, formatQuoteTermsText } from './index';

describe('formatQuoteLineDescription', () => {
  it('formats a pergola module with heading heuristics and sorted bullets', () => {
    const raw = [
      'Pergola Module',
      '- Colour: Monument',
      '- Style: signature',
      '- Connections: house=soffit, posts=deck_bracket',
      '- Posts: 4',
      '- Roof: Acrylic',
      '- Size: 6m x 3m',
    ].join('\n');

    const result = formatQuoteLineDescription(raw, 0);

    expect(result.heading).toBe('Signature Pergola:');
    expect(result.bullets).toEqual([
      'Size: 6m × 3m',
      'Roof: Acrylic',
      'Colour: Monument',
      'Posts: 4',
      'House connection: Soffit brackets',
      'Post fixings: Deck brackets',
    ]);
  });

  it('expands and title-cases connections', () => {
    const raw = ['Custom Item', '- Connections: cable_tray=wall_mount, house=soffit'].join('\n');
    const result = formatQuoteLineDescription(raw, 0);

    expect(result.heading).toBe('Custom Item:');
    expect(result.bullets).toEqual(['Cable Tray: Wall Mount', 'House connection: Soffit brackets']);
  });
});

describe('formatQuoteTermsText', () => {
  it('splits terms and adjusts draft wording when sentAt is missing', () => {
    const raw = [
      '- This quote is valid for 30 days from the issue date.',
      '- Payment due on completion.',
      '- ',
    ].join('\n');

    expect(formatQuoteTermsText(raw, { sentAt: null })).toEqual([
      'This quote will be valid for 30 days from the issue date.',
      'Payment due on completion.',
    ]);

    expect(formatQuoteTermsText(raw, { sentAt: '2026-02-01T00:00:00Z' })).toEqual([
      'This quote is valid for 30 days from the issue date.',
      'Payment due on completion.',
    ]);
  });
});
