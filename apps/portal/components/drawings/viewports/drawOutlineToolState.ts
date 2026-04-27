import {
  buildDrawOutlinePreviewPolygon,
  distanceBetweenOutlinePoints,
  formatOutlineNumber,
  hasDrawOutlineDraft,
  isFiniteOutlinePoint,
  MIN_OUTLINE_SEGMENT_M,
  outlinePointsToPolygon,
  resolveDrawOutlineHoverPoint,
  resolvePendingOutlinePoint,
} from './drawOutlineToolGeometry';
import { validateDrawOutlinePoints, type DrawOutlineValidationIssue } from './drawOutlineToolValidation';

export { outlinePointsToPolygon } from './drawOutlineToolGeometry';

export type DrawOutlinePoint = {
  alongM: number;
  depthM: number;
};

export type DrawOutlinePolygonPoint = {
  alongM: string;
  depthM: string;
};

export type DrawOutlineAngleMode = 'relative' | 'absolute';

export type DrawOutlinePreviewSource = 'none' | 'hover' | 'locked-distance';

export type DrawOutlineActiveStatus =
  | 'first-point'
  | 'placing'
  | 'locked-distance'
  | 'close-ready'
  | 'close-hovered';

export type DrawOutlineDiagnosticState = 'inactive' | DrawOutlineActiveStatus | 'error';

export type DrawOutlineHoverPoint = {
  point: DrawOutlinePoint;
  closeHovered: boolean;
};

export type DrawOutlineInactiveState = {
  kind: 'inactive';
};

export type DrawOutlineActiveToolState = {
  kind: 'active';
  status: DrawOutlineActiveStatus;
  points: DrawOutlinePoint[];
  pendingPoint: DrawOutlinePoint | null;
  hoverPoint: DrawOutlineHoverPoint | null;
  distanceDraft: string;
  angleDraft: string;
  angleMode: DrawOutlineAngleMode;
  lockedDistanceDraft: string | null;
  previewSource: DrawOutlinePreviewSource;
};

export type DrawOutlineToolState = DrawOutlineInactiveState | DrawOutlineActiveToolState;

export type DrawOutlineTransitionResult = {
  state: DrawOutlineToolState;
  error?: string | null;
};

export type DrawOutlineCloseResult =
  | {
      ok: true;
      state: DrawOutlineToolState;
      polygon: DrawOutlinePolygonPoint[];
    }
  | {
      ok: false;
      state: DrawOutlineToolState;
      error?: string;
      validationIssue?: DrawOutlineValidationIssue;
    };

export type DrawOutlineViewModel = {
  activeState: DrawOutlineActiveToolState | null;
  isActive: boolean;
  pendingPoint: DrawOutlinePoint | null;
  hoverPreviewPoint: DrawOutlinePoint | null;
  previewPointKind: 'pending' | 'hover' | 'locked-distance' | null;
  confirmedPointCount: number;
  closeReady: boolean;
  closeHovered: boolean;
  popoverAnchorPointCount: number;
  previewPolygon?: DrawOutlinePolygonPoint[];
  diagnosticState: DrawOutlineDiagnosticState;
  angleMode: DrawOutlineAngleMode | 'none';
  hasPendingPoint: boolean;
  hideHouseFootprint: boolean;
  lockedDistanceDraft: string | null;
  previewSource: DrawOutlinePreviewSource;
};

export function createInactiveDrawOutlineState(): DrawOutlineToolState {
  return { kind: 'inactive' };
}

export function startDrawOutlineTool(): DrawOutlineTransitionResult {
  return {
    state: normalizeDrawOutlineState({
      kind: 'active',
      status: 'first-point',
      points: [],
      pendingPoint: null,
      hoverPoint: null,
      distanceDraft: '',
      angleDraft: '',
      angleMode: 'relative',
      lockedDistanceDraft: null,
      previewSource: 'none',
    }),
    error: null,
  };
}

export function cancelDrawOutlineTool(): DrawOutlineTransitionResult {
  return { state: createInactiveDrawOutlineState(), error: null };
}

export function finishSuccessfulDrawOutlineCommit(): DrawOutlineTransitionResult {
  return { state: createInactiveDrawOutlineState(), error: null };
}

export function isDrawOutlineActive(state: DrawOutlineToolState): state is DrawOutlineActiveToolState {
  return state.kind === 'active';
}

