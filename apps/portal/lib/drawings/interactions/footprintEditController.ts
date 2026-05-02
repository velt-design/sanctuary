import type { AttachmentSide } from '@sp/costing';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';

export type FootprintHandleId =
  | 'bandDepth'
  | 'returnRun'
  | 'recessWidth'
  | 'recessDepth'
  | 'leftLegRun'
  | 'rightLegRun'
  | 'sideRun';

export type FootprintEditIntent =
  | {
      kind: 'footprint_edit';
      edit: EstimateDrawingFootprintEdit;
    }
  | {
      kind: 'custom_polygon_commit';
      polygon: CalculatorHouseFootprintPolygonPoint[];
    }
  | {
      kind: 'start_draw_outline';
    }
  | {
      kind: 'invalid';
      error: string;
    };

export type FootprintDragControllerState = {
  handleId: FootprintHandleId;
  startSvgX: number;
  startSvgY: number;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
  startParams: CalculatorHouseFootprintParams;
};

export type FootprintVertexDragControllerState = {
  vertexIndex: number;
  startSvgX: number;
  startSvgY: number;
  alongAxisX: number;
  alongAxisY: number;
  depthAxisX: number;
  depthAxisY: number;
  scale: number;
  startPolygon: CalculatorHouseFootprintPolygonPoint[];
};

export type FootprintSvgPoint = {
  x: number;
  y: number;
};

function formatFootprintValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function parseFootprintValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapFootprintValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parsePolygonMetres(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPolygonMetres(value: number): string {
  return formatFootprintValue(snapFootprintValue(value));
}

function moveCustomPolygonVertex(input: {
  polygon: CalculatorHouseFootprintPolygonPoint[];
  vertexIndex: number;
  nextAlongM: number;
  nextDepthM: number;
}): CalculatorHouseFootprintPolygonPoint[] {
  const points = input.polygon.map((point) => ({
    alongM: parsePolygonMetres(point.alongM),
    depthM: parsePolygonMetres(point.depthM),
  }));
  if (points.length < 3 || input.vertexIndex < 0 || input.vertexIndex >= points.length) {
    return input.polygon;
  }
  points[input.vertexIndex] = {
    alongM: input.nextAlongM,
    depthM: input.nextDepthM,
  };

  return points.map((point) => ({
    alongM: formatPolygonMetres(point.alongM),
    depthM: formatPolygonMetres(point.depthM),
  }));
}

export function buildFootprintPresetIntent(
  preset: NonNullable<Extract<EstimateDrawingFootprintEdit, { type: 'preset' }>['preset']>,
): FootprintEditIntent {
  return {
    kind: 'footprint_edit',
    edit: { type: 'preset', preset },
  };
}

export function buildFootprintModeIntent(
  mode: NonNullable<Extract<EstimateDrawingFootprintEdit, { type: 'mode' }>['mode']>,
): FootprintEditIntent {
  return mode === 'custom_polygon'
    ? { kind: 'start_draw_outline' }
    : {
        kind: 'footprint_edit',
        edit: { type: 'mode', mode },
      };
}

export function buildFootprintRotateIntent(delta: -1 | 1): FootprintEditIntent {
  return {
    kind: 'footprint_edit',
    edit: { type: 'rotate', delta },
  };
}

export function buildFootprintAttachmentSideIntent(side: AttachmentSide): FootprintEditIntent {
  return {
    kind: 'footprint_edit',
    edit: { type: 'attachment_side', side },
  };
}

export function resolveFootprintHandleDragIntent(input: {
  session: FootprintDragControllerState;
  nextSvgPoint: FootprintSvgPoint;
}): FootprintEditIntent {
  const deltaSvgX = input.nextSvgPoint.x - input.session.startSvgX;
  const deltaSvgY = input.nextSvgPoint.y - input.session.startSvgY;
  const deltaUnits = deltaSvgX * input.session.axisX + deltaSvgY * input.session.axisY;
  const deltaM = (deltaUnits / Math.max(input.session.scale, 0.001)) * input.session.deltaMultiplier;
  const minValueM = input.session.minValueM;
  const maxValueM = Math.max(minValueM, input.session.maxValueM);
  const startParams = input.session.startParams;

  let key: keyof CalculatorHouseFootprintParams = 'bandDepthM';
  let nextValue = parseFootprintValue(startParams.bandDepthM, 1.8) + deltaM;

  switch (input.session.handleId) {
    case 'returnRun':
      key = 'returnRunM';
      nextValue = parseFootprintValue(startParams.returnRunM, 2.4) + deltaM;
      break;
    case 'recessWidth':
      key = 'recessWidthM';
      nextValue = parseFootprintValue(startParams.recessWidthM, 2.4) + deltaM;
      break;
    case 'recessDepth':
      key = 'recessDepthM';
      nextValue = parseFootprintValue(startParams.recessDepthM, 1.2) + deltaM;
      break;
    case 'leftLegRun':
      key = 'leftLegRunM';
      nextValue = parseFootprintValue(startParams.leftLegRunM, 2.4) + deltaM;
      break;
    case 'rightLegRun':
      key = 'rightLegRunM';
      nextValue = parseFootprintValue(startParams.rightLegRunM, 2.4) + deltaM;
      break;
    case 'sideRun':
      key = 'sideRunM';
      nextValue = parseFootprintValue(startParams.sideRunM, 2.4) + deltaM;
      break;
    case 'bandDepth':
    default:
      key = 'bandDepthM';
      nextValue = parseFootprintValue(startParams.bandDepthM, 1.8) + deltaM;
      break;
  }

  return {
    kind: 'footprint_edit',
    edit: {
      type: 'param',
      key,
      value: formatFootprintValue(snapFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM))),
    },
  };
}

