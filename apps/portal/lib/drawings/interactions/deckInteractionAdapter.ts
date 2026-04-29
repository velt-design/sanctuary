import type { AttachmentSide } from '@sp/costing';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type { HouseFirstDeckDraft } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type {
  HouseFirstPlanDeckInteraction,
  HouseFirstPlanDeckReferenceFrame,
  HouseFirstPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/houseFirstPlanOverlay';
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

export type DeckSvgInteraction = {
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
};

export type DeckDragSession = ObjectInteractionSessionBase & {
  deckId: string;
  startSvgX: number;
  startSvgY: number;
  startDragPlanPoint: PlanPoint | null;
  startCenter: PlanPoint;
  startPolygon: PlanPoint[];
  startWidthM: number;
  startDepthM: number;
  heldCornerIndex: number;
  interaction: HouseFirstPlanDeckInteraction;
  svgInteraction: DeckSvgInteraction;
};

export type DeckPreviewState = {
  deckId: string;
  polygon: PlanPoint[];
  previewAnchor: PlanPoint;
  activeSnapMode: 'floating' | 'single_edge' | 'corner_dual_edge';
  snapTargetState: 'none' | 'candidate' | 'locked';
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
  heldCornerIndex: number;
  heldCornerPoint: PlanPoint;
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
  frames: HouseFirstPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): HouseFirstPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  return frames.find((frame) => frame.sourceEdgeId === edgeId) ?? null;
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
  return input.polygon.map((point) => {
    const localPoint = planPointToDeckLocal(point, input.attachmentSide);
    return {
      alongM: formatDeckPresetValue(localPoint.alongM),
      depthM: formatDeckPresetValue(localPoint.depthM),
    };
  });
}

