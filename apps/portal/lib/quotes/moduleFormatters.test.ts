import { describe, expect, it } from 'vitest';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  formatDimension,
  formatModuleColour,
  formatModulePitch,
  formatModulePosts,
  formatModuleRoof,
  formatModuleSize,
  formatModuleStyle,
  toTitleCase,
} from './moduleFormatters';

function module(overrides: Record<string, unknown> = {}): CalculatorModuleInputs {
  return {
    pergolaId: 'p1',
    pergolaStyle: 'pitched_roof',
    roofMaterial: 'acrylic',
    extrusionColour: 'Slate',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '',
    roofPitchDeg: '15',
    gableEndFramesMode: 'none',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'house',
    boxGutterHouseEdge: 'none',
    boxGutterFarEdge: 'none',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '0',
    timberTrayWidthMm: '0',
    lengthM: '6',
    projectionM: '3',
    postCount: '4',
    houseConnectionType: 'fascia',
    postConnectionType: 'concrete',
    ...overrides,
  } as unknown as CalculatorModuleInputs;
}

describe('toTitleCase', () => {
  it('replaces underscores and dashes with spaces and title-cases each word', () => {
    expect(toTitleCase('pitched_roof')).toBe('Pitched Roof');
    expect(toTitleCase('hip-corner')).toBe('Hip Corner');
  });

  it('trims surrounding whitespace', () => {
    expect(toTitleCase('  acrylic  ')).toBe('Acrylic');
  });
});

describe('formatDimension', () => {
  it('returns an integer string when the value rounds to a whole number', () => {
    expect(formatDimension('6')).toBe('6');
    expect(formatDimension('6.0')).toBe('6');
  });

  it('keeps two-decimal precision and trims trailing zeros', () => {
    expect(formatDimension('3.5')).toBe('3.5');
    expect(formatDimension('3.50')).toBe('3.5');
    expect(formatDimension('3.25')).toBe('3.25');
  });

  it('falls back to em dash on invalid input', () => {
    expect(formatDimension('not-a-number')).toBe('—');
    expect(formatDimension('')).toBe('—');
  });
});

describe('formatModuleSize', () => {
  it('returns a length-by-projection string for normal styles', () => {
    expect(formatModuleSize(module({ lengthM: '6', projectionM: '3' }))).toBe('6m x 3m');
  });

  it('returns the dual-section A/B string for hip_corner pergolas', () => {
    expect(
      formatModuleSize(
        module({
          pergolaStyle: 'hip_corner',
          lengthM: '6',
          projectionM: '3',
          hipCornerLengthBM: '4',
          hipCornerProjectionBM: '2.5',
        }),
      ),
    ).toBe('A 6m x 3m, B 4m x 2.5m');
  });
});

describe('formatModuleStyle / formatModuleRoof', () => {
  it('returns title-cased style label', () => {
    expect(formatModuleStyle(module({ pergolaStyle: 'pitched_roof' }))).toBe('Pitched Roof');
  });

  it('returns null when the style is missing', () => {
    expect(formatModuleStyle(module({ pergolaStyle: '' }))).toBeNull();
  });

  it('returns title-cased roof material label', () => {
    expect(formatModuleRoof(module({ roofMaterial: 'acrylic' }))).toBe('Acrylic');
  });

  it('uses customer-friendly wording for an open pergola', () => {
    expect(formatModuleRoof(module({ roofMaterial: 'none' }))).toBe('No roof covering');
  });
});

describe('formatModuleColour', () => {
  it('returns base colour when no powdercoat option is set', () => {
    expect(formatModuleColour(module({ extrusionColour: 'Slate' }))).toBe('Slate');
  });

  it('appends a parenthesised standard powdercoat colour', () => {
    expect(formatModuleColour(module({ extrusionColour: 'Slate', powdercoatStandardColour: 'Charcoal' }))).toBe('Slate (Charcoal)');
  });

  it('appends a parenthesised custom powdercoat colour when flagged custom', () => {
    expect(
      formatModuleColour(
        module({
          extrusionColour: 'Slate',
          powdercoatIsCustom: true,
          powdercoatCustomColour: 'Forest Mist',
        }),
      ),
    ).toBe('Slate (Forest Mist)');
  });

  it('uses generic Custom suffix when custom is flagged but no value is provided', () => {
    expect(formatModuleColour(module({ extrusionColour: 'Slate', powdercoatIsCustom: true, powdercoatCustomColour: '' }))).toBe('Slate (Custom)');
  });

  it('returns null when no colour is set', () => {
    expect(formatModuleColour(module({ extrusionColour: '' }))).toBeNull();
  });
});

describe('formatModulePitch / formatModulePosts', () => {
  it('appends ° to the pitch value', () => {
    expect(formatModulePitch(module({ roofPitchDeg: '15' }))).toBe('15°');
  });

  it('returns null when pitch is empty', () => {
    expect(formatModulePitch(module({ roofPitchDeg: '' }))).toBeNull();
  });

  it('returns the post count as-is', () => {
    expect(formatModulePosts(module({ postCount: '4' }))).toBe('4');
  });

  it('returns null when post count is empty', () => {
    expect(formatModulePosts(module({ postCount: '' }))).toBeNull();
  });
});
