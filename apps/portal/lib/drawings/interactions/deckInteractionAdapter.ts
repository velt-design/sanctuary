import type { AttachmentSide } from '@sp/costing';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import {
  buildObjectInteractionTelemetry,
  buildObjectInteractionViewState,
  type ObjectInteractionAffordanceState,
  type ObjectInteractionPhase,
  type ObjectInteractionReferenceGuideState,
  type ObjectInteractionReleaseOutcome,
  type ObjectInteractionSessionBase,
  type ObjectInteractionSettleVisualState,
  type ObjectInteractionViewState,
} from './objectInteractionEngine';
import {
  buildDeckInteractionCapabilityFromSelection,
  resolveDeckInteractionHint,
  resolveDeckSelectedTypeFromShape,
  type DeckInteractionCapability,
  type DeckInteractionTelemetry,
} from './deckInteractionContract';

const DECK_SNAP_TOLERANCE_M = 0.18;
const DECK_UNSNAP_TOLERANCE_M = 0.28;
const DECK_REFERENCE_SWITCH_HYSTERESIS_M = 0.08;
const DECK_CORNER_SNAP_ZONE_M = 0.26;
const DECK_CORNER_UNSNAP_ZONE_M = 0.36;
const DECK_END_CATCH_TOLERANCE_M = 0.1;
const DECK_END_CATCH_UNSNAP_TOLERANCE_M = 0.16;
const DECK_WALL_SPAN_CANDIDATE_TOLERANCE_M = 0.35;
const DECK_WALL_SPAN_RETAIN_TOLERANCE_M = 0.5;
const DECK_COMMIT_FRAME_MATCH_TOLERANCE_M = 1.5;
const DECK_COMMIT_FRAME_LINE_TOLERANCE_M = 0.5;
const DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE = 0.75;
const DECK_COMMIT_FRAME_POINT_SPAN_TOLERANCE_M = 0.25;

export type DeckSvgInteraction = {
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
};

export type DeckObjectRef = {
  family: 'decks';
  objectId: string;
};

export type DeckObjectPatchCommit = {
  target: DeckObjectRef;
  patch: ObjectWorkbenchDeckPatch;
};

export type DeckDragSession = ObjectInteractionSessionBase & {
  deckId: string;
  objectRef: DeckObjectRef;
  startSvgX: number;
  startSvgY: number;
  startDragPlanPoint: PlanPoint | null;
  grabbedPlanPoint: PlanPoint;
  startCenter: PlanPoint;
  startPolygon: PlanPoint[];
  startWidthM: number;
  startDepthM: number;
  heldCornerIndex: number;
  grabbedPointAlongOffsetFromCenterM: number;
  grabbedPointDepthFromNearEdgeM: number;
  interaction: ObjectWorkbenchPlanDeckInteraction;
  svgInteraction: DeckSvgInteraction;
};

type DeckWallTargetStability = 'none' | 'transient' | 'stable' | 'locked';

export type DeckPreviewState = {
  deckId: string;
  polygon: PlanPoint[];
  previewAnchor: PlanPoint;
  activeSnapMode: 'floating' | 'single_edge' | 'corner_dual_edge';
  snapTargetState: 'none' | 'candidate' | 'stable' | 'locked';
  attachmentMode: 'floating' | 'single_edge' | 'corner_dual_edge';
  semanticPlacementSide: AttachmentSide | null;
  semanticWitnessSide: AttachmentSide;
  activePrimaryTargetId: string | null;
  activeSecondaryTargetId: string | null;
  placementEdgeId: string | null;
  primaryHostEdgeId: string | null;
  secondaryHostEdgeId: string | null;
  cornerVertexId: string | null;
  witnessEdgeId: string;
  highlightTargetId: string | null;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  secondaryHostEdgeStart: PlanPoint | null;
  secondaryHostEdgeEnd: PlanPoint | null;
  grabbedPlanPoint: PlanPoint;
  heldCornerIndex: number;
  heldCornerPoint: PlanPoint;
  grabbedPointAlongOffsetFromCenterM: number | null;
  grabbedPointDepthFromNearEdgeM: number | null;
  previewWallFrameId: string | null;
  activeLockedWallFrameId: string | null;
  anchorAlongM: number | null;
  anchorDerivedCenterOffsetM: number | null;
  wallTargetStability: DeckWallTargetStability;
  lockedCornerPoint: PlanPoint | null;
  endCatchSide: 'start' | 'end' | null;
  endCatchPoint: PlanPoint | null;
  centerOffsetM: number;
  referenceEdgeGapM: number;
  placement: 'snapped' | 'floating';
  snapEligible: boolean;
  releasePlacement: 'snapped' | 'floating';
  referenceGuide: {
    start: PlanPoint;
    end: PlanPoint;
    state: Exclude<ObjectInteractionReferenceGuideState, 'none'>;
  } | null;
};

export type DeckReleaseState = {
  outcome: Exclude<ObjectInteractionReleaseOutcome, 'none'>;
  releasePlacement: 'snapped' | 'floating' | null;
  settleVisualState: ObjectInteractionSettleVisualState;
  errorDetail: string | null;
  previewState: DeckPreviewState | null;
};

function formatDeckPresetValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function findDeckReferenceFrameById(
  frames: ObjectWorkbenchPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  return frames.find((frame) => frame.sourceEdgeId === edgeId) ?? null;
}

