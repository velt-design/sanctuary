import { describe, expect, it } from 'vitest';
import { evaluateDrawingSheetFit, getDrawingSheetViewportMm, getViewBoxUnitsPerMetreAtScale } from './drawingSheetLayout';

describe('drawingSheetLayout', () => {
  it('exposes the fixed A3 drawing viewport in paper millimetres', () => {
    expect(getDrawingSheetViewportMm()).toEqual({
      widthMm: 288,
      heightMm: 216,
    });
  });

  it('converts architectural scales into stable sheet viewBox units', () => {
    expect(getViewBoxUnitsPerMetreAtScale(50)).toBeCloseTo(8.333333, 5);
    expect(getViewBoxUnitsPerMetreAtScale(25)).toBeCloseTo(16.666667, 5);
  });

  it('reports whether a scaled drawing fits inside the available viewport', () => {
    expect(
      evaluateDrawingSheetFit({
        widthM: 4.6,
        heightM: 5.1,
        ratio: 50,
        marginsMm: { left: 20, right: 20, top: 20, bottom: 20 },
      }),
    ).toMatchObject({
      fits: true,
      requiredWidthMm: 132,
      requiredHeightMm: 142,
      availableWidthMm: 288,
      availableHeightMm: 216,
    });

    expect(
      evaluateDrawingSheetFit({
        widthM: 4.6,
        heightM: 5.1,
        ratio: 20,
        marginsMm: { left: 20, right: 20, top: 20, bottom: 20 },
      }).fits,
    ).toBe(false);
  });
});
