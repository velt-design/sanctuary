import { describe, expect, it } from 'vitest';
import type {
  HouseFirstPlanDeckInteraction,
  HouseFirstPlanDeckReferenceFrame,
  HouseFirstPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/houseFirstPlanOverlay';
import {
  buildDeckDragSession,
  resolveDeckPreviewState,
} from './deckInteractionAdapter';

function makeFrame(input: Partial<HouseFirstPlanDeckReferenceFrame> & Pick<HouseFirstPlanDeckReferenceFrame, 'hostEdgeId' | 'sourceEdgeId' | 'axis' | 'hostEdgeStart' | 'hostEdgeEnd' | 'alongUnitX' | 'alongUnitY' | 'outwardUnitX' | 'outwardUnitY' | 'spanStartM' | 'spanEndM' | 'edgeCoordinateM' | 'outwardDirection'>): HouseFirstPlanDeckReferenceFrame {
  return input;
}

function makeInteraction(input: {
  polygon: PlanPoint[];
  frames: HouseFirstPlanDeckReferenceFrame[];
  deckWidthM: number;
  deckDepthM: number;
  renderedCenter: PlanPoint;
}): HouseFirstPlanDeckInteraction {
  const primaryFrame = input.frames[0]!;
  return {
    kind: 'preset_rect',
    placement: 'snapped',
    attachmentMode: 'single_edge',
    houseAttachmentSide: 'rear',
    semanticPlacementSide: 'rear',
    semanticWitnessSide: 'rear',
    placementEdgeId: primaryFrame.sourceEdgeId,
    primaryHostEdgeId: primaryFrame.sourceEdgeId,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: primaryFrame.sourceEdgeId,
    hostEdgeStart: primaryFrame.hostEdgeStart,
    hostEdgeEnd: primaryFrame.hostEdgeEnd,
    hostSpanM: primaryFrame.spanEndM - primaryFrame.spanStartM,
    deckWidthM: input.deckWidthM,
    deckDepthM: input.deckDepthM,
    centerOffsetM: 0,
    referenceEdgeGapM: 0,
    minCenterOffsetM: -20,
    maxCenterOffsetM: 20,
    renderedCenter: input.renderedCenter,
    referenceFrames: input.frames,
    crossEdgeReference: null,
  };
}

function makeSession(input: {
  polygon: PlanPoint[];
  startDragPlanPoint: PlanPoint;
  frames: HouseFirstPlanDeckReferenceFrame[];
  renderedCenter: PlanPoint;
  deckWidthM: number;
  deckDepthM: number;
}) {
  const overlayShape = {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon: input.polygon,
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: makeInteraction({
      polygon: input.polygon,
      frames: input.frames,
      deckWidthM: input.deckWidthM,
      deckDepthM: input.deckDepthM,
      renderedCenter: input.renderedCenter,
    }),
    openingInteraction: null,
    deckDragEligibility: { eligible: true, reason: 'Drag deck' },
    openingDragEligibility: null,
  } satisfies HouseFirstPlanShapeOverlay;

  const session = buildDeckDragSession({
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    startSvgX: input.startDragPlanPoint.x,
    startSvgY: input.startDragPlanPoint.y,
    startDragPlanPoint: input.startDragPlanPoint,
    deckId: 'deck-1',
    overlayShape,
    svgInteraction: {
      hostEdgeStart: input.frames[0]!.hostEdgeStart,
      hostEdgeEnd: input.frames[0]!.hostEdgeEnd,
    },
  });
  if (!session) {
    throw new Error('Expected drag session.');
  }
  return session;
}

describe('deckInteractionAdapter', () => {
  const rearFrame = makeFrame({
    hostEdgeId: 'rear',
    sourceEdgeId: 'footprint-edge-1',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 4,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 4, y: 0 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: 1,
  });
  const leftFrame = makeFrame({
    hostEdgeId: 'left',
    sourceEdgeId: 'footprint-edge-4',
    axis: 'depth',
    spanStartM: 0,
    spanEndM: 3,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 0, y: 3 },
    alongUnitX: 0,
    alongUnitY: 1,
    outwardUnitX: 1,
    outwardUnitY: 0,
  });

  it('does not trigger corner mode just because a wide deck overlaps a second wall span', () => {
    const polygon = [
      { x: -0.45, y: 0 },
      { x: 4.55, y: 0 },
      { x: 4.55, y: 2 },
      { x: -0.45, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 4.5, y: 0.08 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2.05, y: 1 },
      deckWidthM: 5,
      deckDepthM: 2,
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });

    expect(preview.attachmentMode).toBe('single_edge');
    expect(preview.secondaryHostEdgeId).toBeNull();
    expect(preview.lockedCornerPoint).toBeNull();
  });

  it('locks corner mode from the held deck corner and preserves it through small jitter', () => {
    const polygon = [
      { x: -0.08, y: 0 },
      { x: 4.92, y: 0 },
      { x: 4.92, y: 2 },
      { x: -0.08, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: -0.06, y: 0.04 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2.42, y: 1 },
      deckWidthM: 5,
      deckDepthM: 2,
    });

    const firstPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const jitteredPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX + 0.12,
      nextSvgY: session.startSvgY + 0.1,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x + 0.12,
        y: session.startDragPlanPoint!.y + 0.1,
      },
      previousPreviewState: firstPreview,
    });

    expect(firstPreview.attachmentMode).toBe('corner_dual_edge');
    expect(firstPreview.lockedCornerPoint).toEqual({ x: 0, y: 0 });
    expect(firstPreview.secondaryHostEdgeId).toBe('footprint-edge-4');
    expect(jitteredPreview.attachmentMode).toBe('corner_dual_edge');
    expect(jitteredPreview.cornerVertexId).toBe(firstPreview.cornerVertexId);
    expect(jitteredPreview.heldCornerIndex).toBe(firstPreview.heldCornerIndex);
  });

  it('softly aligns oversized single-edge decks to wall ends without clamping them to the span', () => {
    const polygon = [
      { x: 0.06, y: 0 },
      { x: 6.06, y: 0 },
      { x: 6.06, y: 2 },
      { x: 0.06, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 3.2, y: 0.08 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 3.06, y: 1 },
      deckWidthM: 6,
      deckDepthM: 2,
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });

    expect(preview.attachmentMode).toBe('single_edge');
    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.endCatchSide).toBe('start');
    expect(preview.endCatchPoint).toEqual(rearFrame.hostEdgeStart);
    expect(preview.centerOffsetM).toBe(1);
  });
});
