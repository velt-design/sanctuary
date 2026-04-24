import {
  buildCustomHouseFootprintPolygon,
  buildHouseFootprintPresetSideLocalPoints,
} from '@sp/geometry';
import type {
  HouseModel,
  WorkbenchHouseSelection,
  WallOpeningHostSide,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  buildDeckReferenceHousePolygon,
  resolveDeckHostEdgeFrame,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import {
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;
export type HouseFirstPlanHousePolygonSource = 'custom_saved' | 'preset_derived';

export type HouseFirstPlanDeckInteraction = {
  kind: 'attached_preset_rect';
  hostEdgeId: AttachmentSide;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  deckWidthM: number;
  centerOffsetM: number;
  minCenterOffsetM: number;
  maxCenterOffsetM: number;
};

export type PlanPoint = {
  x: number;
  y: number;
};

export type HouseFirstPlanShapeOverlay = {
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  polygon: PlanPoint[];
  selected: boolean;
  custom: boolean;
  muted: boolean;
  invalid: boolean;
  invalidMessage: string | null;
  deckInteraction: HouseFirstPlanDeckInteraction | null;
  deckDragEligibility:
    | {
        eligible: boolean;
        reason: string;
      }
    | null;
};

export type HouseFirstPlanPresetDimensionAnnotation = {
  id: string;
  targetKind: 'house_preset_param' | 'deck_preset_param' | 'deck_host_edge_reference' | 'opening_param';
  emphasis: 'driving' | 'relationship';
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  fieldKey: string;
  rawValue: string;
  displayValue: string;
  witnessStart: PlanPoint;
  witnessEnd: PlanPoint;
  lineStart: PlanPoint;
  lineEnd: PlanPoint;
  deckInteraction: HouseFirstPlanDeckInteraction | null;
};

export type HouseFirstPlanCustomEdgeCandidate = {
  id: string;
  targetKind: 'house_custom_edge' | 'deck_custom_edge';
  ownerKind: 'footprint' | 'deck';
  ownerId: string;
  edgeIndex: number;
  rawValue: string;
  displayValue: string;
  localPolygon: CalculatorHouseFootprintPolygonPoint[];
  witnessStart: PlanPoint;
  witnessEnd: PlanPoint;
  lineStart: PlanPoint;
  lineEnd: PlanPoint;
};

export type HouseFirstPlanOverlay = {
  housePolygonSource: HouseFirstPlanHousePolygonSource;
  shapes: HouseFirstPlanShapeOverlay[];
  presetAnnotations: HouseFirstPlanPresetDimensionAnnotation[];
  customEdgeCandidates: HouseFirstPlanCustomEdgeCandidate[];
};

type LocalPoint = {
  alongM: number;
  depthM: number;
};

type ResolvedFootprintParams = {
  widthM: number;
  offsetXM: number;
  setbackM: number;
  bandDepthM: number;
  returnRunM: number;
  recessWidthM: number;
  recessDepthM: number;
  leftLegRunM: number;
  rightLegRunM: number;
  sideRunM: number;
};

const DEFAULT_MODULE_LENGTH_M = 6;
const DEFAULT_MODULE_PROJECTION_M = 3;
const EDGE_LABEL_OFFSET_M = 0.9;
const EDGE_NORMAL_PROBE_M = 0.12;
const ZERO_DIMENSION_EPSILON_M = 1e-6;
const OPENING_PLAN_THICKNESS_M = 0.12;

function roundMetres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatRawMetres(value: number): string {
  return String(roundMetres(value));
}

function formatDisplayMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

function parseMetres(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseLocalPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined,
): LocalPoint[] {
  return normalizeHouseFootprintPolygon(polygon)
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

function attachmentFrame(input: {
  attachmentSide: AttachmentSide;
  moduleLengthM: number;
  moduleProjectionM: number;
}) {
  return {
    attachmentSide: input.attachmentSide,
    pergolaWidthM: Math.max(0.5, input.moduleLengthM),
    pergolaDepthM: Math.max(0.5, input.moduleProjectionM),
    alongWidthM:
      input.attachmentSide === 'left' || input.attachmentSide === 'right'
        ? Math.max(0.5, input.moduleProjectionM)
        : Math.max(0.5, input.moduleLengthM),
    perpendicularDepthM:
      input.attachmentSide === 'left' || input.attachmentSide === 'right'
        ? Math.max(0.5, input.moduleLengthM)
        : Math.max(0.5, input.moduleProjectionM),
  };
}

function resolveFootprintParams(input: {
  params: CalculatorHouseFootprintParams;
  attachmentSide: AttachmentSide;
  moduleLengthM: number;
  moduleProjectionM: number;
}): ResolvedFootprintParams {
  const frame = attachmentFrame(input);
  const params = normalizeHouseFootprintParams(input.params);
  const widthM = clamp(parseMetres(params.widthM, frame.alongWidthM), 0.5, 30);
  const offsetXM = parseMetres(params.offsetXM, 0);
  const setbackM = Math.max(0, parseMetres(params.setbackM, 0));
  const bandDepthM = clamp(parseMetres(params.bandDepthM, 1.8), 0.5, 12);
  const returnRunM = clamp(parseMetres(params.returnRunM, 2.4), 0.5, frame.perpendicularDepthM);
  const recessWidthM = clamp(parseMetres(params.recessWidthM, 2.4), 0.5, Math.max(0.5, widthM - 0.5));
  const recessDepthM = clamp(parseMetres(params.recessDepthM, 1.2), 0.3, bandDepthM);
  const leftLegRunM = clamp(parseMetres(params.leftLegRunM, 2.4), 0.5, frame.perpendicularDepthM);
  const rightLegRunM = clamp(parseMetres(params.rightLegRunM, 2.4), 0.5, frame.perpendicularDepthM);
  const sideRunM = clamp(parseMetres(params.sideRunM, 2.4), 0.5, widthM);

  return {
    widthM,
    offsetXM,
    setbackM,
    bandDepthM,
    returnRunM,
    recessWidthM,
    recessDepthM,
    leftLegRunM,
    rightLegRunM,
    sideRunM,
  };
}

function localPointToPlanWorld(input: {
  point: LocalPoint;
  attachmentSide: AttachmentSide;
  offsetXM: number;
  setbackM: number;
  moduleLengthM: number;
  moduleProjectionM: number;
}): PlanPoint {
  const along = input.point.alongM + input.offsetXM;
  const depth = input.point.depthM;

  if (input.attachmentSide === 'front') {
    return {
      x: along,
      y: input.moduleProjectionM + input.setbackM + depth,
    };
  }

  if (input.attachmentSide === 'left') {
    return {
      x: -input.setbackM - depth,
      y: along,
    };
  }

  if (input.attachmentSide === 'right') {
    return {
      x: input.moduleLengthM + input.setbackM + depth,
      y: along,
    };
  }

  return {
    x: along,
    y: -input.setbackM - depth,
  };
}

function midpoint(start: PlanPoint, end: PlanPoint): PlanPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function pointInPolygon(point: PlanPoint, polygon: PlanPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          Math.max(previousPoint.y - currentPoint.y, Number.EPSILON) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function createOffsetDimensionGeometry(input: {
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: PlanPoint[];
  offsetM?: number;
}) {
  const dx = input.segmentEnd.x - input.segmentStart.x;
  const dy = input.segmentEnd.y - input.segmentStart.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;

  const normalA = { x: -dy / length, y: dx / length };
  const normalB = { x: -normalA.x, y: -normalA.y };
  const edgeMidpoint = midpoint(input.segmentStart, input.segmentEnd);
  const probeA = {
    x: edgeMidpoint.x + normalA.x * EDGE_NORMAL_PROBE_M,
    y: edgeMidpoint.y + normalA.y * EDGE_NORMAL_PROBE_M,
  };
  const probeB = {
    x: edgeMidpoint.x + normalB.x * EDGE_NORMAL_PROBE_M,
    y: edgeMidpoint.y + normalB.y * EDGE_NORMAL_PROBE_M,
  };
  const outward =
    pointInPolygon(probeA, input.polygon) && !pointInPolygon(probeB, input.polygon)
      ? normalB
      : !pointInPolygon(probeA, input.polygon) && pointInPolygon(probeB, input.polygon)
        ? normalA
        : normalA;
  const offset = input.offsetM ?? EDGE_LABEL_OFFSET_M;

  return {
    witnessStart: input.segmentStart,
    witnessEnd: input.segmentEnd,
    lineStart: {
      x: input.segmentStart.x + outward.x * offset,
      y: input.segmentStart.y + outward.y * offset,
    },
    lineEnd: {
      x: input.segmentEnd.x + outward.x * offset,
      y: input.segmentEnd.y + outward.y * offset,
    },
  };
}

function resolveCanonicalHouseLocalPolygon(input: {
  house: HouseModel;
  moduleLengthM: number;
  moduleProjectionM: number;
}): {
  localPolygon: LocalPoint[];
  housePolygonSource: HouseFirstPlanHousePolygonSource;
} {
  if (input.house.footprint.mode === 'custom_polygon') {
    return {
      localPolygon: parseLocalPolygon(input.house.footprint.polygon),
      housePolygonSource: 'custom_saved',
    };
  }
  return {
    localPolygon: buildHouseFootprintPresetSideLocalPoints({
      pergolaWidthMm: Math.round(input.moduleLengthM * 1000),
      pergolaDepthMm: Math.round(input.moduleProjectionM * 1000),
      preset: input.house.footprint.preset,
      params: input.house.footprint.params,
      attachmentSide: input.house.footprint.attachmentSide,
    }).map((point) => ({
      alongM: point.alongM,
      depthM: point.depthM,
    })),
    housePolygonSource: 'preset_derived',
  };
}

function buildWorldPolygon(input: {
  localPolygon: LocalPoint[];
  attachmentSide: AttachmentSide;
  moduleLengthM: number;
  moduleProjectionM: number;
  offsetXM: number;
  setbackM: number;
}): PlanPoint[] {
  return input.localPolygon.map((point) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.attachmentSide,
      offsetXM: input.offsetXM,
      setbackM: input.setbackM,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    }),
  );
}

function buildDeckWorldPolygon(input: {
  localPolygon: LocalPoint[];
  attachmentSide: AttachmentSide;
  moduleLengthM: number;
  moduleProjectionM: number;
}): PlanPoint[] {
  return buildWorldPolygon({
    localPolygon: input.localPolygon,
    attachmentSide: input.attachmentSide,
    moduleLengthM: input.moduleLengthM,
    moduleProjectionM: input.moduleProjectionM,
    // Deck outlines are already authored in the house side-local frame.
    // Unlike the house footprint, they do not apply footprint offset/setback.
    offsetXM: 0,
    setbackM: 0,
  });
}

function buildOpeningLocalPolygon(input: {
  wallFrame: ReturnType<typeof resolveDeckHostEdgeFrame>;
  widthM: number;
  offsetAlongWallM: number;
}): LocalPoint[] {
  if (!input.wallFrame) return [];
  const start = input.wallFrame.start + input.offsetAlongWallM;
  const end = start + input.widthM;
  const inwardThicknessM = OPENING_PLAN_THICKNESS_M * -input.wallFrame.outwardDirection;
  if (input.wallFrame.axis === 'along') {
    return [
      { alongM: start, depthM: input.wallFrame.edgeCoordinate },
      { alongM: end, depthM: input.wallFrame.edgeCoordinate },
      { alongM: end, depthM: input.wallFrame.edgeCoordinate + inwardThicknessM },
      { alongM: start, depthM: input.wallFrame.edgeCoordinate + inwardThicknessM },
    ];
  }
  return [
    { alongM: input.wallFrame.edgeCoordinate, depthM: start },
    { alongM: input.wallFrame.edgeCoordinate, depthM: end },
    { alongM: input.wallFrame.edgeCoordinate + inwardThicknessM, depthM: end },
    { alongM: input.wallFrame.edgeCoordinate + inwardThicknessM, depthM: start },
  ];
}

function buildOpeningPresetAnnotations(input: {
  house: HouseModel;
  opening: HouseModel['openings'][number];
  openingPolygon: PlanPoint[];
  wallFrame: ReturnType<typeof resolveDeckHostEdgeFrame>;
  moduleLengthM: number;
  moduleProjectionM: number;
  offsetXM: number;
  setbackM: number;
}): HouseFirstPlanPresetDimensionAnnotation[] {
  if (!input.wallFrame) return [];
  const widthM = Number(input.opening.widthM);
  const offsetAlongWallM = Number(input.opening.offsetAlongWallM);
  if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) return [];

  const localStart =
    input.wallFrame.axis === 'along'
      ? {
          alongM: input.wallFrame.start + offsetAlongWallM,
          depthM: input.wallFrame.edgeCoordinate,
        }
      : {
          alongM: input.wallFrame.edgeCoordinate,
          depthM: input.wallFrame.start + offsetAlongWallM,
        };
  const localEnd =
    input.wallFrame.axis === 'along'
      ? {
          alongM: localStart.alongM + widthM,
          depthM: input.wallFrame.edgeCoordinate,
        }
      : {
          alongM: input.wallFrame.edgeCoordinate,
          depthM: localStart.depthM + widthM,
        };
  const wallStart =
    input.wallFrame.axis === 'along'
      ? { alongM: input.wallFrame.start, depthM: input.wallFrame.edgeCoordinate }
      : { alongM: input.wallFrame.edgeCoordinate, depthM: input.wallFrame.start };
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.house.footprint.attachmentSide,
      offsetXM: input.offsetXM,
      setbackM: input.setbackM,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });

  return [
    makeAnnotation({
      id: `${input.opening.id}:widthM`,
      targetKind: 'opening_param',
      emphasis: 'driving',
      ownerKind: 'opening',
      ownerId: input.opening.id,
      fieldKey: 'widthM',
      rawValue: input.opening.widthM,
      displayValue: formatDisplayMetres(widthM),
      segmentStart: toWorld(localStart),
      segmentEnd: toWorld(localEnd),
      polygon: input.openingPolygon,
    }),
    makeAnnotation({
      id: `${input.opening.id}:offsetAlongWallM`,
      targetKind: 'opening_param',
      emphasis: 'driving',
      ownerKind: 'opening',
      ownerId: input.opening.id,
      fieldKey: 'offsetAlongWallM',
      rawValue: input.opening.offsetAlongWallM,
      displayValue: formatDisplayMetres(offsetAlongWallM),
      segmentStart: toWorld(wallStart),
      segmentEnd: toWorld(localStart),
      polygon: input.openingPolygon,
    }),
  ].filter((annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation));
}

