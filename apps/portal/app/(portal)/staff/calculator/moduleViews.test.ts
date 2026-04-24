import { describe, expect, it } from 'vitest';
import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorHouseFootprintParams, CalculatorModuleInputs } from '@/lib/types/calculator';
import { attachmentSideQuarterTurns, buildHouseFootprintLocalLayout, buildModulePlanModel, buildModuleSectionModel } from './moduleViews';

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

function makeFootprintParams(overrides: Partial<Record<keyof CalculatorHouseFootprintParams, string>> = {}) {
  return {
    widthM: '',
    offsetXM: '0',
    setbackM: '0',
    bandDepthM: '1.8',
    returnRunM: '2.4',
    recessWidthM: '2.4',
    recessDepthM: '1.2',
    leftLegRunM: '2.4',
    rightLegRunM: '2.4',
    sideRunM: '2.4',
    ...overrides,
  };
}

type TestPoint = { x: number; y: number };

function rotatePointQuarterTurns(point: TestPoint, center: TestPoint, turns: number): TestPoint {
  const normalized = ((turns % 4) + 4) % 4;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (normalized === 1) return { x: center.x + dy, y: center.y - dx };
  if (normalized === 2) return { x: center.x - dx, y: center.y - dy };
  if (normalized === 3) return { x: center.x - dy, y: center.y + dx };
  return point;
}

function normalizePoints(points: TestPoint[]): string[] {
  return points
    .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .sort();
}

