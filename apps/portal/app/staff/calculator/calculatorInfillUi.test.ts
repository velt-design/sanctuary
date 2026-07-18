import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import { makeDefaultModule } from './calculatorInputs';
import {
  acrylicSourceLabel,
  estimateInfillUi,
  estimateRoofRafterSpacing,
  formatInfillShapeSummary,
  infillStatusLabel,
  locationLabel,
  parseInfillsForPayload,
  validateInfillUi,
} from './calculatorInfillUi';

function makeBaseInfill(overrides?: Partial<InfillLineItem>): InfillLineItem {
  const base: InfillLineItem = {
    id: 'infill-1',
    qty: '1',
    location: 'side',
    acrylicSource: 'sheet_panels',
    panelOrientation: 'vertical',
    widthMode: 'target_width',
    targetPanelWidthM: '1',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: true,
      hasBottom: true,
      hasLeft: true,
      hasRight: true,
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'rect',
      widthM: '2.4',
      heightM: '2.1',
      bottomOffsetM: '0',
    },
  };

  return {
    ...base,
    ...overrides,
    support: { ...base.support, ...(overrides?.support ?? {}) },
    shape: (overrides?.shape as InfillLineItem['shape']) ?? base.shape,
  };
}

describe('calculator infill UI helpers', () => {
  it('estimates roof rafter spacing from fallback and derived counts', () => {
    expect(estimateRoofRafterSpacing(6)).toEqual({ spacingM: 0.6, source: 'fallback' });
    expect(estimateRoofRafterSpacing(6, 7)).toEqual({ spacingM: 1, source: 'derived' });
    expect(estimateRoofRafterSpacing(Number.NaN)).toEqual({ spacingM: 0.642, source: 'fallback' });
  });

  it('auto-switches acrylic source when sheet runs exceed sheet stock', () => {
    const infill = makeBaseInfill({
      acrylicSource: 'sheet_panels',
      shape: {
        type: 'rect',
        widthM: '2.4',
        heightM: '3.4',
        bottomOffsetM: '0',
      },
    });

    const estimate = estimateInfillUi(infill, 0.9);
    const validation = validateInfillUi(infill, estimate);

    expect(estimate.acrylicSourceUsed).toBe('strip_620');
    expect(estimate.acrylicSourceAutoSwitched).toBe(true);
    expect(validation.warnings).toEqual([
      'Acrylic source auto-switched from Sheet panels to 620 strips because run side 3.40m exceeds 3.05m.',
    ]);
  });

  it('marks acrylic source unavailable when all run limits are exceeded', () => {
    const infill = makeBaseInfill({
      acrylicSource: 'sheet_panels',
      shape: {
        type: 'rect',
        widthM: '2.4',
        heightM: '6.5',
        bottomOffsetM: '0',
      },
    });

    const estimate = estimateInfillUi(infill, 0.9);
    const validation = validateInfillUi(infill, estimate);

    expect(estimate.acrylicSourceUnavailable).toBe(true);
    expect(validation.errors.acrylicSource).toBe('Run side 6.50m exceeds all material limits (sheet 3.05m, strips 6.00m).');
  });

  it('validates invalid shape, quantity, bottom offset, and custom support inputs', () => {
    const infill = makeBaseInfill({
      qty: '0',
      support: {
        hasTop: true,
        hasBottom: true,
        hasLeft: true,
        hasRight: true,
        internalSupportMode: 'custom',
        internalSupportPositionsM: ['abc'],
      },
      shape: {
        type: 'rect',
        widthM: '-1',
        heightM: 'bad',
        bottomOffsetM: '-0.1',
      },
    });

    const validation = validateInfillUi(infill, estimateInfillUi(infill, 0.9));

    expect(validation.errors).toMatchObject({
      qty: 'Enter a whole number of at least 1.',
      widthM: 'Enter a value of at least 0.',
      heightM: 'Enter a value of at least 0.',
      bottomOffsetM: 'Enter a value of at least 0.',
      internalSupportPositionsM: 'Use a comma-separated list of numbers (m).',
    });
  });

  it('parses rectangular infills for the costing payload', () => {
    const module = {
      ...makeDefaultModule(),
      lengthM: '4',
      infills: {
        items: [
          makeBaseInfill({
            label: ' Side panel ',
            qty: '2',
            maxPanelWidthM: '1.8',
          }),
        ],
      },
    };

    const payload = parseInfillsForPayload(module);

    expect(payload).toHaveLength(1);
    expect(payload?.[0]).toMatchObject({
      id: 'infill-1',
      label: 'Side panel',
      qty: 2,
      location: 'side',
      acrylic_source: 'sheet_panels',
      panel_orientation: 'vertical',
      width_mode: 'target_width',
      target_panel_width_m: 1,
      max_panel_width_m: 1.2,
      support: {
        has_top: true,
        has_bottom: true,
        has_left: true,
        has_right: true,
        internal_support_mode: 'none',
        internal_support_positions_m: [],
      },
      shape: {
        type: 'rect',
        width_m: 2.4,
        height_m: 2.1,
        bottom_offset_m: 0,
      },
    });
  });

  it('resolves automatic material and direction before building CostInputsV1', () => {
    const module = {
      ...makeDefaultModule(),
      lengthM: '3',
      infills: {
        items: [makeBaseInfill({ acrylicSource: 'auto', panelOrientation: 'auto' })],
      },
    };

    const payload = parseInfillsForPayload(module);

    expect(payload?.[0]?.acrylic_source).not.toBe('auto');
    expect(payload?.[0]?.panel_orientation).not.toBe('auto');
    expect(['sheet_panels', 'strip_620']).toContain(payload?.[0]?.acrylic_source);
    expect(['vertical', 'horizontal']).toContain(payload?.[0]?.panel_orientation);
  });

  it('does not warn when bottom installation height exceeds panel height', () => {
    const infill = makeBaseInfill({
      shape: { type: 'rect', widthM: '2', heightM: '0.5', bottomOffsetM: '1.2' },
    });

    expect(validateInfillUi(infill, estimateInfillUi(infill, 0.9)).warnings).toEqual([]);
  });

  it('parses mono-slope pitch infills into resolved heights', () => {
    const module = {
      ...makeDefaultModule(),
      infills: {
        items: [
          makeBaseInfill({
            shape: {
              type: 'mono_slope',
              widthM: '2',
              heightLowM: '1',
              heightHighM: '0',
              bottomOffsetM: '0',
              slopeMode: 'pitch',
              slopeDeg: '45',
              slopeAnchor: 'left',
            },
          }),
        ],
      },
    };

    const payload = parseInfillsForPayload(module);
    const shape = payload?.[0]?.shape;

    expect(shape?.type).toBe('mono_slope');
    if (shape?.type === 'mono_slope') {
      expect(shape.width_m).toBe(2);
      expect(shape.height_low_m).toBe(1);
      expect(shape.height_high_m).toBeCloseTo(3, 6);
      expect(shape.bottom_offset_m).toBe(0);
    }
  });

  it('formats infill labels used by the list UI', () => {
    const infill = makeBaseInfill();

    expect(locationLabel('gable_end')).toBe('Gable end');
    expect(acrylicSourceLabel('strip_620')).toBe('620 strips');
    expect(infillStatusLabel('draft')).toBe('Needs setup');
    expect(infillStatusLabel('valid')).toBe('Configured');
    expect(formatInfillShapeSummary(infill.shape)).toBe('2.40x2.10m');
  });
});
