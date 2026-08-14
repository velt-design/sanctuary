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

  it('preserves an explicit mixed pergola heading instead of collapsing to the first style', () => {
    const raw = [
      'Pergola 1',
      '- Configuration: Gable + Perimeter modules',
      'Shared specification',
      '- Roof: Acrylic',
      'Module 1: Gable',
      '- Size: 6m x 3m',
      'Module 2: Perimeter',
      '- Size: 4.2m x 2.6m',
    ].join('\n');

    const result = formatQuoteLineDescription(raw, 0);

    expect(result.heading).toBe('Pergola 1:');
    expect(result.entries).toEqual([
      { kind: 'bullet', text: 'Configuration: Gable + Perimeter modules' },
      { kind: 'section', text: 'Shared specification' },
      { kind: 'bullet', text: 'Roof: Acrylic' },
      { kind: 'section', text: 'Module 1: Gable' },
      { kind: 'bullet', text: 'Size: 6m × 3m' },
      { kind: 'section', text: 'Module 2: Perimeter' },
      { kind: 'bullet', text: 'Size: 4.2m × 2.6m' },
    ]);
  });

  it('formats value-led roof sections and included infills without flattening their hierarchy', () => {
    const raw = [
      'Pergola 1',
      '- Included: Custom-designed pergola, supplied and installed',
      '- Configuration: 2 connected Gable roof sections',
      'Shared across all roof sections',
      '- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter',
      'Roof section 1: Gable',
      '- Overall size: 6m x 3m',
      'Included infills',
      '- Front infill: 2.4m × 1.2m',
    ].join('\n');

    const result = formatQuoteLineDescription(raw, 0);

    expect(result.heading).toBe('Pergola 1:');
    expect(result.entries).toEqual([
      { kind: 'bullet', text: 'Included: Custom-designed pergola, supplied and installed' },
      { kind: 'bullet', text: 'Configuration: 2 connected Gable roof sections' },
      { kind: 'section', text: 'Shared across all roof sections' },
      { kind: 'bullet', text: 'Roof covering: Acrylic roofing — admits natural light while adding overhead shelter' },
      { kind: 'section', text: 'Roof section 1: Gable' },
      { kind: 'bullet', text: 'Overall size: 6m × 3m' },
      { kind: 'section', text: 'Included infills' },
      { kind: 'bullet', text: 'Front infill: 2.4m × 1.2m' },
    ]);
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