function pointDistance(left: PlanPoint, right: PlanPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function polygonCenter(polygon: PlanPoint[]): PlanPoint | null {
  if (!polygon.length) return null;
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function unitVectorDistance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function scoreDeckReferenceFrameGeometryMatch(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): number {
  const directEndpointDistance =
    pointDistance(input.renderFrame.hostEdgeStart, input.commitFrame.hostEdgeStart) +
    pointDistance(input.renderFrame.hostEdgeEnd, input.commitFrame.hostEdgeEnd);
  const reversedEndpointDistance =
    pointDistance(input.renderFrame.hostEdgeStart, input.commitFrame.hostEdgeEnd) +
    pointDistance(input.renderFrame.hostEdgeEnd, input.commitFrame.hostEdgeStart);
  const endpointDistance = Math.min(directEndpointDistance, reversedEndpointDistance);
  const alongDistance = Math.min(
    unitVectorDistance(
      { x: input.renderFrame.alongUnitX, y: input.renderFrame.alongUnitY },
      { x: input.commitFrame.alongUnitX, y: input.commitFrame.alongUnitY },
    ),
    unitVectorDistance(
      { x: input.renderFrame.alongUnitX, y: input.renderFrame.alongUnitY },
      { x: -input.commitFrame.alongUnitX, y: -input.commitFrame.alongUnitY },
    ),
  );
  const outwardDistance = unitVectorDistance(
    { x: input.renderFrame.outwardUnitX, y: input.renderFrame.outwardUnitY },
    { x: input.commitFrame.outwardUnitX, y: input.commitFrame.outwardUnitY },
  );
  const semanticPenalty =
    input.renderFrame.hostEdgeId === input.commitFrame.hostEdgeId ? 0 : 2;
  const axisPenalty = input.renderFrame.axis === input.commitFrame.axis ? 0 : 0.5;
  const outwardDirectionPenalty =
    input.renderFrame.outwardDirection === input.commitFrame.outwardDirection ? 0 : 0.5;
  return endpointDistance + alongDistance + outwardDistance + semanticPenalty + axisPenalty + outwardDirectionPenalty;
}

function deckReferenceFramesAreCompatibleForCommit(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): boolean {
  if (input.renderFrame.axis !== input.commitFrame.axis) return false;
  if (input.renderFrame.hostEdgeId !== input.commitFrame.hostEdgeId) return false;
  if (input.renderFrame.outwardDirection !== input.commitFrame.outwardDirection) return false;

  const alongDot =
    input.renderFrame.alongUnitX * input.commitFrame.alongUnitX +
    input.renderFrame.alongUnitY * input.commitFrame.alongUnitY;
  const outwardDot =
    input.renderFrame.outwardUnitX * input.commitFrame.outwardUnitX +
    input.renderFrame.outwardUnitY * input.commitFrame.outwardUnitY;
  if (Math.abs(alongDot) < DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE) return false;
  if (outwardDot < DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE) return false;

  const directEndpointDistance =
    pointDistance(input.renderFrame.hostEdgeStart, input.commitFrame.hostEdgeStart) +
    pointDistance(input.renderFrame.hostEdgeEnd, input.commitFrame.hostEdgeEnd);
  const reversedEndpointDistance =
    pointDistance(input.renderFrame.hostEdgeStart, input.commitFrame.hostEdgeEnd) +
    pointDistance(input.renderFrame.hostEdgeEnd, input.commitFrame.hostEdgeStart);
  const endpointDistance = Math.min(directEndpointDistance, reversedEndpointDistance);
  const edgeCoordinateDistance = Math.abs(input.renderFrame.edgeCoordinateM - input.commitFrame.edgeCoordinateM);

  return (
    endpointDistance <= DECK_COMMIT_FRAME_LINE_TOLERANCE_M ||
    edgeCoordinateDistance <= DECK_COMMIT_FRAME_LINE_TOLERANCE_M
  );
}

function deckReferenceFramesShareCommitIdentity(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): boolean {
  if (input.renderFrame.axis !== input.commitFrame.axis) return false;
  if (input.renderFrame.hostEdgeId !== input.commitFrame.hostEdgeId) return false;
  if (input.renderFrame.outwardDirection !== input.commitFrame.outwardDirection) return false;
  const alongDot =
    input.renderFrame.alongUnitX * input.commitFrame.alongUnitX +
    input.renderFrame.alongUnitY * input.commitFrame.alongUnitY;
  const outwardDot =
    input.renderFrame.outwardUnitX * input.commitFrame.outwardUnitX +
    input.renderFrame.outwardUnitY * input.commitFrame.outwardUnitY;
  return Math.abs(alongDot) >= DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE &&
    outwardDot >= DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE;
}

function deckReferenceFramePointSpanDistance(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  point: PlanPoint;
}): number {
  const projection = projectPointToDeckReferenceFrame(input.point, input.frame);
  if (projection.alongM < input.frame.spanStartM) return input.frame.spanStartM - projection.alongM;
  if (projection.alongM > input.frame.spanEndM) return projection.alongM - input.frame.spanEndM;
  return 0;
}

function resolveDeckCommitReferenceFrame(input: {
  interaction: ObjectWorkbenchPlanDeckInteraction;
  renderEdgeId: string | null | undefined;
  referencePoint?: PlanPoint | null;
}): ObjectWorkbenchPlanDeckReferenceFrame | null {
  const commitFrames = input.interaction.commitReferenceFrames.length
    ? input.interaction.commitReferenceFrames
    : input.interaction.referenceFrames;
  const exactCommitFrame = findDeckReferenceFrameById(commitFrames, input.renderEdgeId);
  const renderFrame = findDeckReferenceFrameById(input.interaction.referenceFrames, input.renderEdgeId);
  if (!renderFrame) return exactCommitFrame;
  if (
    exactCommitFrame &&
    deckReferenceFramesShareCommitIdentity({
      renderFrame,
      commitFrame: exactCommitFrame,
    })
  ) {
    return exactCommitFrame;
  }

  const compatibleCommitFrames = commitFrames.filter((commitFrame) =>
    deckReferenceFramesAreCompatibleForCommit({
      renderFrame,
      commitFrame,
    }),
  );
  const referencePoint = input.referencePoint ?? null;
  const containingCommitFrames = referencePoint
    ? compatibleCommitFrames.filter(
        (commitFrame) =>
          deckReferenceFramePointSpanDistance({
            frame: commitFrame,
            point: referencePoint,
          }) <= DECK_COMMIT_FRAME_POINT_SPAN_TOLERANCE_M,
      )
    : [];
  const scoredCommitFrames = containingCommitFrames.length ? containingCommitFrames : compatibleCommitFrames;
  const bestGeometryMatch =
    scoredCommitFrames
      .map((commitFrame) => ({
        commitFrame,
        score: scoreDeckReferenceFrameGeometryMatch({
          renderFrame,
          commitFrame,
        }),
      }))
      .sort((left, right) => left.score - right.score || left.commitFrame.sourceEdgeId.localeCompare(right.commitFrame.sourceEdgeId))[0] ??
    null;
  if (
    bestGeometryMatch &&
    (containingCommitFrames.length > 0 || bestGeometryMatch.score <= DECK_COMMIT_FRAME_MATCH_TOLERANCE_M)
  ) {
    return bestGeometryMatch.commitFrame;
  }
  return exactCommitFrame &&
    deckReferenceFramesAreCompatibleForCommit({
      renderFrame,
      commitFrame: exactCommitFrame,
    })
    ? exactCommitFrame
    : null;
}

function resolveDeckCommitCornerVertexId(input: {
  preview: DeckPreviewState;
  primaryCommitFrame: ObjectWorkbenchPlanDeckReferenceFrame | null;
  secondaryCommitFrame: ObjectWorkbenchPlanDeckReferenceFrame | null;
}): string | null {
  if (!input.preview.cornerVertexId) return null;
  const cornerPoint = input.preview.lockedCornerPoint ?? input.preview.heldCornerPoint;
  const frames = [input.primaryCommitFrame, input.secondaryCommitFrame].filter(
    (frame): frame is ObjectWorkbenchPlanDeckReferenceFrame => Boolean(frame),
  );
  for (const frame of frames) {
    const edgeNumberMatch = /^footprint-edge-(\d+)$/.exec(frame.sourceEdgeId);
    const edgeNumber = edgeNumberMatch ? Number.parseInt(edgeNumberMatch[1]!, 10) : null;
    if (!Number.isFinite(edgeNumber) || edgeNumber === null) continue;
    if (pointDistance(frame.hostEdgeStart, cornerPoint) <= 0.05) return `footprint-vertex-${edgeNumber}`;
    if (pointDistance(frame.hostEdgeEnd, cornerPoint) <= 0.05) return `footprint-vertex-${edgeNumber + 1}`;
  }
  return input.preview.cornerVertexId;
}

function translatePolygon(polygon: PlanPoint[], deltaX: number, deltaY: number): PlanPoint[] {
  if (Math.abs(deltaX) <= 1e-6 && Math.abs(deltaY) <= 1e-6) return polygon;
  return polygon.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
}

function resolveNearestDeckCornerIndex(input: {
  polygon: PlanPoint[];
  point: PlanPoint | null;
}): number {
  if (!input.polygon.length) return 0;
  if (!input.point) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  input.polygon.forEach((corner, index) => {
    const distance = Math.hypot(corner.x - input.point!.x, corner.y - input.point!.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function resolvePolygonPointByIndex(polygon: PlanPoint[], index: number): PlanPoint {
  if (!polygon.length) {
    return { x: 0, y: 0 };
  }
  return polygon[((index % polygon.length) + polygon.length) % polygon.length]!;
}

function resolveNearestPreviewCorner(input: {
  polygon: PlanPoint[];
  point: PlanPoint;
}): {
  index: number;
  point: PlanPoint;
} {
  const index = resolveNearestDeckCornerIndex(input);
  return {
    index,
    point: resolvePolygonPointByIndex(input.polygon, index),
  };
}

function resolveDeckGrabPointAnchor(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  grabbedPlanPoint: PlanPoint;
  polygon: PlanPoint[];
  fallbackReferenceEdgeGapM: number;
}): {
  alongOffsetFromCenterM: number;
  depthFromNearEdgeM: number;
} {
  const projection = projectPointToDeckReferenceFrame(input.grabbedPlanPoint, input.frame);
  const polygonProjection = projectPolygonToDeckReferenceFrame({
    polygon: input.polygon,
    frame: input.frame,
  });
  const centerOffsetM = polygonProjection?.centerOffsetM ?? 0;
  const nearGapM = polygonProjection?.nearGapM ?? input.fallbackReferenceEdgeGapM;
  const frameMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = frameMidpointM + centerOffsetM;
  return {
    alongOffsetFromCenterM: projection.alongM - centerAlongM,
    depthFromNearEdgeM: Math.max(0, projection.outwardM - nearGapM),
  };
}

function resolveDeckAnchoredCenterOffset(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  heldAlongM: number;
  grabbedPointAlongOffsetFromCenterM: number;
}): {
  centerOffsetM: number;
  grabbedPointAlongOffsetFromCenterM: number;
} {
  const frameMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  return {
    centerOffsetM: input.heldAlongM - frameMidpointM - input.grabbedPointAlongOffsetFromCenterM,
    grabbedPointAlongOffsetFromCenterM: input.grabbedPointAlongOffsetFromCenterM,
  };
}

function planPointToDeckLocal(point: PlanPoint, attachmentSide: AttachmentSide): {
  alongM: number;
  depthM: number;
} {
  if (attachmentSide === 'front') {
    return { alongM: point.x, depthM: point.y - 1 };
  }
  if (attachmentSide === 'left') {
    return { alongM: point.y, depthM: -point.x };
  }
  if (attachmentSide === 'right') {
    return { alongM: point.y, depthM: point.x - 1 };
  }
  return { alongM: point.x, depthM: -point.y };
}

function serializeDeckOutlineFromPlanPolygon(input: {
  polygon: PlanPoint[];
  attachmentSide: AttachmentSide;
}): CalculatorHouseFootprintPolygonPoint[] {
  void input.attachmentSide;
  return input.polygon.map((point) => {
    return {
      alongM: formatDeckPresetValue(point.x),
      depthM: formatDeckPresetValue(point.y),
    };
  });
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
  polygon: PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}): {
  nearGapM: number;
  centerOffsetM: number;
} | null {
  if (!input.polygon.length) return null;
  const alongValues = input.polygon.map((point) => projectPointToDeckReferenceFrame(point, input.frame).alongM);
  const outwardValues = input.polygon.map((point) => projectPointToDeckReferenceFrame(point, input.frame).outwardM);
  const alongMinM = Math.min(...alongValues);
  const alongMaxM = Math.max(...alongValues);
  const outwardMinM = Math.min(...outwardValues);
  const nearGapM = Math.max(0, outwardMinM);
  const centerOffsetM = ((alongMinM + alongMaxM) / 2) - ((input.frame.spanStartM + input.frame.spanEndM) / 2);
  return {
    nearGapM,
    centerOffsetM,
  };
}

function deckReferenceFrameMidpoint(frame: ObjectWorkbenchPlanDeckReferenceFrame): number {
  return (frame.spanStartM + frame.spanEndM) / 2;
}

function deckReferenceFrameAlongDirectionSign(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): -1 | 1 {
  const alongDot =
    input.renderFrame.alongUnitX * input.commitFrame.alongUnitX +
    input.renderFrame.alongUnitY * input.commitFrame.alongUnitY;
  return alongDot < 0 ? -1 : 1;
}

function mapDeckFrameAlongFromRenderToCommit(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  renderAlongM: number;
}): number {
  const renderCenterOffsetM = input.renderAlongM - deckReferenceFrameMidpoint(input.renderFrame);
  return (
    deckReferenceFrameMidpoint(input.commitFrame) +
    renderCenterOffsetM *
      deckReferenceFrameAlongDirectionSign({
        renderFrame: input.renderFrame,
        commitFrame: input.commitFrame,
      })
  );
}

function mapDeckPointFromRenderFrameToCommitFrame(input: {
  point: PlanPoint;
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): PlanPoint {
  const projection = projectPointToDeckReferenceFrame(input.point, input.renderFrame);
  return buildPlanPointOnDeckReferenceFrame({
    frame: input.commitFrame,
    alongM: mapDeckFrameAlongFromRenderToCommit({
      renderFrame: input.renderFrame,
      commitFrame: input.commitFrame,
      renderAlongM: projection.alongM,
    }),
    outwardM: projection.outwardM,
  });
}

function resolveDeckPreviewRenderEdgeId(input: {
  preview: DeckPreviewState;
}): string | null {
  return input.preview.releasePlacement === 'snapped'
    ? input.preview.primaryHostEdgeId ?? input.preview.placementEdgeId ?? input.preview.witnessEdgeId
    : input.preview.witnessEdgeId;
}

function resolveDeckPreviewRenderCommitFrames(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
} | null {
  const renderEdgeId = resolveDeckPreviewRenderEdgeId({ preview: input.preview });
  const renderFrame =
    findDeckReferenceFrameById(input.session.interaction.referenceFrames, renderEdgeId) ??
    input.session.interaction.referenceFrames[0] ??
    null;
  if (!renderFrame) return null;
  const commitFrame = resolveDeckCommitReferenceFrame({
    interaction: input.session.interaction,
    renderEdgeId: renderFrame.sourceEdgeId,
    referencePoint: input.preview.previewAnchor,
  });
  return commitFrame ? { renderFrame, commitFrame } : null;
}

function mapDeckPreviewPolygonThroughCommitFrame(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): PlanPoint[] | null {
  const frames = resolveDeckPreviewRenderCommitFrames(input);
  if (!frames) return null;
  if (frames.renderFrame === frames.commitFrame) return input.preview.polygon;
  return input.preview.polygon.map((point) =>
    mapDeckPointFromRenderFrameToCommitFrame({
      point,
      renderFrame: frames.renderFrame,
      commitFrame: frames.commitFrame,
    }),
  );
}

function inferFloatingRectFromPlanPolygon(input: {
  polygon: PlanPoint[];
  attachmentSide: AttachmentSide;
}): {
  centerAlongM: string;
  centerDepthM: string;
  widthM: string;
  depthM: string;
} | null {
  void input.attachmentSide;
  if (!input.polygon.length) return null;
  const alongValues = input.polygon.map((point) => point.x);
  const depthValues = input.polygon.map((point) => point.y);
  const minAlongM = Math.min(...alongValues);
  const maxAlongM = Math.max(...alongValues);
  const minDepthM = Math.min(...depthValues);
  const maxDepthM = Math.max(...depthValues);
  if (![minAlongM, maxAlongM, minDepthM, maxDepthM].every(Number.isFinite)) return null;

  return {
    centerAlongM: formatDeckPresetValue((minAlongM + maxAlongM) / 2),
    centerDepthM: formatDeckPresetValue((minDepthM + maxDepthM) / 2),
    widthM: formatDeckPresetValue(Math.max(0, maxAlongM - minAlongM)),
    depthM: formatDeckPresetValue(Math.max(0, maxDepthM - minDepthM)),
  };
}

function planPolygonBounds(polygon: readonly PlanPoint[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  if (!polygon.length) return null;
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxY: Math.max(...polygon.map((point) => point.y)),
  };
}

function mapPreviewPolygonToCommitSpace(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): PlanPoint[] {
  const commitStartPolygon = input.session.interaction.commitStartPolygon;
  const frameMappedPolygon = mapDeckPreviewPolygonThroughCommitFrame(input);
  if (
    frameMappedPolygon &&
    (!commitStartPolygon ||
      (() => {
        const frames = resolveDeckPreviewRenderCommitFrames(input);
        return frames
          ? !deckReferenceFramesAreCompatibleForCommit({
              renderFrame: frames.renderFrame,
              commitFrame: frames.commitFrame,
            })
          : false;
      })())
  ) {
    return frameMappedPolygon;
  }
  if (!commitStartPolygon || commitStartPolygon.length !== input.session.startPolygon.length) {
    return input.preview.polygon;
  }
  const renderedBounds = planPolygonBounds(input.session.startPolygon);
  const commitBounds = planPolygonBounds(commitStartPolygon);
  if (!renderedBounds || !commitBounds) return input.preview.polygon;
  const renderedWidth = renderedBounds.maxX - renderedBounds.minX;
  const renderedHeight = renderedBounds.maxY - renderedBounds.minY;
  const commitWidth = commitBounds.maxX - commitBounds.minX;
  const commitHeight = commitBounds.maxY - commitBounds.minY;
  const scaleX = Math.abs(renderedWidth) > 1e-6 ? commitWidth / renderedWidth : 1;
  const scaleY = Math.abs(renderedHeight) > 1e-6 ? commitHeight / renderedHeight : 1;
  if (![scaleX, scaleY].every(Number.isFinite)) return input.preview.polygon;
  return input.preview.polygon.map((point) => ({
    x: commitBounds.minX + (point.x - renderedBounds.minX) * scaleX,
    y: commitBounds.minY + (point.y - renderedBounds.minY) * scaleY,
  }));
}

function clampPresetDeckCenterOffset(input: {
  centerOffsetM: number;
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  deckWidthM: number;
}): number {
  void input.frame;
  void input.deckWidthM;
  return input.centerOffsetM;
}

function scoreDeckReferenceFrameForPolygon(input: {
  polygon: PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}): {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  overlapPenaltyM: number;
  spanPenaltyM: number;
  outsidePenaltyM: number;
  midpointDistanceM: number;
} | null {
  if (!input.polygon.length) return null;
  const alongValues = input.polygon.map((point) => projectPointToDeckReferenceFrame(point, input.frame).alongM);
  const outwardValues = input.polygon.map((point) => projectPointToDeckReferenceFrame(point, input.frame).outwardM);
  const alongMinM = Math.min(...alongValues);
  const alongMaxM = Math.max(...alongValues);
  const outwardMinM = Math.min(...outwardValues);
  const frameMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const deckMidpointM = (alongMinM + alongMaxM) / 2;
  return {
    frame: input.frame,
    overlapPenaltyM: Math.max(0, -outwardMinM),
    spanPenaltyM: Math.max(0, input.frame.spanStartM - alongMinM) + Math.max(0, alongMaxM - input.frame.spanEndM),
    outsidePenaltyM: Math.max(0, outwardMinM),
    midpointDistanceM: Math.abs(deckMidpointM - frameMidpointM),
  };
}

type DeckWallCandidate = {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  nearGapM: number;
  centerOffsetM: number;
  heldAlongM: number;
  heldOutwardM: number;
  heldSpanOutsideM: number;
  spanPenaltyM: number;
  snapSpanPenaltyM: number;
  overlapPenaltyM: number;
  outsidePenaltyM: number;
  midpointDistanceM: number;
};

function isDeckWallSnapCandidate(candidate: DeckWallCandidate): boolean {
  return (
    candidate.nearGapM <= DECK_SNAP_TOLERANCE_M &&
    candidate.overlapPenaltyM <= DECK_UNSNAP_TOLERANCE_M + 1e-6 &&
    candidate.snapSpanPenaltyM <= DECK_WALL_SPAN_CANDIDATE_TOLERANCE_M
  );
}

function scoreDeckWallCandidate(input: {
  heldPoint: PlanPoint;
  polygon: PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}): DeckWallCandidate | null {
  const polygonProjection = projectPolygonToDeckReferenceFrame({
    polygon: input.polygon,
    frame: input.frame,
  });
  const frameScore = scoreDeckReferenceFrameForPolygon({
    polygon: input.polygon,
    frame: input.frame,
  });
  if (!polygonProjection || !frameScore) return null;
  const heldProjection = projectPointToDeckReferenceFrame(input.heldPoint, input.frame);
  const heldSpanOutsideM =
    heldProjection.alongM < input.frame.spanStartM
      ? input.frame.spanStartM - heldProjection.alongM
      : heldProjection.alongM > input.frame.spanEndM
        ? heldProjection.alongM - input.frame.spanEndM
        : 0;
  return {
    frame: input.frame,
    nearGapM: polygonProjection.nearGapM,
    centerOffsetM: polygonProjection.centerOffsetM,
    heldAlongM: heldProjection.alongM,
    heldOutwardM: heldProjection.outwardM,
    heldSpanOutsideM,
    spanPenaltyM: frameScore.spanPenaltyM,
    snapSpanPenaltyM: Math.min(frameScore.spanPenaltyM, heldSpanOutsideM),
    overlapPenaltyM: frameScore.overlapPenaltyM,
    outsidePenaltyM: frameScore.outsidePenaltyM,
    midpointDistanceM: frameScore.midpointDistanceM,
  };
}

function resolveDeckCommitCenterOffset(input: {
  preview: DeckPreviewState;
  session: DeckDragSession;
}): number {
  const previewEdgeId =
    input.preview.primaryHostEdgeId ?? input.preview.placementEdgeId ?? input.preview.witnessEdgeId;
  const previewCenter = polygonCenter(input.preview.polygon);
  const renderFrame =
    findDeckReferenceFrameById(
      input.session.interaction.referenceFrames,
      previewEdgeId,
    ) ?? input.session.interaction.referenceFrames[0];
  if (!renderFrame) return input.preview.anchorDerivedCenterOffsetM ?? input.preview.centerOffsetM;

  const renderProjection = projectPolygonToDeckReferenceFrame({
    polygon: input.preview.polygon,
    frame: renderFrame,
  });
  const renderCenterOffsetM =
    renderProjection?.centerOffsetM ?? input.preview.anchorDerivedCenterOffsetM ?? input.preview.centerOffsetM;
  const commitFrame = resolveDeckCommitReferenceFrame({
    interaction: input.session.interaction,
    renderEdgeId: previewEdgeId,
    referencePoint: previewCenter,
  });
  if (
    commitFrame &&
    previewCenter &&
    deckReferenceFramesAreCompatibleForCommit({
      renderFrame,
      commitFrame,
    })
  ) {
    const commitProjection = projectPointToDeckReferenceFrame(previewCenter, commitFrame);
    return commitProjection.alongM - deckReferenceFrameMidpoint(commitFrame);
  }
  if (commitFrame) {
    const sign = deckReferenceFrameAlongDirectionSign({
      renderFrame,
      commitFrame,
    });
    return renderCenterOffsetM * sign;
  }

  return renderCenterOffsetM;
}

function selectDeckWallCandidate(input: {
  heldPoint: PlanPoint;
  polygon: PlanPoint[];
  frames: ObjectWorkbenchPlanDeckReferenceFrame[];
  previousPreviewState: DeckPreviewState | null;
  fallbackEdgeId: string;
}): DeckWallCandidate {
  const candidates =
    input.frames
      .map((frame) => scoreDeckWallCandidate({
        heldPoint: input.heldPoint,
        polygon: input.polygon,
        frame,
      }))
      .filter((candidate): candidate is DeckWallCandidate => Boolean(candidate));
  const previousTargetId =
    input.previousPreviewState?.activePrimaryTargetId ??
    input.previousPreviewState?.placementEdgeId ??
    input.previousPreviewState?.witnessEdgeId ??
    input.fallbackEdgeId;
  const previousCandidate = candidates.find((candidate) => candidate.frame.sourceEdgeId === previousTargetId) ?? candidates[0]!;
  const bestCandidate =
    [...candidates].sort((left, right) =>
      Number(isDeckWallSnapCandidate(right)) - Number(isDeckWallSnapCandidate(left)) ||
      left.overlapPenaltyM - right.overlapPenaltyM ||
      left.nearGapM - right.nearGapM ||
      left.snapSpanPenaltyM - right.snapSpanPenaltyM ||
      left.outsidePenaltyM - right.outsidePenaltyM ||
      left.heldSpanOutsideM - right.heldSpanOutsideM ||
      left.midpointDistanceM - right.midpointDistanceM,
    )[0] ?? previousCandidate;

  if (bestCandidate.frame.sourceEdgeId === previousCandidate.frame.sourceEdgeId) {
    return bestCandidate;
  }

  const previousRetainEligible =
    input.previousPreviewState?.activePrimaryTargetId === previousCandidate.frame.sourceEdgeId &&
    previousCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M &&
    previousCandidate.overlapPenaltyM <= DECK_CORNER_UNSNAP_ZONE_M + 1e-6 &&
    previousCandidate.snapSpanPenaltyM <= DECK_WALL_SPAN_RETAIN_TOLERANCE_M;
  if (previousRetainEligible && !isDeckWallSnapCandidate(bestCandidate)) {
    return previousCandidate;
  }

  const previousStillCompetitive =
    previousCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M ||
    previousCandidate.overlapPenaltyM <= DECK_UNSNAP_TOLERANCE_M;
  const betterByContact =
    bestCandidate.nearGapM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.nearGapM ||
    bestCandidate.overlapPenaltyM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.overlapPenaltyM ||
    bestCandidate.outsidePenaltyM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.outsidePenaltyM;
  const previousWallStillFlush =
    previousCandidate.nearGapM <= DECK_SNAP_TOLERANCE_M &&
    previousCandidate.outsidePenaltyM <= DECK_UNSNAP_TOLERANCE_M;
  if (previousWallStillFlush && !betterByContact) {
    return previousCandidate;
  }
  const materiallyBetter =
    betterByContact ||
    bestCandidate.snapSpanPenaltyM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.snapSpanPenaltyM ||
    bestCandidate.heldSpanOutsideM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.heldSpanOutsideM;

  return previousStillCompetitive && !materiallyBetter ? previousCandidate : bestCandidate;
}

function buildPlanPointOnDeckReferenceFrame(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  alongM: number;
  outwardM: number;
}): PlanPoint {
  return {
    x:
      input.frame.hostEdgeStart.x +
      input.frame.alongUnitX * (input.alongM - input.frame.spanStartM) +
      input.frame.outwardUnitX * input.outwardM,
    y:
      input.frame.hostEdgeStart.y +
      input.frame.alongUnitY * (input.alongM - input.frame.spanStartM) +
      input.frame.outwardUnitY * input.outwardM,
  };
}

function buildDeckPreviewPolygon(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  deckWidthM: number;
  deckDepthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
}): PlanPoint[] {
  const edgeMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = edgeMidpointM + input.centerOffsetM;
  const nearAlongM = centerAlongM - input.deckWidthM / 2;
  const farAlongM = centerAlongM + input.deckWidthM / 2;
  const nearOutM = input.referenceEdgeGapM;
  const farOutM = nearOutM + input.deckDepthM;
  if (input.frame.outwardDirection < 0) {
    return [
      buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: nearAlongM, outwardM: farOutM }),
      buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: farAlongM, outwardM: farOutM }),
      buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: farAlongM, outwardM: nearOutM }),
      buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: nearAlongM, outwardM: nearOutM }),
    ];
  }
  return [
    buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: nearAlongM, outwardM: nearOutM }),
    buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: farAlongM, outwardM: nearOutM }),
    buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: farAlongM, outwardM: farOutM }),
    buildPlanPointOnDeckReferenceFrame({ frame: input.frame, alongM: nearAlongM, outwardM: farOutM }),
  ];
}

