import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type {
  DeckCommitCoordinateTrace,
  DeckCommitTransformDiagnostics,
  DeckPreviewState,
} from './deckInteractionAdapter';
import {
  advanceDeckReleaseSettleState,
  createDeckReleaseSettleState,
  resolveDeckCommitSettleState,
  resolveDeckReleasePreview,
  resolveDeckSettleMatch,
  type DeckDragSettleState,
} from './deckReleaseSettlementController';

const polygon: PlanPoint[] = [
  { x: 1, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 2 },
  { x: 1, y: 2 },
];

const frame: ObjectWorkbenchPlanDeckReferenceFrame = {
  hostEdgeId: 'rear',
  sourceEdgeId: 'wall-rear',
  frameSource: 'top_projection_wall_edge',
  axis: 'along',
  spanStartM: 0,
  spanEndM: 6,
  edgeCoordinateM: 0,
  outwardDirection: 1,
  hostEdgeStart: { x: 0, y: 0 },
  hostEdgeEnd: { x: 6, y: 0 },
  alongUnitX: 1,
  alongUnitY: 0,
  outwardUnitX: 0,
  outwardUnitY: 1,
};

const commitTransform: DeckCommitTransformDiagnostics = {
  renderFrameId: 'wall-rear',
  commitFrameId: 'wall-rear',
  renderCoordinateSpace: 'top_projection_world_m',
  commitCoordinateSpace: 'object_frame_m',
  transformSource: 'top_projection_to_object_frame',
};

function makePreview(overrides: Partial<DeckPreviewState> = {}): DeckPreviewState {
  return {
    deckId: 'deck-1',
    polygon,
    previewAnchor: { x: 3, y: 1 },
    activeSnapMode: 'single_edge',
    snapTargetState: 'stable',
    attachmentMode: 'single_edge',
    semanticPlacementSide: 'rear',
    semanticWitnessSide: 'rear',
    activePrimaryTargetId: 'wall-rear',
    activeSecondaryTargetId: null,
    placementEdgeId: 'wall-rear',
    primaryHostEdgeId: 'wall-rear',
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: 'wall-rear',
    highlightTargetId: 'wall-rear',
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    secondaryHostEdgeStart: null,
    secondaryHostEdgeEnd: null,
    grabbedPlanPoint: { x: 3, y: 1 },
    heldCornerIndex: 0,
    heldCornerPoint: polygon[0]!,
    grabbedPointAlongOffsetFromCenterM: 0,
    grabbedPointDepthFromNearEdgeM: 1,
    previewWallFrameId: 'wall-rear',
    activeLockedWallFrameId: 'wall-rear',
    anchorAlongM: 3,
    anchorDerivedCenterOffsetM: 0,
    wallTargetStability: 'stable',
    lockedCornerPoint: null,
    endCatchSide: null,
    endCatchPoint: null,
    centerOffsetM: 0,
    referenceEdgeGapM: 0,
    placement: 'snapped',
    snapEligible: true,
    releasePlacement: 'snapped',
    referenceGuide: null,
    ...overrides,
  };
}

function makeCoordinateTrace(preview: DeckPreviewState): DeckCommitCoordinateTrace {
  return {
    dragStartPolygon: preview.polygon,
    previewPolygon: preview.polygon,
    releasePolygon: preview.polygon,
    commitSpacePolygon: preview.polygon,
    rebuiltProjectionPolygon: null,
    patch: {
      hostEdgeId: preview.witnessEdgeId,
      attachmentMode: preview.attachmentMode,
      primaryHostEdgeId: preview.primaryHostEdgeId,
      secondaryHostEdgeId: preview.secondaryHostEdgeId,
      cornerVertexId: preview.cornerVertexId,
      isAttached: preview.releasePlacement === 'snapped',
    },
    transform: commitTransform,
    centroidDeltaM: {
      previewToCommit: { x: 0, y: 0 },
      releaseToRebuilt: null,
    },
  };
}

function makeSettlingState(
  overrides: Partial<DeckDragSettleState> = {},
): DeckDragSettleState {
  const preview = overrides.previewState ?? makePreview();
  return {
    ...createDeckReleaseSettleState({
      deckId: preview.deckId,
      previewState: preview,
      commitStartedAtMs: 900,
      commitSource: preview.releasePlacement === 'floating'
        ? 'floating_rect_from_projection_preview'
        : 'snapped_frame_commit',
      commitTransform,
      coordinateTrace: makeCoordinateTrace(preview),
    }),
    ...overrides,
  };
}