function makeAnnotation(input: {
  id: string;
  targetKind: 'house_preset_param' | 'deck_preset_param' | 'deck_host_edge_reference' | 'opening_param';
  emphasis?: 'driving' | 'relationship';
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  fieldKey: string;
  rawValue: string;
  displayValue: string;
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: PlanPoint[];
  deckInteraction?: HouseFirstPlanDeckInteraction | null;
}): HouseFirstPlanPresetDimensionAnnotation | null {
  const geometry = createOffsetDimensionGeometry({
    segmentStart: input.segmentStart,
    segmentEnd: input.segmentEnd,
    polygon: input.polygon,
  });
  if (!geometry) return null;
  return {
    id: input.id,
    targetKind: input.targetKind,
    emphasis:
      input.emphasis ??
      (input.targetKind === 'deck_host_edge_reference' ? 'relationship' : 'driving'),
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    fieldKey: input.fieldKey,
    rawValue: input.rawValue,
    displayValue: input.displayValue,
    ...geometry,
    deckInteraction: input.deckInteraction ?? null,
  };
}

function makeCustomEdgeCandidate(input: {
  id: string;
  targetKind: 'house_custom_edge' | 'deck_custom_edge';
  ownerKind: 'footprint' | 'deck';
  ownerId: string;
  edgeIndex: number;
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: PlanPoint[];
  lengthM: number;
  localPolygon: CalculatorHouseFootprintPolygonPoint[];
}): HouseFirstPlanCustomEdgeCandidate | null {
  const geometry = createOffsetDimensionGeometry({
    segmentStart: input.segmentStart,
    segmentEnd: input.segmentEnd,
    polygon: input.polygon,
  });
  if (!geometry) return null;
  return {
    id: input.id,
    targetKind: input.targetKind,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    edgeIndex: input.edgeIndex,
    rawValue: formatRawMetres(input.lengthM),
    displayValue: formatDisplayMetres(input.lengthM),
    localPolygon: input.localPolygon,
    ...geometry,
  };
}