function resolveDeckPreviewAlongExtents(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  deckWidthM: number;
  centerOffsetM: number;
}): {
  centerAlongM: number;
  nearAlongM: number;
  farAlongM: number;
} {
  const edgeMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = edgeMidpointM + input.centerOffsetM;
  return {
    centerAlongM,
    nearAlongM: centerAlongM - input.deckWidthM / 2,
    farAlongM: centerAlongM + input.deckWidthM / 2,
  };
}

function resolveDeckPreviewGrabbedPoint(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  centerOffsetM: number;
  referenceEdgeGapM: number;
  grabbedPointAlongOffsetFromCenterM: number;
  grabbedPointDepthFromNearEdgeM: number;
}): PlanPoint {
  const edgeMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  return buildPlanPointOnDeckReferenceFrame({
    frame: input.frame,
    alongM: edgeMidpointM + input.centerOffsetM + input.grabbedPointAlongOffsetFromCenterM,
    outwardM: input.referenceEdgeGapM + input.grabbedPointDepthFromNearEdgeM,
  });
}

function resolveDeckEndCatch(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  deckWidthM: number;
  centerOffsetM: number;
  previousPreviewState: DeckPreviewState | null;
}): {
  centerOffsetM: number;
  endCatchSide: 'start' | 'end' | null;
  endCatchPoint: PlanPoint | null;
} {
  const { nearAlongM, farAlongM } = resolveDeckPreviewAlongExtents(input);
  const previousEndCatchSide =
    input.previousPreviewState?.placementEdgeId === input.frame.sourceEdgeId
      ? input.previousPreviewState.endCatchSide
      : null;
  const startDistanceM = Math.abs(nearAlongM - input.frame.spanStartM);
  const endDistanceM = Math.abs(farAlongM - input.frame.spanEndM);
  const startActive =
    startDistanceM <= DECK_END_CATCH_TOLERANCE_M ||
    (previousEndCatchSide === 'start' && startDistanceM <= DECK_END_CATCH_UNSNAP_TOLERANCE_M);
  const endActive =
    endDistanceM <= DECK_END_CATCH_TOLERANCE_M ||
    (previousEndCatchSide === 'end' && endDistanceM <= DECK_END_CATCH_UNSNAP_TOLERANCE_M);

  if (!startActive && !endActive) {
    return {
      centerOffsetM: input.centerOffsetM,
      endCatchSide: null,
      endCatchPoint: null,
    };
  }

  const endCatchSide =
    startActive && endActive
      ? startDistanceM <= endDistanceM
        ? 'start'
        : 'end'
      : startActive
        ? 'start'
        : 'end';
  const alignedCenterOffsetM =
    endCatchSide === 'start'
      ? input.frame.spanStartM + input.deckWidthM / 2 - ((input.frame.spanStartM + input.frame.spanEndM) / 2)
      : input.frame.spanEndM - input.deckWidthM / 2 - ((input.frame.spanStartM + input.frame.spanEndM) / 2);
  const endCatchPoint =
    endCatchSide === 'start'
      ? input.frame.hostEdgeStart
      : input.frame.hostEdgeEnd;

  return {
    centerOffsetM: alignedCenterOffsetM,
    endCatchSide,
    endCatchPoint,
  };
}

