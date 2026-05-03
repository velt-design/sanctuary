import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import type { ModulePlanModel } from './moduleViews';
import {
  getPlanRealExtents,
  hipCornerInnerPoints,
  planHouseLineClass,
  planHouseSurfaceClass,
  resolvePlanRotationFrame,
} from './ModulePlanGeometryPresentation';
import {
  getPlanSheetFrame,
  resolvePlanFixedScaleBox,
  resolvePlanSheetLayout,
} from './ModulePlanSheetLayoutPresentation';
import {
  resolvePlanModelSpaceLayout,
  topProjectionExtentsToModelSpaceBounds,
} from './ModulePlanModelSpaceLayoutPresentation';
import { MODEL_SPACE_UNITS_PER_METRE } from './ModuleDrawingSurfacePrimitives';

function basePlanModel(overrides: Partial<ModulePlanModel> = {}): ModulePlanModel {
  return {
    dataSource: 'derived',
    pergolaStyle: 'pitched',
    roofType: 'pitched',
    boxPerimeterEnabled: false,
    houseConnectionType: 'soffit',
    attachmentSide: 'rear',
    drawingRotationQuarterTurns: 0,
    houseFootprintPreset: 'straight',
    houseFootprintParams: {
      widthM: '6',
      offsetXM: '0',
      setbackM: '0',
      bandDepthM: '2',
      returnRunM: '2',
      recessWidthM: '2',
      recessDepthM: '1',
      leftLegRunM: '2',
      rightLegRunM: '2',
      sideRunM: '2',
    },
    supportsHouseFootprints: true,
    overhangEnabled: false,
    overhangAmountM: 0,
    slopeDirection: 'away_from_house',
    lengthA: 6,
    spanA: 3,
    lengthB: null,
    spanB: null,
    rafterWidthM: 0.05,
    rafterDepthM: 0.15,
    ledgerBeamWidthM: 0.09,
    ledgerBeamDepthM: 0.19,
    supportBeamWidthM: 0.09,
    supportBeamDepthM: 0.19,
    gutterWidthM: 0.1,
    gutterDepthM: 0.12,
    ridgeBeamWidthM: 0.09,
    ridgeBeamDepthM: 0.19,
    rafterMaxSpacingM: 0.63,
    rafterCountA: 5,
    rafterSpacingA: 0.63,
    rafterPositionsA: [0, 1.5, 3, 4.5, 6],
    rafterEdgeLengthM: 3,
    rafterCountB: null,
    rafterSpacingB: null,
    rafterPositionsB: null,
    attachmentEdgeLengthM: 6,
    soffitBracketOffsetM: 0.2,
    soffitBracketMaxSpacingM: 1,
    soffitBracketPositionsA: [0.2, 1.2, 2.2],
    houseContext: null,
    ...overrides,
  };
}

function topProjection(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes: [],
    extents: {
      minX: 1000,
      minY: 2000,
      maxX: 5000,
      maxY: 6000,
      widthMm: 4000,
      heightMm: 4000,
    },
  };
}

describe('plan layout owner modules', () => {
  it('keeps shared geometry helpers in the geometry presentation owner', () => {
    const model = basePlanModel({
      drawingRotationQuarterTurns: 1,
      houseContext: {
        surfaces: [
          {
            id: 'roof',
            kind: 'roof',
            boundary: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 4 },
              { x: 0, y: 4 },
            ],
          },
        ],
        lines: [],
      },
    });

    expect(getPlanRealExtents(model)).toEqual({ widthM: 4, heightM: 10 });
    expect(resolvePlanRotationFrame({ x: 10, y: 20, width: 100, height: 40, turns: 1 })).toEqual({
      baseX: -20,
      baseY: 50,
      center: { x: 30, y: 70 },
      turns: 1,
    });
    expect(hipCornerInnerPoints(0, 0, 8, 4, 3, 6, 0.05)[0]).toEqual({ x: 0.2, y: 0.2 });
    expect(planHouseSurfaceClass('roof')).not.toEqual(planHouseSurfaceClass('footprint'));
    expect(planHouseLineClass('wall_segment')).not.toEqual(planHouseLineClass('roof_feature'));
  });

  it('keeps sheet layout helpers in the sheet layout owner', () => {
    const frame = getPlanSheetFrame(false);
    const fixedBox = resolvePlanFixedScaleBox(6, 3, false, 50);
    const layout = resolvePlanSheetLayout({
      model: basePlanModel(),
      drawingScale: { mode: 'fixed', ratio: 50 },
    });

    expect(frame.outerField.width).toBe(120);
    expect(frame.fitArea.height).toBe(86);
    expect(fixedBox.x).toBeCloseTo(35);
    expect(fixedBox.y).toBeCloseTo(30.5);
    expect(fixedBox.scale).toBeCloseTo(8.333333333);
    expect(layout.scale).toBeCloseTo(fixedBox.scale);
    expect(layout.annotatedBounds.maxX).toBeGreaterThan(layout.annotatedBounds.minX);
    expect(layout.annotatedBounds.maxY).toBeGreaterThan(layout.annotatedBounds.minY);
  });

  it('keeps model-space top-projection fitting in the model-space layout owner', () => {
    const projectionBounds = topProjectionExtentsToModelSpaceBounds(topProjection(), MODEL_SPACE_UNITS_PER_METRE);
    const layout = resolvePlanModelSpaceLayout(basePlanModel(), undefined, { topProjection: topProjection() });

    expect(projectionBounds).toEqual({
      minX: MODEL_SPACE_UNITS_PER_METRE,
      minY: MODEL_SPACE_UNITS_PER_METRE * 2,
      maxX: MODEL_SPACE_UNITS_PER_METRE * 5,
      maxY: MODEL_SPACE_UNITS_PER_METRE * 6,
    });
    expect(layout.focusBounds).toEqual(projectionBounds);
    expect(layout.viewBox.width).toBeGreaterThan(0);
    expect(layout.viewBox.height).toBeGreaterThan(0);
  });
});
