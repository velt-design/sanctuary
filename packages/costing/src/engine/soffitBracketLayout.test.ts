import { describe, expect, it } from 'vitest';
import { calculateSoffitBracketCountV1 } from './soffitBracketLayout';
import { normalizeAndDeriveV1 } from './derive';

describe('shared soffit bracket quantity', () => {
  it.each([[1500, 2], [1501, 3], [6000, 5], [6001, 6], [7500, 6], [10000, 8]])('uses %i mm attachment length for %i brackets', (attachmentLengthMm, count) => {
    expect(calculateSoffitBracketCountV1(attachmentLengthMm)).toBe(count);
    const result = normalizeAndDeriveV1({
      length_m: 10, projection_m: 3, attachment_length_mm: attachmentLengthMm,
      pergola_style: 'pitched', roof_material: 'acrylic', house_connection_type: 'soffit',
      post_count: 4, post_cut_height_m: 2.4, extrusion_colour: 'Black',
      post_connection_type: 'deck_bracket', access: 'normal', height: 'single_storey',
    });
    expect(result.derived.bracket_count).toBe(count);
  });
});
