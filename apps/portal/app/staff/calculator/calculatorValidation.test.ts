import { describe, expect, it } from 'vitest';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { makeDefaultModule } from './calculatorInputs';
import { buildCalculatorModuleErrors } from './calculatorValidation';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  return {
    ...makeDefaultModule(),
    ...overrides,
  };
}

describe('buildCalculatorModuleErrors', () => {
  it('accepts the default calculator module', () => {
    expect(buildCalculatorModuleErrors([makeModule()])).toEqual([{}]);
  });

  it('reports invalid dimensions, pitch, posts, and drainage counts', () => {
    const [errors] = buildCalculatorModuleErrors([
      makeModule({
        lengthM: '',
        projectionM: '0',
        postCutHeightM: '-1',
        roofPitchDeg: '86',
        postCount: '0',
        downpipeCount: '-1',
        downpipeJoinCount: '11',
        downpipeElbowCount: '21',
      }),
    ]);

    expect(errors).toMatchObject({
      lengthM: 'Enter a length > 0',
      projectionM: 'Enter a roof span > 0',
      postCutHeightM: 'Enter a post cut height > 0',
      roofPitchDeg: 'Enter a pitch between 0 and 85',
      postCount: 'Enter a post count > 0',
      downpipeCount: 'Enter a downpipe count >= 0',
      downpipeJoinCount: 'Choose 0–10',
      downpipeElbowCount: 'Choose 0–20',
    });
  });

  it('applies hip-corner, overhang, and inverted roof constraints independently', () => {
    const errors = buildCalculatorModuleErrors([
      makeModule({
        pergolaStyle: 'hip_corner',
        hipCornerLengthBM: '',
        hipCornerProjectionBM: '0',
      }),
      makeModule({
        boxPerimeterEnabled: true,
        overhangEnabled: true,
        overhangAmountM: '3',
      }),
      makeModule({ pergolaStyle: 'gable', invertedEnabled: true }),
    ]);

    expect(errors[0]).toMatchObject({
      hipCornerLengthBM: 'Roof length B is required',
      hipCornerProjectionBM: 'Roof span B is required',
    });
    expect(errors[1]).toMatchObject({
      overhangEnabled: 'Overhang cannot be used with Box Perimeter.',
      overhangAmountM: 'Enter an overhang between 0 and 1.5m',
    });
    expect(errors[2]).toMatchObject({
      invertedEnabled: 'Inverted option is only available for Pitched roofs.',
    });
  });

  it('validates powdercoat and mixed-roof selections', () => {
    const errors = buildCalculatorModuleErrors([
      makeModule({ extrusionColour: 'Mill', powdercoatStandardColour: '' }),
      makeModule({
        extrusionColour: 'Mill',
        powdercoatIsCustom: true,
        powdercoatCustomColour: ' ',
      }),
      makeModule({ roofMaterial: 'mixed', mixedAcrylicBaysMain: '999' }),
    ]);

    expect(errors[0]).toMatchObject({ powdercoatStandardColour: 'Select a powdercoat colour' });
    expect(errors[1]).toMatchObject({ powdercoatCustomColour: 'Enter a custom powdercoat colour' });
    expect(errors[2].mixedAcrylicBaysMain).toMatch(/^Enter an integer between 0 and \d+$/);
  });

  it('validates timber roof details and flashing lengths', () => {
    const invalidFlashingModule = makeModule();
    invalidFlashingModule.flashings = {
      rows: invalidFlashingModule.flashings!.rows.map((row) => ({ ...row, lengthM: '-0.1' })),
    };

    const errors = buildCalculatorModuleErrors([
      makeModule({
        roofMaterial: 'timber',
        timberRoofAboveType: 'insulated_panels',
        timberInsulatedPanelThicknessMm: '0',
      }),
      makeModule({
        roofMaterial: 'timber',
        timberRoofAboveType: 'steel_tray',
        timberTrayWidthMm: '450',
      }),
      invalidFlashingModule,
    ]);

    expect(errors[0]).toMatchObject({
      timberInsulatedPanelThicknessMm: 'Enter a panel thickness > 0',
    });
    expect(errors[1]).toMatchObject({ timberTrayWidthMm: 'Choose 400, 500, or 600' });
    expect(errors[2]).toMatchObject({ flashings: 'Enter a flashing length of 0 or more.' });
  });

  it('requires positive open-pergola spacing without an upper cap', () => {
    const errors = buildCalculatorModuleErrors([
      makeModule({ roofMaterial: 'none', rafterSpacingMm: '0' }),
      makeModule({ roofMaterial: 'none', rafterSpacingMm: '50000' }),
    ]);

    expect(errors[0]).toMatchObject({ rafterSpacingMm: 'Enter a rafter spacing > 0' });
    expect(errors[1]).toEqual({});
  });
});
