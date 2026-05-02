import { describe, expect, it } from 'vitest';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { ObjectWorkbenchOverlayShape } from './ModulePlanLayerRenderers';
import type { ModulePlanModel } from './moduleViews';
import {
  buildPlanSvgGeometryPresentation,
  resolvePlanSvgGeometryPresentationMode,
} from './ModulePlanSvgGeometryPresentation';

const visible: DrawingWorkbenchVisibilityState = {
  house: true,
  decks: true,
  pergolas: true,
  openings: true,
};

function topProjection(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes: [],
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

function planModel(): ModulePlanModel {
  return {
    houseContext: {
      surfaces: [
        {
          id: 'roof',
          kind: 'roof',
          boundary: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
        },
        {
          id: 'deck-1',
          kind: 'deck',
          boundary: [
            { x: 1, y: 3 },
            { x: 5, y: 3 },
            { x: 5, y: 5 },
            { x: 1, y: 5 },
          ],
        },
      ],
      lines: [
        {
          id: 'wall-rear',
          kind: 'wall_segment',
          line: {
            start: { x: 0, y: 3 },
            end: { x: 6, y: 3 },
          },
          metadata: {
            sourceEdgeId: 'edge-rear',
          },
        },
      ],
    },
  } as unknown as ModulePlanModel;
}

function geometryPlan(): GeometryPlanViewModel {
  return {
    outline: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ],
    attachmentEdge: {
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
    },
    members: {
      posts: [
        {
          id: 'post-1',
          role: 'post',
          centerline: {
            start: { x: 1000, y: 500 },
            end: { x: 1000, y: 500 },
          },
          profile: {
            shape: 'rectangular',
            widthMm: 90,
            depthMm: 90,
          },
          lengthMm: 2400,
        },
      ],
      beams: [],
      ledgers: [],
      rafters: [
        {
          id: 'rafter-1',
          role: 'rafter',
          centerline: {
            start: { x: 0, y: 250 },
            end: { x: 4000, y: 250 },
          },
          profile: {
            shape: 'rectangular',
            widthMm: 50,
            depthMm: 150,
          },
          lengthMm: 4000,
        },
      ],
      gutters: [],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [
        {
          id: 'roof-plane',
          kind: 'roof_plane',
          boundary: [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 2000 },
            { x: 0, y: 2000 },
          ],
        },
      ],
      roofCladding: [],
    },
    anchors: {
      fall: {
        point: { x: 2000, y: 1000 },
        direction: { x: 0, y: 1 },
        dual: false,
      },
    },
  } as unknown as GeometryPlanViewModel;
}

function selectedOpeningOverlay(): ObjectWorkbenchOverlayShape {
  return {
    ownerKind: 'opening',
    ownerId: 'opening-1',
    points: [],
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: null,
    deckInteractionSvg: null,
    openingInteraction: {
      kind: 'opening',
      hostEdgeId: 'edge-rear',
      hostEdgeStart: { x: 0, y: 0 },
      hostEdgeEnd: { x: 6, y: 0 },
    } as ObjectWorkbenchOverlayShape['openingInteraction'],
    deckDragEligibility: null,
    openingDragEligibility: null,
    source: 'top_projection_committed',
    geometrySourceId: 'opening-1',
    renderStatus: 'geometry_ready',
  } as unknown as ObjectWorkbenchOverlayShape;
}

