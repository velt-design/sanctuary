import type { AttachmentSide } from '@sp/costing';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { DeckDragSession, DeckPreviewState } from './deckInteractionAdapter';

const DECK_COMMIT_FRAME_MATCH_TOLERANCE_M = 1.5;
const DECK_COMMIT_FRAME_LINE_TOLERANCE_M = 0.5;
const DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE = 0.75;
const DECK_COMMIT_FRAME_POINT_SPAN_TOLERANCE_M = 0.25;

export type DeckCommitTransformSource =
  | 'none'
  | 'legacy_plan'
  | 'same_frame'
  | 'top_projection_to_object_frame'
  | 'missing_frame';

export type DeckCommitTransformDiagnostics = {
  renderFrameId: string | null;
  commitFrameId: string | null;
  renderCoordinateSpace: DeckDragSession['dragCoordinateSpace'] | 'unknown';
  commitCoordinateSpace: 'object_frame_m' | 'legacy_plan_m' | 'unknown';
  transformSource: DeckCommitTransformSource;
};

export type DeckCommitCoordinateTrace = {
  dragStartPolygon: PlanPoint[];
  previewPolygon: PlanPoint[];
  releasePolygon: PlanPoint[];
  commitSpacePolygon: PlanPoint[];
  rebuiltProjectionPolygon: PlanPoint[] | null;
  patch: ObjectWorkbenchDeckPatch;
  transform: DeckCommitTransformDiagnostics;
  centroidDeltaM: {
    previewToCommit: PlanPoint | null;
    releaseToRebuilt: PlanPoint | null;
  };
};

function formatDeckPresetValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function findDeckReferenceFrameById(
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  return frames.find((frame) => frame.sourceEdgeId === edgeId) ?? null;
}