function buildDeckCornerPreviewPolygon(input: {
  primaryFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  secondaryFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  cornerPoint: PlanPoint;
  deckWidthM: number;
  deckDepthM: number;
}): PlanPoint[] {
  const alongDirection =
    ((input.primaryFrame.outwardUnitX !== 0 ? input.primaryFrame.outwardUnitX : 0) +
      (input.secondaryFrame.outwardUnitX !== 0 ? input.secondaryFrame.outwardUnitX : 0)) < 0
      ? -1
      : 1;
  const depthDirection =
    ((input.primaryFrame.outwardUnitY !== 0 ? input.primaryFrame.outwardUnitY : 0) +
      (input.secondaryFrame.outwardUnitY !== 0 ? input.secondaryFrame.outwardUnitY : 0)) < 0
      ? -1
      : 1;
  const minX = input.cornerPoint.x + Math.min(0, alongDirection * input.deckWidthM);
  const maxX = input.cornerPoint.x + Math.max(0, alongDirection * input.deckWidthM);
  const minY = input.cornerPoint.y + Math.min(0, depthDirection * input.deckDepthM);
  const maxY = input.cornerPoint.y + Math.max(0, depthDirection * input.deckDepthM);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function resolveDeckReferenceGuidePoint(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  alongM: number;
}): PlanPoint {
  const clampedAlongM = clampValue(input.alongM, input.frame.spanStartM, input.frame.spanEndM);
  return {
    x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * (clampedAlongM - input.frame.spanStartM),
    y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * (clampedAlongM - input.frame.spanStartM),
  };
}