export function selectDrawOutlinePoint(state: DrawOutlineToolState, point: DrawOutlinePoint): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state) || !isFiniteOutlinePoint(point)) return { state };

  if (!state.points.length) {
    return {
      state: normalizeDrawOutlineState({
        ...state,
        points: [point],
        pendingPoint: null,
        hoverPoint: null,
        distanceDraft: '',
        angleDraft: '',
        angleMode: 'absolute',
        lockedDistanceDraft: null,
        previewSource: 'none',
      }),
      error: null,
    };
  }

  const start = state.points[state.points.length - 1]!;
  const distance = distanceBetweenOutlinePoints(start, point);
  const clearedHoverState = normalizeDrawOutlineState({ ...state, hoverPoint: null });
  if (distance < MIN_OUTLINE_SEGMENT_M) {
    return {
      state: clearedHoverState,
      error: 'Click a point at least 1mm from the previous point.',
    };
  }

  const previous = state.points[state.points.length - 2];

  return {
    state: normalizeDrawOutlineState({
      ...state,
      points: [...state.points, point],
      pendingPoint: null,
      hoverPoint: null,
      distanceDraft: '',
      angleDraft: '',
      angleMode: previous ? 'relative' : 'absolute',
      lockedDistanceDraft: null,
      previewSource: 'none',
    }),
    error: null,
  };
}

export function hoverDrawOutlinePoint(state: DrawOutlineToolState, point: DrawOutlinePoint | null): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  if (!point || !state.points.length || !isFiniteOutlinePoint(point)) {
    return { state: normalizeDrawOutlineState({ ...state, hoverPoint: null, previewSource: 'none' }) };
  }

  const nextHoverPoint = resolveDrawOutlineHoverPoint(state.points, point);
  const current = state.hoverPoint;
  if (
    current &&
    current.closeHovered === nextHoverPoint.closeHovered &&
    current.point.alongM === nextHoverPoint.point.alongM &&
    current.point.depthM === nextHoverPoint.point.depthM
  ) {
    return { state };
  }

  return {
    state: normalizeDrawOutlineState({
      ...state,
      hoverPoint: nextHoverPoint,
      previewSource: state.lockedDistanceDraft ? 'locked-distance' : 'hover',
    }),
  };
}

export function setDrawOutlineDistanceDraft(state: DrawOutlineToolState, distanceDraft: string): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  return {
    state: normalizeDrawOutlineState({
      ...state,
      distanceDraft,
      pendingPoint: null,
      lockedDistanceDraft: null,
      previewSource: state.hoverPoint ? 'hover' : 'none',
    }),
  };
}

export function setDrawOutlineAngleDraft(state: DrawOutlineToolState, angleDraft: string): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  return {
    state: normalizeDrawOutlineState({
      ...state,
      angleDraft,
      pendingPoint: null,
      lockedDistanceDraft: null,
      previewSource: state.hoverPoint ? 'hover' : 'none',
    }),
  };
}

export function armDrawOutlineDistanceLock(state: DrawOutlineToolState): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  if (!state.points.length) {
    return { state, error: 'Place the first point before locking a segment length.' };
  }
  const distance = Number.parseFloat(state.distanceDraft);
  if (!Number.isFinite(distance) || distance < MIN_OUTLINE_SEGMENT_M) {
    return { state, error: 'Enter a valid segment distance.' };
  }
  return {
    state: normalizeDrawOutlineState({
      ...state,
      pendingPoint: null,
      distanceDraft: '',
      angleDraft: '',
      lockedDistanceDraft: formatOutlineNumber(distance),
      previewSource: state.hoverPoint ? 'locked-distance' : 'none',
    }),
    error: null,
  };
}

export function confirmDrawOutlineSegment(state: DrawOutlineToolState): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  const nextPoint = resolvePendingOutlinePoint(state);
  if (!nextPoint) {
    return { state, error: 'Enter a valid segment distance and angle.' };
  }
  const previous = state.points[state.points.length - 1];
  if (previous && distanceBetweenOutlinePoints(previous, nextPoint) < MIN_OUTLINE_SEGMENT_M) {
    return { state, error: 'House footprint outline cannot include duplicate consecutive points.' };
  }
  return {
    state: normalizeDrawOutlineState({
      ...state,
      points: [...state.points, nextPoint],
      pendingPoint: null,
      hoverPoint: null,
      distanceDraft: '',
      angleDraft: '',
      angleMode: 'relative',
      lockedDistanceDraft: null,
      previewSource: 'none',
    }),
    error: null,
  };
}