function buildHousePresetAnnotations(input: {
  house: HouseModel;
  housePolygon: PlanPoint[];
  moduleLengthM: number;
  moduleProjectionM: number;
}): HouseFirstPlanPresetDimensionAnnotation[] {
  const attachmentSide = input.house.footprint.attachmentSide;
  const resolved = resolveFootprintParams({
    params: input.house.footprint.params,
    attachmentSide,
    moduleLengthM: input.moduleLengthM,
    moduleProjectionM: input.moduleProjectionM,
  });
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide,
      offsetXM: resolved.offsetXM,
      setbackM: resolved.setbackM,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });
  const annotations: Array<HouseFirstPlanPresetDimensionAnnotation | null> = [
    makeAnnotation({
      id: `${input.house.id}:widthM`,
      targetKind: 'house_preset_param',
      ownerKind: 'footprint',
      ownerId: input.house.id,
      fieldKey: 'widthM',
      rawValue: formatRawMetres(resolved.widthM),
      displayValue: formatDisplayMetres(resolved.widthM),
      segmentStart: toWorld({ alongM: 0, depthM: 0 }),
      segmentEnd: toWorld({ alongM: resolved.widthM, depthM: 0 }),
      polygon: input.housePolygon,
    }),
    makeAnnotation({
      id: `${input.house.id}:bandDepthM`,
      targetKind: 'house_preset_param',
      ownerKind: 'footprint',
      ownerId: input.house.id,
      fieldKey: 'bandDepthM',
      rawValue: formatRawMetres(resolved.bandDepthM),
      displayValue: formatDisplayMetres(resolved.bandDepthM),
      segmentStart: toWorld({ alongM: 0, depthM: 0 }),
      segmentEnd: toWorld({ alongM: 0, depthM: resolved.bandDepthM }),
      polygon: input.housePolygon,
    }),
  ];

  if (input.house.footprint.preset === 'l_left') {
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:returnRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'returnRunM',
        rawValue: formatRawMetres(resolved.returnRunM),
        displayValue: formatDisplayMetres(resolved.returnRunM),
        segmentStart: toWorld({ alongM: 0, depthM: 0 }),
        segmentEnd: toWorld({ alongM: 0, depthM: -resolved.returnRunM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'l_right') {
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:returnRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'returnRunM',
        rawValue: formatRawMetres(resolved.returnRunM),
        displayValue: formatDisplayMetres(resolved.returnRunM),
        segmentStart: toWorld({ alongM: resolved.widthM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.widthM, depthM: -resolved.returnRunM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'recess_left') {
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:recessWidthM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'recessWidthM',
        rawValue: formatRawMetres(resolved.recessWidthM),
        displayValue: formatDisplayMetres(resolved.recessWidthM),
        segmentStart: toWorld({ alongM: 0, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.recessWidthM, depthM: 0 }),
        polygon: input.housePolygon,
      }),
      makeAnnotation({
        id: `${input.house.id}:recessDepthM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'recessDepthM',
        rawValue: formatRawMetres(resolved.recessDepthM),
        displayValue: formatDisplayMetres(resolved.recessDepthM),
        segmentStart: toWorld({ alongM: resolved.recessWidthM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.recessWidthM, depthM: resolved.recessDepthM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'recess_right') {
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:recessWidthM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'recessWidthM',
        rawValue: formatRawMetres(resolved.recessWidthM),
        displayValue: formatDisplayMetres(resolved.recessWidthM),
        segmentStart: toWorld({ alongM: resolved.widthM - resolved.recessWidthM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.widthM, depthM: 0 }),
        polygon: input.housePolygon,
      }),
      makeAnnotation({
        id: `${input.house.id}:recessDepthM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'recessDepthM',
        rawValue: formatRawMetres(resolved.recessDepthM),
        displayValue: formatDisplayMetres(resolved.recessDepthM),
        segmentStart: toWorld({ alongM: resolved.widthM - resolved.recessWidthM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.widthM - resolved.recessWidthM, depthM: resolved.recessDepthM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'u_shape') {
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:leftLegRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'leftLegRunM',
        rawValue: formatRawMetres(resolved.leftLegRunM),
        displayValue: formatDisplayMetres(resolved.leftLegRunM),
        segmentStart: toWorld({ alongM: 0, depthM: 0 }),
        segmentEnd: toWorld({ alongM: 0, depthM: -resolved.leftLegRunM }),
        polygon: input.housePolygon,
      }),
      makeAnnotation({
        id: `${input.house.id}:rightLegRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'rightLegRunM',
        rawValue: formatRawMetres(resolved.rightLegRunM),
        displayValue: formatDisplayMetres(resolved.rightLegRunM),
        segmentStart: toWorld({ alongM: resolved.widthM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: resolved.widthM, depthM: -resolved.rightLegRunM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'wrap_left') {
    const depthM = attachmentFrame({
      attachmentSide,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    }).perpendicularDepthM;
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:sideRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'sideRunM',
        rawValue: formatRawMetres(resolved.sideRunM),
        displayValue: formatDisplayMetres(resolved.sideRunM),
        segmentStart: toWorld({ alongM: 0, depthM: -depthM }),
        segmentEnd: toWorld({ alongM: resolved.sideRunM, depthM: -depthM }),
        polygon: input.housePolygon,
      }),
    );
  } else if (input.house.footprint.preset === 'wrap_right') {
    const depthM = attachmentFrame({
      attachmentSide,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    }).perpendicularDepthM;
    annotations.push(
      makeAnnotation({
        id: `${input.house.id}:sideRunM`,
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: input.house.id,
        fieldKey: 'sideRunM',
        rawValue: formatRawMetres(resolved.sideRunM),
        displayValue: formatDisplayMetres(resolved.sideRunM),
        segmentStart: toWorld({ alongM: resolved.widthM - resolved.sideRunM, depthM: -depthM }),
        segmentEnd: toWorld({ alongM: resolved.widthM, depthM: -depthM }),
        polygon: input.housePolygon,
      }),
    );
  }

  return annotations.filter((annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation));
}

function buildDeckPresetAnnotations(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  deck: HouseModel['decks'][number];
  deckPolygon: PlanPoint[];
  moduleLengthM: number;
  moduleProjectionM: number;
  deckInteraction: HouseFirstPlanDeckInteraction | null;
}): HouseFirstPlanPresetDimensionAnnotation[] {
  const presetRect = input.deck.presetRect;
  if (!presetRect) return [];

  const attachmentSide = input.house.footprint.attachmentSide;
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide,
      offsetXM: 0,
      setbackM: 0,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });

  const localOutline = parseLocalPolygon(input.deck.outline);
  if (localOutline.length < 4) return [];
  const [first, second, third] = localOutline;
  if (!first || !second || !third) return [];
  const widthStart = toWorld(first);
  const widthEnd = toWorld(second);
  const depthEnd = toWorld(third);

  const drivingAnnotations: Array<HouseFirstPlanPresetDimensionAnnotation | null> = [
    makeAnnotation({
      id: `${input.deck.id}:widthM`,
      targetKind: 'deck_preset_param',
      emphasis: 'driving',
      ownerKind: 'deck',
      ownerId: input.deck.id,
      fieldKey: 'widthM',
      rawValue: presetRect.widthM,
      displayValue: formatDisplayMetres(Number(presetRect.widthM)),
      segmentStart: widthStart,
      segmentEnd: widthEnd,
      polygon: input.deckPolygon,
      deckInteraction: input.deckInteraction,
    }),
    makeAnnotation({
      id: `${input.deck.id}:depthM`,
      targetKind: 'deck_preset_param',
      emphasis: 'driving',
      ownerKind: 'deck',
      ownerId: input.deck.id,
      fieldKey: 'depthM',
      rawValue: presetRect.depthM,
      displayValue: formatDisplayMetres(Number(presetRect.depthM)),
      segmentStart: widthEnd,
      segmentEnd: depthEnd,
      polygon: input.deckPolygon,
      deckInteraction: input.deckInteraction,
    }),
  ];

  const relationshipAnnotations: Array<HouseFirstPlanPresetDimensionAnnotation | null> = [];

  const centerOffsetM = Number(presetRect.centerOffsetM);
  if (Math.abs(centerOffsetM) > ZERO_DIMENSION_EPSILON_M) {
    const frame = attachmentFrame({
      attachmentSide,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });
    const midpointAlongM = frame.alongWidthM / 2;
    drivingAnnotations.push(
      makeAnnotation({
        id: `${input.deck.id}:centerOffsetM`,
        targetKind: 'deck_preset_param',
        emphasis: 'driving',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'centerOffsetM',
        rawValue: presetRect.centerOffsetM,
        displayValue: formatDisplayMetres(centerOffsetM),
        segmentStart: toWorld({ alongM: midpointAlongM, depthM: 0 }),
        segmentEnd: toWorld({ alongM: midpointAlongM + centerOffsetM, depthM: 0 }),
        polygon: input.deckPolygon,
        deckInteraction: input.deckInteraction,
      }),
    );
  }

  if (input.deckInteraction) {
    const referenceFrame = resolveDeckHostEdgeFrame({
      housePolygon: buildDeckReferenceHousePolygon({
        housePolygon: input.houseLocalPolygon.map((point) => ({
          alongM: formatRawMetres(point.alongM),
          depthM: formatRawMetres(point.depthM),
        })),
        footprintParams: input.house.footprint.params,
      }),
      hostEdgeId: input.deckInteraction.hostEdgeId,
    });
    const localAxisValues = parseLocalPolygon(input.deck.outline).map((point) =>
      referenceFrame?.axis === 'along' ? point.alongM : point.depthM,
    );
    const deckAxisStart = localAxisValues.length ? Math.min(...localAxisValues) : null;
    const deckAxisEnd = localAxisValues.length ? Math.max(...localAxisValues) : null;
    const hostEdgeStartLocal =
      referenceFrame?.axis === 'along'
        ? { alongM: referenceFrame.start, depthM: referenceFrame.edgeCoordinate }
        : referenceFrame
          ? { alongM: referenceFrame.edgeCoordinate, depthM: referenceFrame.start }
          : null;
    const hostEdgeEndLocal =
      referenceFrame?.axis === 'along'
        ? { alongM: referenceFrame.end, depthM: referenceFrame.edgeCoordinate }
        : referenceFrame
          ? { alongM: referenceFrame.edgeCoordinate, depthM: referenceFrame.end }
          : null;
    const deckStartLocal =
      referenceFrame && deckAxisStart !== null
        ? referenceFrame.axis === 'along'
          ? { alongM: deckAxisStart, depthM: referenceFrame.edgeCoordinate }
          : { alongM: referenceFrame.edgeCoordinate, depthM: deckAxisStart }
        : null;
    const deckEndLocal =
      referenceFrame && deckAxisEnd !== null
        ? referenceFrame.axis === 'along'
          ? { alongM: deckAxisEnd, depthM: referenceFrame.edgeCoordinate }
          : { alongM: referenceFrame.edgeCoordinate, depthM: deckAxisEnd }
        : null;

    if (hostEdgeStartLocal && deckStartLocal && hostEdgeEndLocal && deckEndLocal) {
      const hostStartGapM = Math.max(0, deckAxisStart! - referenceFrame.start);
      const hostEndGapM = Math.max(0, referenceFrame.end - deckAxisEnd!);
      const minimumVisibleGapM = 0.001;
      const visibleDeckStartLocal =
        hostStartGapM <= ZERO_DIMENSION_EPSILON_M
          ? referenceFrame.axis === 'along'
            ? { alongM: deckAxisStart! + minimumVisibleGapM, depthM: referenceFrame.edgeCoordinate }
            : { alongM: referenceFrame.edgeCoordinate, depthM: deckAxisStart! + minimumVisibleGapM }
          : deckStartLocal;
      const visibleDeckEndLocal =
        hostEndGapM <= ZERO_DIMENSION_EPSILON_M
          ? referenceFrame.axis === 'along'
            ? { alongM: deckAxisEnd! - minimumVisibleGapM, depthM: referenceFrame.edgeCoordinate }
            : { alongM: referenceFrame.edgeCoordinate, depthM: deckAxisEnd! - minimumVisibleGapM }
          : deckEndLocal;
      relationshipAnnotations.push(
        makeAnnotation({
          id: `${input.deck.id}:hostStartGapM`,
          targetKind: 'deck_host_edge_reference',
          emphasis: 'relationship',
          ownerKind: 'deck',
          ownerId: input.deck.id,
          fieldKey: 'hostStartGapM',
          rawValue: formatRawMetres(hostStartGapM),
          displayValue: formatDisplayMetres(hostStartGapM),
          segmentStart: toWorld(hostEdgeStartLocal),
          segmentEnd: toWorld(visibleDeckStartLocal),
          polygon: input.deckPolygon,
          deckInteraction: input.deckInteraction,
        }),
        makeAnnotation({
          id: `${input.deck.id}:hostEndGapM`,
          targetKind: 'deck_host_edge_reference',
          emphasis: 'relationship',
          ownerKind: 'deck',
          ownerId: input.deck.id,
          fieldKey: 'hostEndGapM',
          rawValue: formatRawMetres(hostEndGapM),
          displayValue: formatDisplayMetres(hostEndGapM),
          segmentStart: toWorld(visibleDeckEndLocal),
          segmentEnd: toWorld(hostEdgeEndLocal),
          polygon: input.deckPolygon,
          deckInteraction: input.deckInteraction,
        }),
      );
    }
  }

  if (!input.deck.isAttached && presetRect.detachedGapM) {
    const nearestHousePoint = toWorld({ alongM: first.alongM, depthM: 0 });
    relationshipAnnotations.push(
      makeAnnotation({
        id: `${input.deck.id}:detachedGapM`,
        targetKind: 'deck_preset_param',
        emphasis: 'relationship',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'detachedGapM',
        rawValue: presetRect.detachedGapM,
        displayValue: formatDisplayMetres(Number(presetRect.detachedGapM)),
        segmentStart: nearestHousePoint,
        segmentEnd: widthStart,
        polygon: input.deckPolygon,
        deckInteraction: input.deckInteraction,
      }),
    );
  }

  return [...drivingAnnotations, ...relationshipAnnotations].filter(
    (annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation),
  );
}

function buildAttachedDeckInteraction(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  deck: HouseModel['decks'][number];
  moduleLengthM: number;
  moduleProjectionM: number;
}): HouseFirstPlanDeckInteraction | null {
  if (
    input.deck.shape !== 'preset' ||
    !input.deck.isAttached ||
    input.deck.presetType !== 'rect_attached' ||
    !input.deck.presetRect
  ) {
    return null;
  }

  const hostEdgeId = input.deck.hostEdgeId;
  if (
    hostEdgeId !== 'rear' &&
    hostEdgeId !== 'front' &&
    hostEdgeId !== 'left' &&
    hostEdgeId !== 'right'
  ) {
    return null;
  }

  const referenceHousePolygon = buildDeckReferenceHousePolygon({
    housePolygon: input.houseLocalPolygon.map((point) => ({
      alongM: formatRawMetres(point.alongM),
      depthM: formatRawMetres(point.depthM),
    })),
    footprintParams: input.house.footprint.params,
  });
  const frame = resolveDeckHostEdgeFrame({
    housePolygon: referenceHousePolygon,
    hostEdgeId,
  });
  if (!frame) return null;

  const widthM = Number(input.deck.presetRect.widthM);
  const centerOffsetM = Number(input.deck.presetRect.centerOffsetM);
  if (!Number.isFinite(widthM) || !Number.isFinite(centerOffsetM)) return null;

  const hostSpanM = Math.max(0, frame.end - frame.start);
  const availableHalfSpanM = widthM <= hostSpanM + ZERO_DIMENSION_EPSILON_M ? Math.max(0, (hostSpanM - widthM) / 2) : 0;
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.house.footprint.attachmentSide,
      offsetXM: 0,
      setbackM: 0,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });
  const hostEdgeStart =
    frame.axis === 'along'
      ? toWorld({ alongM: frame.start, depthM: frame.edgeCoordinate })
      : toWorld({ alongM: frame.edgeCoordinate, depthM: frame.start });
  const hostEdgeEnd =
    frame.axis === 'along'
      ? toWorld({ alongM: frame.end, depthM: frame.edgeCoordinate })
      : toWorld({ alongM: frame.edgeCoordinate, depthM: frame.end });

  return {
    kind: 'attached_preset_rect',
    hostEdgeId,
    hostEdgeStart,
    hostEdgeEnd,
    hostSpanM,
    deckWidthM: widthM,
    centerOffsetM,
    minCenterOffsetM: -availableHalfSpanM,
    maxCenterOffsetM: availableHalfSpanM,
  };
}

function buildDeckDragEligibility(input: {
  deck: HouseModel['decks'][number];
  deckInteraction: HouseFirstPlanDeckInteraction | null;
}): HouseFirstPlanShapeOverlay['deckDragEligibility'] {
  if (input.deck.shape === 'custom') {
    return {
      eligible: false,
      reason: 'Custom deck dragging is deferred. Use dimensions or redraw the outline.',
    };
  }
  if (!input.deck.isAttached || input.deck.presetType !== 'rect_attached') {
    return {
      eligible: false,
      reason: 'Drag and snap currently apply only to attached preset rectangular decks.',
    };
  }
  if (!input.deckInteraction) {
    return {
      eligible: false,
      reason: 'This attached deck needs a resolvable host edge before drag and relationship dims are available.',
    };
  }
  return {
    eligible: true,
    reason: 'Drag the selected deck body to move it along the host edge, or click dimensions to edit.',
  };
}

function buildCustomEdgeCandidates(input: {
  ownerKind: 'footprint' | 'deck';
  ownerId: string;
  polygon: PlanPoint[];
  localPolygon: LocalPoint[];
}): HouseFirstPlanCustomEdgeCandidate[] {
  const candidates: HouseFirstPlanCustomEdgeCandidate[] = [];
  for (let index = 0; index < input.polygon.length; index += 1) {
    const start = input.polygon[index]!;
    const end = input.polygon[(index + 1) % input.polygon.length]!;
    const localStart = input.localPolygon[index]!;
    const localEnd = input.localPolygon[(index + 1) % input.localPolygon.length]!;
    if (!localStart || !localEnd) continue;
    const lengthM = Math.hypot(localEnd.alongM - localStart.alongM, localEnd.depthM - localStart.depthM);
    const candidate = makeCustomEdgeCandidate({
      id: `${input.ownerId}:edge:${index}`,
      targetKind: input.ownerKind === 'footprint' ? 'house_custom_edge' : 'deck_custom_edge',
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      edgeIndex: index,
      segmentStart: start,
      segmentEnd: end,
      polygon: input.polygon,
      lengthM,
      localPolygon: input.localPolygon.map((point) => ({
        alongM: formatRawMetres(point.alongM),
        depthM: formatRawMetres(point.depthM),
      })),
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export function resizeCustomPolygonEdge(input: {
  polygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
  edgeIndex: number;
  nextLengthM: string;
}): CalculatorHouseFootprintPolygonPoint[] | null {
  const localPolygon = parseLocalPolygon(input.polygon);
  if (localPolygon.length < 3) return null;
  const start = localPolygon[input.edgeIndex];
  const end = localPolygon[(input.edgeIndex + 1) % localPolygon.length];
  if (!start || !end) return null;
  const nextLength = Number(input.nextLengthM);
  if (!Number.isFinite(nextLength) || nextLength <= 0) return null;

  const dx = end.alongM - start.alongM;
  const dy = end.depthM - start.depthM;
  const currentLength = Math.hypot(dx, dy);
  if (currentLength <= 1e-6) return null;
  const unitX = dx / currentLength;
  const unitY = dy / currentLength;
  const centerAlongM = (start.alongM + end.alongM) / 2;
  const centerDepthM = (start.depthM + end.depthM) / 2;
  const halfLength = nextLength / 2;

  const nextPolygon = localPolygon.map((point) => ({ ...point }));
  nextPolygon[input.edgeIndex] = {
    alongM: centerAlongM - unitX * halfLength,
    depthM: centerDepthM - unitY * halfLength,
  };
  nextPolygon[(input.edgeIndex + 1) % nextPolygon.length] = {
    alongM: centerAlongM + unitX * halfLength,
    depthM: centerDepthM + unitY * halfLength,
  };

  const serializedPolygon = nextPolygon.map((point) => ({
    alongM: formatRawMetres(point.alongM),
    depthM: formatRawMetres(point.depthM),
  }));
  const validation = buildCustomHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 3000,
    attachmentSide: 'rear',
    polygon: serializedPolygon,
  });
  if (!validation.ok) return null;

  return serializedPolygon;
}

export function buildHouseFirstPlanOverlay(input: {
  house: HouseModel | null | undefined;
  selection: WorkbenchHouseSelection;
  moduleLengthM: string | null | undefined;
  moduleProjectionM: string | null | undefined;
}): HouseFirstPlanOverlay | null {
  const house = input.house;
  if (!house) return null;

  const moduleLengthM = Math.max(0.5, parseMetres(input.moduleLengthM, DEFAULT_MODULE_LENGTH_M));
  const moduleProjectionM = Math.max(0.5, parseMetres(input.moduleProjectionM, DEFAULT_MODULE_PROJECTION_M));
  const resolved = resolveFootprintParams({
    params: house.footprint.params,
    attachmentSide: house.footprint.attachmentSide,
    moduleLengthM,
    moduleProjectionM,
  });
  const canonicalHousePolygon = resolveCanonicalHouseLocalPolygon({
    house,
    moduleLengthM,
    moduleProjectionM,
  });
  const houseLocalPolygon = canonicalHousePolygon.localPolygon;
  const housePolygon = buildWorldPolygon({
    localPolygon: houseLocalPolygon,
    attachmentSide: house.footprint.attachmentSide,
    moduleLengthM,
    moduleProjectionM,
    offsetXM: resolved.offsetXM,
    setbackM: resolved.setbackM,
  });
  const shapes: HouseFirstPlanShapeOverlay[] = [
    {
      ownerKind: 'footprint',
      ownerId: house.id,
      polygon: housePolygon,
      selected: input.selection.kind === 'footprint',
      custom: house.footprint.mode === 'custom_polygon',
      muted: input.selection.kind === 'deck',
      invalid: false,
      invalidMessage: null,
      deckInteraction: null,
      deckDragEligibility: null,
    },
  ];

  for (const deck of house.decks) {
    const localPolygon = parseLocalPolygon(deck.outline);
    const selected = input.selection.kind === 'deck' && input.selection.targetId === deck.id;
    const deckInteraction = selected
      ? buildAttachedDeckInteraction({
          house,
          houseLocalPolygon,
          deck,
          moduleLengthM,
          moduleProjectionM,
        })
      : null;
    shapes.push({
      ownerKind: 'deck',
      ownerId: deck.id,
      polygon: buildDeckWorldPolygon({
        localPolygon,
        attachmentSide: house.footprint.attachmentSide,
        moduleLengthM,
        moduleProjectionM,
      }),
      selected,
      custom: deck.shape === 'custom',
      muted: house.decks.length > 1 && !selected,
      invalid: deck.validation.status === 'invalid',
      invalidMessage: deck.validation.message,
      deckInteraction,
      deckDragEligibility: buildDeckDragEligibility({
        deck,
        deckInteraction,
      }),
    });
  }

  for (const opening of house.openings) {
    const wallAnchor = opening.hostEdgeId ?? (opening.wallId as WallOpeningHostSide | null);
    const wallFrame = wallAnchor
      ? resolveDeckHostEdgeFrame({
          housePolygon: houseLocalPolygon.map((point) => ({
            alongM: formatRawMetres(point.alongM),
            depthM: formatRawMetres(point.depthM),
          })),
          hostEdgeId: wallAnchor,
        })
      : null;
    const widthM = Number(opening.widthM);
    const offsetAlongWallM = Number(opening.offsetAlongWallM);
    const localPolygon =
      wallFrame && Number.isFinite(widthM) && Number.isFinite(offsetAlongWallM)
        ? buildOpeningLocalPolygon({
            wallFrame,
            widthM,
            offsetAlongWallM,
          })
        : [];
    shapes.push({
      ownerKind: 'opening',
      ownerId: opening.id,
      polygon: buildWorldPolygon({
        localPolygon,
        attachmentSide: house.footprint.attachmentSide,
        moduleLengthM,
        moduleProjectionM,
        offsetXM: resolved.offsetXM,
        setbackM: resolved.setbackM,
      }),
      selected: input.selection.kind === 'opening' && input.selection.targetId === opening.id,
      custom: false,
      muted: house.openings.length > 1 && !(input.selection.kind === 'opening' && input.selection.targetId === opening.id),
      invalid: opening.validation.status === 'invalid',
      invalidMessage: opening.validation.message,
      deckInteraction: null,
      deckDragEligibility: null,
    });
  }

  const presetAnnotations: HouseFirstPlanPresetDimensionAnnotation[] = [];
  const customEdgeCandidates: HouseFirstPlanCustomEdgeCandidate[] = [];

  if (input.selection.kind === 'footprint') {
    if (house.footprint.mode === 'custom_polygon') {
      customEdgeCandidates.push(
        ...buildCustomEdgeCandidates({
          ownerKind: 'footprint',
          ownerId: house.id,
          polygon: housePolygon,
          localPolygon: houseLocalPolygon,
        }),
      );
    } else {
      presetAnnotations.push(
        ...buildHousePresetAnnotations({
          house,
          housePolygon,
          moduleLengthM,
          moduleProjectionM,
        }),
      );
    }
  } else if (input.selection.kind === 'deck' && input.selection.targetId) {
    const deck = house.decks.find((candidate) => candidate.id === input.selection.targetId);
    const shape = shapes.find((candidate) => candidate.ownerKind === 'deck' && candidate.ownerId === input.selection.targetId);
    if (deck && shape) {
      const localPolygon = parseLocalPolygon(deck.outline);
      if (deck.shape === 'custom') {
        customEdgeCandidates.push(
          ...buildCustomEdgeCandidates({
            ownerKind: 'deck',
            ownerId: deck.id,
            polygon: shape.polygon,
            localPolygon,
          }),
        );
      } else {
        presetAnnotations.push(
          ...buildDeckPresetAnnotations({
            house,
            houseLocalPolygon,
            deck,
            deckPolygon: shape.polygon,
            moduleLengthM,
            moduleProjectionM,
            deckInteraction: shape.deckInteraction,
          }),
        );
      }
    }
  } else if (input.selection.kind === 'opening' && input.selection.targetId) {
    const opening = house.openings.find((candidate) => candidate.id === input.selection.targetId);
    const shape = shapes.find((candidate) => candidate.ownerKind === 'opening' && candidate.ownerId === input.selection.targetId);
    const wallFrame =
      (opening?.hostEdgeId ?? opening?.wallId)
        ? resolveDeckHostEdgeFrame({
            housePolygon: houseLocalPolygon.map((point) => ({
              alongM: formatRawMetres(point.alongM),
              depthM: formatRawMetres(point.depthM),
            })),
            hostEdgeId: opening.hostEdgeId ?? opening.wallId,
          })
        : null;
    if (opening && shape && wallFrame) {
      presetAnnotations.push(
        ...buildOpeningPresetAnnotations({
          house,
          opening,
          openingPolygon: shape.polygon,
          wallFrame,
          moduleLengthM,
          moduleProjectionM,
          offsetXM: resolved.offsetXM,
          setbackM: resolved.setbackM,
        }),
      );
    }
  }

  return {
    housePolygonSource: canonicalHousePolygon.housePolygonSource,
    shapes,
    presetAnnotations,
    customEdgeCandidates,
  };
}
