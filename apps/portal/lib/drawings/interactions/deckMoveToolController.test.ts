import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { buildDeckObjectPatchCommit } from './deckInteractionAdapter';
import {
  moveDeckMoveTool,
  releaseDeckMoveTool,
  startDeckMoveTool,
} from './deckMoveToolController';
import type { InteractionToolPointer } from './interactionToolController';

function makeFrame(): ObjectWorkbenchPlanDeckReferenceFrame {
  return {
    hostEdgeId: 'rear',
    sourceEdgeId: 'wall-rear',
    frameSource: 'top_projection_wall_edge',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 8,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 8, y: 0 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: 1,
  };
}

function polygonCenter(polygon: PlanPoint[]): PlanPoint {
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function makePointer(input: { svg: PlanPoint; plan?: PlanPoint | null; pointerId?: number }): InteractionToolPointer {
  return {
    pointerId: input.pointerId ?? 1,
    clientX: input.svg.x,
    clientY: input.svg.y,
    svgPoint: input.svg,
    planPoint: input.plan ?? null,
  };
}

function makeInteraction(input?: {
  kind?: ObjectWorkbenchPlanDeckInteraction['kind'];
  placement?: ObjectWorkbenchPlanDeckInteraction['placement'];
  dragSource?: ObjectWorkbenchPlanDeckInteraction['dragSource'];
  dragCoordinateSpace?: ObjectWorkbenchPlanDeckInteraction['dragCoordinateSpace'];
  polygon?: PlanPoint[];
}): ObjectWorkbenchPlanDeckInteraction {
  const frame = makeFrame();
  const polygon = input?.polygon ?? [
    { x: 2, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 3 },
    { x: 2, y: 3 },
  ];
  const placement = input?.placement ?? 'floating';
  const center = polygonCenter(polygon);
  return {
    kind: input?.kind ?? 'preset_rect',
    placement,
    attachmentMode: placement === 'snapped' ? 'single_edge' : 'floating',
    houseAttachmentSide: 'rear',
    semanticPlacementSide: placement === 'snapped' ? 'rear' : null,
    semanticWitnessSide: 'rear',
    placementEdgeId: placement === 'snapped' ? frame.sourceEdgeId : null,
    primaryHostEdgeId: placement === 'snapped' ? frame.sourceEdgeId : null,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: frame.sourceEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    hostSpanM: frame.spanEndM - frame.spanStartM,
    deckWidthM: 4,
    deckDepthM: 2,
    centerOffsetM: 0,
    referenceEdgeGapM: placement === 'snapped' ? 0 : 1,
    minCenterOffsetM: -4,
    maxCenterOffsetM: 4,
    renderedCenter: center,
    dragPolygon: polygon,
    dragCenter: center,
    dragCoordinateSpace: input?.dragCoordinateSpace ?? 'top_projection_world_m',
    dragSource: input?.dragSource ?? 'top_projection_committed',
    commitStartPolygon: polygon,
    referenceFrames: [frame],
    commitReferenceFrames: [frame],
    snapFrameSource: 'top_projection_wall_edge',
    crossEdgeReference: null,
  };
}

function makeOverlay(input?: {
  interaction?: ObjectWorkbenchPlanDeckInteraction;
  polygon?: PlanPoint[];
}): ObjectWorkbenchPlanShapeOverlay {
  const interaction = input?.interaction ?? makeInteraction({ polygon: input?.polygon });
  const polygon = input?.polygon ?? interaction.dragPolygon;
  return {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon,
    detailSegments: [],
    selected: true,
    custom: interaction.kind === 'custom_outline',
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: interaction,
    openingInteraction: null,
    deckDragEligibility: { eligible: true, reason: 'Drag deck' },
    openingDragEligibility: null,
    source: interaction.dragSource,
    geometrySourceId: 'deck-1',
    renderStatus: 'geometry_ready',
  };
}

describe('deckMoveToolController', () => {
  it('starts projection-backed drag from the committed drag polygon and projection point', () => {
    const dragPolygon = [
      { x: 10, y: 10 },
      { x: 14, y: 10 },
      { x: 14, y: 12 },
      { x: 10, y: 12 },
    ];
    const overlayShape = makeOverlay({
      interaction: makeInteraction({ polygon: dragPolygon }),
      polygon: [
        { x: -1, y: -1 },
        { x: -2, y: -1 },
        { x: -2, y: -2 },
        { x: -1, y: -2 },
      ],
    });

    const result = startDeckMoveTool(
      {
        deckId: 'deck-1',
        overlayShape,
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 8, y: 0 },
        },
      },
      makePointer({ svg: { x: 11, y: 11 }, plan: { x: 11, y: 11 } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.startPolygon).toEqual(dragPolygon);
    expect(result.session.grabbedPlanPoint).toEqual({ x: 11, y: 11 });
    expect(result.session.pointerResolverSource).toBe('top_projection_inverse');
  });

  it('translates preview polygon by projection pointer deltas in each screen direction', () => {
    const startPolygon = [
      { x: 2, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 3 },
      { x: 2, y: 3 },
    ];
    const start = startDeckMoveTool(
      {
        deckId: 'deck-1',
        overlayShape: makeOverlay({
          interaction: makeInteraction({
            kind: 'custom_outline',
            polygon: startPolygon,
          }),
        }),
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 8, y: 0 },
        },
      },
      makePointer({ svg: { x: 4, y: 2 }, plan: { x: 4, y: 2 } }),
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    for (const delta of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ]) {
      const preview = moveDeckMoveTool({
        session: start.session,
        pointer: makePointer({
          svg: { x: 4 + delta.x, y: 2 + delta.y },
          plan: { x: 4 + delta.x, y: 2 + delta.y },
        }),
        previousPreviewState: null,
      });
      expect(preview.polygon).toEqual(
        startPolygon.map((point) => ({
          x: point.x + delta.x,
          y: point.y + delta.y,
        })),
      );
    }
  });

  it('returns the same deck release target and patch as the adapter commit', () => {
    const start = startDeckMoveTool(
      {
        deckId: 'deck-1',
        overlayShape: makeOverlay(),
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 8, y: 0 },
        },
      },
      makePointer({ svg: { x: 4, y: 2 }, plan: { x: 4, y: 2 } }),
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const preview = moveDeckMoveTool({
      session: start.session,
      pointer: makePointer({ svg: { x: 5, y: 5 }, plan: { x: 5, y: 5 } }),
      previousPreviewState: null,
    });
    const release = releaseDeckMoveTool({ session: start.session, preview });
    const adapterCommit = buildDeckObjectPatchCommit({ session: start.session, preview });

    expect(release.target).toEqual(adapterCommit.target);
    expect(release.patch).toEqual(adapterCommit.patch);
    expect(release.commitSource).toBe('floating_rect_from_projection_preview');
    expect(release.commitCoordinateSpace).toBe(release.commitTransform.commitCoordinateSpace);
    expect(release.coordinateTrace.patch).toEqual(adapterCommit.patch);
    expect(release.coordinateTrace.transform).toEqual(release.commitTransform);
    expect(release.coordinateTrace.releasePolygon).toEqual(preview.polygon);
  });

  it('blocks projection-backed drag start when the projection point is missing', () => {
    const result = startDeckMoveTool(
      {
        deckId: 'deck-1',
        overlayShape: makeOverlay(),
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 8, y: 0 },
        },
      },
      makePointer({ svg: { x: 4, y: 2 }, plan: null }),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.status).toBe('blocked');
    expect(result.diagnostics.source).toBe('top_projection_committed');
  });
});
