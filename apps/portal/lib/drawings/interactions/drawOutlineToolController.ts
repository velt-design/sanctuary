import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import {
  CLOSE_START_TOLERANCE_M,
  MIN_OUTLINE_SEGMENT_M,
  distanceBetweenOutlinePoints,
} from '@/components/drawings/viewports/drawOutlineToolGeometry';
import {
  armDrawOutlineDistanceLock,
  cancelDrawOutlineTool,
  finishSuccessfulDrawOutlineCommit,
  hoverDrawOutlinePoint,
  isDrawOutlineActive,
  prepareDrawOutlineClose,
  selectDrawOutlinePoint,
  startDrawOutlineTool,
  undoDrawOutline,
  type DrawOutlinePoint,
  type DrawOutlineToolState,
  type DrawOutlineTransitionResult,
} from '@/components/drawings/viewports/drawOutlineToolState';

export type DrawOutlineCanvasPoint = {
  alongM: string;
  depthM: string;
  numericAlongM: number;
  numericDepthM: number;
};

export type DrawOutlinePointerSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  startPoint: DrawOutlineCanvasPoint;
  hasPanned: boolean;
};

export type DrawOutlineCommitIntent =
  | {
      kind: 'footprint_edit';
      edit: Extract<EstimateDrawingFootprintEdit, { type: 'custom_polygon' }>;
    }
  | {
      kind: 'custom_polygon_commit';
      polygon: CalculatorHouseFootprintPolygonPoint[];
    };

export type DrawOutlineCloseControllerResult =
  | {
      ok: true;
      transition: DrawOutlineTransitionResult;
      commitIntent: DrawOutlineCommitIntent;
    }
  | {
      ok: false;
      transition: DrawOutlineTransitionResult;
      error?: string;
    };

export function startDrawOutlineController(): DrawOutlineTransitionResult {
  return startDrawOutlineTool();
}

export function cancelDrawOutlineController(): DrawOutlineTransitionResult {
  return cancelDrawOutlineTool();
}

export function finishDrawOutlineCommitController(): DrawOutlineTransitionResult {
  return finishSuccessfulDrawOutlineCommit();
}

export function undoDrawOutlineController(state: DrawOutlineToolState): DrawOutlineTransitionResult {
  return undoDrawOutline(state);
}

export function armDrawOutlineDistanceLockController(state: DrawOutlineToolState): DrawOutlineTransitionResult {
  return armDrawOutlineDistanceLock(state);
}

function formatOutlineMetres(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}