function makeCommittedState(
  overrides: Partial<DeckDragSettleState> = {},
): DeckDragSettleState {
  return resolveDeckCommitSettleState({
    state: makeSettlingState(overrides),
    ok: true,
    resolvedAtMs: 1000,
  });
}

function makeDeckShape(overrides: Partial<ObjectWorkbenchPlanShapeOverlay> = {}): ObjectWorkbenchPlanShapeOverlay {
  return {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon,
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: {
      kind: 'preset_rect',
      placement: 'snapped',
      attachmentMode: 'single_edge',
      houseAttachmentSide: 'rear',
      semanticPlacementSide: 'rear',
      semanticWitnessSide: 'rear',
      placementEdgeId: 'wall-rear',
      primaryHostEdgeId: 'wall-rear',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      witnessEdgeId: 'wall-rear',
      hostEdgeStart: frame.hostEdgeStart,
      hostEdgeEnd: frame.hostEdgeEnd,
      hostSpanM: 6,
      deckWidthM: 4,
      deckDepthM: 2,
      centerOffsetM: 0,
      referenceEdgeGapM: 0,
      minCenterOffsetM: -3,
      maxCenterOffsetM: 3,
      renderedCenter: { x: 3, y: 1 },
      dragPolygon: polygon,
      dragCenter: { x: 3, y: 1 },
      dragCoordinateSpace: 'top_projection_world_m',
      dragSource: 'top_projection_committed',
      commitStartPolygon: polygon,
      referenceFrames: [frame],
      commitReferenceFrames: [frame],
      snapFrameSource: 'top_projection_wall_edge',
      crossEdgeReference: null,
    },
    openingInteraction: null,
    deckDragEligibility: { eligible: true, reason: 'ready' },
    openingDragEligibility: null,
    source: 'top_projection_committed',
    geometrySourceId: 'deck-1',
    renderStatus: 'geometry_ready',
    ...overrides,
  };
}

