import type { ObjectWorkbenchPlanShapeOverlay, ObjectWorkbenchPlanOpeningInteraction, PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import {
  buildObjectInteractionTelemetry,
  buildObjectInteractionViewState,
  type ObjectInteractionTelemetry,
  type ObjectInteractionViewState,
} from './objectInteractionEngine';

export type OpeningSvgInteraction = {
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
};

export type OpeningDragSession = {
  pointerId: number;
  openingId: string;
  startSvgX: number;
  startSvgY: number;
  startPolygon: PlanPoint[];
  startOffsetAlongWallM: number;
  interaction: ObjectWorkbenchPlanOpeningInteraction;
  svgInteraction: OpeningSvgInteraction;
};

export type OpeningPreviewState = {
  openingId: string;
  polygon: PlanPoint[];
  offsetAlongWallM: number;
  clamped: boolean;
};

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function translatePolygon(polygon: PlanPoint[], deltaX: number, deltaY: number): PlanPoint[] {
  if (Math.abs(deltaX) <= 1e-6 && Math.abs(deltaY) <= 1e-6) return polygon;
  return polygon.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
}

export function buildOpeningDragSession(input: {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  openingId: string;
  overlayShape: ObjectWorkbenchPlanShapeOverlay;
  svgInteraction: OpeningSvgInteraction;
}): OpeningDragSession | null {
  if (!input.overlayShape.openingInteraction) return null;
  return {
    pointerId: input.pointerId,
    openingId: input.openingId,
    startSvgX: input.startSvgX,
    startSvgY: input.startSvgY,
    startPolygon: input.overlayShape.polygon,
    startOffsetAlongWallM: input.overlayShape.openingInteraction.offsetAlongWallM,
    interaction: input.overlayShape.openingInteraction,
    svgInteraction: input.svgInteraction,
  };
}

export function resolveOpeningPreviewState(input: {
  session: OpeningDragSession;
  nextSvgX: number;
  nextSvgY: number;
}): OpeningPreviewState {
  const svgDx = input.session.svgInteraction.hostEdgeEnd.x - input.session.svgInteraction.hostEdgeStart.x;
  const svgDy = input.session.svgInteraction.hostEdgeEnd.y - input.session.svgInteraction.hostEdgeStart.y;
  const svgLength = Math.hypot(svgDx, svgDy);
  const axisX = svgLength > 1e-6 ? svgDx / svgLength : 1;
  const axisY = svgLength > 1e-6 ? svgDy / svgLength : 0;
  const deltaSvgX = input.nextSvgX - input.session.startSvgX;
  const deltaSvgY = input.nextSvgY - input.session.startSvgY;
  const deltaSvgAlong = deltaSvgX * axisX + deltaSvgY * axisY;
  const metresPerSvgUnit = svgLength > 1e-6 ? input.session.interaction.hostSpanM / svgLength : 0;
  const unclampedOffsetAlongWallM = input.session.startOffsetAlongWallM + deltaSvgAlong * metresPerSvgUnit;
  const offsetAlongWallM = clampValue(
    unclampedOffsetAlongWallM,
    input.session.interaction.minOffsetAlongWallM,
    input.session.interaction.maxOffsetAlongWallM,
  );
  const deltaOffsetM = offsetAlongWallM - input.session.startOffsetAlongWallM;
  const normalizedAxisX =
    (input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x) /
    Math.max(
      Math.hypot(
        input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x,
        input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y,
      ),
      1e-6,
    );
  const normalizedAxisY =
    (input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y) /
    Math.max(
      Math.hypot(
        input.session.interaction.hostEdgeEnd.x - input.session.interaction.hostEdgeStart.x,
        input.session.interaction.hostEdgeEnd.y - input.session.interaction.hostEdgeStart.y,
      ),
      1e-6,
    );

  return {
    openingId: input.session.openingId,
    polygon: translatePolygon(input.session.startPolygon, normalizedAxisX * deltaOffsetM, normalizedAxisY * deltaOffsetM),
    offsetAlongWallM,
    clamped: Math.abs(offsetAlongWallM - unclampedOffsetAlongWallM) > 1e-6,
  };
}

export function buildOpeningInteractionViewState(input: {
  selectedOpeningShape: Pick<ObjectWorkbenchPlanShapeOverlay, 'ownerId' | 'openingInteraction' | 'openingDragEligibility'> | null;
  dragSession: OpeningDragSession | null;
  previewState: OpeningPreviewState | null;
}): ObjectInteractionViewState | null {
  if (!input.selectedOpeningShape) return null;

  const dragEligible = input.selectedOpeningShape.openingDragEligibility?.eligible ?? false;
  const dragReason = input.selectedOpeningShape.openingDragEligibility?.reason ?? null;
  const isDragging =
    input.dragSession?.openingId === input.selectedOpeningShape.ownerId && Boolean(input.previewState);

  return buildObjectInteractionViewState({
    phase: isDragging ? 'dragging' : 'selected',
    placementState: dragEligible ? (isDragging ? 'floating' : 'none') : 'blocked',
    statusLabel: dragEligible ? (isDragging ? 'Dragging opening' : 'Drag opening') : 'Blocked',
    statusDetail: dragReason,
    canCommit: isDragging,
    highlightTargetId: input.selectedOpeningShape.openingInteraction?.hostEdgeId ?? null,
    previewAnchor: null,
    releaseOutcome: 'none',
    releasePlacement: null,
    settleVisualState: null,
    affordanceState: dragEligible ? (isDragging ? 'floating' : 'idle') : 'blocked',
    referenceGuideState: 'none',
  });
}

export function buildOpeningInteractionTelemetry(input: {
  selectedOpeningId: string | null;
  viewState: ObjectInteractionViewState | null;
}): ObjectInteractionTelemetry<'opening'> | null {
  if (!input.viewState) return null;
  return buildObjectInteractionTelemetry({
    objectKind: 'opening',
    selectedObjectId: input.selectedOpeningId,
    viewState: input.viewState,
  });
}
