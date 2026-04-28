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

const DECK_SNAP_TOLERANCE_M = 0.25;
const DECK_UNSNAP_TOLERANCE_M = 0.4;
const DECK_REFERENCE_SWITCH_HYSTERESIS_M = 0.2;

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
  interaction: HouseFirstPlanDeckInteraction;
  svgInteraction: DeckSvgInteraction;
};

export type DeckPreviewState = {
  deckId: string;
  polygon: PlanPoint[];
  previewAnchor: PlanPoint;
  semanticPlacementSide: AttachmentSide | null;
  semanticWitnessSide: AttachmentSide;
  placementEdgeId: string | null;
  witnessEdgeId: string;
  highlightTargetId: string | null;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
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
  const hostSpanM = Math.max(0, input.frame.spanEndM - input.frame.spanStartM);
  const availableHalfSpanM =
    input.deckWidthM <= hostSpanM + 1e-6 ? Math.max(0, (hostSpanM - input.deckWidthM) / 2) : 0;
  return clampValue(input.centerOffsetM, -availableHalfSpanM, availableHalfSpanM);
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
      semanticPlacementSide: null,
      semanticWitnessSide: witnessFrame.hostEdgeId,
      placementEdgeId: null,
      witnessEdgeId: witnessFrame.sourceEdgeId,
      highlightTargetId: witnessFrame.sourceEdgeId,
      hostEdgeStart: witnessFrame.hostEdgeStart,
      hostEdgeEnd: witnessFrame.hostEdgeEnd,
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
    input.previousPreviewState?.witnessEdgeId ??
    input.session.interaction.placementEdgeId ??
    input.session.interaction.witnessEdgeId;
  const candidateFrame = resolveDeckReferenceFrameFromCenter({
    center,
    polygon: translatedPolygon,
    frames: input.session.interaction.referenceFrames,
    previousHostEdgeId: currentHostEdgeId,
  });
  const anchoredFrame = findDeckReferenceFrameById(input.session.interaction.referenceFrames, currentHostEdgeId) ?? candidateFrame;
  const anchoredProjection = projectPointToDeckReferenceFrame(center, anchoredFrame);
  const anchoredRawGapM = Math.max(0, anchoredProjection.outwardM - input.session.startDepthM / 2);
  const startedFloating = input.session.interaction.placement === 'floating';
  const previousPlacement = input.previousPreviewState?.placement ?? input.session.interaction.placement;
  const placement =
    startedFloating || previousPlacement === 'floating'
      ? 'floating'
      : anchoredRawGapM > DECK_UNSNAP_TOLERANCE_M
        ? 'floating'
        : 'snapped';
  const candidateProjection =
    placement === 'snapped' ? anchoredProjection : projectPointToDeckReferenceFrame(center, candidateFrame);
  const candidateRawGapM =
    placement === 'snapped'
      ? anchoredRawGapM
      : Math.max(0, candidateProjection.outwardM - input.session.startDepthM / 2);
  const candidateSnapEligible =
    placement !== 'snapped' &&
    candidateProjection.outwardM >= 0 &&
    candidateRawGapM <= DECK_SNAP_TOLERANCE_M;
  const anchoredSnapEligible =
    placement !== 'snapped' &&
    anchoredProjection.outwardM >= 0 &&
    anchoredRawGapM <= DECK_SNAP_TOLERANCE_M;
  const snapFrame =
    placement === 'snapped'
      ? anchoredFrame
      : candidateSnapEligible
        ? candidateFrame
        : anchoredSnapEligible
          ? anchoredFrame
          : null;
  const witnessFrame = placement === 'snapped' ? anchoredFrame : candidateFrame;
  const frame = placement === 'snapped' ? anchoredFrame : snapFrame ?? witnessFrame;
  const witnessProjection = witnessFrame.sourceEdgeId === anchoredFrame.sourceEdgeId ? anchoredProjection : candidateProjection;
  const projection = frame.sourceEdgeId === witnessFrame.sourceEdgeId ? witnessProjection : anchoredProjection;
  const rawCenterOffsetM = projection.alongM - ((frame.spanStartM + frame.spanEndM) / 2);
  const rawGapM = frame.sourceEdgeId === witnessFrame.sourceEdgeId ? candidateRawGapM : anchoredRawGapM;
  const snapEligible = snapFrame !== null;
  const releasePlacement = placement === 'snapped' || snapEligible ? 'snapped' : 'floating';
  const centerOffsetM = placement === 'snapped'
    ? clampPresetDeckCenterOffset({
        centerOffsetM: rawCenterOffsetM,
        frame,
        deckWidthM: input.session.startWidthM,
      })
    : rawCenterOffsetM;
  const referenceEdgeGapM = releasePlacement === 'snapped' ? 0 : rawGapM;
  const referenceGuide =
    releasePlacement === 'snapped' && placement === 'snapped'
      ? null
      : {
          start: center,
          end: resolveDeckReferenceGuidePoint({
            frame,
            alongM: projection.alongM,
          }),
          state: releasePlacement === 'snapped' ? 'snap-lane' : 'witness',
        };

  return {
    deckId: input.session.deckId,
    previewAnchor: center,
    semanticPlacementSide: releasePlacement === 'snapped' ? frame.hostEdgeId : null,
    semanticWitnessSide: witnessFrame.hostEdgeId,
    placementEdgeId: releasePlacement === 'snapped' ? frame.sourceEdgeId : null,
    witnessEdgeId: witnessFrame.sourceEdgeId,
    highlightTargetId: frame.sourceEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    centerOffsetM,
    referenceEdgeGapM,
    placement,
    snapEligible,
    releasePlacement,
    referenceGuide,
    polygon:
      placement === 'snapped'
        ? buildDeckPreviewPolygon({
            frame,
            deckWidthM: input.session.startWidthM,
            deckDepthM: input.session.startDepthM,
            centerOffsetM,
            referenceEdgeGapM,
          })
        : translatedPolygon,
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
    hostEdgeId: input.preview.releasePlacement === 'snapped' ? input.preview.placementEdgeId : input.preview.witnessEdgeId,
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
  const selectedDeckType =
    capability?.selectedDeckType ??
    (input.selectedDeckShape
      ? resolveDeckSelectedTypeFromShape({
          custom: input.selectedDeckShape.custom,
          interactionPlacement: input.selectedDeckShape.deckInteraction?.placement ?? null,
        })
      : 'none');

  return {
    selectedDeckId: input.selectedDeckId,
    hoveredDeckId: input.hoveredDeckId,
    housePolygonSource: input.housePolygonSource,
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