function bounds(points: TestPoint[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function transformLocalFootprint(points: TestPoint[], input: { attachmentSide: 'rear' | 'front' | 'left' | 'right'; width: number; depth: number; drawingTurns?: number }) {
  const { attachmentSide, width, depth, drawingTurns = 0 } = input;
  const sideTurns = attachmentSideQuarterTurns(attachmentSide);
  const canonicalWidth = attachmentSide === 'left' || attachmentSide === 'right' ? depth : width;
  const canonicalDepth = attachmentSide === 'left' || attachmentSide === 'right' ? width : depth;
  const center = { x: width / 2, y: depth / 2 };
  const canonicalX = center.x - canonicalWidth / 2;
  const canonicalY = center.y - canonicalDepth / 2;
  return points.map((point) =>
    rotatePointQuarterTurns(
      {
        x: canonicalX + point.x,
        y: canonicalY + point.y,
      },
      center,
      sideTurns + drawingTurns,
    ),
  );
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

  it('backfills attachment-side drawing defaults for legacy-style modules', () => {
    const model = buildModulePlanModel(makeModule(), null);
    expect(model).not.toBeNull();
    expect(model?.attachmentSide).toBe('rear');
    expect(model?.drawingRotationQuarterTurns).toBe(0);
    expect(model?.houseFootprintPreset).toBe('straight');
    expect(model?.houseFootprintParams.bandDepthM).toBe('1.8');
    expect(model?.supportsHouseFootprints).toBe(true);
    expect(model?.attachmentEdgeLengthM).toBeCloseTo(6);
  });

  it('uses the selected attachment side to drive plan brackets and section span', () => {
    const module = makeModule({
      attachmentSide: 'left',
      houseConnectionType: 'soffit',
      lengthM: '6',
      projectionM: '3',
    });
    const planModel = buildModulePlanModel(module, null);
    const sectionModel = buildModuleSectionModel(module, null);

    expect(planModel).not.toBeNull();
    expect(planModel?.attachmentSide).toBe('left');
    expect(planModel?.attachmentEdgeLengthM).toBeCloseTo(3);
    expect(planModel?.rafterEdgeLengthM).toBeCloseTo(3);
    expect(planModel?.soffitBracketPositionsA[0]).toBeCloseTo(0.5, 6);
    expect(planModel?.soffitBracketPositionsA[planModel!.soffitBracketPositionsA.length - 1]).toBeCloseTo(2.5, 6);

    expect(sectionModel).not.toBeNull();
    expect(sectionModel?.attachmentSide).toBe('left');
    expect(sectionModel?.sectionSpanField).toBe('lengthM');
    expect(sectionModel?.spanA).toBeCloseTo(6);
  });

  it('maps beam profile dimensions for true-scale gable plan rendering', () => {
    const module = makeModule({ pergolaStyle: 'gable', lengthM: '6', projectionM: '3' });
    const result = makeResult({ roofType: 'gable', lengthA: 6, spanA: 3 });
    (result.derived as any).ledger_profile_used = '120x40';
    (result.derived as any).front_beam_profile_used = '100x50';
    (result.derived as any).ridge_beam_profile_used = '150x50';

    const model = buildModulePlanModel(module, result);

    expect(model).not.toBeNull();
    expect(model?.ledgerBeamDepthM).toBeCloseTo(0.12);
    expect(model?.ledgerBeamWidthM).toBeCloseTo(0.04);
    expect(model?.supportBeamDepthM).toBeCloseTo(0.1);
    expect(model?.supportBeamWidthM).toBeCloseTo(0.05);
    expect(model?.ridgeBeamDepthM).toBeCloseTo(0.15);
    expect(model?.ridgeBeamWidthM).toBeCloseTo(0.05);
  });

  it('mirrors L presets around the pergola width in local space', () => {
    const left = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'l_left',
      params: makeFootprintParams(),
    });
    const right = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'l_right',
      params: makeFootprintParams(),
    });

    const mirroredLeft = left.polygon.map((point) => ({ x: 6 - point.x, y: point.y }));

    expect(normalizePoints(mirroredLeft)).toEqual(normalizePoints(right.polygon));
  });

  it('applies house width, offset, and facade setback to local footprint layout and handles', () => {
    const layout = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'straight',
      params: makeFootprintParams({
        widthM: '8',
        offsetXM: '-1',
        setbackM: '0.4',
        bandDepthM: '2',
      }),
    });

    expect(layout.polygon).toEqual([
      { x: -1, y: -2.4 },
      { x: 7, y: -2.4 },
      { x: 7, y: -0.4 },
      { x: -1, y: -0.4 },
    ]);
    expect(layout.handles.find((handle) => handle.id === 'bandDepth')?.point).toEqual({ x: 3, y: -2.4 });
    expect(layout.edges.find((edge) => edge.id === 'bandDepth')?.end).toEqual({ x: 7, y: -2.4 });
  });

  it('builds recess presets as true front-opening notches aligned to the chosen side', () => {
    const left = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'recess_left',
      params: makeFootprintParams(),
    });
    const right = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'recess_right',
      params: makeFootprintParams(),
    });

    expect(normalizePoints(left.polygon)).toContain('2.400,0.000');
    expect(normalizePoints(left.polygon)).toContain('2.400,-1.200');
    expect(normalizePoints(left.polygon)).toContain('0.000,-1.200');
    expect(normalizePoints(right.polygon)).toContain('3.600,0.000');
    expect(normalizePoints(right.polygon)).toContain('3.600,-1.200');
    expect(normalizePoints(right.polygon)).toContain('6.000,-1.200');
  });

  it('builds wrap presets with a full side leg plus a partial front return on the same side', () => {
    const left = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'wrap_left',
      params: makeFootprintParams(),
    });
    const right = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'wrap_right',
      params: makeFootprintParams(),
    });

    expect(bounds(left.polygon)).toMatchObject({ minX: -1.8, maxX: 6, maxY: 6.8 });
    expect(bounds(right.polygon)).toMatchObject({ minX: 0, maxX: 7.8, maxY: 6.8 });
    expect(normalizePoints(left.polygon)).toContain('2.400,6.800');
    expect(normalizePoints(right.polygon)).toContain('3.600,6.800');
  });

  it('positions the U preset around the pergola on the correct side for all attachment edges', () => {
    const u = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'u_shape',
      params: makeFootprintParams(),
    });
    const rearBounds = bounds(transformLocalFootprint(u.polygon, { attachmentSide: 'rear', width: 6, depth: 5 }));
    const frontBounds = bounds(transformLocalFootprint(u.polygon, { attachmentSide: 'front', width: 6, depth: 5 }));
    const leftBounds = bounds(transformLocalFootprint(u.polygon, { attachmentSide: 'left', width: 6, depth: 5 }));
    const rightBounds = bounds(transformLocalFootprint(u.polygon, { attachmentSide: 'right', width: 6, depth: 5 }));

    expect(rearBounds.minY).toBeCloseTo(-1.8);
    expect(rearBounds.maxY).toBeCloseTo(2.4);
    expect(frontBounds.minY).toBeCloseTo(2.6);
    expect(frontBounds.maxY).toBeCloseTo(6.8);
    expect(leftBounds.minX).toBeCloseTo(-1.8);
    expect(leftBounds.maxX).toBeCloseTo(2.4);
    expect(rightBounds.minX).toBeCloseTo(3.6);
    expect(rightBounds.maxX).toBeCloseTo(7.8);
  });

  it('treats drawing quarter-turns as presentation-only rotation', () => {
    const wrap = buildHouseFootprintLocalLayout({
      pergolaWidthM: 6,
      pergolaDepthM: 5,
      preset: 'wrap_left',
      params: makeFootprintParams(),
    });
    const base = transformLocalFootprint(wrap.polygon, { attachmentSide: 'rear', width: 6, depth: 5 });
    const rotated = transformLocalFootprint(wrap.polygon, { attachmentSide: 'rear', width: 6, depth: 5, drawingTurns: 1 }).map((point) =>
      rotatePointQuarterTurns(point, { x: 3, y: 2.5 }, 3),
    );

    expect(normalizePoints(rotated)).toEqual(normalizePoints(base));
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

  it('uses derived overhang values when available', () => {
    const module = makeModule({
      pergolaStyle: 'pitched',
      projectionM: '3.0',
      overhangEnabled: false,
      overhangAmountM: '0.2',
    });
    const result = makeResult({
      roofType: 'pitched',
      spanA: 3,
      slopeDirection: 'away_from_house',
    });
    (result.derived as any).overhang_enabled = true;
    (result.derived as any).overhang_amount_m = 0.75;

    const model = buildModuleSectionModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.dataSource).toBe('derived');
    expect(model?.overhangEnabled).toBe(true);
    expect(model?.overhangAmountM).toBeCloseTo(0.75);
  });

  it('maps support beam profile dimensions for section rendering', () => {
    const module = makeModule({
      pergolaStyle: 'pitched',
      projectionM: '3.0',
      postCutHeightM: '2.4',
    });
    const result = makeResult({
      roofType: 'pitched',
      spanA: 3,
      slopeDirection: 'away_from_house',
    });
    (result.derived as any).front_beam_profile_used = '100x50';

    const model = buildModuleSectionModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.supportBeamDepthM).toBeCloseTo(0.1);
    expect(model?.supportBeamWidthM).toBeCloseTo(0.05);
  });

  it('maps post profile dimensions for section rendering', () => {
    const module = makeModule({
      pergolaStyle: 'pitched',
      projectionM: '3.0',
      postCutHeightM: '2.4',
    });
    const result = makeResult({
      roofType: 'pitched',
      spanA: 3,
      slopeDirection: 'away_from_house',
    });
    (result.derived as any).post_profile_used = '125x100';

    const model = buildModuleSectionModel(module, result);
    expect(model).not.toBeNull();
    expect(model?.postDepthM).toBeCloseTo(0.125);
    expect(model?.postWidthM).toBeCloseTo(0.1);
  });

  it('uses section member defaults when profiles are unavailable', () => {
    const module = makeModule({
      pergolaStyle: 'pitched',
      projectionM: '3.0',
      postCutHeightM: '2.4',
    });
    const model = buildModuleSectionModel(module, null);
    expect(model).not.toBeNull();
    expect(model?.ledgerBeamDepthM).toBeCloseTo(0.1);
    expect(model?.ledgerBeamWidthM).toBeCloseTo(0.05);
    expect(model?.postDepthM).toBeCloseTo(0.1);
    expect(model?.postWidthM).toBeCloseTo(0.1);
    expect(model?.supportBeamDepthM).toBeCloseTo(0.15);
    expect(model?.supportBeamWidthM).toBeCloseTo(0.05);
    expect(model?.gutterDepthM).toBeCloseTo(0.15);
    expect(model?.gutterWidthM).toBeCloseTo(0.1);
    expect(model?.ridgeBeamDepthM).toBeCloseTo(0.15);
    expect(model?.ridgeBeamWidthM).toBeCloseTo(0.05);
  });
});
