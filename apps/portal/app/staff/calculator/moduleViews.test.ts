import { describe, expect, it } from 'vitest';
import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildModulePlanModel, buildModuleSectionModel } from './moduleViews';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    houseConnectionType: 'soffit',
    overhangEnabled: false,
    overhangAmountM: '0.2',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    invertedEnabled: false,
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeResult(params: {
  roofType?: RoofType;
  lengthA?: number;
  spanA?: number;
  lengthB?: number;
  spanB?: number;
  rafterCount?: number;
  rafterCountA?: number;
  rafterCountB?: number;
  bracketCount?: number;
  slopeDirection?: 'away_from_house' | 'toward_house' | null;
}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: params.roofType ?? 'pitched',
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      hip_corner_length_b_m: params.lengthB,
      hip_corner_projection_b_m: params.spanB,
      rafter_count: params.rafterCount,
      hip_corner_rafter_count_a: params.rafterCountA,
      hip_corner_rafter_count_b: params.rafterCountB,
      bracket_count: params.bracketCount,
      slope_direction: params.slopeDirection ?? 'away_from_house',
    },
  } as unknown as CostOutputV1;
}

describe('buildModulePlanModel', () => {
  it('prefers derived geometry when available', () => {
    const module = makeModule({ pergolaStyle: 'gable', lengthM: '6', projectionM: '3' });
    const result = makeResult({ roofType: 'gable', lengthA: 7.2, spanA: 4.1 });
    const model = buildModulePlanModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('derived');
    expect(model?.roofType).toBe('gable');
    expect(model?.lengthA).toBeCloseTo(7.2);
    expect(model?.spanA).toBeCloseTo(4.1);
  });

  it('falls back to input geometry when derived output is unavailable', () => {
    const module = makeModule({ lengthM: '5.8', projectionM: '2.9', invertedEnabled: true });
    const model = buildModulePlanModel(module, null);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('input_fallback');
    expect(model?.lengthA).toBeCloseTo(5.8);
    expect(model?.spanA).toBeCloseTo(2.9);
    expect(model?.slopeDirection).toBe('toward_house');
    expect(model?.rafterSpacingA).toBeLessThanOrEqual(0.642 + 1e-6);
  });

  it('requires B dimensions for hip corner input fallback', () => {
    const module = makeModule({
      pergolaStyle: 'hip_corner',
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '2',
    });
    const model = buildModulePlanModel(module, null);
    expect(model).toBeNull();
  });

  it('uses derived hip corner dimensions when present', () => {
    const module = makeModule({
      pergolaStyle: 'hip_corner',
      hipCornerLengthBM: '4',
      hipCornerProjectionBM: '2',
    });
    const result = makeResult({
      roofType: 'hip_corner',
      lengthA: 6,
      spanA: 3,
      lengthB: 4.25,
      spanB: 2.1,
      slopeDirection: 'toward_house',
    });
    const model = buildModulePlanModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('derived');
    expect(model?.roofType).toBe('hip_corner');
    expect(model?.lengthB).toBeCloseTo(4.25);
    expect(model?.spanB).toBeCloseTo(2.1);
    expect(model?.slopeDirection).toBe('toward_house');
    expect(model?.rafterCountA ?? 0).toBeGreaterThan(2);
    expect(model?.rafterCountB ?? 0).toBeGreaterThan(2);
    expect(model?.rafterSpacingA ?? 1).toBeLessThanOrEqual(0.642 + 1e-6);
    expect(model?.rafterSpacingB ?? 1).toBeLessThanOrEqual(0.642 + 1e-6);
  });

  it('computes soffit bracket offsets with max spacing', () => {
    const module = makeModule({ houseConnectionType: 'soffit', lengthM: '6', projectionM: '3' });
    const model = buildModulePlanModel(module, null);
    expect(model).not.toBeNull();
    const brackets = model!.soffitBracketPositionsA;
    expect(brackets.length).toBeGreaterThanOrEqual(2);
    expect(brackets[0]).toBeCloseTo(0.5, 6);
    expect(brackets[brackets.length - 1]).toBeCloseTo(5.5, 6);
    for (let idx = 1; idx < brackets.length; idx += 1) {
      expect(brackets[idx] - brackets[idx - 1]).toBeLessThanOrEqual(1.5 + 1e-6);
    }
  });

  it('hides soffit brackets when house connection is not soffit', () => {
    const module = makeModule({ houseConnectionType: 'fascia', lengthM: '6' });
    const model = buildModulePlanModel(module, null);
    expect(model).not.toBeNull();
    expect(model?.soffitBracketPositionsA).toEqual([]);
  });
});

describe('buildModuleSectionModel', () => {
  it('prefers derived section geometry when available', () => {
    const module = makeModule({ pergolaStyle: 'pitched', projectionM: '3.0', postCutHeightM: '2.4', overhangEnabled: true, overhangAmountM: '0.25' });
    const result = makeResult({
      roofType: 'pitched',
      spanA: 3,
      slopeDirection: 'away_from_house',
    });
    (result.derived as any).roof_pitch_deg_used = 8;
    (result.derived as any).post_cut_height_house_side_m = 2.5;
    (result.derived as any).post_cut_height_outer_side_m = 2.1;
    const model = buildModuleSectionModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('derived');
    expect(model?.sectionKind).toBe('mono');
    expect(model?.pitchDeg).toBeCloseTo(8);
    expect(model?.leftEdgeHeightM).toBeCloseTo(2.5);
    expect(model?.rightEdgeHeightM).toBeCloseTo(2.1);
    expect(model?.overhangEnabled).toBe(true);
    expect(model?.overhangAmountM).toBeCloseTo(0.25);
  });

  it('falls back to input-derived section geometry when result is missing', () => {
    const module = makeModule({
      pergolaStyle: 'pitched',
      projectionM: '3.0',
      postCutHeightM: '2.4',
      roofPitchDeg: '5',
      invertedEnabled: false,
    });
    const model = buildModuleSectionModel(module, null);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('input_fallback');
    expect(model?.sectionKind).toBe('mono');
    expect(model?.spanA).toBeCloseTo(3);
    expect(model?.pitchDeg).toBeCloseTo(5);
  });

  it('creates a gable section with ridge height', () => {
    const module = makeModule({
      pergolaStyle: 'gable',
      projectionM: '4.0',
      postCutHeightM: '2.4',
      roofPitchDeg: '25',
    });
    const model = buildModuleSectionModel(module, null);
    expect(model).not.toBeNull();
    expect(model?.sectionKind).toBe('gable');
    expect(model?.ridgeHeightM).toBeTypeOf('number');
    expect((model?.ridgeHeightM ?? 0) > model!.leftEdgeHeightM).toBe(true);
  });

  it('requires B span for hip corner input fallback', () => {
    const module = makeModule({
      pergolaStyle: 'hip_corner',
      projectionM: '3.0',
      hipCornerProjectionBM: '0',
      postCutHeightM: '2.4',
    });
    const model = buildModuleSectionModel(module, null);
    expect(model).toBeNull();
  });
});