function resolveDeckCornerCandidate(input: {
  primaryFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  heldCornerPoint: PlanPoint;
  frames: ObjectWorkbenchPlanDeckReferenceFrame[];
  previousPreviewState: DeckPreviewState | null;
}): {
  primaryFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  secondaryFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  cornerPoint: PlanPoint;
  cornerVertexId: string | null;
} | null {
  const orthogonalFrames = input.frames.filter(
    (frame) => frame.sourceEdgeId !== input.primaryFrame.sourceEdgeId && frame.axis !== input.primaryFrame.axis,
  );
  const previousCornerVertexId =
    input.previousPreviewState?.attachmentMode === 'corner_dual_edge'
      ? input.previousPreviewState.cornerVertexId
      : null;
  const candidate =
    orthogonalFrames
      .map((frame) => {
        const sharedPoint =
          [
            input.primaryFrame.hostEdgeStart,
            input.primaryFrame.hostEdgeEnd,
          ].flatMap((primaryPoint) =>
            [frame.hostEdgeStart, frame.hostEdgeEnd]
              .filter((secondaryPoint) => Math.abs(primaryPoint.x - secondaryPoint.x) <= 0.01 && Math.abs(primaryPoint.y - secondaryPoint.y) <= 0.01)
              .map(() => primaryPoint),
          )[0] ?? null;
        if (!sharedPoint) return null;
        return {
          frame,
          sharedPoint,
          cornerDistanceM: Math.hypot(input.heldCornerPoint.x - sharedPoint.x, input.heldCornerPoint.y - sharedPoint.y),
        };
      })
      .filter((value): value is { frame: ObjectWorkbenchPlanDeckReferenceFrame; sharedPoint: PlanPoint; cornerDistanceM: number } => Boolean(value))
      .sort((left, right) =>
        left.cornerDistanceM - right.cornerDistanceM || left.frame.sourceEdgeId.localeCompare(right.frame.sourceEdgeId),
      )[0] ?? null;
  if (!candidate) return null;

  const edgeNumberMatch = /^footprint-edge-(\d+)$/.exec(input.primaryFrame.sourceEdgeId);
  const edgeNumber = edgeNumberMatch ? Number.parseInt(edgeNumberMatch[1]!, 10) : null;
  const cornerVertexId =
    Number.isFinite(edgeNumber) && edgeNumber
      ? Math.abs(input.primaryFrame.hostEdgeStart.x - candidate.sharedPoint.x) <= 0.01 &&
        Math.abs(input.primaryFrame.hostEdgeStart.y - candidate.sharedPoint.y) <= 0.01
        ? `footprint-vertex-${edgeNumber}`
        : `footprint-vertex-${edgeNumber + 1}`
      : null;
  const allowCorner =
    candidate.cornerDistanceM <= DECK_CORNER_SNAP_ZONE_M ||
    (previousCornerVertexId !== null &&
      previousCornerVertexId === cornerVertexId &&
      candidate.cornerDistanceM <= DECK_CORNER_UNSNAP_ZONE_M);
  if (!allowCorner) return null;

  return {
    primaryFrame: input.primaryFrame,
    secondaryFrame: candidate.frame,
    cornerPoint: candidate.sharedPoint,
    cornerVertexId,
  };
}

function resolveDeckReferenceFrameFromCenter(input: {
  center: PlanPoint;
  polygon: PlanPoint[];
  frames: ObjectWorkbenchPlanDeckReferenceFrame[];
  previousHostEdgeId: string;
}): ObjectWorkbenchPlanDeckReferenceFrame {
  void input.center;
  const scoredFrames =
    input.frames
      .map((frame) => scoreDeckReferenceFrameForPolygon({ polygon: input.polygon, frame }))
      .filter((candidate): candidate is NonNullable<ReturnType<typeof scoreDeckReferenceFrameForPolygon>> => Boolean(candidate));
  const previous = scoredFrames.find((candidate) => candidate.frame.sourceEdgeId === input.previousHostEdgeId) ?? scoredFrames[0]!;
  const nearest =
    [...scoredFrames].sort((left, right) =>
      left.overlapPenaltyM - right.overlapPenaltyM ||
      left.spanPenaltyM - right.spanPenaltyM ||
      left.outsidePenaltyM - right.outsidePenaltyM ||
      left.midpointDistanceM - right.midpointDistanceM,
    )[0] ?? previous;
  if (
    nearest.frame.sourceEdgeId !== previous.frame.sourceEdgeId &&
    Math.abs(nearest.overlapPenaltyM - previous.overlapPenaltyM) <= 1e-6 &&
    Math.abs(nearest.spanPenaltyM - previous.spanPenaltyM) <= 1e-6 &&
    nearest.outsidePenaltyM + DECK_REFERENCE_SWITCH_HYSTERESIS_M >= previous.outsidePenaltyM
  ) {
    return previous.frame;
  }
  return nearest.frame;
}

export function buildDeckDragSession(input: {
  pointerId: number;
  clientX: number;
  clientY: number;
  startSvgX: number;
  startSvgY: number;
  startDragPlanPoint: PlanPoint | null;
  deckId: string;
  overlayShape: ObjectWorkbenchPlanShapeOverlay;
  svgInteraction: DeckSvgInteraction;
}): DeckDragSession | null {
  if (!input.overlayShape.deckInteraction) return null;
  const grabbedPlanPoint = input.startDragPlanPoint ?? input.overlayShape.deckInteraction.renderedCenter;
  const heldCornerIndex = resolveNearestDeckCornerIndex({
    polygon: input.overlayShape.polygon,
    point: grabbedPlanPoint,
  });
  const interaction = input.overlayShape.deckInteraction;
  const activeFrame =
    findDeckReferenceFrameById(
      interaction.referenceFrames,
      interaction.placement === 'snapped'
        ? interaction.primaryHostEdgeId ?? interaction.placementEdgeId ?? interaction.witnessEdgeId
        : interaction.witnessEdgeId,
    ) ?? interaction.referenceFrames[0];
  const grabbedPointAnchor =
    interaction.kind === 'preset_rect' && activeFrame
      ? resolveDeckGrabPointAnchor({
          frame: activeFrame,
          grabbedPlanPoint,
          polygon: input.overlayShape.polygon,
          fallbackReferenceEdgeGapM: interaction.placement === 'snapped' ? 0 : interaction.referenceEdgeGapM,
        })
      : null;
  return {
    pointerId: input.pointerId,
    startClientX: input.clientX,
    startClientY: input.clientY,
    phase: 'drag-intent',
    deckId: input.deckId,
    objectRef: {
      family: 'decks',
      objectId: input.deckId,
    },
    startSvgX: input.startSvgX,
    startSvgY: input.startSvgY,
    startDragPlanPoint: input.startDragPlanPoint,
    grabbedPlanPoint,
    startCenter: interaction.renderedCenter,
    startPolygon: input.overlayShape.polygon,
    startWidthM: interaction.deckWidthM,
    startDepthM: interaction.deckDepthM,
    heldCornerIndex,
    grabbedPointAlongOffsetFromCenterM: grabbedPointAnchor?.alongOffsetFromCenterM ?? 0,
    grabbedPointDepthFromNearEdgeM: grabbedPointAnchor?.depthFromNearEdgeM ?? 0,
    interaction,
    svgInteraction: input.svgInteraction,
  };
}