export function undoDrawOutline(state: DrawOutlineToolState): DrawOutlineTransitionResult {
  if (!isDrawOutlineActive(state)) return { state };
  if (state.lockedDistanceDraft || state.pendingPoint || state.distanceDraft || state.angleDraft) {
    return {
      state: normalizeDrawOutlineState({
        ...state,
        pendingPoint: null,
        hoverPoint: null,
        distanceDraft: '',
        angleDraft: '',
        lockedDistanceDraft: null,
        previewSource: 'none',
      }),
      error: null,
    };
  }

  return {
    state: normalizeDrawOutlineState({
      ...state,
      points: state.points.slice(0, -1),
      hoverPoint: null,
      angleMode: state.points.length <= 2 ? 'absolute' : state.angleMode,
      lockedDistanceDraft: null,
      previewSource: 'none',
    }),
    error: null,
  };
}

export function prepareDrawOutlineClose(state: DrawOutlineToolState): DrawOutlineCloseResult {
  if (!isDrawOutlineActive(state)) return { ok: false, state };
  const pendingPoint = resolvePendingOutlinePoint(state);
  const points = pendingPoint ? [...state.points, pendingPoint] : state.points;
  const validation = validateDrawOutlinePoints(points);
  if (!validation.ok) {
    return { ok: false, state, error: validation.issue.message, validationIssue: validation.issue };
  }
  return { ok: true, state, polygon: outlinePointsToPolygon(points) };
}

export function deriveDrawOutlineViewModel(state: DrawOutlineToolState, hasInteractionError: boolean): DrawOutlineViewModel {
  const normalizedState = normalizeDrawOutlineState(state);
  if (!isDrawOutlineActive(normalizedState)) {
    return {
      activeState: null,
      isActive: false,
      pendingPoint: null,
      hoverPreviewPoint: null,
      previewPointKind: null,
      confirmedPointCount: 0,
      closeReady: false,
      closeHovered: false,
      popoverAnchorPointCount: 0,
      previewPolygon: undefined,
      diagnosticState: 'inactive',
      angleMode: 'none',
      hasPendingPoint: false,
      hideHouseFootprint: false,
      lockedDistanceDraft: null,
      previewSource: 'none',
    };
  }

  const pendingPoint = resolvePendingOutlinePoint(normalizedState);
  const hoverPreviewPoint = !pendingPoint ? normalizedState.hoverPoint?.point ?? null : null;
  const previewPointKind: 'pending' | 'hover' | 'locked-distance' | null = pendingPoint
    ? 'pending'
    : hoverPreviewPoint
      ? normalizedState.previewSource === 'locked-distance'
        ? 'locked-distance'
        : 'hover'
      : null;
  const confirmedPointCount = normalizedState.points.length;
  const closeReady = confirmedPointCount >= 3;
  const closeHovered = Boolean(closeReady && normalizedState.hoverPoint?.closeHovered && hoverPreviewPoint);
  const popoverAnchorPointCount = pendingPoint ? confirmedPointCount + 1 : confirmedPointCount;
  const previewPolygon = buildDrawOutlinePreviewPolygon(normalizedState.points, previewPointKind ? (pendingPoint ?? hoverPreviewPoint) : null);
  const diagnosticState: DrawOutlineDiagnosticState = hasInteractionError ? 'error' : normalizedState.status;

  return {
    activeState: normalizedState,
    isActive: true,
    pendingPoint,
    hoverPreviewPoint,
    previewPointKind,
    confirmedPointCount,
    closeReady,
    closeHovered,
    popoverAnchorPointCount,
    previewPolygon,
    diagnosticState,
    angleMode: normalizedState.angleMode,
    hasPendingPoint: Boolean(pendingPoint),
    hideHouseFootprint: previewPolygon.length < 3,
    lockedDistanceDraft: normalizedState.lockedDistanceDraft,
    previewSource: normalizedState.previewSource,
  };
}

function normalizeDrawOutlineState(state: DrawOutlineToolState): DrawOutlineToolState {
  if (!isDrawOutlineActive(state)) return state;
  const pendingPoint = resolvePendingOutlinePoint(state);
  const hoverPreviewPoint = !pendingPoint ? state.hoverPoint?.point ?? null : null;
  const closeReady = state.points.length >= 3;
  const closeHovered = Boolean(closeReady && state.hoverPoint?.closeHovered && hoverPreviewPoint);
  const status: DrawOutlineActiveStatus = closeHovered
    ? 'close-hovered'
    : state.lockedDistanceDraft
      ? 'locked-distance'
      : closeReady
        ? 'close-ready'
        : state.points.length === 0
          ? 'first-point'
          : 'placing';
  return {
    ...state,
    status,
    previewSource: state.hoverPoint
      ? state.lockedDistanceDraft
        ? 'locked-distance'
        : 'hover'
      : 'none',
  };
}