describe('deckReleaseSettlementController', () => {
  it('preserves the coordinate trace while release settle is pending', () => {
    const preview = makePreview();
    const trace = makeCoordinateTrace(preview);
    const state = createDeckReleaseSettleState({
      deckId: preview.deckId,
      previewState: preview,
      commitStartedAtMs: 900,
      commitSource: 'snapped_frame_commit',
      commitTransform,
      coordinateTrace: trace,
    });

    expect(state.coordinateTrace).toBe(trace);
    expect(state.coordinateTrace.transform).toBe(commitTransform);
    expect(state.coordinateTrace.centroidDeltaM.releaseToRebuilt).toBeNull();
  });

  it('keeps a committed snapped release frozen until rebuilt top-projection geometry is stable', () => {
    const state = makeCommittedState();
    const match = resolveDeckSettleMatch({
      settleState: state,
      settledDeckShape: makeDeckShape(),
    });

    const firstFrame = advanceDeckReleaseSettleState({
      state,
      match,
      viewportStable: true,
      requiresCanonicalMatch: true,
      nowMs: 1010,
    });

    expect(firstFrame.finalizeOutcome).toBeNull();
    expect(firstFrame.releaseFeedback).toBeNull();
    expect(firstFrame.state.stableMatchFrameCount).toBe(1);
    expect(firstFrame.state.coordinateTrace.rebuiltProjectionPolygon).toEqual(polygon);
    expect(firstFrame.state.coordinateTrace.centroidDeltaM.releaseToRebuilt).toEqual({ x: 0, y: 0 });
    expect(resolveDeckReleasePreview({
      settleState: firstFrame.state,
      previewState: null,
      feedbackState: null,
    })).toBe(state.previewState);

    const secondFrame = advanceDeckReleaseSettleState({
      state: firstFrame.state,
      match,
      viewportStable: true,
      requiresCanonicalMatch: true,
      nowMs: 1020,
    });

    expect(secondFrame.finalizeOutcome).toBe('committed');
    expect(secondFrame.releaseFeedback).toMatchObject({
      deckId: 'deck-1',
      releaseOutcome: 'committed',
      settleVisualState: 'complete',
      commitSource: 'snapped_frame_commit',
      settleMatchSource: 'top_projection_committed',
      projectionSettleStatus: 'matched',
    });
    expect(secondFrame.releaseFeedback?.coordinateTrace.centroidDeltaM.releaseToRebuilt).toEqual({ x: 0, y: 0 });
  });

  it('fails a snapped release after the canonical settle deadline when rebuilt geometry differs', () => {
    const state = makeCommittedState();
    const shiftedPolygon = polygon.map((point) => ({ x: point.x + 10, y: point.y }));
    const match = resolveDeckSettleMatch({
      settleState: state,
      settledDeckShape: makeDeckShape({
        polygon: shiftedPolygon,
      }),
    });

    const deadline = advanceDeckReleaseSettleState({
      state,
      match,
      viewportStable: true,
      requiresCanonicalMatch: true,
      nowMs: 1501,
    });

    expect(deadline.finalizeOutcome).toBeNull();
    expect(deadline.state).toMatchObject({
      releaseOutcome: 'failed',
      settleVisualState: 'failed',
      resolvedSuccess: false,
      releaseError: 'Deck release preview did not match rebuilt plan geometry.',
      projectionSettleStatus: 'failed',
    });
    expect(deadline.state.coordinateTrace.rebuiltProjectionPolygon).toEqual(shiftedPolygon);
    expect(deadline.state.coordinateTrace.centroidDeltaM.releaseToRebuilt).toEqual({ x: 10, y: 0 });

    const failed = advanceDeckReleaseSettleState({
      state: deadline.state,
      match,
      viewportStable: true,
      requiresCanonicalMatch: true,
      nowMs: 1510,
    });

    expect(failed.finalizeOutcome).toBe('failed');
    expect(failed.releaseFeedback).toMatchObject({
      releaseOutcome: 'failed',
      settleVisualState: 'failed',
      projectionSettleStatus: 'failed',
    });
    expect(failed.releaseFeedback?.coordinateTrace.centroidDeltaM.releaseToRebuilt).toEqual({ x: 10, y: 0 });
  });

  it('lets a floating release complete when the top-projection deck body is still pending', () => {
    const floatingPreview = makePreview({
      releasePlacement: 'floating',
      placement: 'floating',
      activeSnapMode: 'floating',
      attachmentMode: 'floating',
      primaryHostEdgeId: null,
      placementEdgeId: null,
      activePrimaryTargetId: null,
      snapTargetState: 'none',
      snapEligible: false,
      referenceEdgeGapM: 5,
      polygon: polygon.map((point) => ({ x: point.x + 20, y: point.y + 20 })),
      previewAnchor: { x: 23, y: 21 },
    });
    const state = makeCommittedState({ previewState: floatingPreview });
    const match = resolveDeckSettleMatch({
      settleState: state,
      settledDeckShape: makeDeckShape(),
    });

    expect(match).toMatchObject({
      matches: false,
      source: 'floating_projection_pending',
      projectionStatus: 'pending',
    });

    const result = advanceDeckReleaseSettleState({
      state,
      match,
      viewportStable: true,
      requiresCanonicalMatch: true,
      nowMs: 1501,
    });

    expect(result.finalizeOutcome).toBe('committed');
    expect(result.releaseFeedback).toMatchObject({
      releaseOutcome: 'committed',
      commitSource: 'floating_rect_from_projection_preview',
      settleMatchSource: 'floating_projection_pending',
      projectionSettleStatus: 'pending',
    });
  });

  it('returns the failed release preview only while failure feedback is visible', () => {
    const failedFeedback = {
      deckId: 'deck-1',
      releaseOutcome: 'failed' as const,
      releasePlacement: 'snapped' as const,
      settleVisualState: 'failed' as const,
      releaseError: 'Nope',
      previewState: makePreview(),
      expiresAtMs: 100,
      commitSource: 'snapped_frame_commit' as const,
      settleMatchSource: 'none' as const,
      projectionSettleStatus: 'failed' as const,
      commitTransform,
      coordinateTrace: makeCoordinateTrace(makePreview()),
    };

    expect(resolveDeckReleasePreview({
      settleState: null,
      previewState: null,
      feedbackState: failedFeedback,
    })).toBe(failedFeedback.previewState);
    expect(resolveDeckReleasePreview({
      settleState: null,
      previewState: null,
      feedbackState: {
        ...failedFeedback,
        releaseOutcome: 'committed',
        settleVisualState: 'complete',
      },
    })).toBeNull();
  });
});
