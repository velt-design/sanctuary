import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { ObjectWorkbenchPlanOverlay } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { buildPlanSvgPresentationModel } from './ModulePlanSvgPresentationModel';

const visible = {
  house: true,
  decks: true,
  pergolas: true,
  openings: true,
};

function projectionShape(
  input: Partial<GeometryTopProjectionShape> & Pick<GeometryTopProjectionShape, 'id' | 'family' | 'kind' | 'sourceType'>,
): GeometryTopProjectionShape {
  return {
    sourceObjectId: input.sourceObjectId ?? input.id,
    sourceId: input.sourceId ?? input.id,
    polygon: input.polygon ?? [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ],
    zOrder: input.zOrder ?? 0,
    zMin: input.zMin ?? null,
    zMax: input.zMax ?? null,
    metadata: input.metadata,
    ...input,
  };
}

function projection(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes,
    extents: {
      minX: 0,
      minY: 0,
      maxX: 6000,
      maxY: 4000,
      widthMm: 6000,
      heightMm: 4000,
    },
  };
}

function overlayShape(
  overrides: Partial<ObjectWorkbenchPlanOverlay['shapes'][number]> = {},
): ObjectWorkbenchPlanOverlay['shapes'][number] {
  return {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 3 },
      { x: 1, y: 3 },
    ],
    detailSegments: [],
    selected: false,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: null,
    openingInteraction: null,
    deckDragEligibility: null,
    openingDragEligibility: null,
    source: 'top_projection_committed',
    geometrySourceId: 'deck-1',
    renderStatus: 'geometry_ready',
    ...overrides,
  };
}

function build(input: Partial<Parameters<typeof buildPlanSvgPresentationModel>[0]> = {}) {
  return buildPlanSvgPresentationModel({
    isModel: true,
    useTopProjectionBackedPlan: true,
    useProjectionOnlyModelSpacePlan: true,
    modelSpaceTopProjection: projection([
      projectionShape({
        id: 'roof',
        family: 'house',
        kind: 'roof',
        sourceType: 'house_surface_solid',
        metadata: { topProjectionRole: 'top_visible' },
      }),
      projectionShape({
        id: 'footprint',
        family: 'house',
        kind: 'footprint',
        sourceType: 'house_surface',
        metadata: { topProjectionRole: 'top_visible' },
      }),
      projectionShape({
        id: 'deck-1',
        sourceId: 'deck-1',
        family: 'house',
        kind: 'deck',
        sourceType: 'house_surface_solid',
        metadata: { topProjectionRole: 'top_visible' },
      }),
      projectionShape({
        id: 'wall-edge',
        family: 'house',
        kind: 'wall_segment',
        sourceType: 'house_line',
        polygon: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
        ],
        metadata: {
          topProjectionRole: 'context',
          planDetailRole: 'wall_edge',
          snapRole: 'deck_host_edge',
        },
      }),
      projectionShape({
        id: 'reference-footprint',
        family: 'reference',
        kind: 'house-footprint',
        sourceType: 'house_reference',
        metadata: { topProjectionRole: 'context' },
      }),
    ]),
    familyVisibility: visible,
    baseX: 10,
    baseY: 20,
    scale: 2,
    rawObjectWorkbenchOverlayShapes: [overlayShape({ selected: true })],
    rawObjectWorkbenchPresetAnnotations: [],
    rawObjectWorkbenchCustomEdgeCandidates: [],
    rawObjectWorkbenchPreviewShape: null,
    ...input,
  });
}

describe('ModulePlanSvgPresentationModel', () => {
  it('builds the projection-only render contract with one visible body owner per semantic object', () => {
    const model = build();

    expect(model.diagnostics.renderContract).toBe('top_projection_only');
    expect(model.diagnostics.topProjectionParityStatus).toBe('pass');
    expect(model.diagnostics.duplicateCommittedBodyCount).toBe(0);
    expect(model.diagnostics.duplicateSemanticOwnerCount).toBe(0);
    expect(model.diagnostics.visibleLegacyPlanOverlayBodyCount).toBe(0);
    expect(model.diagnostics.visibleGeometryFallbackOverlayBodyCount).toBe(0);
    expect(model.diagnostics.visibleTopProjectionContextOverlayBodyCount).toBe(0);
    expect(model.diagnostics.committedTopProjectionBodyCount).toBe(2);
    expect(model.committedTopProjectionBodies.map(({ shape }) => shape.id)).toEqual(['roof', 'deck-1']);
  });

  it('keeps wall detail as context lines while suppressing context bodies', () => {
    const model = build();

    expect(model.renderedTopProjectionContextLines.map(({ shape }) => shape.id)).toEqual(['wall-edge']);
    expect(model.diagnostics.renderedTopProjectionWallDetailCount).toBe(1);
    expect(model.diagnostics.suppressedTopProjectionContextBodyCount).toBe(1);
  });

  it('keeps selected overlays bound to committed top projection sources', () => {
    const model = build({
      rawObjectWorkbenchOverlayShapes: [
        overlayShape({
          ownerKind: 'footprint',
          ownerId: 'house',
          selected: true,
          source: 'geometry_plan_fallback',
        }),
        overlayShape({
          ownerKind: 'deck',
          ownerId: 'deck-1',
          selected: true,
          source: 'top_projection_committed',
        }),
      ],
    });

    expect(model.objectWorkbenchOverlayShapes).toHaveLength(1);
    expect(model.objectWorkbenchOverlayShapes[0]?.ownerKind).toBe('deck');
    expect(model.objectWorkbenchOverlayShapes[0]?.source).toBe('top_projection_committed');
    expect(model.diagnostics.visibleGeometryFallbackOverlayBodyCount).toBe(0);
    expect(model.diagnostics.visibleTopProjectionCommittedOverlayBodyCount).toBe(1);
  });

  it('preserves legacy fallback body rendering when top projection is unavailable', () => {
    const model = build({
      useTopProjectionBackedPlan: false,
      useProjectionOnlyModelSpacePlan: false,
      modelSpaceTopProjection: null,
      rawObjectWorkbenchOverlayShapes: [overlayShape({ source: 'geometry', selected: true })],
    });

    expect(model.diagnostics.renderContract).toBe('legacy_or_fallback');
    expect(model.renderObjectWorkbenchCommittedBodies).toBe(true);
    expect(model.diagnostics.objectWorkbenchRenderedBodyCount).toBe(1);
    expect(model.objectWorkbenchOverlayShapes[0]?.source).toBe('geometry');
  });
});