export function resolveDeckPreviewState(input: {
  session: DeckDragSession;
  nextSvgX: number;
  nextSvgY: number;
  nextDragPlanPoint: PlanPoint | null;
  previousPreviewState: DeckPreviewState | null;
}): DeckPreviewState {
  const svgDx = input.nextSvgX - input.session.startSvgX;
  const svgDy = input.nextSvgY - input.session.startSvgY;
  const interactionSvgDx = input.session.svgInteraction.hostEdgeEnd.x - input.session.svgInteraction.hostEdgeStart.x;
  const interactionSvgDy = input.session.svgInteraction.hostEdgeEnd.y - input.session.svgInteraction.hostEdgeStart.y;
  const svgLength = Math.hypot(interactionSvgDx, interactionSvgDy);
  const metresPerSvgUnit = svgLength > 1e-6 ? input.session.interaction.hostSpanM / svgLength : 0;
  const planDx =
    input.session.startDragPlanPoint && input.nextDragPlanPoint
      ? input.nextDragPlanPoint.x - input.session.startDragPlanPoint.x
      : svgDx * metresPerSvgUnit;
  const planDy =
    input.session.startDragPlanPoint && input.nextDragPlanPoint
      ? input.nextDragPlanPoint.y - input.session.startDragPlanPoint.y
      : svgDy * metresPerSvgUnit;
  const center = {
    x: input.session.startCenter.x + planDx,
    y: input.session.startCenter.y + planDy,
  };
  const translatedGrabbedPoint = {
    x: input.session.grabbedPlanPoint.x + planDx,
    y: input.session.grabbedPlanPoint.y + planDy,
  };
  const translatedPolygon = translatePolygon(input.session.startPolygon, planDx, planDy);
  if (input.session.interaction.kind === 'custom_outline') {
    const currentHostEdgeId = input.previousPreviewState?.witnessEdgeId ?? input.session.interaction.witnessEdgeId;
    const witnessFrame = resolveDeckReferenceFrameFromCenter({
      center,
      polygon: translatedPolygon,
      frames: input.session.interaction.referenceFrames,
      previousHostEdgeId: currentHostEdgeId,
    });
    const centerProjection = projectPointToDeckReferenceFrame(center, witnessFrame);
    const projection = projectPolygonToDeckReferenceFrame({
      polygon: translatedPolygon,
      frame: witnessFrame,
    });
    return {
      deckId: input.session.deckId,
      previewAnchor: center,
      activeSnapMode: 'floating',
      snapTargetState: 'none',
      attachmentMode: 'floating',
      semanticPlacementSide: null,
      semanticWitnessSide: witnessFrame.hostEdgeId,
      activePrimaryTargetId: null,
      activeSecondaryTargetId: null,
      placementEdgeId: null,
      primaryHostEdgeId: null,
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      witnessEdgeId: witnessFrame.sourceEdgeId,
      highlightTargetId: witnessFrame.sourceEdgeId,
      hostEdgeStart: witnessFrame.hostEdgeStart,
      hostEdgeEnd: witnessFrame.hostEdgeEnd,
      secondaryHostEdgeStart: null,
      secondaryHostEdgeEnd: null,
      grabbedPlanPoint: translatedGrabbedPoint,
      heldCornerIndex: input.session.heldCornerIndex,
      heldCornerPoint: resolvePolygonPointByIndex(translatedPolygon, input.session.heldCornerIndex),
      grabbedPointAlongOffsetFromCenterM: null,
      grabbedPointDepthFromNearEdgeM: null,
      previewWallFrameId: null,
      activeLockedWallFrameId: null,
      anchorAlongM: null,
      anchorDerivedCenterOffsetM: null,
      wallTargetStability: 'none',
      lockedCornerPoint: null,
      endCatchSide: null,
      endCatchPoint: null,
      centerOffsetM: projection?.centerOffsetM ?? 0,
      referenceEdgeGapM: projection?.nearGapM ?? 0,
      placement: 'floating',
      snapEligible: false,
      releasePlacement: 'floating',
      referenceGuide: {
        start: translatedGrabbedPoint,
        end: resolveDeckReferenceGuidePoint({
          frame: witnessFrame,
          alongM: centerProjection.alongM,
        }),
        state: 'witness',
      },
      polygon: translatedPolygon,
    };
  }

  const currentHostEdgeId =
    input.previousPreviewState?.placementEdgeId ??
    input.previousPreviewState?.activePrimaryTargetId ??
    input.previousPreviewState?.witnessEdgeId ??
    input.session.interaction.primaryHostEdgeId ??
    input.session.interaction.placementEdgeId ??
    input.session.interaction.witnessEdgeId;
  const translatedHeldCornerPoint = resolvePolygonPointByIndex(translatedPolygon, input.session.heldCornerIndex);
  const previousLockedWallId =
    input.previousPreviewState?.placement === 'snapped' && input.previousPreviewState.attachmentMode !== 'corner_dual_edge'
      ? input.previousPreviewState.primaryHostEdgeId
      : input.previousPreviewState === null &&
          input.session.interaction.placement === 'snapped' &&
          input.session.interaction.attachmentMode !== 'corner_dual_edge'
        ? input.session.interaction.primaryHostEdgeId ??
          input.session.interaction.placementEdgeId ??
          input.session.interaction.witnessEdgeId
        : null;
  const previousLockedCornerId =
    input.previousPreviewState?.placement === 'snapped' && input.previousPreviewState.attachmentMode === 'corner_dual_edge'
      ? input.previousPreviewState.cornerVertexId
      : input.previousPreviewState === null &&
          input.session.interaction.placement === 'snapped' &&
          input.session.interaction.attachmentMode === 'corner_dual_edge'
        ? input.session.interaction.cornerVertexId
        : null;
  const lockedWallFrameCandidate =
    previousLockedWallId !== null
      ? scoreDeckWallCandidate({
          heldPoint: translatedGrabbedPoint,
          polygon: translatedPolygon,
          frame:
            findDeckReferenceFrameById(input.session.interaction.referenceFrames, previousLockedWallId) ??
            input.session.interaction.referenceFrames[0]!,
        })
      : null;
  const initialLockedWallFrame =
    previousLockedWallId !== null
      ? findDeckReferenceFrameById(input.session.interaction.referenceFrames, previousLockedWallId)
      : null;
  const lockedWallParallelMove =
    initialLockedWallFrame && lockedWallFrameCandidate && input.session.startDragPlanPoint
      ? (() => {
          const startProjection = projectPointToDeckReferenceFrame(input.session.grabbedPlanPoint, initialLockedWallFrame);
          const currentProjection = projectPointToDeckReferenceFrame(translatedGrabbedPoint, initialLockedWallFrame);
          const deltaAlongM = Math.abs(currentProjection.alongM - startProjection.alongM);
          const deltaOutwardM = Math.abs(currentProjection.outwardM - startProjection.outwardM);
          return deltaOutwardM <= DECK_SNAP_TOLERANCE_M && deltaAlongM > deltaOutwardM;
        })()
      : false;
  const wallCandidate =
    lockedWallParallelMove && lockedWallFrameCandidate
      ? lockedWallFrameCandidate
      : selectDeckWallCandidate({
          heldPoint: translatedGrabbedPoint,
          polygon: translatedPolygon,
          frames: input.session.interaction.referenceFrames,
          previousPreviewState: input.previousPreviewState,
          fallbackEdgeId: currentHostEdgeId,
        });
  const activeFrame = wallCandidate.frame;
  const wallSpanEligible =
    wallCandidate.snapSpanPenaltyM <= DECK_WALL_SPAN_CANDIDATE_TOLERANCE_M ||
    (input.previousPreviewState?.activePrimaryTargetId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.snapSpanPenaltyM <= DECK_WALL_SPAN_RETAIN_TOLERANCE_M) ||
    (previousLockedWallId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.heldSpanOutsideM <= Number.POSITIVE_INFINITY);
  const wallFaceSnapEligible = wallCandidate.overlapPenaltyM <= DECK_UNSNAP_TOLERANCE_M + 1e-6;
  const wallFaceRetainEligible = wallCandidate.overlapPenaltyM <= DECK_CORNER_UNSNAP_ZONE_M + 1e-6;
  const wallCandidateActive =
    (wallCandidate.nearGapM <= DECK_SNAP_TOLERANCE_M && wallFaceSnapEligible && wallSpanEligible) ||
    (input.previousPreviewState?.activePrimaryTargetId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M &&
      wallFaceRetainEligible &&
      wallCandidate.snapSpanPenaltyM <= DECK_WALL_SPAN_RETAIN_TOLERANCE_M) ||
    (previousLockedWallId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M &&
      wallFaceRetainEligible);
  const wallTransient =
    wallSpanEligible &&
    wallFaceRetainEligible &&
    wallCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M;
  const previousStableWallId =
    input.previousPreviewState?.wallTargetStability === 'stable' ||
    input.previousPreviewState?.wallTargetStability === 'locked'
      ? input.previousPreviewState.previewWallFrameId
      : null;
  const wallStable = wallCandidateActive;
  const wallLocked =
    wallStable &&
    (
      (previousLockedWallId !== null &&
        wallCandidate.frame.sourceEdgeId === previousLockedWallId &&
        (lockedWallFrameCandidate?.nearGapM ?? wallCandidate.nearGapM) <= DECK_UNSNAP_TOLERANCE_M) ||
      previousStableWallId === wallCandidate.frame.sourceEdgeId
    );
  const wallTargetStability: DeckWallTargetStability =
    wallLocked ? 'locked' : wallStable ? 'stable' : wallTransient ? 'transient' : 'none';
  const anchoredCenterOffset =
    wallStable || wallLocked
      ? resolveDeckAnchoredCenterOffset({
          frame: activeFrame,
          heldAlongM: wallCandidate.heldAlongM,
          grabbedPointAlongOffsetFromCenterM: input.session.grabbedPointAlongOffsetFromCenterM,
        })
      : null;
  const unclampedCenterOffsetM =
    anchoredCenterOffset
      ? clampPresetDeckCenterOffset({
          centerOffsetM: anchoredCenterOffset.centerOffsetM,
          frame: activeFrame,
          deckWidthM: input.session.startWidthM,
        })
      : wallCandidate.centerOffsetM;
  const endCatch =
    wallStable || wallLocked
      ? resolveDeckEndCatch({
          frame: activeFrame,
          deckWidthM: input.session.startWidthM,
          centerOffsetM: unclampedCenterOffsetM,
          previousPreviewState: input.previousPreviewState,
        })
      : null;
  const previousCornerPrimaryFrame =
    input.previousPreviewState?.attachmentMode === 'corner_dual_edge'
      ? findDeckReferenceFrameById(
          input.session.interaction.referenceFrames,
          input.previousPreviewState.primaryHostEdgeId,
        )
      : null;
  const retainedCornerCandidate =
    wallCandidateActive && previousCornerPrimaryFrame
      ? resolveDeckCornerCandidate({
          primaryFrame: previousCornerPrimaryFrame,
          heldCornerPoint: translatedHeldCornerPoint,
          frames: input.session.interaction.referenceFrames,
          previousPreviewState: input.previousPreviewState,
        })
      : null;
  const cornerCandidate =
    retainedCornerCandidate ??
    (wallCandidateActive
      ? resolveDeckCornerCandidate({
          primaryFrame: activeFrame,
          heldCornerPoint: translatedHeldCornerPoint,
          frames: input.session.interaction.referenceFrames,
          previousPreviewState: input.previousPreviewState,
        })
      : null);
  const cornerLocked =
    cornerCandidate !== null &&
    ((previousLockedCornerId !== null && cornerCandidate.cornerVertexId === previousLockedCornerId) || wallLocked);
  const placement = cornerLocked
    ? 'snapped'
    : wallLocked
      ? 'snapped'
      : 'floating';
  const releasePlacement =
    cornerCandidate || wallStable || wallLocked
      ? 'snapped'
      : 'floating';
  const activeSnapMode =
    cornerCandidate
      ? 'corner_dual_edge'
      : wallTransient || wallStable || wallLocked
        ? 'single_edge'
        : 'floating';
  const snapTargetState =
    placement === 'snapped'
      ? 'locked'
      : wallStable
        ? 'stable'
        : releasePlacement === 'snapped'
        ? 'candidate'
        : 'none';
  const centerOffsetM = placement === 'snapped' && !cornerLocked
    ? endCatch?.centerOffsetM ?? unclampedCenterOffsetM
    : unclampedCenterOffsetM;
  const referenceEdgeGapM = releasePlacement === 'snapped' ? 0 : wallCandidate.nearGapM;
  const attachmentMode = activeSnapMode;
  const previewPolygon =
    cornerCandidate && releasePlacement === 'snapped'
      ? buildDeckCornerPreviewPolygon({
          primaryFrame: cornerCandidate.primaryFrame,
          secondaryFrame: cornerCandidate.secondaryFrame,
          cornerPoint: cornerCandidate.cornerPoint,
          deckWidthM: input.session.startWidthM,
          deckDepthM: input.session.startDepthM,
        })
      : wallStable || wallLocked
        ? buildDeckPreviewPolygon({
            frame: activeFrame,
            deckWidthM: input.session.startWidthM,
            deckDepthM: input.session.startDepthM,
            centerOffsetM,
            referenceEdgeGapM,
          })
        : translatedPolygon;
  const bodyGrabbedPoint =
    wallStable || wallLocked
      ? resolveDeckPreviewGrabbedPoint({
          frame: activeFrame,
          centerOffsetM,
          referenceEdgeGapM,
          grabbedPointAlongOffsetFromCenterM: input.session.grabbedPointAlongOffsetFromCenterM,
          grabbedPointDepthFromNearEdgeM: input.session.grabbedPointDepthFromNearEdgeM,
        })
      : translatedGrabbedPoint;
  const previewGrabbedPoint =
    releasePlacement === 'snapped' && placement !== 'snapped'
      ? translatedGrabbedPoint
      : bodyGrabbedPoint;
  const referenceGuide: DeckPreviewState['referenceGuide'] =
    snapTargetState === 'locked'
      ? null
      : cornerCandidate
        ? {
            start: previewGrabbedPoint,
            end: cornerCandidate.cornerPoint,
            state: 'snap-lane' as const,
          }
        : {
            start: previewGrabbedPoint,
            end: resolveDeckReferenceGuidePoint({
              frame: activeFrame,
              alongM: wallCandidate.heldAlongM,
            }),
            state: wallStable ? 'snap-lane' : 'witness',
          };

  return {
    deckId: input.session.deckId,
    previewAnchor: previewGrabbedPoint,
    activeSnapMode,
    snapTargetState,
    attachmentMode,
    semanticPlacementSide: releasePlacement === 'snapped' ? activeFrame.hostEdgeId : null,
    semanticWitnessSide: activeFrame.hostEdgeId,
    activePrimaryTargetId:
      wallTransient || wallStable || wallLocked || cornerCandidate ? activeFrame.sourceEdgeId : null,
    activeSecondaryTargetId: cornerCandidate?.secondaryFrame.sourceEdgeId ?? null,
    placementEdgeId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    primaryHostEdgeId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    secondaryHostEdgeId: cornerCandidate?.secondaryFrame.sourceEdgeId ?? null,
    cornerVertexId: cornerCandidate?.cornerVertexId ?? null,
    witnessEdgeId: activeFrame.sourceEdgeId,
    highlightTargetId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    hostEdgeStart: activeFrame.hostEdgeStart,
    hostEdgeEnd: activeFrame.hostEdgeEnd,
    secondaryHostEdgeStart: cornerCandidate?.secondaryFrame.hostEdgeStart ?? null,
    secondaryHostEdgeEnd: cornerCandidate?.secondaryFrame.hostEdgeEnd ?? null,
    grabbedPlanPoint: previewGrabbedPoint,
    heldCornerIndex: input.session.heldCornerIndex,
    heldCornerPoint:
      cornerLocked
        ? cornerCandidate?.cornerPoint ?? resolvePolygonPointByIndex(previewPolygon, input.session.heldCornerIndex)
        : resolvePolygonPointByIndex(previewPolygon, input.session.heldCornerIndex),
    grabbedPointAlongOffsetFromCenterM: input.session.grabbedPointAlongOffsetFromCenterM,
    grabbedPointDepthFromNearEdgeM: input.session.grabbedPointDepthFromNearEdgeM,
    previewWallFrameId: wallTransient || wallStable || wallLocked || cornerCandidate ? activeFrame.sourceEdgeId : null,
    activeLockedWallFrameId: wallLocked ? activeFrame.sourceEdgeId : previousLockedWallId,
    anchorAlongM: wallTransient || wallStable || wallLocked || cornerCandidate ? wallCandidate.heldAlongM : null,
    anchorDerivedCenterOffsetM:
      anchoredCenterOffset ? (endCatch?.centerOffsetM ?? anchoredCenterOffset.centerOffsetM) : null,
    wallTargetStability,
    lockedCornerPoint: cornerLocked ? cornerCandidate?.cornerPoint ?? null : null,
    endCatchSide: (wallStable || wallLocked) && !cornerLocked ? endCatch?.endCatchSide ?? null : null,
    endCatchPoint: (wallStable || wallLocked) && !cornerLocked ? endCatch?.endCatchPoint ?? null : null,
    centerOffsetM,
    referenceEdgeGapM,
    placement,
    snapEligible: wallStable || wallLocked,
    releasePlacement,
    referenceGuide,
    polygon: previewPolygon,
  };
}

