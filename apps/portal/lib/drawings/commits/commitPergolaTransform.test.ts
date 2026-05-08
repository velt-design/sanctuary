import { describe, expect, it } from 'vitest';
import { buildPergolaTransformPosition } from './commitPergolaTransform';

describe('buildPergolaTransformPosition', () => {
  it('adds delta to current position and preserves rotation', () => {
    expect(
      buildPergolaTransformPosition({
        currentPosition: { originXMm: '1000', originYMm: '500', rotationDeg: '45' },
        deltaMm: { x: 200, y: -100 },
      }),
    ).toEqual({ originXMm: 1200, originYMm: 400, rotationDeg: 45 });
  });

  it('treats null current position as world origin (0, 0, rotation 0)', () => {
    expect(
      buildPergolaTransformPosition({
        currentPosition: null,
        deltaMm: { x: 300, y: 400 },
      }),
    ).toEqual({ originXMm: 300, originYMm: 400, rotationDeg: 0 });
  });

  it('treats undefined current position as world origin', () => {
    expect(
      buildPergolaTransformPosition({
        currentPosition: undefined,
        deltaMm: { x: 0, y: 0 },
      }),
    ).toEqual({ originXMm: 0, originYMm: 0, rotationDeg: 0 });
  });

  it('falls back to 0 for non-numeric persisted values (defensive against bad data)', () => {
    expect(
      buildPergolaTransformPosition({
        currentPosition: { originXMm: 'not-a-number', originYMm: '', rotationDeg: 'NaN' },
        deltaMm: { x: 100, y: 100 },
      }),
    ).toEqual({ originXMm: 100, originYMm: 100, rotationDeg: 0 });
  });
});