export function resolveFootprintVertexDragIntent(input: {
  session: FootprintVertexDragControllerState;
  nextSvgPoint: FootprintSvgPoint;
}): FootprintEditIntent {
  const deltaSvgX = input.nextSvgPoint.x - input.session.startSvgX;
  const deltaSvgY = input.nextSvgPoint.y - input.session.startSvgY;
  const deltaAlongM =
    (deltaSvgX * input.session.alongAxisX + deltaSvgY * input.session.alongAxisY) /
    Math.max(input.session.scale, 0.001);
  const deltaDepthM =
    (deltaSvgX * input.session.depthAxisX + deltaSvgY * input.session.depthAxisY) /
    Math.max(input.session.scale, 0.001);
  const startPoint = input.session.startPolygon[input.session.vertexIndex];
  if (!startPoint) return { kind: 'invalid', error: 'Footprint vertex metadata is unavailable.' };

  return {
    kind: 'footprint_edit',
    edit: {
      type: 'polygon',
      polygon: moveCustomPolygonVertex({
        polygon: input.session.startPolygon,
        vertexIndex: input.session.vertexIndex,
        nextAlongM: snapFootprintValue(parsePolygonMetres(startPoint.alongM) + deltaAlongM),
        nextDepthM: snapFootprintValue(parsePolygonMetres(startPoint.depthM) + deltaDepthM),
      }),
    },
  };
}

export function resolveFootprintEdgeAddIntent(input: {
  polygon: CalculatorHouseFootprintPolygonPoint[];
  edgeIndex: number;
}): FootprintEditIntent {
  if (input.polygon.length < 3) return { kind: 'invalid', error: 'Footprint polygon metadata is unavailable.' };
  const start = input.polygon[input.edgeIndex];
  const end = input.polygon[(input.edgeIndex + 1) % input.polygon.length];
  if (!start || !end) return { kind: 'invalid', error: 'Footprint edge metadata is unavailable.' };

  const next = [...input.polygon];
  next.splice(input.edgeIndex + 1, 0, {
    alongM: formatPolygonMetres((parsePolygonMetres(start.alongM) + parsePolygonMetres(end.alongM)) / 2),
    depthM: formatPolygonMetres((parsePolygonMetres(start.depthM) + parsePolygonMetres(end.depthM)) / 2),
  });

  return {
    kind: 'footprint_edit',
    edit: { type: 'polygon', polygon: next },
  };
}

export function resolveFootprintVertexDeleteIntent(input: {
  polygon: CalculatorHouseFootprintPolygonPoint[];
  vertexIndex: number;
}): FootprintEditIntent {
  if (input.polygon.length <= 3 || input.vertexIndex < 0 || input.vertexIndex >= input.polygon.length) {
    return { kind: 'invalid', error: 'Footprint vertex cannot be deleted.' };
  }
  return {
    kind: 'footprint_edit',
    edit: {
      type: 'polygon',
      polygon: input.polygon.filter((_, index) => index !== input.vertexIndex),
    },
  };
}