function pointDistance(left: PlanPoint, right: PlanPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function polygonCenter(polygon: readonly PlanPoint[]): PlanPoint | null {
  if (!polygon.length) return null;
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function centroidDelta(from: readonly PlanPoint[], to: readonly PlanPoint[] | null): PlanPoint | null {
  const fromCenter = polygonCenter(from);
  const toCenter = to ? polygonCenter(to) : null;
  if (!fromCenter || !toCenter) return null;
  return {
    x: toCenter.x - fromCenter.x,
    y: toCenter.y - fromCenter.y,
  };
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
  const semanticPenalty = input.renderFrame.hostEdgeId === input.commitFrame.hostEdgeId ? 0 : 2;
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

  if (input.commitFrame.frameSource === 'object_frame' && input.renderFrame.frameSource !== 'object_frame') {
    return true;
  }

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
    (containingCommitFrames.length > 0 ||
      bestGeometryMatch.commitFrame.frameSource === 'object_frame' ||
      bestGeometryMatch.score <= DECK_COMMIT_FRAME_MATCH_TOLERANCE_M)
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

function projectPolygonToDeckReferenceFrame(input: {
  polygon: readonly PlanPoint[];
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

function deckReferenceFrameSpanLength(frame: ObjectWorkbenchPlanDeckReferenceFrame): number {
  return Math.max(0, frame.spanEndM - frame.spanStartM);
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

function deckReferenceFrameAlongScale(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): number {
  const renderLength = deckReferenceFrameSpanLength(input.renderFrame);
  const commitLength = deckReferenceFrameSpanLength(input.commitFrame);
  if (renderLength <= 1e-6 || commitLength <= 1e-6) return 1;
  return commitLength / renderLength;
}

function mapDeckFrameAlongFromRenderToCommit(input: {
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  renderAlongM: number;
}): number {
  const alongDot =
    input.renderFrame.alongUnitX * input.commitFrame.alongUnitX +
    input.renderFrame.alongUnitY * input.commitFrame.alongUnitY;
  const sharesWorldAlongCoordinate =
    input.renderFrame.axis === input.commitFrame.axis &&
    Math.abs(input.renderFrame.edgeCoordinateM - input.commitFrame.edgeCoordinateM) <= 1e-6 &&
    Math.abs(alongDot) >= DECK_COMMIT_FRAME_VECTOR_DOT_TOLERANCE;
  if (sharesWorldAlongCoordinate) {
    if (alongDot >= 0) return input.renderAlongM;
    return (
      deckReferenceFrameMidpoint(input.commitFrame) +
      (deckReferenceFrameMidpoint(input.renderFrame) - input.renderAlongM)
    );
  }
  const renderCenterOffsetM = input.renderAlongM - deckReferenceFrameMidpoint(input.renderFrame);
  return (
    deckReferenceFrameMidpoint(input.commitFrame) +
    renderCenterOffsetM *
      deckReferenceFrameAlongScale({
        renderFrame: input.renderFrame,
        commitFrame: input.commitFrame,
      }) *
      deckReferenceFrameAlongDirectionSign({
        renderFrame: input.renderFrame,
        commitFrame: input.commitFrame,
      })
  );
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

function resolveDeckFrameOppositeSpan(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[];
}): number | null {
  const opposite =
    input.frames
      .filter(
        (frame) =>
          frame.axis === input.frame.axis &&
          frame.sourceEdgeId !== input.frame.sourceEdgeId &&
          frame.outwardDirection === -input.frame.outwardDirection,
      )
      .map((frame) => Math.abs(frame.edgeCoordinateM - input.frame.edgeCoordinateM))
      .filter((distance) => Number.isFinite(distance) && distance > 1e-6)
      .sort((left, right) => left - right)[0] ?? null;
  return opposite;
}

function resolveDeckFrameOutwardScale(input: {
  interaction: ObjectWorkbenchPlanDeckInteraction;
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
}): number {
  const renderSpan = resolveDeckFrameOppositeSpan({
    frame: input.renderFrame,
    frames: input.interaction.referenceFrames,
  });
  const commitFrames = input.interaction.commitReferenceFrames.length
    ? input.interaction.commitReferenceFrames
    : input.interaction.referenceFrames;
  const commitSpan = resolveDeckFrameOppositeSpan({
    frame: input.commitFrame,
    frames: commitFrames,
  });
  if (!renderSpan || !commitSpan) return 1;
  return commitSpan / renderSpan;
}

function mapDeckPointFromRenderFrameToCommitFrame(input: {
  point: PlanPoint;
  renderFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  commitFrame: ObjectWorkbenchPlanDeckReferenceFrame;
  outwardScale: number;
}): PlanPoint {
  const projection = projectPointToDeckReferenceFrame(input.point, input.renderFrame);
  return buildPlanPointOnDeckReferenceFrame({
    frame: input.commitFrame,
    alongM: mapDeckFrameAlongFromRenderToCommit({
      renderFrame: input.renderFrame,
      commitFrame: input.commitFrame,
      renderAlongM: projection.alongM,
    }),
    outwardM: projection.outwardM * input.outwardScale,
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
  return mapDeckPolygonThroughCommitFrame({
    ...input,
    polygon: input.preview.polygon,
  });
}

function mapDeckPolygonThroughCommitFrame(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
  polygon: readonly PlanPoint[];
}): PlanPoint[] | null {
  const frames = resolveDeckPreviewRenderCommitFrames(input);
  if (!frames) return null;
  if (frames.renderFrame === frames.commitFrame) return [...input.polygon];
  const outwardScale = resolveDeckFrameOutwardScale({
    interaction: input.session.interaction,
    renderFrame: frames.renderFrame,
    commitFrame: frames.commitFrame,
  });
  return input.polygon.map((point) =>
    mapDeckPointFromRenderFrameToCommitFrame({
      point,
      renderFrame: frames.renderFrame,
      commitFrame: frames.commitFrame,
      outwardScale,
    }),
  );
}

function isProjectionBackedDeckSession(session: DeckDragSession): boolean {
  return session.dragSource === 'top_projection_committed' ||
    session.dragCoordinateSpace === 'top_projection_world_m';
}

export function resolveDeckCommitTransformDiagnostics(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): DeckCommitTransformDiagnostics {
  const projectionBacked = isProjectionBackedDeckSession(input.session);
  const renderEdgeId = resolveDeckPreviewRenderEdgeId({ preview: input.preview });
  const renderFrame =
    findDeckReferenceFrameById(input.session.interaction.referenceFrames, renderEdgeId) ??
    input.session.interaction.referenceFrames[0] ??
    null;
  const commitFrame = renderFrame
    ? resolveDeckCommitReferenceFrame({
        interaction: input.session.interaction,
        renderEdgeId: renderFrame.sourceEdgeId,
        referencePoint: input.preview.previewAnchor,
      })
    : null;
  if (!projectionBacked) {
    return {
      renderFrameId: renderFrame?.sourceEdgeId ?? null,
      commitFrameId: commitFrame?.sourceEdgeId ?? null,
      renderCoordinateSpace: input.session.dragCoordinateSpace ?? 'unknown',
      commitCoordinateSpace: 'legacy_plan_m',
      transformSource: 'legacy_plan',
    };
  }
  return {
    renderFrameId: renderFrame?.sourceEdgeId ?? null,
    commitFrameId: commitFrame?.sourceEdgeId ?? null,
    renderCoordinateSpace: input.session.dragCoordinateSpace ?? 'unknown',
    commitCoordinateSpace: renderFrame && commitFrame ? 'object_frame_m' : 'unknown',
    transformSource: !renderFrame || !commitFrame
      ? 'missing_frame'
      : renderFrame === commitFrame
        ? 'same_frame'
        : 'top_projection_to_object_frame',
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

function mapDeckPreviewPolygonToCommitSpaceStrict(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): PlanPoint[] {
  const projectionBacked = isProjectionBackedDeckSession(input.session);
  const frameMappedPolygon = mapDeckPreviewPolygonThroughCommitFrame(input);
  if (projectionBacked) {
    if (!frameMappedPolygon) {
      throw new Error('Deck projection commit frame is unavailable.');
    }
    return frameMappedPolygon;
  }
  if (input.session.interaction.kind === 'preset_rect' && input.preview.releasePlacement === 'floating') {
    return input.preview.polygon;
  }
  return mapPreviewPolygonToCommitSpace(input);
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
  const previewDerivedCenterOffsetM =
    input.preview.anchorDerivedCenterOffsetM ?? input.preview.centerOffsetM;
  if (commitFrame && renderFrame === commitFrame && Number.isFinite(previewDerivedCenterOffsetM)) {
    return previewDerivedCenterOffsetM;
  }
  if (
    isProjectionBackedDeckSession(input.session) &&
    input.preview.releasePlacement === 'snapped' &&
    Number.isFinite(previewDerivedCenterOffsetM)
  ) {
    return previewDerivedCenterOffsetM;
  }
  const frameMappedPolygon = commitFrame ? mapDeckPreviewPolygonThroughCommitFrame(input) : null;
  const frameMappedProjection =
    frameMappedPolygon && commitFrame
      ? projectPolygonToDeckReferenceFrame({
          polygon: frameMappedPolygon,
          frame: commitFrame,
        })
      : null;
  if (frameMappedProjection) {
    return frameMappedProjection.centerOffsetM;
  }
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

export function buildDeckCommitPatch(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): ObjectWorkbenchDeckPatch {
  const commitWitnessFrame = resolveDeckCommitReferenceFrame({
    interaction: input.session.interaction,
    renderEdgeId: input.preview.witnessEdgeId,
  });
  const commitSpacePreviewPolygon = mapDeckPreviewPolygonToCommitSpaceStrict(input);
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
      widthM: formatDeckPresetValue(input.session.startWidthM),
      depthM: formatDeckPresetValue(input.session.startDepthM),
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

export function buildDeckCommitCoordinateTrace(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
  rebuiltProjectionPolygon?: PlanPoint[] | null;
}): DeckCommitCoordinateTrace {
  const commitSpacePolygon = mapDeckPreviewPolygonToCommitSpaceStrict(input);
  const patch = buildDeckCommitPatch(input);
  return {
    dragStartPolygon: input.session.startPolygon,
    previewPolygon: input.preview.polygon,
    releasePolygon: input.preview.polygon,
    commitSpacePolygon,
    rebuiltProjectionPolygon: input.rebuiltProjectionPolygon ?? null,
    patch,
    transform: resolveDeckCommitTransformDiagnostics(input),
    centroidDeltaM: {
      previewToCommit: centroidDelta(input.preview.polygon, commitSpacePolygon),
      releaseToRebuilt: centroidDelta(input.preview.polygon, input.rebuiltProjectionPolygon ?? null),
    },
  };
}