function parseOutlineMetres(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCanvasPointFromOutlinePoint(point: DrawOutlinePoint): DrawOutlineCanvasPoint {
  return {
    alongM: formatOutlineMetres(point.alongM),
    depthM: formatOutlineMetres(point.depthM),
    numericAlongM: point.alongM,
    numericDepthM: point.depthM,
  };
}

export function parseDrawOutlineCanvasPoint(rawPoint: DrawOutlineCanvasPoint): DrawOutlinePoint | null {
  const point = {
    alongM: parseOutlineMetres(rawPoint.alongM),
    depthM: parseOutlineMetres(rawPoint.depthM),
  };
  return Number.isFinite(point.alongM) && Number.isFinite(point.depthM) ? point : null;
}

function constrainOutlinePointToWorldAxes(start: DrawOutlinePoint, point: DrawOutlinePoint): DrawOutlinePoint {
  const deltaAlongM = point.alongM - start.alongM;
  const deltaDepthM = point.depthM - start.depthM;
  return Math.abs(deltaAlongM) >= Math.abs(deltaDepthM)
    ? { alongM: point.alongM, depthM: start.depthM }
    : { alongM: start.alongM, depthM: point.depthM };
}

export function resolveDrawOutlinePreviewCanvasPoint(input: {
  rawPoint: DrawOutlineCanvasPoint;
  state: DrawOutlineToolState;
  shiftKey: boolean;
}): DrawOutlineCanvasPoint | null {
  if (!isDrawOutlineActive(input.state)) {
    return input.rawPoint;
  }

  const parsedPoint = parseDrawOutlineCanvasPoint(input.rawPoint);
  if (!parsedPoint) return null;

  const confirmedPoints = input.state.points;
  if (!confirmedPoints.length) {
    return buildCanvasPointFromOutlinePoint(parsedPoint);
  }

  if (confirmedPoints.length >= 3) {
    const firstPoint = confirmedPoints[0];
    if (firstPoint && distanceBetweenOutlinePoints(firstPoint, parsedPoint) <= CLOSE_START_TOLERANCE_M) {
      return buildCanvasPointFromOutlinePoint(firstPoint);
    }
  }

  const startPoint = confirmedPoints[confirmedPoints.length - 1]!;
  let resolvedPoint = input.shiftKey ? constrainOutlinePointToWorldAxes(startPoint, parsedPoint) : parsedPoint;
  const lockedDistanceM = Number.parseFloat(input.state.lockedDistanceDraft ?? '');

  if (Number.isFinite(lockedDistanceM) && lockedDistanceM >= MIN_OUTLINE_SEGMENT_M) {
    const deltaAlongM = resolvedPoint.alongM - startPoint.alongM;
    const deltaDepthM = resolvedPoint.depthM - startPoint.depthM;
    if (Math.abs(deltaAlongM) <= 1e-9 && Math.abs(deltaDepthM) <= 1e-9) {
      return null;
    }
    if (input.shiftKey) {
      if (Math.abs(deltaAlongM) >= Math.abs(deltaDepthM)) {
        resolvedPoint = {
          alongM: startPoint.alongM + Math.sign(deltaAlongM || 1) * lockedDistanceM,
          depthM: startPoint.depthM,
        };
      } else {
        resolvedPoint = {
          alongM: startPoint.alongM,
          depthM: startPoint.depthM + Math.sign(deltaDepthM || 1) * lockedDistanceM,
        };
      }
    } else {
      const distanceM = Math.hypot(deltaAlongM, deltaDepthM);
      if (distanceM < 1e-9) return null;
      const scale = lockedDistanceM / distanceM;
      resolvedPoint = {
        alongM: startPoint.alongM + deltaAlongM * scale,
        depthM: startPoint.depthM + deltaDepthM * scale,
      };
    }
  }

  return buildCanvasPointFromOutlinePoint(resolvedPoint);
}

export function selectDrawOutlineCanvasPoint(input: {
  state: DrawOutlineToolState;
  rawPoint: DrawOutlineCanvasPoint;
}): {
  transition: DrawOutlineTransitionResult | null;
  landingPoint: DrawOutlineCanvasPoint | null;
} {
  const point = parseDrawOutlineCanvasPoint(input.rawPoint);
  if (!point) return { transition: null, landingPoint: null };
  return {
    transition: selectDrawOutlinePoint(input.state, point),
    landingPoint: input.rawPoint,
  };
}

export function startDrawOutlinePointerSession(input: {
  rawPoint: DrawOutlineCanvasPoint;
  state: DrawOutlineToolState;
  shiftKey: boolean;
  pointerId: number;
  clientX: number;
  clientY: number;
  startPanX: number;
  startPanY: number;
}): {
  session: DrawOutlinePointerSession | null;
  landingPoint: DrawOutlineCanvasPoint | null;
} {
  if (!Number.isFinite(input.rawPoint.numericAlongM) || !Number.isFinite(input.rawPoint.numericDepthM)) {
    return { session: null, landingPoint: null };
  }
  const resolvedPoint = resolveDrawOutlinePreviewCanvasPoint({
    rawPoint: input.rawPoint,
    state: input.state,
    shiftKey: input.shiftKey,
  });
  if (!resolvedPoint) return { session: null, landingPoint: null };
  return {
    landingPoint: resolvedPoint,
    session: {
      pointerId: input.pointerId,
      startClientX: input.clientX,
      startClientY: input.clientY,
      startPanX: input.startPanX,
      startPanY: input.startPanY,
      startPoint: resolvedPoint,
      hasPanned: false,
    },
  };
}

export function hoverDrawOutlineCanvasPoint(input: {
  state: DrawOutlineToolState;
  rawPoint: DrawOutlineCanvasPoint | null;
  shiftKey?: boolean;
}): {
  transition: DrawOutlineTransitionResult;
  landingPoint: DrawOutlineCanvasPoint | null;
} {
  if (!input.rawPoint) {
    return {
      landingPoint: null,
      transition: hoverDrawOutlinePoint(input.state, null),
    };
  }
  const resolvedPoint = resolveDrawOutlinePreviewCanvasPoint({
    rawPoint: input.rawPoint,
    state: input.state,
    shiftKey: input.shiftKey ?? false,
  });
  const point = resolvedPoint ? parseDrawOutlineCanvasPoint(resolvedPoint) : null;
  if (!resolvedPoint || !point) {
    return {
      landingPoint: null,
      transition: hoverDrawOutlinePoint(input.state, null),
    };
  }
  return {
    landingPoint: resolvedPoint,
    transition: hoverDrawOutlinePoint(input.state, point),
  };
}

export function closeDrawOutlineController(input: {
  state: DrawOutlineToolState;
  mode: 'house_footprint' | 'deck_custom_outline';
}): DrawOutlineCloseControllerResult {
  const closeResult = prepareDrawOutlineClose(input.state);
  if (!closeResult.ok) {
    return {
      ok: false,
      transition: { state: closeResult.state, error: closeResult.error },
      error: closeResult.error,
    };
  }

  return {
    ok: true,
    transition: finishSuccessfulDrawOutlineCommit(),
    commitIntent:
      input.mode === 'deck_custom_outline'
        ? {
            kind: 'custom_polygon_commit',
            polygon: closeResult.polygon,
          }
        : {
            kind: 'footprint_edit',
            edit: {
              type: 'custom_polygon',
              polygon: closeResult.polygon,
            },
          },
  };
}