export function buildDeckInteractionViewState(input: {
  capability: DeckInteractionCapability | null;
  selectedDeckShape:
    | {
        custom: boolean;
        deckInteraction: ObjectWorkbenchPlanShapeOverlay['deckInteraction'];
      }
    | null;
  phase: ObjectInteractionPhase;
  previewState: DeckPreviewState | null;
  dragSession: DeckDragSession | null;
  releaseState: DeckReleaseState | null;
  hovered: boolean;
}): ObjectInteractionViewState {
  const previewState = input.releaseState?.previewState ?? input.previewState;
  const capability =
    input.capability ??
    (input.selectedDeckShape
      ? buildDeckInteractionCapabilityFromSelection({
          custom: input.selectedDeckShape.custom,
          interactionPlacement: input.selectedDeckShape.deckInteraction?.placement ?? null,
          dragEligible: false,
          dragReason: null,
          hostEdgeResolvable: Boolean(input.selectedDeckShape.deckInteraction),
          relationshipDimensionsAvailable: false,
        })
      : null);

  let statusLabel: string | null = null;
  let statusDetail: string | null = null;
  let placementState: ObjectInteractionViewState['placementState'] = 'none';

  if (input.releaseState) {
    placementState =
      input.releaseState.outcome === 'failed'
        ? 'blocked'
        : input.releaseState.releasePlacement === 'snapped'
          ? 'snapped'
          : input.releaseState.releasePlacement === 'floating'
            ? 'floating'
            : 'none';
    if (input.releaseState.outcome === 'pending') {
      statusLabel = 'Applying deck position';
      statusDetail =
        input.releaseState.releasePlacement === 'snapped'
          ? 'Holding the snapped preview while the draft settles.'
          : 'Holding the floating preview while the draft settles.';
    } else if (input.releaseState.outcome === 'committed') {
      statusLabel = 'Position updated';
      statusDetail =
        input.releaseState.releasePlacement === 'snapped'
          ? 'Deck stayed attached to the host edge.'
          : 'Deck stayed in its floating position.';
    } else {
      statusLabel = "Couldn't move deck";
      statusDetail = input.releaseState.errorDetail ?? 'The deck returned to its previous position.';
    }
  } else {
    const hint = resolveDeckInteractionHint({
      capability,
      phase: input.phase,
      previewState,
    });
    statusLabel = hint?.label ?? null;
    statusDetail = hint?.detail ?? null;
    placementState =
      !capability
        ? 'none'
        : !capability.dragEligible
          ? 'blocked'
          : previewState?.releasePlacement === 'snapped'
            ? previewState.placement === 'snapped'
              ? 'snapped'
              : 'snap-available'
            : previewState
              ? 'floating'
              : 'none';
  }

  const previewAnchor =
    previewState?.previewAnchor ??
    input.dragSession?.startDragPlanPoint ??
    input.dragSession?.startCenter ??
    input.selectedDeckShape?.deckInteraction?.renderedCenter ??
    null;
  const nextPhase =
    capability === null
      ? 'idle'
      : !capability.dragEligible
        ? 'selected'
        : input.phase === 'idle'
          ? input.hovered
            ? 'hover'
            : 'selected'
          : input.phase;
  let affordanceState: ObjectInteractionAffordanceState = 'idle';
  let referenceGuideState: ObjectInteractionReferenceGuideState = 'none';
  if (input.releaseState) {
    affordanceState = input.releaseState.outcome === 'failed' ? 'blocked' : 'settling';
    referenceGuideState =
      input.releaseState.previewState?.referenceGuide?.state ??
      (input.releaseState.releasePlacement === 'floating' ? 'witness' : 'none');
  } else if (!capability) {
    affordanceState = 'idle';
  } else if (!capability.dragEligible) {
    affordanceState = 'blocked';
  } else if (nextPhase === 'hover') {
    affordanceState = 'hover';
  } else if (nextPhase === 'drag-intent') {
    affordanceState = 'grabbed';
  } else if (previewState?.releasePlacement === 'snapped') {
    affordanceState = previewState.placement === 'snapped' ? 'snapped' : 'snap-available';
    referenceGuideState = previewState.placement === 'snapped' ? 'none' : 'snap-lane';
  } else if (previewState) {
    affordanceState = 'floating';
    referenceGuideState = 'witness';
  }

  return buildObjectInteractionViewState({
    phase: nextPhase,
    placementState,
    statusLabel,
    statusDetail,
    canCommit: Boolean(!input.releaseState && capability?.dragEligible && input.phase === 'dragging' && previewState),
    highlightTargetId:
      input.releaseState?.outcome === 'failed'
        ? null
        : previewState?.highlightTargetId ?? null,
    previewAnchor,
    releaseOutcome: input.releaseState?.outcome ?? 'none',
    releasePlacement: input.releaseState?.releasePlacement ?? null,
    settleVisualState: input.releaseState?.settleVisualState ?? null,
    affordanceState,
    referenceGuideState,
  });
}