function projectPointToDeckReferenceFrame(
  point: PlanPoint,
  frame: HouseFirstPlanDeckReferenceFrame,
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
  frame: HouseFirstPlanDeckReferenceFrame;
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

function inferFloatingRectFromPlanPolygon(input: {
  polygon: PlanPoint[];
  attachmentSide: AttachmentSide;
}): {
  centerAlongM: string;
  centerDepthM: string;
  widthM: string;
  depthM: string;
} | null {
  if (!input.polygon.length) return null;
  const localPolygon = input.polygon.map((point) => planPointToDeckLocal(point, input.attachmentSide));
  const alongValues = localPolygon.map((point) => point.alongM);
  const depthValues = localPolygon.map((point) => point.depthM);
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

function clampPresetDeckCenterOffset(input: {
  centerOffsetM: number;
  frame: HouseFirstPlanDeckReferenceFrame;
  deckWidthM: number;
}): number {
  void input.frame;
  void input.deckWidthM;
  return input.centerOffsetM;
}

function scoreDeckReferenceFrameForPolygon(input: {
  polygon: PlanPoint[];
  frame: HouseFirstPlanDeckReferenceFrame;
}): {
  frame: HouseFirstPlanDeckReferenceFrame;
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
  frame: HouseFirstPlanDeckReferenceFrame;
  nearGapM: number;
  centerOffsetM: number;
  heldAlongM: number;
  heldOutwardM: number;
  heldSpanOutsideM: number;
  overlapPenaltyM: number;
  outsidePenaltyM: number;
  midpointDistanceM: number;
};

function scoreDeckWallCandidate(input: {
  heldPoint: PlanPoint;
  polygon: PlanPoint[];
  frame: HouseFirstPlanDeckReferenceFrame;
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
    overlapPenaltyM: frameScore.overlapPenaltyM,
    outsidePenaltyM: frameScore.outsidePenaltyM,
    midpointDistanceM: frameScore.midpointDistanceM,
  };
}

function selectDeckWallCandidate(input: {
  heldPoint: PlanPoint;
  polygon: PlanPoint[];
  frames: HouseFirstPlanDeckReferenceFrame[];
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
      left.nearGapM - right.nearGapM ||
      left.overlapPenaltyM - right.overlapPenaltyM ||
      left.outsidePenaltyM - right.outsidePenaltyM ||
      left.heldSpanOutsideM - right.heldSpanOutsideM ||
      left.midpointDistanceM - right.midpointDistanceM,
    )[0] ?? previousCandidate;

  if (bestCandidate.frame.sourceEdgeId === previousCandidate.frame.sourceEdgeId) {
    return bestCandidate;
  }

  const previousStillCompetitive =
    previousCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M ||
    previousCandidate.overlapPenaltyM <= DECK_UNSNAP_TOLERANCE_M;
  const materiallyBetter =
    bestCandidate.nearGapM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.nearGapM ||
    bestCandidate.overlapPenaltyM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.overlapPenaltyM ||
    bestCandidate.heldSpanOutsideM + DECK_REFERENCE_SWITCH_HYSTERESIS_M < previousCandidate.heldSpanOutsideM;

  return previousStillCompetitive && !materiallyBetter ? previousCandidate : bestCandidate;
}

function buildDeckPreviewPolygon(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
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
  const pointAt = (alongM: number, outM: number): PlanPoint => ({
    x:
      input.frame.hostEdgeStart.x +
      input.frame.alongUnitX * (alongM - input.frame.spanStartM) +
      input.frame.outwardUnitX * outM,
    y:
      input.frame.hostEdgeStart.y +
      input.frame.alongUnitY * (alongM - input.frame.spanStartM) +
      input.frame.outwardUnitY * outM,
  });
  if (input.frame.outwardDirection < 0) {
    return [
      pointAt(nearAlongM, farOutM),
      pointAt(farAlongM, farOutM),
      pointAt(farAlongM, nearOutM),
      pointAt(nearAlongM, nearOutM),
    ];
  }
  return [
    pointAt(nearAlongM, nearOutM),
    pointAt(farAlongM, nearOutM),
    pointAt(farAlongM, farOutM),
    pointAt(nearAlongM, farOutM),
  ];
}

function resolveDeckPreviewAlongExtents(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
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

function resolveDeckEndCatch(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
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
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  secondaryFrame: HouseFirstPlanDeckReferenceFrame;
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
  frame: HouseFirstPlanDeckReferenceFrame;
  alongM: number;
}): PlanPoint {
  const clampedAlongM = clampValue(input.alongM, input.frame.spanStartM, input.frame.spanEndM);
  return {
    x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * (clampedAlongM - input.frame.spanStartM),
    y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * (clampedAlongM - input.frame.spanStartM),
  };
}

function resolveDeckCornerCandidate(input: {
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  heldCornerPoint: PlanPoint;
  frames: HouseFirstPlanDeckReferenceFrame[];
  previousPreviewState: DeckPreviewState | null;
}): {
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  secondaryFrame: HouseFirstPlanDeckReferenceFrame;
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
      .filter((value): value is { frame: HouseFirstPlanDeckReferenceFrame; sharedPoint: PlanPoint; cornerDistanceM: number } => Boolean(value))
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
  frames: HouseFirstPlanDeckReferenceFrame[];
  previousHostEdgeId: string;
}): HouseFirstPlanDeckReferenceFrame {
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
  overlayShape: HouseFirstPlanShapeOverlay;
  svgInteraction: DeckSvgInteraction;
}): DeckDragSession | null {
  if (!input.overlayShape.deckInteraction) return null;
  const heldCornerIndex = resolveNearestDeckCornerIndex({
    polygon: input.overlayShape.polygon,
    point: input.startDragPlanPoint,
  });
  return {
    pointerId: input.pointerId,
    startClientX: input.clientX,
    startClientY: input.clientY,
    phase: 'drag-intent',
    deckId: input.deckId,
    startSvgX: input.startSvgX,
    startSvgY: input.startSvgY,
    startDragPlanPoint: input.startDragPlanPoint,
    startCenter: input.overlayShape.deckInteraction.renderedCenter,
    startPolygon: input.overlayShape.polygon,
    startWidthM: input.overlayShape.deckInteraction.deckWidthM,
    startDepthM: input.overlayShape.deckInteraction.deckDepthM,
    heldCornerIndex,
    interaction: input.overlayShape.deckInteraction,
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
      heldCornerIndex: input.session.heldCornerIndex,
      heldCornerPoint: resolvePolygonPointByIndex(translatedPolygon, input.session.heldCornerIndex),
      lockedCornerPoint: null,
      endCatchSide: null,
      endCatchPoint: null,
      centerOffsetM: projection?.centerOffsetM ?? 0,
      referenceEdgeGapM: projection?.nearGapM ?? 0,
      placement: 'floating',
      snapEligible: false,
      releasePlacement: 'floating',
      referenceGuide: {
        start: center,
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
          heldPoint: translatedHeldCornerPoint,
          polygon: translatedPolygon,
          frame:
            findDeckReferenceFrameById(input.session.interaction.referenceFrames, previousLockedWallId) ??
            input.session.interaction.referenceFrames[0]!,
        })
      : null;
  const wallCandidate =
    lockedWallFrameCandidate && lockedWallFrameCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M
      ? lockedWallFrameCandidate
      : selectDeckWallCandidate({
          heldPoint: translatedHeldCornerPoint,
          polygon: translatedPolygon,
          frames: input.session.interaction.referenceFrames,
          previousPreviewState: input.previousPreviewState,
          fallbackEdgeId: currentHostEdgeId,
        });
  const activeFrame = wallCandidate.frame;
  const wallSpanEligible =
    wallCandidate.heldSpanOutsideM <= DECK_WALL_SPAN_CANDIDATE_TOLERANCE_M ||
    (input.previousPreviewState?.activePrimaryTargetId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.heldSpanOutsideM <= DECK_WALL_SPAN_RETAIN_TOLERANCE_M) ||
    (previousLockedWallId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.heldSpanOutsideM <= Number.POSITIVE_INFINITY);
  const wallCandidateActive =
    (wallCandidate.nearGapM <= DECK_SNAP_TOLERANCE_M && wallSpanEligible) ||
    (input.previousPreviewState?.activePrimaryTargetId === wallCandidate.frame.sourceEdgeId &&
      wallCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M &&
      wallCandidate.heldSpanOutsideM <= DECK_WALL_SPAN_RETAIN_TOLERANCE_M) ||
    (previousLockedWallId === wallCandidate.frame.sourceEdgeId && wallCandidate.nearGapM <= DECK_UNSNAP_TOLERANCE_M);
  const wallLocked =
    previousLockedWallId !== null &&
    wallCandidate.frame.sourceEdgeId === previousLockedWallId &&
    (lockedWallFrameCandidate?.nearGapM ?? wallCandidate.nearGapM) <= DECK_UNSNAP_TOLERANCE_M;
  const unclampedCenterOffsetM = wallCandidateActive
    ? clampPresetDeckCenterOffset({
        centerOffsetM: wallCandidate.centerOffsetM,
        frame: activeFrame,
        deckWidthM: input.session.startWidthM,
      })
    : wallCandidate.centerOffsetM;
  const endCatch =
    wallLocked
      ? resolveDeckEndCatch({
          frame: activeFrame,
          deckWidthM: input.session.startWidthM,
          centerOffsetM: unclampedCenterOffsetM,
          previousPreviewState: input.previousPreviewState,
        })
      : null;
  const cornerCandidate =
    wallCandidateActive
      ? resolveDeckCornerCandidate({
        primaryFrame: activeFrame,
        heldCornerPoint: translatedHeldCornerPoint,
        frames: input.session.interaction.referenceFrames,
        previousPreviewState: input.previousPreviewState,
      })
      : null;
  const cornerLocked =
    cornerCandidate !== null &&
    ((previousLockedCornerId !== null && cornerCandidate.cornerVertexId === previousLockedCornerId) || wallLocked);
  const placement = cornerLocked
    ? 'snapped'
    : wallLocked
      ? 'snapped'
      : 'floating';
  const releasePlacement =
    cornerCandidate || wallCandidateActive
      ? 'snapped'
      : 'floating';
  const activeSnapMode =
    cornerCandidate
      ? 'corner_dual_edge'
      : wallCandidateActive
        ? 'single_edge'
        : 'floating';
  const snapTargetState =
    placement === 'snapped'
      ? 'locked'
      : releasePlacement === 'snapped'
        ? 'candidate'
        : 'none';
  const centerOffsetM = placement === 'snapped' && !cornerLocked
    ? endCatch?.centerOffsetM ?? unclampedCenterOffsetM
    : unclampedCenterOffsetM;
  const referenceEdgeGapM = releasePlacement === 'snapped' ? 0 : wallCandidate.nearGapM;
  const attachmentMode = activeSnapMode;
  const previewPolygon =
    cornerLocked
      ? buildDeckCornerPreviewPolygon({
          primaryFrame: cornerCandidate.primaryFrame,
          secondaryFrame: cornerCandidate.secondaryFrame,
          cornerPoint: cornerCandidate.cornerPoint,
          deckWidthM: input.session.startWidthM,
          deckDepthM: input.session.startDepthM,
        })
      : wallLocked
        ? buildDeckPreviewPolygon({
            frame: activeFrame,
            deckWidthM: input.session.startWidthM,
            deckDepthM: input.session.startDepthM,
            centerOffsetM,
            referenceEdgeGapM: 0,
          })
        : translatedPolygon;
  const resolvedHeldPreviewCorner = resolveNearestPreviewCorner({
    polygon: previewPolygon,
    point: translatedHeldCornerPoint,
  });
  const referenceGuide =
    snapTargetState === 'locked'
      ? null
      : cornerCandidate
        ? {
            start: resolvedHeldPreviewCorner.point,
            end: cornerCandidate.cornerPoint,
            state: 'snap-lane' as const,
          }
        : {
            start: resolvedHeldPreviewCorner.point,
            end: resolveDeckReferenceGuidePoint({
              frame: activeFrame,
              alongM: wallCandidate.heldAlongM,
            }),
            state: wallCandidateActive ? 'snap-lane' : 'witness',
          };

  return {
    deckId: input.session.deckId,
    previewAnchor: resolvedHeldPreviewCorner.point,
    activeSnapMode,
    snapTargetState,
    attachmentMode,
    semanticPlacementSide: releasePlacement === 'snapped' ? activeFrame.hostEdgeId : null,
    semanticWitnessSide: activeFrame.hostEdgeId,
    activePrimaryTargetId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    activeSecondaryTargetId: cornerCandidate?.secondaryFrame.sourceEdgeId ?? null,
    placementEdgeId: placement === 'snapped' ? activeFrame.sourceEdgeId : null,
    primaryHostEdgeId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    secondaryHostEdgeId: cornerCandidate?.secondaryFrame.sourceEdgeId ?? null,
    cornerVertexId: cornerCandidate?.cornerVertexId ?? null,
    witnessEdgeId: activeFrame.sourceEdgeId,
    highlightTargetId: releasePlacement === 'snapped' ? activeFrame.sourceEdgeId : null,
    hostEdgeStart: activeFrame.hostEdgeStart,
    hostEdgeEnd: activeFrame.hostEdgeEnd,
    secondaryHostEdgeStart: cornerCandidate?.secondaryFrame.hostEdgeStart ?? null,
    secondaryHostEdgeEnd: cornerCandidate?.secondaryFrame.hostEdgeEnd ?? null,
    heldCornerIndex: resolvedHeldPreviewCorner.index,
    heldCornerPoint: resolvedHeldPreviewCorner.point,
    lockedCornerPoint: cornerLocked ? cornerCandidate?.cornerPoint ?? null : null,
    endCatchSide: placement === 'snapped' && !cornerLocked ? endCatch?.endCatchSide ?? null : null,
    endCatchPoint: placement === 'snapped' && !cornerLocked ? endCatch?.endCatchPoint ?? null : null,
    centerOffsetM,
    referenceEdgeGapM,
    placement,
    snapEligible: wallCandidateActive,
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
        deckInteraction: HouseFirstPlanShapeOverlay['deckInteraction'];
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
}): Partial<HouseFirstDeckDraft> {
  if (input.session.interaction.kind === 'custom_outline') {
    return {
      hostEdgeId: input.preview.witnessEdgeId,
      attachmentMode: 'floating',
      primaryHostEdgeId: null,
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      isAttached: false,
      outline: serializeDeckOutlineFromPlanPolygon({
        polygon: input.preview.polygon,
        attachmentSide: input.session.interaction.houseAttachmentSide,
      }),
    };
  }

  const floatingRect =
    input.preview.releasePlacement === 'floating'
      ? inferFloatingRectFromPlanPolygon({
          polygon: input.preview.polygon,
          attachmentSide: input.session.interaction.houseAttachmentSide,
        })
      : null;

  return {
    hostEdgeId: input.preview.releasePlacement === 'snapped' ? input.preview.primaryHostEdgeId : input.preview.witnessEdgeId,
    attachmentMode: input.preview.attachmentMode,
    primaryHostEdgeId: input.preview.releasePlacement === 'snapped' ? input.preview.primaryHostEdgeId : null,
    secondaryHostEdgeId:
      input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode === 'corner_dual_edge'
        ? input.preview.secondaryHostEdgeId
        : null,
    cornerVertexId:
      input.preview.releasePlacement === 'snapped' && input.preview.attachmentMode === 'corner_dual_edge'
        ? input.preview.cornerVertexId
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
      centerOffsetM: formatDeckPresetValue(input.preview.centerOffsetM),
      detachedGapM:
        input.preview.releasePlacement === 'floating'
          ? formatDeckPresetValue(input.preview.referenceEdgeGapM)
          : null,
    } as unknown as HouseFirstDeckDraft['presetRect'],
    ...(input.preview.releasePlacement === 'snapped' ? { floatingRect: null } : null),
  };
}

export function buildDeckInteractionTelemetry(input: {
  selectedDeckId: string | null;
  hoveredDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | null;
  capability: DeckInteractionCapability | null;
  viewState: ObjectInteractionViewState;
  selectedDeckShape:
    | {
        custom: boolean;
        deckInteraction: HouseFirstPlanShapeOverlay['deckInteraction'];
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
