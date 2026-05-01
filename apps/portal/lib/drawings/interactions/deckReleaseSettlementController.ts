import type {
  DeckCommitCoordinateTrace,
  DeckCommitTransformDiagnostics,
  DeckPreviewState,
} from './deckInteractionAdapter';
import type { DeckReleaseCommitSource } from './deckMoveToolController';
import type {
  ObjectInteractionReleaseOutcome,
  ObjectInteractionSettleVisualState,
} from './objectInteractionEngine';
import type {
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { buildDeckReleaseRebuildParityReport } from './deckReleaseParity';

export type DeckSettleMatchSource =
  | 'none'
  | 'top_projection_committed'
  | 'semantic_projection'
  | 'floating_projection_pending';

export type DeckProjectionSettleStatus = 'none' | 'matched' | 'pending' | 'failed';

export type DeckDragSettleState = {
  deckId: string;
  previewState: DeckPreviewState;
  commitStartedAtMs: number;
  commitResolvedAtMs: number | null;
  releasePlacement: 'snapped' | 'floating';
  releaseOutcome: Exclude<ObjectInteractionReleaseOutcome, 'none'>;
  settleVisualState: ObjectInteractionSettleVisualState;
  resolvedSuccess: boolean | null;
  matchedCommittedGeometry: boolean;
  stableMatchFrameCount: number;
  releaseError: string | null;
  commitSource: DeckReleaseCommitSource;
  settleMatchSource: DeckSettleMatchSource;
  projectionSettleStatus: DeckProjectionSettleStatus;
  commitTransform: DeckCommitTransformDiagnostics;
  coordinateTrace: DeckCommitCoordinateTrace;
};

export type DeckReleaseFeedbackState = {
  deckId: string;
  releaseOutcome: Extract<ObjectInteractionReleaseOutcome, 'committed' | 'failed'>;
  releasePlacement: 'snapped' | 'floating' | null;
  settleVisualState: Extract<ObjectInteractionSettleVisualState, 'complete' | 'failed'>;
  releaseError: string | null;
  previewState: DeckPreviewState | null;
  expiresAtMs: number;
  commitSource: DeckReleaseCommitSource;
  settleMatchSource: DeckSettleMatchSource;
  projectionSettleStatus: DeckProjectionSettleStatus;
  commitTransform: DeckCommitTransformDiagnostics;
  coordinateTrace: DeckCommitCoordinateTrace;
};

export type DeckSettleMatch = {
  matches: boolean;
  source: DeckSettleMatchSource;
  projectionStatus: DeckProjectionSettleStatus;
  rebuiltProjectionPolygon: PlanPoint[] | null;
};

export const DECK_SETTLE_MATCH_TOLERANCE_M = 0.1;
export const DECK_SETTLE_MAX_WAIT_MS = 500;
export const DECK_SETTLE_MATCH_STABLE_FRAMES = 1;
export const DECK_RELEASE_SUCCESS_FEEDBACK_MS = 180;
export const DECK_RELEASE_FAILURE_FEEDBACK_MS = 1400;

function pointsApproximatelyEqual(left: PlanPoint, right: PlanPoint, toleranceM = DECK_SETTLE_MATCH_TOLERANCE_M): boolean {
  return Math.hypot(left.x - right.x, left.y - right.y) <= toleranceM;
}

function polygonsApproximatelyEqual(
  left: readonly PlanPoint[],
  right: readonly PlanPoint[],
  toleranceM = DECK_SETTLE_MATCH_TOLERANCE_M,
): boolean {
  if (!left.length || !right.length) return false;
  if (left.length !== right.length) return false;
  const remaining = [...right];
  for (const point of left) {
    const matchIndex = remaining.findIndex((candidate) => pointsApproximatelyEqual(point, candidate, toleranceM));
    if (matchIndex < 0) return false;
    remaining.splice(matchIndex, 1);
  }
  return remaining.length === 0;
}

function resolvePolygonBounds(points: readonly PlanPoint[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (!points.length) return null;
  let minX = points[0]!.x;
  let maxX = points[0]!.x;
  let minY = points[0]!.y;
  let maxY = points[0]!.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function polygonsVisuallyMatch(
  left: readonly PlanPoint[],
  right: readonly PlanPoint[],
  toleranceM = DECK_SETTLE_MATCH_TOLERANCE_M,
): boolean {
  if (polygonsApproximatelyEqual(left, right, toleranceM)) return true;
  const leftBounds = resolvePolygonBounds(left);
  const rightBounds = resolvePolygonBounds(right);
  if (!leftBounds || !rightBounds) return false;
  return (
    Math.abs(leftBounds.minX - rightBounds.minX) <= toleranceM &&
    Math.abs(leftBounds.maxX - rightBounds.maxX) <= toleranceM &&
    Math.abs(leftBounds.minY - rightBounds.minY) <= toleranceM &&
    Math.abs(leftBounds.maxY - rightBounds.maxY) <= toleranceM
  );
}

function findDeckReferenceFrameById(
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  return frames.find((frame) => frame.sourceEdgeId === edgeId) ?? null;
}

function projectPointToDeckReferenceFrame(
  point: PlanPoint,
  frame: ObjectWorkbenchPlanDeckReferenceFrame,
): { alongM: number; outwardM: number } {
  const relative = {
    x: point.x - frame.hostEdgeStart.x,
    y: point.y - frame.hostEdgeStart.y,
  };
  return {
    alongM: relative.x * frame.alongUnitX + relative.y * frame.alongUnitY + frame.spanStartM,
    outwardM: relative.x * frame.outwardUnitX + relative.y * frame.outwardUnitY,
  };
}

function projectPolygonToDeckReferenceFrame(input: {
  polygon: readonly PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}): {
  nearGapM: number;
  centerOffsetM: number;
} | null {
  if (!input.polygon.length) return null;
  const projections = input.polygon.map((point) => projectPointToDeckReferenceFrame(point, input.frame));
  const alongValues = projections.map((projection) => projection.alongM);
  const outwardValues = projections.map((projection) => projection.outwardM);
  const alongMinM = Math.min(...alongValues);
  const alongMaxM = Math.max(...alongValues);
  const outwardMinM = Math.min(...outwardValues);
  const frameMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  return {
    nearGapM: Math.max(0, outwardMinM),
    centerOffsetM: ((alongMinM + alongMaxM) / 2) - frameMidpointM,
  };
}

function resolvePolygonCenter(polygon: readonly PlanPoint[]): PlanPoint | null {
  if (!polygon.length) return null;
  const sum = polygon.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}

function resolveRebuiltProjectionPolygon(
  shape: ObjectWorkbenchPlanShapeOverlay | null,
): PlanPoint[] | null {
  return shape?.source === 'top_projection_committed' ? shape.polygon : null;
}

function updateDeckCoordinateTraceWithRebuiltProjection(input: {
  trace: DeckCommitCoordinateTrace;
  rebuiltProjectionPolygon: PlanPoint[] | null;
}): DeckCommitCoordinateTrace {
  const parity = buildDeckReleaseRebuildParityReport({
    coordinateTrace: input.trace,
    rebuiltProjectionPolygon: input.rebuiltProjectionPolygon,
    toleranceM: DECK_SETTLE_MATCH_TOLERANCE_M,
  });
  const releaseToRebuilt = parity.centroidDeltaM.releaseToRebuilt;
  const currentDelta = input.trace.centroidDeltaM.releaseToRebuilt;
  const currentHasRebuiltProjection = Boolean(input.trace.rebuiltProjectionPolygon);
  const nextHasRebuiltProjection = Boolean(input.rebuiltProjectionPolygon);
  if (
    currentHasRebuiltProjection === nextHasRebuiltProjection &&
    ((!currentDelta && !releaseToRebuilt) ||
      (currentDelta &&
        releaseToRebuilt &&
        currentDelta.x === releaseToRebuilt.x &&
        currentDelta.y === releaseToRebuilt.y))
  ) {
    return input.trace;
  }
  return {
    ...input.trace,
    rebuiltProjectionPolygon: input.rebuiltProjectionPolygon,
    centroidDeltaM: {
      ...input.trace.centroidDeltaM,
      releaseToRebuilt,
    },
  };
}

function deckShapeSemanticallyMatchesPreview(input: {
  shape: {
    polygon: PlanPoint[];
    deckInteraction: ObjectWorkbenchPlanShapeOverlay['deckInteraction'];
  } | null;
  preview: DeckPreviewState;
  toleranceM?: number;
}): boolean {
  if (!input.shape?.deckInteraction) return false;
  const toleranceM = input.toleranceM ?? DECK_SETTLE_MATCH_TOLERANCE_M;
  const interaction = input.shape.deckInteraction;
  if (interaction.placement !== input.preview.releasePlacement) return false;
  if (input.preview.releasePlacement === 'snapped') {
    if (interaction.attachmentMode !== input.preview.attachmentMode) return false;
    const interactionSnapEdgeId =
      interaction.primaryHostEdgeId ?? interaction.placementEdgeId ?? interaction.witnessEdgeId;
    const previewSnapEdgeId =
      input.preview.primaryHostEdgeId ?? input.preview.placementEdgeId ?? input.preview.witnessEdgeId;
    if (input.preview.attachmentMode === 'corner_dual_edge') {
      if (interactionSnapEdgeId !== previewSnapEdgeId) return false;
      if (interaction.secondaryHostEdgeId !== input.preview.secondaryHostEdgeId) return false;
      if (interaction.cornerVertexId !== input.preview.cornerVertexId) return false;
    } else if (interactionSnapEdgeId !== previewSnapEdgeId) {
      return false;
    }
  } else if (interaction.witnessEdgeId !== input.preview.witnessEdgeId) {
    return false;
  }

  const comparisonFrame =
    findDeckReferenceFrameById(
      interaction.referenceFrames,
      input.preview.releasePlacement === 'snapped'
        ? input.preview.primaryHostEdgeId ?? input.preview.placementEdgeId ?? interaction.placementEdgeId
        : input.preview.witnessEdgeId ?? interaction.witnessEdgeId,
    ) ?? interaction.referenceFrames[0] ?? null;
  if (!comparisonFrame) return false;

  const previewProjection = projectPolygonToDeckReferenceFrame({
    polygon: input.preview.polygon,
    frame: comparisonFrame,
  });
  if (!previewProjection) return false;

  if (Math.abs(interaction.centerOffsetM - previewProjection.centerOffsetM) > toleranceM) return false;

  const expectedGapM = input.preview.releasePlacement === 'snapped' ? 0 : previewProjection.nearGapM;
  if (Math.abs(interaction.referenceEdgeGapM - expectedGapM) > toleranceM) return false;
  if (input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode !== 'corner_dual_edge') {
    return true;
  }

  const previewCenter = resolvePolygonCenter(input.preview.polygon) ?? input.preview.previewAnchor;
  const centerToleranceM = input.preview.releasePlacement === 'floating'
    ? Math.max(toleranceM, 1)
    : toleranceM;
  return pointsApproximatelyEqual(interaction.renderedCenter, previewCenter, centerToleranceM);
}

export function createDeckReleaseSettleState(input: {
  deckId: string;
  previewState: DeckPreviewState;
  commitStartedAtMs: number;
  commitSource: DeckReleaseCommitSource;
  commitTransform: DeckCommitTransformDiagnostics;
  coordinateTrace: DeckCommitCoordinateTrace;
}): DeckDragSettleState {
  return {
    deckId: input.deckId,
    previewState: input.previewState,
    commitStartedAtMs: input.commitStartedAtMs,
    commitResolvedAtMs: null,
    releasePlacement: input.previewState.releasePlacement,
    releaseOutcome: 'pending',
    settleVisualState: 'holding-preview',
    resolvedSuccess: null,
    matchedCommittedGeometry: false,
    stableMatchFrameCount: 0,
    releaseError: null,
    commitSource: input.commitSource,
    settleMatchSource: 'none',
    projectionSettleStatus: 'pending',
    commitTransform: input.commitTransform,
    coordinateTrace: input.coordinateTrace,
  };
}

export function resolveDeckCommitSettleState(input: {
  state: DeckDragSettleState;
  ok: boolean;
  error?: string | null;
  resolvedAtMs: number;
}): DeckDragSettleState {
  const releaseError = input.ok ? null : input.error ?? 'Unable to update the deck position.';
  return {
    ...input.state,
    commitResolvedAtMs: input.resolvedAtMs,
    releaseOutcome: input.ok ? 'committed' : 'failed',
    settleVisualState: input.ok ? 'reconciling' : 'failed',
    resolvedSuccess: input.ok,
    releaseError,
    projectionSettleStatus: input.ok ? input.state.projectionSettleStatus : 'failed',
  };
}

export function resolveDeckSettleMatch(input: {
  settleState: DeckDragSettleState | null;
  settledDeckShape: ObjectWorkbenchPlanShapeOverlay | null;
}): DeckSettleMatch {
  if (!input.settleState || !input.settledDeckShape) {
    return {
      matches: false,
      source: 'none',
      projectionStatus: 'none',
      rebuiltProjectionPolygon: null,
    };
  }
  const rebuiltProjectionPolygon = resolveRebuiltProjectionPolygon(input.settledDeckShape);
  const visuallyMatches = polygonsVisuallyMatch(
    input.settledDeckShape.polygon,
    input.settleState.previewState.polygon,
  );
  if (visuallyMatches) {
    return {
      matches: true,
      source: input.settledDeckShape.source === 'top_projection_committed'
        ? 'top_projection_committed'
        : 'semantic_projection',
      projectionStatus: 'matched',
      rebuiltProjectionPolygon,
    };
  }
  const semanticallyMatches = deckShapeSemanticallyMatchesPreview({
    shape: input.settledDeckShape,
    preview: input.settleState.previewState,
  });
  if (semanticallyMatches) {
    return {
      matches: true,
      source: 'semantic_projection',
      projectionStatus: 'matched',
      rebuiltProjectionPolygon,
    };
  }
  return {
    matches: false,
    source: input.settleState.releasePlacement === 'floating' ? 'floating_projection_pending' : 'none',
    projectionStatus: input.settleState.releasePlacement === 'floating' ? 'pending' : 'none',
    rebuiltProjectionPolygon,
  };
}

export function buildDeckReleaseFeedback(input: {
  state: DeckDragSettleState;
  match: DeckSettleMatch;
  outcome: Extract<ObjectInteractionReleaseOutcome, 'committed' | 'failed'>;
  settleVisualState: Extract<ObjectInteractionSettleVisualState, 'complete' | 'failed'>;
  nowMs: number;
}): DeckReleaseFeedbackState {
  return {
    deckId: input.state.deckId,
    releaseOutcome: input.outcome,
    releasePlacement: input.state.releasePlacement,
    settleVisualState: input.settleVisualState,
    releaseError: input.state.releaseError,
    previewState: input.state.previewState,
    commitSource: input.state.commitSource,
    settleMatchSource: input.outcome === 'failed' ? input.state.settleMatchSource : input.match.source,
    projectionSettleStatus: input.outcome === 'failed' ? 'failed' : input.match.projectionStatus,
    commitTransform: input.state.commitTransform,
    coordinateTrace: input.state.coordinateTrace,
    expiresAtMs:
      input.nowMs +
      (input.outcome === 'committed' ? DECK_RELEASE_SUCCESS_FEEDBACK_MS : DECK_RELEASE_FAILURE_FEEDBACK_MS),
  };
}

export type DeckSettleAdvanceResult = {
  state: DeckDragSettleState;
  releaseFeedback: DeckReleaseFeedbackState | null;
  finalizeOutcome: Extract<ObjectInteractionReleaseOutcome, 'committed' | 'failed'> | null;
  restorePinnedScrollTargets: boolean;
};

export function advanceDeckReleaseSettleState(input: {
  state: DeckDragSettleState;
  match: DeckSettleMatch;
  viewportStable: boolean;
  requiresCanonicalMatch: boolean;
  nowMs: number;
}): DeckSettleAdvanceResult {
  const committedReleaseReady =
    input.state.releaseOutcome === 'committed' && input.state.commitResolvedAtMs !== null;
  const matchedAndStable = input.match.matches && (committedReleaseReady || input.viewportStable);
  let nextState = input.state;
  const coordinateTrace = updateDeckCoordinateTraceWithRebuiltProjection({
    trace: input.state.coordinateTrace,
    rebuiltProjectionPolygon: input.match.rebuiltProjectionPolygon,
  });
  if (coordinateTrace !== input.state.coordinateTrace) {
    nextState = {
      ...nextState,
      coordinateTrace,
    };
  }

  if (!matchedAndStable) {
    if (
      input.state.stableMatchFrameCount > 0 ||
      input.state.matchedCommittedGeometry ||
      input.state.settleMatchSource !== input.match.source ||
      input.state.projectionSettleStatus !== input.match.projectionStatus
    ) {
      nextState = {
        ...nextState,
        matchedCommittedGeometry: false,
        stableMatchFrameCount: 0,
        settleMatchSource: input.match.source,
        projectionSettleStatus: input.match.projectionStatus,
      };
    }
  } else if (input.state.stableMatchFrameCount < DECK_SETTLE_MATCH_STABLE_FRAMES) {
    nextState = {
      ...nextState,
      matchedCommittedGeometry: true,
      stableMatchFrameCount: Math.min(
        input.state.stableMatchFrameCount + 1,
        DECK_SETTLE_MATCH_STABLE_FRAMES,
      ),
      settleMatchSource: input.match.source,
      projectionSettleStatus: input.match.projectionStatus,
    };
  }

  if (input.state.releaseOutcome === 'failed') {
    return {
      state: nextState,
      releaseFeedback: buildDeckReleaseFeedback({
        state: nextState,
        match: input.match,
        outcome: 'failed',
        settleVisualState: 'failed',
        nowMs: input.nowMs,
      }),
      finalizeOutcome: 'failed',
      restorePinnedScrollTargets: false,
    };
  }

  if (input.state.releaseOutcome === 'committed' && input.state.commitResolvedAtMs !== null) {
    const settleDeadlineMs = input.state.commitResolvedAtMs + DECK_SETTLE_MAX_WAIT_MS;
    const settledPreviewConfirmed =
      matchedAndStable && input.state.stableMatchFrameCount >= DECK_SETTLE_MATCH_STABLE_FRAMES;
    const deadlineCanUnlock = input.nowMs >= settleDeadlineMs;
    if (settledPreviewConfirmed) {
      return {
        state: nextState,
        releaseFeedback: buildDeckReleaseFeedback({
          state: nextState,
          match: input.match,
          outcome: 'committed',
          settleVisualState: 'complete',
          nowMs: input.nowMs,
        }),
        finalizeOutcome: 'committed',
        restorePinnedScrollTargets: false,
      };
    }
    if (deadlineCanUnlock && input.requiresCanonicalMatch && input.state.releasePlacement !== 'floating') {
      return {
          state: {
            ...nextState,
          releaseOutcome: 'failed',
          settleVisualState: 'failed',
          resolvedSuccess: false,
          settleMatchSource: input.match.source,
          projectionSettleStatus: 'failed',
          releaseError: 'Deck release preview did not match rebuilt plan geometry.',
        },
        releaseFeedback: null,
        finalizeOutcome: null,
        restorePinnedScrollTargets: false,
      };
    }
    if (deadlineCanUnlock) {
      return {
        state: nextState,
        releaseFeedback: buildDeckReleaseFeedback({
          state: nextState,
          match: input.match,
          outcome: 'committed',
          settleVisualState: 'complete',
          nowMs: input.nowMs,
        }),
        finalizeOutcome: 'committed',
        restorePinnedScrollTargets: false,
      };
    }
  }

  return {
    state: nextState,
    releaseFeedback: null,
    finalizeOutcome: null,
    restorePinnedScrollTargets: input.state.releaseOutcome === 'pending',
  };
}

export function resolveDeckReleasePreview(input: {
  settleState: DeckDragSettleState | null;
  previewState: DeckPreviewState | null;
  feedbackState: DeckReleaseFeedbackState | null;
}): DeckPreviewState | null {
  if (input.settleState) {
    if (input.settleState.settleVisualState === 'complete') {
      return null;
    }
    return input.settleState.previewState;
  }
  if (input.feedbackState?.releaseOutcome === 'failed') {
    return input.feedbackState.previewState;
  }
  return input.previewState;
}