function build(input?: {
  presentation?: 'card' | 'minimal' | 'sheet' | 'model';
  projection?: GeometryTopProjectionViewModel | null;
  geometry?: GeometryPlanViewModel | null;
  familyVisibility?: DrawingWorkbenchVisibilityState;
  objectWorkbenchOverlayShapes?: ObjectWorkbenchOverlayShape[];
  visibleObjectWorkbenchDeckIds?: Set<string>;
}) {
  const presentation = input?.presentation ?? 'model';
  const familyVisibility = input?.familyVisibility ?? visible;
  const projection = input?.projection ?? null;
  const geometry = input?.geometry ?? geometryPlan();
  const mode = resolvePlanSvgGeometryPresentationMode({
    presentation,
    showPergolaGeometry: familyVisibility.pergolas,
    modelSpacePergolaRenderSource: 'geometry',
    modelSpacePergolaRenderStatus: 'geometry_ready',
    modelSpaceTopProjection: projection,
    modelSpacePergolaGeometry: geometry,
  });
  return buildPlanSvgGeometryPresentation({
    model: planModel(),
    presentation,
    mode,
    modelSpaceTopProjection: projection,
    modelSpacePergolaGeometry: geometry,
    familyVisibility,
    objectWorkbenchOverlayShapes: input?.objectWorkbenchOverlayShapes ?? [],
    visibleObjectWorkbenchDeckIds: input?.visibleObjectWorkbenchDeckIds ?? new Set(),
    customPolygonOverrideActive: false,
    hideHouseFootprint: false,
    baseX: 10,
    baseY: 20,
    scale: 2,
  });
}

describe('ModulePlanSvgGeometryPresentation', () => {
  it('uses projection-only model space and suppresses semantic house context when top projection is ready', () => {
    const presentation = build({ projection: topProjection() });

    expect(presentation.useTopProjectionBackedPlan).toBe(true);
    expect(presentation.useProjectionOnlyModelSpacePlan).toBe(true);
    expect(presentation.semanticPlanHouseSurfaces).toEqual([]);
    expect(presentation.semanticPlanHouseLines).toEqual([]);
    expect(presentation.hasSemanticPlanHouseContext).toBe(false);
  });

  it('projects geometry-backed pergola surfaces and members through the existing SVG transform', () => {
    const presentation = build();

    expect(presentation.useGeometryBackedPergola).toBe(true);
    expect(presentation.geometryOutlinePoints).toEqual([
      { x: 10, y: 20 },
      { x: 18, y: 20 },
      { x: 18, y: 24 },
      { x: 10, y: 24 },
    ]);
    expect(presentation.geometryRoofPlaneSurfaces[0]?.points).toEqual(presentation.geometryOutlinePoints);
    expect(presentation.geometryPergolaStripMembers[0]?.footprint).toHaveLength(4);
    expect(presentation.geometryRafterMembers[0]?.footprint[0]?.x).toBeCloseTo(10, 6);
  });

  it('emphasizes the selected opening host edge in legacy semantic house context', () => {
    const presentation = build({
      objectWorkbenchOverlayShapes: [selectedOpeningOverlay()],
    });

    expect(presentation.selectedOpeningHostEdgeId).toBe('edge-rear');
    expect(presentation.semanticPlanHouseSurfaces.find((surface) => surface.id === 'roof')?.toned).toBe(true);
    expect(presentation.semanticPlanHouseLines[0]).toMatchObject({
      id: 'wall-rear',
      emphasized: true,
      start: { x: 10, y: 26 },
      end: { x: 22, y: 26 },
    });
  });

  it('honors family visibility for pergola render eligibility and deck semantic surfaces', () => {
    const presentation = build({
      familyVisibility: {
        ...visible,
        decks: false,
        pergolas: false,
      },
    });

    expect(presentation.canRenderPergolaPlanGeometry).toBe(false);
    expect(presentation.semanticPlanHouseSurfaces.map((surface) => surface.id)).toEqual(['roof']);
  });

  it('preserves sheet and card semantic house context when top projection is unavailable', () => {
    const sheet = build({ presentation: 'sheet', geometry: null });
    const card = build({ presentation: 'card', geometry: null });

    expect(sheet.useTopProjectionBackedPlan).toBe(false);
    expect(sheet.semanticPlanHouseSurfaces.map((surface) => surface.id)).toEqual(['roof', 'deck-1']);
    expect(card.useTopProjectionBackedPlan).toBe(false);
    expect(card.semanticPlanHouseLines.map((line) => line.id)).toEqual(['wall-rear']);
  });
});