export function buildDeckCommitPatch(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): ObjectWorkbenchDeckPatch {
  const commitWitnessFrame = resolveDeckCommitReferenceFrame({
    interaction: input.session.interaction,
    renderEdgeId: input.preview.witnessEdgeId,
  });
  const commitSpacePreviewPolygon = mapPreviewPolygonToCommitSpace(input);
  if (input.session.interaction.kind === 'custom_outline') {
    return {
      hostEdgeId: commitWitnessFrame?.sourceEdgeId ?? input.preview.witnessEdgeId,
      attachmentMode: 'floating',
      primaryHostEdgeId: null,
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      isAttached: false,
      outline: serializeDeckOutlineFromPlanPolygon({
        polygon: commitSpacePreviewPolygon,
        attachmentSide: input.session.interaction.houseAttachmentSide,
      }),
    };
  }

  const snappedPreviewCenter =
    input.preview.releasePlacement === 'snapped' ? polygonCenter(input.preview.polygon) : null;
  const snappedPrimaryCommitFrame =
    input.preview.releasePlacement === 'snapped'
      ? resolveDeckCommitReferenceFrame({
          interaction: input.session.interaction,
          renderEdgeId: input.preview.primaryHostEdgeId ?? input.preview.placementEdgeId,
          referencePoint: snappedPreviewCenter,
        })
      : null;
  const snappedSecondaryCommitFrame =
    input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode === 'corner_dual_edge'
      ? resolveDeckCommitReferenceFrame({
          interaction: input.session.interaction,
          renderEdgeId: input.preview.secondaryHostEdgeId,
          referencePoint: input.preview.lockedCornerPoint ?? input.preview.heldCornerPoint,
        })
      : null;
  const snappedPrimaryHostEdgeId =
    snappedPrimaryCommitFrame?.sourceEdgeId ??
    input.preview.primaryHostEdgeId ??
    input.preview.placementEdgeId ??
    null;
  const snappedSecondaryHostEdgeId = snappedSecondaryCommitFrame?.sourceEdgeId ?? input.preview.secondaryHostEdgeId ?? null;
  const snappedCornerVertexId = resolveDeckCommitCornerVertexId({
    preview: input.preview,
    primaryCommitFrame: snappedPrimaryCommitFrame,
    secondaryCommitFrame: snappedSecondaryCommitFrame,
  });
  const snappedSemanticPlacementSide =
    snappedPrimaryCommitFrame?.hostEdgeId ?? input.preview.semanticPlacementSide ?? null;
  const floatingWitnessEdgeId = commitWitnessFrame?.sourceEdgeId ?? input.preview.witnessEdgeId;
  const floatingRect =
    input.preview.releasePlacement === 'floating'
      ? inferFloatingRectFromPlanPolygon({
          polygon: commitSpacePreviewPolygon,
          attachmentSide: input.session.interaction.houseAttachmentSide,
        })
      : null;

  return {
    hostEdgeId:
      input.preview.releasePlacement === 'snapped'
        ? snappedSemanticPlacementSide ?? snappedPrimaryHostEdgeId
        : floatingWitnessEdgeId,
    attachmentMode: input.preview.attachmentMode,
    primaryHostEdgeId: input.preview.releasePlacement === 'snapped' ? snappedPrimaryHostEdgeId : null,
    secondaryHostEdgeId:
      input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode === 'corner_dual_edge'
        ? snappedSecondaryHostEdgeId
        : null,
    cornerVertexId:
      input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode === 'corner_dual_edge'
        ? snappedCornerVertexId
        : null,
    isAttached: input.preview.releasePlacement === 'snapped',
    presetType: input.preview.releasePlacement === 'snapped' ? 'rect_attached' : 'rect_detached',
    ...(input.preview.releasePlacement === 'snapped' && input.session.interaction.placement === 'floating'
      ? { elevationMode: 'aligned_to_threshold' as const }
      : input.preview.releasePlacement === 'floating' && input.session.interaction.placement === 'snapped'
        ? { elevationMode: 'ground' as const }
        : null),
    floatingRect,
    presetRect: {
      centerOffsetM: formatDeckPresetValue(
        input.preview.releasePlacement === 'snapped'
          ? resolveDeckCommitCenterOffset(input)
          : input.preview.centerOffsetM,
      ),
      detachedGapM:
        input.preview.releasePlacement === 'floating'
          ? formatDeckPresetValue(input.preview.referenceEdgeGapM)
          : null,
    } as NonNullable<ObjectWorkbenchDeckPatch['presetRect']>,
    ...(input.preview.releasePlacement === 'snapped' ? { floatingRect: null } : null),
  };
}

export function buildDeckObjectPatchCommit(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): DeckObjectPatchCommit {
  return {
    target: input.session.objectRef,
    patch: buildDeckCommitPatch(input),
  };
}

export function buildDeckInteractionTelemetry(input: {
  selectedDeckId: string | null;
  hoveredDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | 'geometry_projection' | null;
  capability: DeckInteractionCapability | null;
  viewState: ObjectInteractionViewState;
  selectedDeckShape:
    | {
        custom: boolean;
        deckInteraction: ObjectWorkbenchPlanShapeOverlay['deckInteraction'];
      }
    | null;
  previewState: DeckPreviewState | null;
}): DeckInteractionTelemetry {
  const capability = input.capability;
  const sharedTelemetry = buildObjectInteractionTelemetry({
    objectKind: 'deck',
    selectedObjectId: input.selectedDeckId,
    hoveredObjectId: input.hoveredDeckId,
    viewState: input.viewState,
  });
  const selectedDeckType =
    capability?.selectedDeckType ??
    (input.selectedDeckShape
      ? resolveDeckSelectedTypeFromShape({
          custom: input.selectedDeckShape.custom,
          interactionPlacement: input.selectedDeckShape.deckInteraction?.placement ?? null,
        })
      : 'none');

  return {
    ...sharedTelemetry,
    selectedDeckId: input.selectedDeckId,
    hoveredDeckId: input.hoveredDeckId,
    housePolygonSource: input.housePolygonSource,
    attachmentMode: input.previewState?.attachmentMode ?? input.selectedDeckShape?.deckInteraction?.attachmentMode ?? 'floating',
    secondaryHostEdgeId:
      input.previewState?.secondaryHostEdgeId ?? input.selectedDeckShape?.deckInteraction?.secondaryHostEdgeId ?? null,
    cornerVertexId: input.previewState?.cornerVertexId ?? input.selectedDeckShape?.deckInteraction?.cornerVertexId ?? null,
    activeSnapTargetCount:
      input.previewState?.attachmentMode === 'corner_dual_edge'
        ? 2
        : input.previewState?.releasePlacement === 'snapped'
          ? 1
          : 0,
    selectedDeckType,
    dragEligible: capability?.dragEligible ?? false,
    dragReason: capability?.dragReason ?? null,
    hostEdgeResolvable: capability?.hostEdgeResolvable ?? false,
    relationshipDimensionsAvailable: capability?.relationshipDimensionsAvailable ?? false,
    phase: input.viewState.phase,
    placementState: input.viewState.placementState,
    releaseOutcome: input.viewState.releaseOutcome,
    releasePlacement: input.viewState.releasePlacement,
    settleVisualState: input.viewState.settleVisualState,
    snapState:
      input.viewState.placementState === 'none'
        ? 'idle'
        : input.viewState.placementState,
    snapMessage: input.viewState.statusDetail,
    interactionState:
      input.viewState.placementState === 'blocked'
        ? 'blocked'
        : input.viewState.placementState === 'snap-available'
          ? 'snap-available'
          : input.viewState.placementState === 'snapped'
            ? 'snapped'
            : input.viewState.placementState === 'floating'
              ? 'floating'
              : input.viewState.phase === 'settling'
                ? 'commit'
                : input.viewState.phase === 'drag-intent'
                  ? 'drag-intent'
                  : input.viewState.phase === 'dragging'
                    ? 'dragging'
                    : input.viewState.phase === 'selected'
                      ? 'selected'
                      : 'idle',
    interactionLabel: input.viewState.statusLabel,
    canCommit: input.viewState.canCommit,
    highlightTargetId: input.viewState.highlightTargetId,
    previewAnchor: input.viewState.previewAnchor,
    affordanceState: input.viewState.affordanceState,
    referenceGuideState: input.viewState.referenceGuideState,
  };
}
