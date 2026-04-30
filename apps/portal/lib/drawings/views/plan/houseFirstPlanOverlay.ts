import {
  buildCustomHouseFootprintPolygon,
  buildHouseFootprintPresetSideLocalPoints,
  houseFootprintSideLocalPointToWorld,
  resolveHouseFootprintFrame,
} from '@sp/geometry';
import type { ModulePlanHouseContext } from '@/app/staff/calculator/moduleViews';
import type {
  DeckAttachmentMode,
  HouseModel,
  WorkbenchHouseSelection,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { resolveDeckPlacementMode } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  buildDeckReferenceHousePolygon,
  resolveDeckHostEdgeFrame,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import { resolveDeckInteractionCapability } from '@/lib/drawings/interactions/deckInteractionContract';
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
  kind: 'preset_rect' | 'custom_outline';
  placement: 'snapped' | 'floating';
  attachmentMode: DeckAttachmentMode;
  houseAttachmentSide: AttachmentSide;
  semanticPlacementSide: AttachmentSide | null;
  semanticWitnessSide: AttachmentSide;
  placementEdgeId: string | null;
  primaryHostEdgeId: string | null;
  secondaryHostEdgeId: string | null;
  cornerVertexId: string | null;
  witnessEdgeId: string;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  deckWidthM: number;
  deckDepthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
  minCenterOffsetM: number;
  maxCenterOffsetM: number;
  renderedCenter: PlanPoint;
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  commitReferenceFrames: HouseFirstPlanDeckReferenceFrame[];
  crossEdgeReference: HouseFirstPlanDeckCrossEdgeReference | null;
};

export type HouseFirstPlanDeckReferenceFrame = {
  hostEdgeId: AttachmentSide;
  sourceEdgeId: string;
  axis: 'along' | 'depth';
  spanStartM: number;
  spanEndM: number;
  edgeCoordinateM: number;
  outwardDirection: -1 | 1;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  alongUnitX: number;
  alongUnitY: number;
  outwardUnitX: number;
  outwardUnitY: number;
};

export type HouseFirstPlanDeckCrossEdgeReference = {
  hostEdgeId: AttachmentSide;
  gapM: number;
  frame: HouseFirstPlanDeckReferenceFrame;
};

export type HouseFirstPlanOpeningInteraction = {
  kind: 'opening';
  hostEdgeId: string;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  openingWidthM: number;
  offsetAlongWallM: number;
  minOffsetAlongWallM: number;
  maxOffsetAlongWallM: number;
};

export type PlanPoint = {
  x: number;
  y: number;
};

export type PlanSegment = {
  start: PlanPoint;
  end: PlanPoint;
};

export type HouseFirstPlanShapeOverlay = {
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  polygon: PlanPoint[];
  detailSegments: PlanSegment[];
  selected: boolean;
  custom: boolean;
  muted: boolean;
  invalid: boolean;
  invalidMessage: string | null;
  deckInteraction: HouseFirstPlanDeckInteraction | null;
  openingInteraction: HouseFirstPlanOpeningInteraction | null;
  deckDragEligibility:
    | {
        eligible: boolean;
        reason: string;
      }
    | null;
  openingDragEligibility:
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

type GeometryPlanSurface = NonNullable<ModulePlanHouseContext>['surfaces'][number];
type GeometryPlanLine = NonNullable<ModulePlanHouseContext>['lines'][number];

type GeometryOpeningFrame = {
  hostEdgeId: string;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  alongUnitX: number;
  alongUnitY: number;
  outwardUnitX: number;
  outwardUnitY: number;
};

type GeometryHouseLookup = {
  footprintPolygon: PlanPoint[] | null;
  deckPolygons: Map<string, PlanPoint[]>;
  deckReferenceFrames: HouseFirstPlanDeckReferenceFrame[];
  openingFrames: Map<string, GeometryOpeningFrame>;
  openingFramesBySide: Map<AttachmentSide, GeometryOpeningFrame[]>;
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
const DECK_FRAME_TRANSFER_LINE_TOLERANCE_M = 0.5;
const DECK_FRAME_TRANSFER_VECTOR_DOT_TOLERANCE = 0.75;

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

function metadataString(
  metadata: GeometryPlanSurface['metadata'] | GeometryPlanLine['metadata'],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toPlanPoint(point: { x: number; y: number }): PlanPoint {
  return {
    x: Number(point.x),
    y: Number(point.y),
  };
}

function toPlanPolygon(points: Array<{ x: number; y: number }>): PlanPoint[] {
  return points.map(toPlanPoint);
}

function normalizeSourceEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

function isSemanticAttachmentSide(value: string | null | undefined): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function pointsAlmostEqual(a: PlanPoint, b: PlanPoint, tolerance = 0.01): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

function inferSourceEdgeIdFromFootprintLine(input: {
  start: PlanPoint;
  end: PlanPoint;
  footprintPolygon: PlanPoint[];
}): string | null {
  for (let index = 0; index < input.footprintPolygon.length; index += 1) {
    const edgeStart = input.footprintPolygon[index]!;
    const edgeEnd = input.footprintPolygon[(index + 1) % input.footprintPolygon.length]!;
    const matchesForward = pointsAlmostEqual(input.start, edgeStart) && pointsAlmostEqual(input.end, edgeEnd);
    const matchesReverse = pointsAlmostEqual(input.start, edgeEnd) && pointsAlmostEqual(input.end, edgeStart);
    if (matchesForward || matchesReverse) {
      return `footprint-edge-${index + 1}`;
    }
  }
  return null;
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
  unitFrame?: boolean;
}): PlanPoint {
  const frame = resolveHouseFootprintFrame({
    pergolaWidthMm: Math.round((input.unitFrame ? 1 : input.moduleLengthM) * 1000),
    pergolaDepthMm: Math.round((input.unitFrame ? 1 : input.moduleProjectionM) * 1000),
    attachmentSide: input.attachmentSide,
  });
  const world = houseFootprintSideLocalPointToWorld({
    point: input.point,
    frame,
    resolved: {
      widthM: 1,
      offsetXM: input.offsetXM,
      setbackM: input.setbackM,
      bandDepthM: 1,
      returnRunM: 1,
      recessWidthM: 1,
      recessDepthM: 1,
      leftLegRunM: 1,
      rightLegRunM: 1,
      sideRunM: 1,
    },
  });
  return {
    x: world.x / 1000,
    y: world.y / 1000,
  };
}

function midpoint(start: PlanPoint, end: PlanPoint): PlanPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function resolvePolygonCenter(polygon: PlanPoint[]): PlanPoint {
  if (!polygon.length) return { x: 0, y: 0 };
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

function buildDeckWorldPolygon(input: {
  localPolygon: LocalPoint[];
  attachmentSide: AttachmentSide;
  moduleLengthM: number;
  moduleProjectionM: number;
}): PlanPoint[] {
  return input.localPolygon.map((point) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.attachmentSide,
      offsetXM: 0,
      setbackM: 0,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
      unitFrame: true,
    }),
  );
}

function buildGeometryHouseLookup(geometryHouseContext: ModulePlanHouseContext | null | undefined): GeometryHouseLookup {
  const footprintPolygon =
    geometryHouseContext?.surfaces.find((surface) => surface.kind === 'footprint')?.boundary.map(toPlanPoint) ?? null;
  const deckPolygons = new Map<string, PlanPoint[]>();
  for (const surface of geometryHouseContext?.surfaces ?? []) {
    if (surface.kind !== 'deck') continue;
    deckPolygons.set(surface.id, toPlanPolygon(surface.boundary));
  }

  const deckReferenceFramesBySourceEdgeId = new Map<string, HouseFirstPlanDeckReferenceFrame>();
  const openingFrames = new Map<string, GeometryOpeningFrame>();
  const openingFramesBySide = new Map<AttachmentSide, GeometryOpeningFrame[]>();
  if (footprintPolygon?.length) {
    const xValues = footprintPolygon.map((point) => point.x);
    const yValues = footprintPolygon.map((point) => point.y);
    const bounds = {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues),
    };
    for (const line of geometryHouseContext?.lines ?? []) {
      if (line.kind !== 'wall_segment') continue;
      if (metadataString(line.metadata, 'houseWallMode') === 'open_gable_frame') continue;
      const sourceEdgeId =
        normalizeSourceEdgeId(metadataString(line.metadata, 'sourceEdgeId')) ??
        inferSourceEdgeIdFromFootprintLine({
          start: toPlanPoint(line.line.start),
          end: toPlanPoint(line.line.end),
          footprintPolygon,
        });
      if (!sourceEdgeId) continue;
      const hostEdgeStart = toPlanPoint(line.line.start);
      const hostEdgeEnd = toPlanPoint(line.line.end);
      const dx = hostEdgeEnd.x - hostEdgeStart.x;
      const dy = hostEdgeEnd.y - hostEdgeStart.y;
      const hostSpanM = Math.hypot(dx, dy);
      if (hostSpanM <= ZERO_DIMENSION_EPSILON_M) continue;
      const alongUnitX = dx / hostSpanM;
      const alongUnitY = dy / hostSpanM;
      const normalA = { x: -alongUnitY, y: alongUnitX };
      const normalB = { x: -normalA.x, y: -normalA.y };
      const midpoint = {
        x: (hostEdgeStart.x + hostEdgeEnd.x) / 2,
        y: (hostEdgeStart.y + hostEdgeEnd.y) / 2,
      };
      const probeA = {
        x: midpoint.x + normalA.x * EDGE_NORMAL_PROBE_M,
        y: midpoint.y + normalA.y * EDGE_NORMAL_PROBE_M,
      };
      const probeB = {
        x: midpoint.x + normalB.x * EDGE_NORMAL_PROBE_M,
        y: midpoint.y + normalB.y * EDGE_NORMAL_PROBE_M,
      };
      const outward =
        pointInPolygon(probeA, footprintPolygon) && !pointInPolygon(probeB, footprintPolygon)
          ? normalB
          : !pointInPolygon(probeA, footprintPolygon) && pointInPolygon(probeB, footprintPolygon)
            ? normalA
            : normalA;
      const horizontal = Math.abs(hostEdgeStart.y - hostEdgeEnd.y) <= ZERO_DIMENSION_EPSILON_M;
      const vertical = Math.abs(hostEdgeStart.x - hostEdgeEnd.x) <= ZERO_DIMENSION_EPSILON_M;
      if ((horizontal || vertical) && !deckReferenceFramesBySourceEdgeId.has(sourceEdgeId)) {
        const spanStartM = horizontal
          ? Math.min(hostEdgeStart.x, hostEdgeEnd.x)
          : Math.min(hostEdgeStart.y, hostEdgeEnd.y);
        const spanEndM = horizontal
          ? Math.max(hostEdgeStart.x, hostEdgeEnd.x)
          : Math.max(hostEdgeStart.y, hostEdgeEnd.y);
        const outwardDirection = horizontal
          ? (outward.y < 0 ? -1 : 1)
          : (outward.x < 0 ? -1 : 1);
        deckReferenceFramesBySourceEdgeId.set(sourceEdgeId, {
          hostEdgeId: horizontal
            ? (outward.y < 0 ? 'rear' : 'front')
            : (outward.x < 0 ? 'left' : 'right'),
          sourceEdgeId,
          axis: horizontal ? 'along' : 'depth',
          spanStartM,
          spanEndM,
          edgeCoordinateM: horizontal ? hostEdgeStart.y : hostEdgeStart.x,
          outwardDirection,
          hostEdgeStart: horizontal
            ? { x: spanStartM, y: hostEdgeStart.y }
            : { x: hostEdgeStart.x, y: spanStartM },
          hostEdgeEnd: horizontal
            ? { x: spanEndM, y: hostEdgeStart.y }
            : { x: hostEdgeStart.x, y: spanEndM },
          alongUnitX: horizontal ? 1 : 0,
          alongUnitY: horizontal ? 0 : 1,
          outwardUnitX: horizontal ? 0 : outwardDirection,
          outwardUnitY: horizontal ? outwardDirection : 0,
        });
      }
      const frame = {
        hostEdgeId: sourceEdgeId,
        hostEdgeStart,
        hostEdgeEnd,
        hostSpanM,
        alongUnitX,
        alongUnitY,
        outwardUnitX: outward.x,
        outwardUnitY: outward.y,
      } satisfies GeometryOpeningFrame;
      openingFrames.set(sourceEdgeId, frame);
      const side: AttachmentSide =
        Math.abs(dx) >= Math.abs(dy)
          ? Math.abs(hostEdgeStart.y - bounds.minY) <= Math.abs(hostEdgeStart.y - bounds.maxY)
            ? 'rear'
            : 'front'
          : Math.abs(hostEdgeStart.x - bounds.minX) <= Math.abs(hostEdgeStart.x - bounds.maxX)
            ? 'left'
            : 'right';
      const framesForSide = openingFramesBySide.get(side) ?? [];
      framesForSide.push(frame);
      openingFramesBySide.set(side, framesForSide);
    }
  }

  return {
    footprintPolygon,
    deckPolygons,
    deckReferenceFrames: Array.from(deckReferenceFramesBySourceEdgeId.values()),
    openingFrames,
    openingFramesBySide,
  };
}

function resolveOpeningHostEdgeIdFromDerivedWall(input: {
  house: HouseModel;
  opening: HouseModel['openings'][number];
}): string | null {
  if (!input.opening.hostWallId) return null;
  const wall = input.house.derivedWallGraph.walls.find((candidate) => candidate.id === input.opening.hostWallId);
  return normalizeSourceEdgeId(wall?.edgeIds[0] ?? null);
}

function resolveOpeningFrameFromGeometry(input: {
  resolvedHostEdgeId: string | null;
  opening: HouseModel['openings'][number];
  geometryHouseLookup: GeometryHouseLookup;
  allowLegacyFallback: boolean;
}): GeometryOpeningFrame | null {
  const exactHostEdgeId = input.resolvedHostEdgeId ?? normalizeSourceEdgeId(input.opening.hostEdgeId ?? input.opening.wallId);
  if (exactHostEdgeId) {
    return input.geometryHouseLookup.openingFrames.get(exactHostEdgeId) ?? null;
  }
  if (!input.allowLegacyFallback) return null;

  const side =
    input.opening.hostEdgeId === 'front' ||
    input.opening.hostEdgeId === 'left' ||
    input.opening.hostEdgeId === 'right'
      ? input.opening.hostEdgeId
      : input.opening.wallId === 'front' || input.opening.wallId === 'left' || input.opening.wallId === 'right'
        ? input.opening.wallId
        : input.opening.hostEdgeId === 'rear' || input.opening.wallId === 'rear'
          ? 'rear'
          : null;
  if (!side) return null;
  const frames = input.geometryHouseLookup.openingFramesBySide.get(side);
  return frames?.length === 1 ? frames[0]! : null;
}

function resolveOpeningHostEdgeIdFromCompatibility(input: {
  opening: HouseModel['openings'][number];
  houseLocalPolygon: LocalPoint[];
}): string | null {
  const exactHostEdgeId = normalizeSourceEdgeId(input.opening.hostEdgeId ?? input.opening.wallId);
  if (exactHostEdgeId) return exactHostEdgeId;
  const requestedHostEdgeId = input.opening.hostEdgeId ?? input.opening.wallId;
  if (!requestedHostEdgeId) return null;
  const resolvedFrame = resolveDeckHostEdgeFrame({
    housePolygon: input.houseLocalPolygon.map((point) => ({
      alongM: formatRawMetres(point.alongM),
      depthM: formatRawMetres(point.depthM),
    })),
    hostEdgeId: requestedHostEdgeId,
  });
  return resolvedFrame?.sourceEdgeId ?? null;
}

function normalizeVector(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= 1e-6) return { x: 0, y: 0 };
  return {
    x: x / length,
    y: y / length,
  };
}

function dotProduct(a: PlanPoint, b: PlanPoint): number {
  return a.x * b.x + a.y * b.y;
}

function subtractPoints(a: PlanPoint, b: PlanPoint): PlanPoint {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function buildDeckReferenceFrames(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  moduleLengthM: number;
  moduleProjectionM: number;
}): HouseFirstPlanDeckReferenceFrame[] {
  const referenceHousePolygon = buildDeckReferenceHousePolygon({
    housePolygon: input.houseLocalPolygon.map((point) => ({
      alongM: formatRawMetres(point.alongM),
      depthM: formatRawMetres(point.depthM),
    })),
    footprintParams: input.house.footprint.params,
  });
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.house.footprint.attachmentSide,
      offsetXM: 0,
      setbackM: 0,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
      unitFrame: true,
    });
  const localPolygon = referenceHousePolygon.map((point) => ({
    alongM: Number(point.alongM),
    depthM: Number(point.depthM),
  }));
  const alongValues = localPolygon.map((point) => point.alongM);
  const depthValues = localPolygon.map((point) => point.depthM);
  const bounds = {
    minAlongM: Math.min(...alongValues),
    maxAlongM: Math.max(...alongValues),
    minDepthM: Math.min(...depthValues),
    maxDepthM: Math.max(...depthValues),
  };

  return localPolygon.flatMap((point, index) => {
    const nextPoint = localPolygon[(index + 1) % localPolygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const frame =
      Math.abs(point.depthM - nextPoint.depthM) <= ZERO_DIMENSION_EPSILON_M &&
      Math.abs(point.depthM - bounds.minDepthM) <= ZERO_DIMENSION_EPSILON_M
        ? {
            hostEdgeId: 'rear' as const,
            sourceEdgeId,
            axis: 'along' as const,
            spanStartM: Math.min(point.alongM, nextPoint.alongM),
            spanEndM: Math.max(point.alongM, nextPoint.alongM),
            edgeCoordinateM: bounds.minDepthM,
            outwardDirection: -1 as const,
          }
        : Math.abs(point.depthM - nextPoint.depthM) <= ZERO_DIMENSION_EPSILON_M &&
            Math.abs(point.depthM - bounds.maxDepthM) <= ZERO_DIMENSION_EPSILON_M
          ? {
              hostEdgeId: 'front' as const,
              sourceEdgeId,
              axis: 'along' as const,
              spanStartM: Math.min(point.alongM, nextPoint.alongM),
              spanEndM: Math.max(point.alongM, nextPoint.alongM),
              edgeCoordinateM: bounds.maxDepthM,
              outwardDirection: 1 as const,
            }
          : Math.abs(point.alongM - nextPoint.alongM) <= ZERO_DIMENSION_EPSILON_M &&
              Math.abs(point.alongM - bounds.minAlongM) <= ZERO_DIMENSION_EPSILON_M
            ? {
                hostEdgeId: 'left' as const,
                sourceEdgeId,
                axis: 'depth' as const,
                spanStartM: Math.min(point.depthM, nextPoint.depthM),
                spanEndM: Math.max(point.depthM, nextPoint.depthM),
                edgeCoordinateM: bounds.minAlongM,
                outwardDirection: -1 as const,
              }
            : Math.abs(point.alongM - nextPoint.alongM) <= ZERO_DIMENSION_EPSILON_M &&
                Math.abs(point.alongM - bounds.maxAlongM) <= ZERO_DIMENSION_EPSILON_M
              ? {
                  hostEdgeId: 'right' as const,
                  sourceEdgeId,
                  axis: 'depth' as const,
                  spanStartM: Math.min(point.depthM, nextPoint.depthM),
                  spanEndM: Math.max(point.depthM, nextPoint.depthM),
                  edgeCoordinateM: bounds.maxAlongM,
                  outwardDirection: 1 as const,
                }
              : null;
    if (!frame) return [];

    const edgeStartLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanStartM, depthM: frame.edgeCoordinateM }
        : { alongM: frame.edgeCoordinateM, depthM: frame.spanStartM };
    const edgeEndLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanEndM, depthM: frame.edgeCoordinateM }
        : { alongM: frame.edgeCoordinateM, depthM: frame.spanEndM };
    const outwardProbeLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanStartM, depthM: frame.edgeCoordinateM + frame.outwardDirection }
        : { alongM: frame.edgeCoordinateM + frame.outwardDirection, depthM: frame.spanStartM };
    const edgeStart = toWorld(edgeStartLocal);
    const edgeEnd = toWorld(edgeEndLocal);
    const outwardProbe = toWorld(outwardProbeLocal);
    const alongUnit = normalizeVector(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
    const outwardUnit = normalizeVector(outwardProbe.x - edgeStart.x, outwardProbe.y - edgeStart.y);
    return [
      {
        hostEdgeId: frame.hostEdgeId,
        sourceEdgeId: frame.sourceEdgeId,
        axis: frame.axis,
        spanStartM: frame.spanStartM,
        spanEndM: frame.spanEndM,
        edgeCoordinateM: frame.edgeCoordinateM,
        outwardDirection: frame.outwardDirection,
        hostEdgeStart: edgeStart,
        hostEdgeEnd: edgeEnd,
        alongUnitX: alongUnit.x,
        alongUnitY: alongUnit.y,
        outwardUnitX: outwardUnit.x,
        outwardUnitY: outwardUnit.y,
      } satisfies HouseFirstPlanDeckReferenceFrame,
    ];
  });
}

function buildDeckDraftReferenceFrames(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  moduleLengthM: number;
  moduleProjectionM: number;
}): HouseFirstPlanDeckReferenceFrame[] {
  const toWorld = (point: LocalPoint) =>
    localPointToPlanWorld({
      point,
      attachmentSide: input.house.footprint.attachmentSide,
      offsetXM: 0,
      setbackM: 0,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
      unitFrame: true,
    });
  const savedDraftPolygon = parseLocalPolygon(input.house.footprint.polygon);
  const localPolygon = savedDraftPolygon.length ? savedDraftPolygon : input.houseLocalPolygon;
  const alongValues = localPolygon.map((point) => point.alongM);
  const depthValues = localPolygon.map((point) => point.depthM);
  const bounds = {
    minAlongM: Math.min(...alongValues),
    maxAlongM: Math.max(...alongValues),
    minDepthM: Math.min(...depthValues),
    maxDepthM: Math.max(...depthValues),
  };

  return localPolygon.flatMap((point, index) => {
    const nextPoint = localPolygon[(index + 1) % localPolygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const frame =
      Math.abs(point.depthM - nextPoint.depthM) <= ZERO_DIMENSION_EPSILON_M &&
      Math.abs(point.depthM - bounds.minDepthM) <= ZERO_DIMENSION_EPSILON_M
        ? {
            hostEdgeId: 'rear' as const,
            sourceEdgeId,
            axis: 'along' as const,
            spanStartM: Math.min(point.alongM, nextPoint.alongM),
            spanEndM: Math.max(point.alongM, nextPoint.alongM),
            edgeCoordinateM: bounds.minDepthM,
            outwardDirection: -1 as const,
          }
        : Math.abs(point.depthM - nextPoint.depthM) <= ZERO_DIMENSION_EPSILON_M &&
            Math.abs(point.depthM - bounds.maxDepthM) <= ZERO_DIMENSION_EPSILON_M
          ? {
              hostEdgeId: 'front' as const,
              sourceEdgeId,
              axis: 'along' as const,
              spanStartM: Math.min(point.alongM, nextPoint.alongM),
              spanEndM: Math.max(point.alongM, nextPoint.alongM),
              edgeCoordinateM: bounds.maxDepthM,
              outwardDirection: 1 as const,
            }
          : Math.abs(point.alongM - nextPoint.alongM) <= ZERO_DIMENSION_EPSILON_M &&
              Math.abs(point.alongM - bounds.minAlongM) <= ZERO_DIMENSION_EPSILON_M
            ? {
                hostEdgeId: 'left' as const,
                sourceEdgeId,
                axis: 'depth' as const,
                spanStartM: Math.min(point.depthM, nextPoint.depthM),
                spanEndM: Math.max(point.depthM, nextPoint.depthM),
                edgeCoordinateM: bounds.minAlongM,
                outwardDirection: -1 as const,
              }
            : Math.abs(point.alongM - nextPoint.alongM) <= ZERO_DIMENSION_EPSILON_M &&
                Math.abs(point.alongM - bounds.maxAlongM) <= ZERO_DIMENSION_EPSILON_M
              ? {
                  hostEdgeId: 'right' as const,
                  sourceEdgeId,
                  axis: 'depth' as const,
                  spanStartM: Math.min(point.depthM, nextPoint.depthM),
                  spanEndM: Math.max(point.depthM, nextPoint.depthM),
                  edgeCoordinateM: bounds.maxAlongM,
                  outwardDirection: 1 as const,
                }
              : null;
    if (!frame) return [];

    const edgeStartLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanStartM, depthM: frame.edgeCoordinateM }
        : { alongM: frame.edgeCoordinateM, depthM: frame.spanStartM };
    const edgeEndLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanEndM, depthM: frame.edgeCoordinateM }
        : { alongM: frame.edgeCoordinateM, depthM: frame.spanEndM };
    const outwardProbeLocal =
      frame.axis === 'along'
        ? { alongM: frame.spanStartM, depthM: frame.edgeCoordinateM + frame.outwardDirection }
        : { alongM: frame.edgeCoordinateM + frame.outwardDirection, depthM: frame.spanStartM };
    const edgeStart = toWorld(edgeStartLocal);
    const edgeEnd = toWorld(edgeEndLocal);
    const outwardProbe = toWorld(outwardProbeLocal);
    const alongUnit = normalizeVector(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
    const outwardUnit = normalizeVector(outwardProbe.x - edgeStart.x, outwardProbe.y - edgeStart.y);
    return [
      {
        hostEdgeId: frame.hostEdgeId,
        sourceEdgeId: frame.sourceEdgeId,
        axis: frame.axis,
        spanStartM: frame.spanStartM,
        spanEndM: frame.spanEndM,
        edgeCoordinateM: frame.edgeCoordinateM,
        outwardDirection: frame.outwardDirection,
        hostEdgeStart: edgeStart,
        hostEdgeEnd: edgeEnd,
        alongUnitX: alongUnit.x,
        alongUnitY: alongUnit.y,
        outwardUnitX: outwardUnit.x,
        outwardUnitY: outwardUnit.y,
      } satisfies HouseFirstPlanDeckReferenceFrame,
    ];
  });
}

function buildWorldDeckReferenceFrames(housePolygon: PlanPoint[]): HouseFirstPlanDeckReferenceFrame[] {
  if (!housePolygon.length) return [];

  return housePolygon.flatMap((point, index) => {
    const nextPoint = housePolygon[(index + 1) % housePolygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const horizontal = Math.abs(point.y - nextPoint.y) <= ZERO_DIMENSION_EPSILON_M;
    const vertical = Math.abs(point.x - nextPoint.x) <= ZERO_DIMENSION_EPSILON_M;
    if (!horizontal && !vertical) return [];

    const midpoint = {
      x: (point.x + nextPoint.x) / 2,
      y: (point.y + nextPoint.y) / 2,
    };
    const normalA = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const normalB = horizontal ? { x: 0, y: -1 } : { x: -1, y: 0 };
    const probeA = {
      x: midpoint.x + normalA.x * EDGE_NORMAL_PROBE_M,
      y: midpoint.y + normalA.y * EDGE_NORMAL_PROBE_M,
    };
    const probeB = {
      x: midpoint.x + normalB.x * EDGE_NORMAL_PROBE_M,
      y: midpoint.y + normalB.y * EDGE_NORMAL_PROBE_M,
    };
    const outward =
      pointInPolygon(probeA, housePolygon) && !pointInPolygon(probeB, housePolygon)
        ? normalB
        : !pointInPolygon(probeA, housePolygon) && pointInPolygon(probeB, housePolygon)
          ? normalA
          : normalB;
    const spanStartM = horizontal ? Math.min(point.x, nextPoint.x) : Math.min(point.y, nextPoint.y);
    const spanEndM = horizontal ? Math.max(point.x, nextPoint.x) : Math.max(point.y, nextPoint.y);
    return [
      {
        hostEdgeId: horizontal
          ? (outward.y < 0 ? 'rear' : 'front')
          : (outward.x < 0 ? 'left' : 'right'),
        sourceEdgeId,
        axis: horizontal ? 'along' : 'depth',
        spanStartM,
        spanEndM,
        edgeCoordinateM: horizontal ? point.y : point.x,
        outwardDirection: horizontal
          ? (outward.y < 0 ? -1 : 1)
          : (outward.x < 0 ? -1 : 1),
        hostEdgeStart: horizontal ? { x: spanStartM, y: point.y } : { x: point.x, y: spanStartM },
        hostEdgeEnd: horizontal ? { x: spanEndM, y: point.y } : { x: point.x, y: spanEndM },
        alongUnitX: horizontal ? 1 : 0,
        alongUnitY: horizontal ? 0 : 1,
        outwardUnitX: outward.x,
        outwardUnitY: outward.y,
      } satisfies HouseFirstPlanDeckReferenceFrame,
    ];
  });
}

function resolveGeometryDeckReferenceFrames(
  geometryHouseLookup: GeometryHouseLookup,
): HouseFirstPlanDeckReferenceFrame[] {
  return geometryHouseLookup.deckReferenceFrames.length
    ? geometryHouseLookup.deckReferenceFrames
    : geometryHouseLookup.footprintPolygon?.length
      ? buildWorldDeckReferenceFrames(geometryHouseLookup.footprintPolygon)
      : [];
}

function resolveWorldHostEdgeFrame(input: {
  housePolygon: PlanPoint[];
  hostEdgeId: string | null | undefined;
}): HouseFirstPlanDeckReferenceFrame | null {
  if (!input.housePolygon.length) return null;

  const candidates = buildWorldDeckReferenceFrames(input.housePolygon);

  const exactHostEdgeId = normalizeSourceEdgeId(input.hostEdgeId);
  if (exactHostEdgeId) {
    return candidates.find((candidate) => candidate.sourceEdgeId === exactHostEdgeId) ?? null;
  }

  const hostEdgeId = input.hostEdgeId === 'front' || input.hostEdgeId === 'left' || input.hostEdgeId === 'right'
    ? input.hostEdgeId
    : 'rear';
  const sideCandidates = candidates.filter((candidate) => candidate.hostEdgeId === hostEdgeId);
  if (!sideCandidates.length) return null;

  const mergedInterval = sideCandidates
    .map((candidate) => ({ start: candidate.spanStartM, end: candidate.spanEndM }))
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<Array<{ start: number; end: number }>>((intervals, interval) => {
      const previous = intervals[intervals.length - 1];
      if (!previous) return [interval];
      if (interval.start <= previous.end + ZERO_DIMENSION_EPSILON_M) {
        previous.end = Math.max(previous.end, interval.end);
        return intervals;
      }
      intervals.push(interval);
      return intervals;
    }, [])
    .sort((left, right) => (right.end - right.start) - (left.end - left.start) || left.start - right.start)[0];
  const primaryCandidate = [...sideCandidates].sort(
    (left, right) => (right.spanEndM - right.spanStartM) - (left.spanEndM - left.spanStartM) || left.spanStartM - right.spanStartM,
  )[0];
  if (!mergedInterval || !primaryCandidate) return null;

  return {
    ...primaryCandidate,
    spanStartM: mergedInterval.start,
    spanEndM: mergedInterval.end,
    hostEdgeStart:
      primaryCandidate.axis === 'along'
        ? { x: mergedInterval.start, y: primaryCandidate.edgeCoordinateM }
        : { x: primaryCandidate.edgeCoordinateM, y: mergedInterval.start },
    hostEdgeEnd:
      primaryCandidate.axis === 'along'
        ? { x: mergedInterval.end, y: primaryCandidate.edgeCoordinateM }
        : { x: primaryCandidate.edgeCoordinateM, y: mergedInterval.end },
  };
}

function buildWorldCornerVertexIdFromPoint(input: {
  housePolygon: PlanPoint[];
  point: PlanPoint;
}): string | null {
  const vertexIndex = input.housePolygon.findIndex((candidate) => pointsAlmostEqual(candidate, input.point));
  return vertexIndex >= 0 ? `footprint-vertex-${vertexIndex + 1}` : null;
}

function resolveWorldCornerAttachmentCandidate(input: {
  housePolygon: PlanPoint[];
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  primaryHostEdgeId: string | null | undefined;
  secondaryHostEdgeId: string | null | undefined;
  cornerVertexId: string | null | undefined;
}): {
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  secondaryFrame: HouseFirstPlanDeckReferenceFrame;
  cornerVertexId: string;
  cornerPoint: PlanPoint;
} | null {
  const exactPrimaryHostEdgeId = normalizeSourceEdgeId(input.primaryHostEdgeId);
  const exactSecondaryHostEdgeId = normalizeSourceEdgeId(input.secondaryHostEdgeId);
  if (!exactPrimaryHostEdgeId || !exactSecondaryHostEdgeId || exactPrimaryHostEdgeId === exactSecondaryHostEdgeId) {
    return null;
  }
  const primaryFrame = input.referenceFrames.find((frame) => frame.sourceEdgeId === exactPrimaryHostEdgeId) ?? null;
  const secondaryFrame = input.referenceFrames.find((frame) => frame.sourceEdgeId === exactSecondaryHostEdgeId) ?? null;
  if (!primaryFrame || !secondaryFrame || primaryFrame.axis === secondaryFrame.axis) return null;

  const sharedPoint =
    [
      primaryFrame.hostEdgeStart,
      primaryFrame.hostEdgeEnd,
    ].flatMap((primaryPoint) =>
      [secondaryFrame.hostEdgeStart, secondaryFrame.hostEdgeEnd]
        .filter((secondaryPoint) => pointsAlmostEqual(primaryPoint, secondaryPoint))
        .map(() => primaryPoint),
    )[0] ?? null;
  if (!sharedPoint) return null;

  const resolvedCornerVertexId = buildWorldCornerVertexIdFromPoint({
    housePolygon: input.housePolygon,
    point: sharedPoint,
  });
  if (!resolvedCornerVertexId) return null;
  if (
    input.cornerVertexId &&
    input.cornerVertexId.trim().length > 0 &&
    input.cornerVertexId.trim() !== resolvedCornerVertexId
  ) {
    return null;
  }

  return {
    primaryFrame,
    secondaryFrame,
    cornerVertexId: resolvedCornerVertexId,
    cornerPoint: sharedPoint,
  };
}

function projectWorldPolygonToReferenceFrame(input: {
  polygon: PlanPoint[];
  frame: HouseFirstPlanDeckReferenceFrame;
}): {
  alongMinM: number;
  alongMaxM: number;
  outwardMinM: number;
  nearGapM: number;
  widthM: number;
  depthM: number;
  centerOffsetM: number;
} | null {
  if (!input.polygon.length) return null;
  const projections = input.polygon.map((point) => projectWorldPointToReferenceFrame({ point, frame: input.frame }));
  const alongValues = projections.map((projection) => projection.alongM);
  const outwardValues = projections.map((projection) => projection.outwardM);
  const alongMinM = Math.min(...alongValues);
  const alongMaxM = Math.max(...alongValues);
  const outwardMinM = Math.min(...outwardValues);
  const nearGapM = Math.max(0, outwardMinM);
  const depthM = Math.max(0, Math.max(...outwardValues) - outwardMinM);
  const centerOffsetM = ((alongMinM + alongMaxM) / 2) - ((input.frame.spanStartM + input.frame.spanEndM) / 2);
  return {
    alongMinM,
    alongMaxM,
    outwardMinM,
    nearGapM,
    widthM: Math.max(0, alongMaxM - alongMinM),
    depthM,
    centerOffsetM,
  };
}

function projectWorldPointToReferenceFrame(input: {
  point: PlanPoint;
  frame: HouseFirstPlanDeckReferenceFrame;
}): {
  alongM: number;
  outwardM: number;
} {
  const vector = subtractPoints(input.point, input.frame.hostEdgeStart);
  return {
    alongM: input.frame.spanStartM + dotProduct(vector, { x: input.frame.alongUnitX, y: input.frame.alongUnitY }),
    outwardM: dotProduct(vector, { x: input.frame.outwardUnitX, y: input.frame.outwardUnitY }),
  };
}

function buildWorldPointOnDeckReferenceFrame(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
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

function referenceFramesSupportWorldPointTransfer(input: {
  fromFrame: HouseFirstPlanDeckReferenceFrame;
  toFrame: HouseFirstPlanDeckReferenceFrame;
}): boolean {
  if (input.fromFrame.axis !== input.toFrame.axis) return false;
  if (input.fromFrame.hostEdgeId !== input.toFrame.hostEdgeId) return false;
  if (input.fromFrame.outwardDirection !== input.toFrame.outwardDirection) return false;

  const alongDot =
    input.fromFrame.alongUnitX * input.toFrame.alongUnitX +
    input.fromFrame.alongUnitY * input.toFrame.alongUnitY;
  const outwardDot =
    input.fromFrame.outwardUnitX * input.toFrame.outwardUnitX +
    input.fromFrame.outwardUnitY * input.toFrame.outwardUnitY;
  if (Math.abs(alongDot) < DECK_FRAME_TRANSFER_VECTOR_DOT_TOLERANCE) return false;
  if (outwardDot < DECK_FRAME_TRANSFER_VECTOR_DOT_TOLERANCE) return false;

  const directEndpointDistance =
    Math.hypot(
      input.fromFrame.hostEdgeStart.x - input.toFrame.hostEdgeStart.x,
      input.fromFrame.hostEdgeStart.y - input.toFrame.hostEdgeStart.y,
    ) +
    Math.hypot(
      input.fromFrame.hostEdgeEnd.x - input.toFrame.hostEdgeEnd.x,
      input.fromFrame.hostEdgeEnd.y - input.toFrame.hostEdgeEnd.y,
    );
  const reversedEndpointDistance =
    Math.hypot(
      input.fromFrame.hostEdgeStart.x - input.toFrame.hostEdgeEnd.x,
      input.fromFrame.hostEdgeStart.y - input.toFrame.hostEdgeEnd.y,
    ) +
    Math.hypot(
      input.fromFrame.hostEdgeEnd.x - input.toFrame.hostEdgeStart.x,
      input.fromFrame.hostEdgeEnd.y - input.toFrame.hostEdgeStart.y,
    );
  const endpointDistance = Math.min(directEndpointDistance, reversedEndpointDistance);
  const edgeCoordinateDistance = Math.abs(input.fromFrame.edgeCoordinateM - input.toFrame.edgeCoordinateM);

  return (
    endpointDistance <= DECK_FRAME_TRANSFER_LINE_TOLERANCE_M ||
    edgeCoordinateDistance <= DECK_FRAME_TRANSFER_LINE_TOLERANCE_M
  );
}

function transferDeckCenterOffsetBetweenReferenceFrames(input: {
  centerOffsetM: number;
  fromFrame: HouseFirstPlanDeckReferenceFrame;
  toFrame: HouseFirstPlanDeckReferenceFrame;
}): number {
  const fromSpanM = input.fromFrame.spanEndM - input.fromFrame.spanStartM;
  const toSpanM = input.toFrame.spanEndM - input.toFrame.spanStartM;
  if (Math.abs(fromSpanM) <= ZERO_DIMENSION_EPSILON_M || Math.abs(toSpanM) <= ZERO_DIMENSION_EPSILON_M) {
    return input.centerOffsetM;
  }

  const fromFrameMidpointM = (input.fromFrame.spanStartM + input.fromFrame.spanEndM) / 2;
  const toFrameMidpointM = (input.toFrame.spanStartM + input.toFrame.spanEndM) / 2;
  if (referenceFramesSupportWorldPointTransfer(input)) {
    const fromCenterAlongM = fromFrameMidpointM + input.centerOffsetM;
    const worldCenterPoint = buildWorldPointOnDeckReferenceFrame({
      frame: input.fromFrame,
      alongM: fromCenterAlongM,
      outwardM: 0,
    });
    const toProjection = projectWorldPointToReferenceFrame({
      point: worldCenterPoint,
      frame: input.toFrame,
    });
    return toProjection.alongM - toFrameMidpointM;
  }

  const fromCenterAlongM = fromFrameMidpointM + input.centerOffsetM;
  const fromCenterRatio = (fromCenterAlongM - input.fromFrame.spanStartM) / fromSpanM;
  const framesAligned =
    input.fromFrame.alongUnitX * input.toFrame.alongUnitX + input.fromFrame.alongUnitY * input.toFrame.alongUnitY >= 0;
  const toCenterRatio = framesAligned ? fromCenterRatio : 1 - fromCenterRatio;
  return input.toFrame.spanStartM + toCenterRatio * toSpanM - toFrameMidpointM;
}

function resolvePresetDeckCommitFrame(input: {
  deck: HouseModel['decks'][number];
  commitReferenceFrames: HouseFirstPlanDeckReferenceFrame[];
}): HouseFirstPlanDeckReferenceFrame | null {
  const exactHostEdgeId = normalizeSourceEdgeId(input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId);
  if (exactHostEdgeId) {
    return input.commitReferenceFrames.find((frame) => frame.sourceEdgeId === exactHostEdgeId) ?? null;
  }

  const semanticHostEdgeId = isSemanticAttachmentSide(input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId)
    ? (input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId)
    : null;
  if (!semanticHostEdgeId) return null;
  const semanticFrames = input.commitReferenceFrames.filter((frame) => frame.hostEdgeId === semanticHostEdgeId);
  return semanticFrames.length === 1 ? semanticFrames[0]! : null;
}

function resolvePresetDeckRenderCenterOffset(input: {
  deck: HouseModel['decks'][number];
  renderFrame: HouseFirstPlanDeckReferenceFrame;
  commitReferenceFrames: HouseFirstPlanDeckReferenceFrame[];
  fallbackCenterOffsetM: number;
}): number {
  const commitFrame = resolvePresetDeckCommitFrame({
    deck: input.deck,
    commitReferenceFrames: input.commitReferenceFrames,
  });
  if (!commitFrame) return input.fallbackCenterOffsetM;
  return transferDeckCenterOffsetBetweenReferenceFrames({
    centerOffsetM: input.fallbackCenterOffsetM,
    fromFrame: commitFrame,
    toFrame: input.renderFrame,
  });
}

function resolveDeckReferenceFrameForPolygon(input: {
  polygon: PlanPoint[];
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  requestedEdgeId: string | null | undefined;
}): HouseFirstPlanDeckReferenceFrame | null {
  if (!input.referenceFrames.length || !input.polygon.length) return null;

  const exactHostEdgeId = normalizeSourceEdgeId(input.requestedEdgeId);
  if (exactHostEdgeId) {
    return input.referenceFrames.find((frame) => frame.sourceEdgeId === exactHostEdgeId) ?? null;
  }

  if (!input.requestedEdgeId) {
    return (
      input.referenceFrames
        .map((frame) => {
          const projection = projectWorldPolygonToReferenceFrame({ polygon: input.polygon, frame });
          if (!projection) return null;
          const frameMidpointM = (frame.spanStartM + frame.spanEndM) / 2;
          const deckMidpointM = (projection.alongMinM + projection.alongMaxM) / 2;
          return {
            frame,
            overlapPenaltyM: Math.max(0, -projection.outwardMinM),
            outsidePenaltyM: projection.nearGapM,
            spanPenaltyM: Math.max(0, frame.spanStartM - projection.alongMinM) + Math.max(0, projection.alongMaxM - frame.spanEndM),
            midpointDistanceM: Math.abs(deckMidpointM - frameMidpointM),
          };
        })
        .filter((candidate): candidate is {
          frame: HouseFirstPlanDeckReferenceFrame;
          overlapPenaltyM: number;
          outsidePenaltyM: number;
          spanPenaltyM: number;
          midpointDistanceM: number;
        } => Boolean(candidate))
        .sort((left, right) =>
          left.overlapPenaltyM - right.overlapPenaltyM ||
          left.spanPenaltyM - right.spanPenaltyM ||
          left.outsidePenaltyM - right.outsidePenaltyM ||
          left.midpointDistanceM - right.midpointDistanceM,
        )[0]?.frame ?? null
    );
  }

  const requestedSide =
    input.requestedEdgeId === 'front' || input.requestedEdgeId === 'left' || input.requestedEdgeId === 'right'
      ? input.requestedEdgeId
      : 'rear';
  const sideFrames = input.referenceFrames.filter((frame) => frame.hostEdgeId === requestedSide);
  const candidates = sideFrames.length ? sideFrames : input.referenceFrames;
  return (
    candidates
      .map((frame) => {
        const projection = projectWorldPolygonToReferenceFrame({ polygon: input.polygon, frame });
        if (!projection) return null;
        const frameMidpointM = (frame.spanStartM + frame.spanEndM) / 2;
        const deckMidpointM = (projection.alongMinM + projection.alongMaxM) / 2;
        const overlapPenaltyM = Math.max(0, -projection.outwardMinM);
        const outsidePenaltyM = projection.nearGapM;
        const spanPenaltyM = Math.max(0, frame.spanStartM - projection.alongMinM) + Math.max(0, projection.alongMaxM - frame.spanEndM);
        return {
          frame,
          overlapPenaltyM,
          outsidePenaltyM,
          spanPenaltyM,
          midpointDistanceM: Math.abs(deckMidpointM - frameMidpointM),
        };
      })
      .filter((candidate): candidate is {
        frame: HouseFirstPlanDeckReferenceFrame;
        overlapPenaltyM: number;
        outsidePenaltyM: number;
        spanPenaltyM: number;
        midpointDistanceM: number;
      } => Boolean(candidate))
      .sort((left, right) =>
        left.overlapPenaltyM - right.overlapPenaltyM ||
        left.spanPenaltyM - right.spanPenaltyM ||
        left.outsidePenaltyM - right.outsidePenaltyM ||
        left.midpointDistanceM - right.midpointDistanceM,
      )[0]?.frame ?? null
  );
}

function resolveWorldCrossEdgeReference(input: {
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  polygon: PlanPoint[];
}): HouseFirstPlanDeckCrossEdgeReference | null {
  const xValues = input.polygon.map((point) => point.x);
  const yValues = input.polygon.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const candidateEdgeIds =
    input.primaryFrame.axis === 'along'
      ? (['left', 'right'] as const)
      : (['rear', 'front'] as const);
  const candidates = candidateEdgeIds
    .flatMap((hostEdgeId) => input.referenceFrames.filter((frame) => frame.hostEdgeId === hostEdgeId))
    .map((frame) => ({
      hostEdgeId: frame.hostEdgeId,
      frame,
      gapM:
        frame.hostEdgeId === 'left'
          ? Math.max(0, minX - frame.edgeCoordinateM)
          : frame.hostEdgeId === 'right'
            ? Math.max(0, frame.edgeCoordinateM - maxX)
            : frame.hostEdgeId === 'rear'
              ? Math.max(0, minY - frame.edgeCoordinateM)
              : Math.max(0, frame.edgeCoordinateM - maxY),
    }))
    .filter((candidate): candidate is HouseFirstPlanDeckCrossEdgeReference => Boolean(candidate));
  if (!candidates.length) return null;
  return candidates.sort((left, right) => left.gapM - right.gapM)[0] ?? null;
}

function buildDeckWorldPolygonFromReferenceFrame(input: {
  frame: HouseFirstPlanDeckReferenceFrame;
  widthM: number;
  depthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
}): PlanPoint[] {
  const hostMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = hostMidpointM + input.centerOffsetM;
  const nearAlongM = centerAlongM - input.widthM / 2;
  const farAlongM = centerAlongM + input.widthM / 2;
  const nearOutM = input.referenceEdgeGapM;
  const farOutM = nearOutM + input.depthM;
  const anchor = input.frame.hostEdgeStart;
  const pointAt = (alongM: number, outM: number): PlanPoint => ({
    x: anchor.x + input.frame.alongUnitX * (alongM - input.frame.spanStartM) + input.frame.outwardUnitX * outM,
    y: anchor.y + input.frame.alongUnitY * (alongM - input.frame.spanStartM) + input.frame.outwardUnitY * outM,
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

function buildDeckWorldPolygonFromCornerAttachment(input: {
  primaryFrame: HouseFirstPlanDeckReferenceFrame;
  secondaryFrame: HouseFirstPlanDeckReferenceFrame;
  cornerPoint: PlanPoint;
  widthM: number;
  depthM: number;
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
  const minX = input.cornerPoint.x + Math.min(0, alongDirection * input.widthM);
  const maxX = input.cornerPoint.x + Math.max(0, alongDirection * input.widthM);
  const minY = input.cornerPoint.y + Math.min(0, depthDirection * input.depthM);
  const maxY = input.cornerPoint.y + Math.max(0, depthDirection * input.depthM);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function resolvePresetDeckGeometryFrame(input: {
  deck: HouseModel['decks'][number];
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  fallbackPolygon: PlanPoint[];
  geometryHouseLookup: GeometryHouseLookup;
}): HouseFirstPlanDeckReferenceFrame | null {
  const requestedHostEdgeId = input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId;
  const exactHostEdgeId = normalizeSourceEdgeId(requestedHostEdgeId);
  if (exactHostEdgeId) {
    const exactFrame = input.referenceFrames.find((frame) => frame.sourceEdgeId === exactHostEdgeId) ?? null;
    if (exactFrame) return exactFrame;
    const semanticFallbackEdgeId = isSemanticAttachmentSide(input.deck.hostEdgeId) ? input.deck.hostEdgeId : null;
    const polygonFrame = input.fallbackPolygon.length
      ? resolveDeckReferenceFrameForPolygon({
          polygon: input.fallbackPolygon,
          referenceFrames: input.referenceFrames,
          requestedEdgeId: semanticFallbackEdgeId,
        })
      : null;
    return polygonFrame;
  }
  if (isSemanticAttachmentSide(requestedHostEdgeId) && input.geometryHouseLookup.footprintPolygon?.length) {
    const fallbackFrame = input.fallbackPolygon.length
      ? resolveDeckReferenceFrameForPolygon({
          polygon: input.fallbackPolygon,
          referenceFrames: input.referenceFrames,
          requestedEdgeId: requestedHostEdgeId,
        })
      : null;
    return fallbackFrame ?? resolveWorldHostEdgeFrame({
      housePolygon: input.geometryHouseLookup.footprintPolygon,
      hostEdgeId: requestedHostEdgeId,
    });
  }
  return resolveDeckReferenceFrameForPolygon({
    polygon: input.fallbackPolygon,
    referenceFrames: input.referenceFrames,
    requestedEdgeId: requestedHostEdgeId,
  });
}

function buildPresetAttachedDeckWorldPolygon(input: {
  deck: HouseModel['decks'][number];
  referenceFrames: HouseFirstPlanDeckReferenceFrame[];
  commitReferenceFrames: HouseFirstPlanDeckReferenceFrame[];
  fallbackPolygon: PlanPoint[];
  geometryHouseLookup: GeometryHouseLookup;
}): PlanPoint[] | null {
  if (input.deck.shape !== 'preset' || !input.deck.presetRect || !input.deck.isAttached) return null;
  if (!input.referenceFrames.length) return null;

  const widthM = Number(input.deck.presetRect.widthM);
  const depthM = Number(input.deck.presetRect.depthM);
  const centerOffsetM = Number(input.deck.presetRect.centerOffsetM);
  if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || !Number.isFinite(centerOffsetM)) return null;

  const attachmentMode =
    input.deck.attachmentMode ??
    (input.deck.secondaryHostEdgeId && input.deck.cornerVertexId ? 'corner_dual_edge' : 'single_edge');
  const cornerAttachment =
    attachmentMode === 'corner_dual_edge' && input.geometryHouseLookup.footprintPolygon?.length
      ? resolveWorldCornerAttachmentCandidate({
          housePolygon: input.geometryHouseLookup.footprintPolygon,
          referenceFrames: input.referenceFrames,
          primaryHostEdgeId: input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId,
          secondaryHostEdgeId: input.deck.secondaryHostEdgeId,
          cornerVertexId: input.deck.cornerVertexId,
        })
      : null;
  if (cornerAttachment) {
    return buildDeckWorldPolygonFromCornerAttachment({
      primaryFrame: cornerAttachment.primaryFrame,
      secondaryFrame: cornerAttachment.secondaryFrame,
      cornerPoint: cornerAttachment.cornerPoint,
      widthM,
      depthM,
    });
  }

  const frame = resolvePresetDeckGeometryFrame(input);
  if (!frame) return null;
  const renderCenterOffsetM = resolvePresetDeckRenderCenterOffset({
    deck: input.deck,
    renderFrame: frame,
    commitReferenceFrames: input.commitReferenceFrames,
    fallbackCenterOffsetM: centerOffsetM,
  });
  return buildDeckWorldPolygonFromReferenceFrame({
    frame,
    widthM,
    depthM,
    centerOffsetM: renderCenterOffsetM,
    referenceEdgeGapM: 0,
  });
}

function buildOpeningPolygonFromGeometryFrame(input: {
  frame: GeometryOpeningFrame;
  widthM: number;
  offsetAlongWallM: number;
}): PlanPoint[] {
  const start = {
    x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * input.offsetAlongWallM,
    y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * input.offsetAlongWallM,
  };
  const end = {
    x: start.x + input.frame.alongUnitX * input.widthM,
    y: start.y + input.frame.alongUnitY * input.widthM,
  };
  const inwardOffset = {
    x: -input.frame.outwardUnitX * OPENING_PLAN_THICKNESS_M,
    y: -input.frame.outwardUnitY * OPENING_PLAN_THICKNESS_M,
  };
  return [
    start,
    end,
    { x: end.x + inwardOffset.x, y: end.y + inwardOffset.y },
    { x: start.x + inwardOffset.x, y: start.y + inwardOffset.y },
  ];
}

function buildSliderDetailSegments(input: {
  frame: GeometryOpeningFrame;
  widthM: number;
  offsetAlongWallM: number;
  panelCount: 2 | 3 | 4 | null;
}): PlanSegment[] {
  const panelCount = input.panelCount ?? 2;
  if (panelCount <= 1 || input.widthM <= ZERO_DIMENSION_EPSILON_M) return [];
  const segments: PlanSegment[] = [];
  for (let index = 1; index < panelCount; index += 1) {
    const alongM = input.offsetAlongWallM + (input.widthM * index) / panelCount;
    const wallPoint = {
      x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * alongM,
      y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * alongM,
    };
    const innerPoint = {
      x: wallPoint.x - input.frame.outwardUnitX * OPENING_PLAN_THICKNESS_M,
      y: wallPoint.y - input.frame.outwardUnitY * OPENING_PLAN_THICKNESS_M,
    };
    segments.push({
      start: wallPoint,
      end: innerPoint,
    });
  }
  return segments;
}

function buildOpeningPresetAnnotations(input: {
  opening: HouseModel['openings'][number];
  openingPolygon: PlanPoint[];
  openingFrame: GeometryOpeningFrame;
}): HouseFirstPlanPresetDimensionAnnotation[] {
  const widthM = Number(input.opening.widthM);
  const offsetAlongWallM = Number(input.opening.offsetAlongWallM);
  if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) return [];

  const wallStart = input.openingFrame.hostEdgeStart;
  const openingStart = {
    x: wallStart.x + input.openingFrame.alongUnitX * offsetAlongWallM,
    y: wallStart.y + input.openingFrame.alongUnitY * offsetAlongWallM,
  };
  const openingEnd = {
    x: openingStart.x + input.openingFrame.alongUnitX * widthM,
    y: openingStart.y + input.openingFrame.alongUnitY * widthM,
  };

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
      segmentStart: openingStart,
      segmentEnd: openingEnd,
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
      segmentStart: wallStart,
      segmentEnd: openingStart,
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
  if (input.deckPolygon.length < 4) return [];
  const [first, second, third] = input.deckPolygon;
  if (!first || !second || !third) return [];
  const widthStart = first;
  const widthEnd = second;
  const depthEnd = third;
  const legacyDetachedGapM = Number(presetRect.detachedGapM ?? '0');
  const preserveLegacyDetachedGap =
    !input.deck.isAttached &&
    !input.deck.floatingRect &&
    !normalizeSourceEdgeId(input.deck.hostEdgeId) &&
    Number.isFinite(legacyDetachedGapM) &&
    legacyDetachedGapM > ZERO_DIMENSION_EPSILON_M;

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
  const referenceFrames =
    input.deckInteraction?.referenceFrames ??
    buildDeckReferenceFrames({
      house: input.house,
      houseLocalPolygon: input.houseLocalPolygon,
      moduleLengthM: input.moduleLengthM,
      moduleProjectionM: input.moduleProjectionM,
    });
  const placement = input.deckInteraction?.placement ?? resolveDeckPlacementMode(input.deck.isAttached);
  const resolvedPlacementEdgeId =
    normalizeSourceEdgeId(input.deck.hostEdgeId) || isSemanticAttachmentSide(input.deck.hostEdgeId)
      ? input.deck.hostEdgeId
      : null;
  const resolvedWitnessEdgeId = normalizeSourceEdgeId(input.deck.hostEdgeId);
  if (placement === 'snapped' && !input.deckInteraction?.placementEdgeId && !resolvedPlacementEdgeId) {
    return drivingAnnotations.filter(
      (annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation),
    );
  }
  const referenceFrame =
    (placement === 'snapped'
      ? input.deckInteraction?.placementEdgeId
      : input.deckInteraction?.witnessEdgeId)
      ? referenceFrames.find((frame) =>
          frame.sourceEdgeId ===
          (placement === 'snapped' ? input.deckInteraction?.placementEdgeId : input.deckInteraction?.witnessEdgeId),
        ) ?? null
      : resolveDeckReferenceFrameForPolygon({
          polygon: input.deckPolygon,
          referenceFrames,
          requestedEdgeId: placement === 'snapped' ? resolvedPlacementEdgeId : resolvedWitnessEdgeId,
        });
  const referenceProjection = referenceFrame
    ? projectWorldPolygonToReferenceFrame({
        polygon: input.deckPolygon,
        frame: referenceFrame,
      })
    : null;
  const crossEdgeReference =
    referenceFrame &&
    (input.deckInteraction?.crossEdgeReference ??
      resolveWorldCrossEdgeReference({
        primaryFrame: referenceFrame,
        referenceFrames,
        polygon: input.deckPolygon,
      }));
  if (referenceFrame && referenceProjection) {
    const pointOnFrame = (frame: HouseFirstPlanDeckReferenceFrame, alongM: number, outM: number): PlanPoint => ({
      x: frame.hostEdgeStart.x + frame.alongUnitX * (alongM - frame.spanStartM) + frame.outwardUnitX * outM,
      y: frame.hostEdgeStart.y + frame.alongUnitY * (alongM - frame.spanStartM) + frame.outwardUnitY * outM,
    });

    if (placement === 'snapped') {
        const hostStartGapM = Math.max(0, referenceProjection.alongMinM - referenceFrame.spanStartM);
        const hostEndGapM = Math.max(0, referenceFrame.spanEndM - referenceProjection.alongMaxM);
        const minimumVisibleGapM = 0.001;
        const hostEdgeStart = pointOnFrame(referenceFrame, referenceFrame.spanStartM, 0);
        const hostEdgeEnd = pointOnFrame(referenceFrame, referenceFrame.spanEndM, 0);
        const deckStart = pointOnFrame(referenceFrame, referenceProjection.alongMinM, 0);
        const deckEnd = pointOnFrame(referenceFrame, referenceProjection.alongMaxM, 0);
        const visibleDeckStart =
          hostStartGapM <= ZERO_DIMENSION_EPSILON_M
            ? pointOnFrame(referenceFrame, referenceProjection.alongMinM + minimumVisibleGapM, 0)
            : deckStart;
        const visibleDeckEnd =
          hostEndGapM <= ZERO_DIMENSION_EPSILON_M
            ? pointOnFrame(referenceFrame, referenceProjection.alongMaxM - minimumVisibleGapM, 0)
            : deckEnd;
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
            segmentStart: hostEdgeStart,
            segmentEnd: visibleDeckStart,
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
            segmentStart: visibleDeckEnd,
            segmentEnd: hostEdgeEnd,
            polygon: input.deckPolygon,
            deckInteraction: input.deckInteraction,
          }),
        );
    } else {
      const centerAlongM = (referenceProjection.alongMinM + referenceProjection.alongMaxM) / 2;
      const referenceEdgeGapM =
        input.deckInteraction?.referenceEdgeGapM && input.deckInteraction.referenceEdgeGapM > ZERO_DIMENSION_EPSILON_M
          ? input.deckInteraction.referenceEdgeGapM
          : preserveLegacyDetachedGap
            ? legacyDetachedGapM
            : Number(presetRect.detachedGapM ?? formatRawMetres(referenceProjection.nearGapM));
      relationshipAnnotations.push(
        makeAnnotation({
          id: `${input.deck.id}:referenceEdgeGapM`,
          targetKind: 'deck_host_edge_reference',
          emphasis: 'relationship',
          ownerKind: 'deck',
          ownerId: input.deck.id,
          fieldKey: 'referenceEdgeGapM',
          rawValue: formatRawMetres(referenceEdgeGapM),
          displayValue: formatDisplayMetres(referenceEdgeGapM),
          segmentStart: pointOnFrame(referenceFrame, centerAlongM, 0),
          segmentEnd: pointOnFrame(referenceFrame, centerAlongM, referenceEdgeGapM),
          polygon: input.deckPolygon,
          deckInteraction: input.deckInteraction,
        }),
      );
      if (crossEdgeReference) {
        const xValues = input.deckPolygon.map((point) => point.x);
        const yValues = input.deckPolygon.map((point) => point.y);
        const minAlongM = Math.min(...xValues);
        const maxAlongM = Math.max(...xValues);
        const minDepthM = Math.min(...yValues);
        const maxDepthM = Math.max(...yValues);
        const crossGapM =
          crossEdgeReference.frame.hostEdgeId === 'left'
            ? Math.max(0, minAlongM - crossEdgeReference.frame.edgeCoordinateM)
            : crossEdgeReference.frame.hostEdgeId === 'right'
              ? Math.max(0, crossEdgeReference.frame.edgeCoordinateM - maxAlongM)
              : crossEdgeReference.frame.hostEdgeId === 'rear'
              ? Math.max(0, minDepthM - crossEdgeReference.frame.edgeCoordinateM)
              : Math.max(0, crossEdgeReference.frame.edgeCoordinateM - maxDepthM);
        const crossCenterAlongM =
          crossEdgeReference.frame.axis === 'along'
            ? (minAlongM + maxAlongM) / 2
            : (minDepthM + maxDepthM) / 2;
        relationshipAnnotations.push(
          makeAnnotation({
            id: `${input.deck.id}:crossEdgeGapM`,
            targetKind: 'deck_host_edge_reference',
            emphasis: 'relationship',
            ownerKind: 'deck',
            ownerId: input.deck.id,
            fieldKey: 'crossEdgeGapM',
            rawValue: formatRawMetres(crossGapM),
            displayValue: formatDisplayMetres(crossGapM),
            segmentStart: pointOnFrame(crossEdgeReference.frame, crossCenterAlongM, 0),
            segmentEnd: pointOnFrame(crossEdgeReference.frame, crossCenterAlongM, crossGapM),
            polygon: input.deckPolygon,
            deckInteraction: input.deckInteraction,
          }),
        );
      }
    }
  }

  return [...drivingAnnotations, ...relationshipAnnotations].filter(
    (annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation),
  );
}

function buildCustomDeckRelationshipAnnotations(input: {
  deck: HouseModel['decks'][number];
  deckPolygon: PlanPoint[];
  deckInteraction: HouseFirstPlanDeckInteraction | null;
}): HouseFirstPlanPresetDimensionAnnotation[] {
  const interaction = input.deckInteraction;
  if (!interaction || interaction.kind !== 'custom_outline') return [];

  const referenceFrame = interaction.referenceFrames.find(
    (frame) => frame.sourceEdgeId === interaction.witnessEdgeId,
  );
  const referenceProjection =
    referenceFrame
      ? projectWorldPolygonToReferenceFrame({
          polygon: input.deckPolygon,
          frame: referenceFrame,
        })
      : null;
  if (!referenceFrame || !referenceProjection) return [];

  const pointOnFrame = (frame: HouseFirstPlanDeckReferenceFrame, alongM: number, outM: number): PlanPoint => ({
    x: frame.hostEdgeStart.x + frame.alongUnitX * (alongM - frame.spanStartM) + frame.outwardUnitX * outM,
    y: frame.hostEdgeStart.y + frame.alongUnitY * (alongM - frame.spanStartM) + frame.outwardUnitY * outM,
  });

  const centerAlongM = (referenceProjection.alongMinM + referenceProjection.alongMaxM) / 2;
  const annotations: Array<HouseFirstPlanPresetDimensionAnnotation | null> = [];
  annotations.push(
    makeAnnotation({
      id: `${input.deck.id}:referenceEdgeGapM`,
      targetKind: 'deck_host_edge_reference',
      emphasis: 'relationship',
      ownerKind: 'deck',
      ownerId: input.deck.id,
      fieldKey: 'referenceEdgeGapM',
      rawValue: formatRawMetres(interaction.referenceEdgeGapM),
      displayValue: formatDisplayMetres(interaction.referenceEdgeGapM),
      segmentStart: pointOnFrame(referenceFrame, centerAlongM, 0),
      segmentEnd: pointOnFrame(referenceFrame, centerAlongM, interaction.referenceEdgeGapM),
      polygon: input.deckPolygon,
      deckInteraction: interaction,
    }),
  );

  if (interaction.crossEdgeReference) {
    const xValues = input.deckPolygon.map((point) => point.x);
    const yValues = input.deckPolygon.map((point) => point.y);
    const minAlongM = Math.min(...xValues);
    const maxAlongM = Math.max(...xValues);
    const minDepthM = Math.min(...yValues);
    const maxDepthM = Math.max(...yValues);
    const crossGapM =
      interaction.crossEdgeReference.frame.hostEdgeId === 'left'
        ? Math.max(0, minAlongM - interaction.crossEdgeReference.frame.edgeCoordinateM)
        : interaction.crossEdgeReference.frame.hostEdgeId === 'right'
          ? Math.max(0, interaction.crossEdgeReference.frame.edgeCoordinateM - maxAlongM)
          : interaction.crossEdgeReference.frame.hostEdgeId === 'rear'
            ? Math.max(0, minDepthM - interaction.crossEdgeReference.frame.edgeCoordinateM)
            : Math.max(0, interaction.crossEdgeReference.frame.edgeCoordinateM - maxDepthM);
    const crossCenterAlongM =
      interaction.crossEdgeReference.frame.axis === 'along'
        ? (minAlongM + maxAlongM) / 2
        : (minDepthM + maxDepthM) / 2;
    annotations.push(
      makeAnnotation({
        id: `${input.deck.id}:crossEdgeGapM`,
        targetKind: 'deck_host_edge_reference',
        emphasis: 'relationship',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'crossEdgeGapM',
        rawValue: formatRawMetres(crossGapM),
        displayValue: formatDisplayMetres(crossGapM),
        segmentStart: pointOnFrame(interaction.crossEdgeReference.frame, crossCenterAlongM, 0),
        segmentEnd: pointOnFrame(interaction.crossEdgeReference.frame, crossCenterAlongM, crossGapM),
        polygon: input.deckPolygon,
        deckInteraction: interaction,
      }),
    );
  }

  return annotations.filter(
    (annotation): annotation is HouseFirstPlanPresetDimensionAnnotation => Boolean(annotation),
  );
}

function buildPresetDeckInteraction(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  deck: HouseModel['decks'][number];
  moduleLengthM: number;
  moduleProjectionM: number;
  deckPolygon: PlanPoint[];
  geometryHouseLookup: GeometryHouseLookup;
  referenceFramesOverride?: HouseFirstPlanDeckReferenceFrame[] | null;
}): HouseFirstPlanDeckInteraction | null {
  if (input.deck.shape !== 'preset' || !input.deck.presetRect) return null;
  if (input.deckPolygon.length < 4) return null;

  const commitReferenceFrames = buildDeckDraftReferenceFrames({
    house: input.house,
    houseLocalPolygon: input.houseLocalPolygon,
    moduleLengthM: input.moduleLengthM,
    moduleProjectionM: input.moduleProjectionM,
  });
  const geometryReferenceFrames = resolveGeometryDeckReferenceFrames(input.geometryHouseLookup);
  const referenceFrames = input.referenceFramesOverride?.length
    ? input.referenceFramesOverride
    : geometryReferenceFrames.length
      ? geometryReferenceFrames
      : commitReferenceFrames;
  const attachmentMode =
    input.deck.attachmentMode ??
    (input.deck.secondaryHostEdgeId && input.deck.cornerVertexId
      ? 'corner_dual_edge'
      : input.deck.isAttached
        ? 'single_edge'
        : 'floating');
  const resolvedPlacementEdgeId =
    normalizeSourceEdgeId(input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId) ||
    isSemanticAttachmentSide(input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId)
      ? (input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId)
      : null;
  const resolvedWitnessEdgeId = normalizeSourceEdgeId(input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId);
  const cornerAttachment =
    attachmentMode === 'corner_dual_edge' && input.geometryHouseLookup.footprintPolygon?.length
      ? resolveWorldCornerAttachmentCandidate({
          housePolygon: input.geometryHouseLookup.footprintPolygon,
          referenceFrames,
          primaryHostEdgeId: input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId,
          secondaryHostEdgeId: input.deck.secondaryHostEdgeId,
          cornerVertexId: input.deck.cornerVertexId,
        })
      : null;
  const placementFrame = input.deck.isAttached && resolvedPlacementEdgeId
    ? resolveDeckReferenceFrameForPolygon({
        polygon: input.deckPolygon,
        referenceFrames,
        requestedEdgeId: resolvedPlacementEdgeId,
      })
    : null;
  if (input.deck.isAttached && !placementFrame) return null;
  const witnessFrame =
    resolveDeckReferenceFrameForPolygon({
      polygon: input.deckPolygon,
      referenceFrames,
      requestedEdgeId: input.deck.isAttached ? resolvedPlacementEdgeId : resolvedWitnessEdgeId,
    }) ??
    placementFrame;
  const interactionFrame = placementFrame ?? witnessFrame;
  if (!interactionFrame || !witnessFrame) return null;

  const widthM = Number(input.deck.presetRect.widthM);
  const depthM = Number(input.deck.presetRect.depthM);
  const storedCenterOffsetM = Number(input.deck.presetRect.centerOffsetM);
  const legacyDetachedGapM = Number(input.deck.presetRect.detachedGapM ?? '0');
  const preserveLegacyDetachedGap =
    !input.deck.isAttached &&
    !input.deck.floatingRect &&
    !normalizeSourceEdgeId(input.deck.hostEdgeId) &&
    Number.isFinite(legacyDetachedGapM) &&
    legacyDetachedGapM > ZERO_DIMENSION_EPSILON_M;
  const referenceProjection = projectWorldPolygonToReferenceFrame({
    polygon: input.deckPolygon,
    frame: witnessFrame,
  });
  const centerOffsetM = input.deck.isAttached
    ? resolvePresetDeckRenderCenterOffset({
        deck: input.deck,
        renderFrame: placementFrame,
        commitReferenceFrames,
        fallbackCenterOffsetM: storedCenterOffsetM,
      })
    : referenceProjection
      ? (referenceProjection.alongMinM + referenceProjection.alongMaxM) / 2 -
        ((witnessFrame.spanStartM + witnessFrame.spanEndM) / 2)
      : storedCenterOffsetM;
  const referenceEdgeGapM = input.deck.isAttached
    ? 0
    : referenceProjection
      ? Math.max(referenceProjection.nearGapM, preserveLegacyDetachedGap ? legacyDetachedGapM : 0)
      : legacyDetachedGapM;
  if (
    !Number.isFinite(widthM) ||
    !Number.isFinite(depthM) ||
    !Number.isFinite(centerOffsetM) ||
    !Number.isFinite(referenceEdgeGapM)
  ) {
    return null;
  }

  const hostSpanM = Math.max(0, interactionFrame.spanEndM - interactionFrame.spanStartM);
  const availableHalfSpanM =
    widthM <= hostSpanM + ZERO_DIMENSION_EPSILON_M ? Math.max(0, (hostSpanM - widthM) / 2) : 0;

  return {
    kind: 'preset_rect',
    attachmentMode: cornerAttachment ? 'corner_dual_edge' : input.deck.isAttached ? 'single_edge' : 'floating',
    placement: resolveDeckPlacementMode(input.deck.isAttached),
    houseAttachmentSide: input.house.footprint.attachmentSide,
    semanticPlacementSide: placementFrame?.hostEdgeId ?? null,
    semanticWitnessSide: witnessFrame.hostEdgeId,
    placementEdgeId: placementFrame?.sourceEdgeId ?? null,
    primaryHostEdgeId: cornerAttachment?.primaryFrame.sourceEdgeId ?? placementFrame?.sourceEdgeId ?? null,
    secondaryHostEdgeId: cornerAttachment?.secondaryFrame.sourceEdgeId ?? input.deck.secondaryHostEdgeId ?? null,
    cornerVertexId: cornerAttachment?.cornerVertexId ?? input.deck.cornerVertexId ?? null,
    witnessEdgeId: witnessFrame.sourceEdgeId,
    hostEdgeStart: interactionFrame.hostEdgeStart,
    hostEdgeEnd: interactionFrame.hostEdgeEnd,
    hostSpanM,
    deckWidthM: widthM,
    deckDepthM: depthM,
    centerOffsetM,
    referenceEdgeGapM,
    minCenterOffsetM: input.deck.isAttached ? Number.NEGATIVE_INFINITY : -availableHalfSpanM,
    maxCenterOffsetM: input.deck.isAttached ? Number.POSITIVE_INFINITY : availableHalfSpanM,
    renderedCenter: resolvePolygonCenter(input.deckPolygon),
    referenceFrames,
    commitReferenceFrames,
    crossEdgeReference: cornerAttachment
      ? {
          hostEdgeId: cornerAttachment.secondaryFrame.hostEdgeId,
          gapM: 0,
          frame: cornerAttachment.secondaryFrame,
        }
      : resolveWorldCrossEdgeReference({
          primaryFrame: witnessFrame,
          referenceFrames,
          polygon: input.deckPolygon,
        }),
  };
}

function buildCustomDeckInteraction(input: {
  house: HouseModel;
  houseLocalPolygon: LocalPoint[];
  deck: HouseModel['decks'][number];
  moduleLengthM: number;
  moduleProjectionM: number;
  deckPolygon: PlanPoint[];
  geometryHouseLookup: GeometryHouseLookup;
}): HouseFirstPlanDeckInteraction | null {
  if (input.deck.shape !== 'custom') return null;
  if (input.deckPolygon.length < 3) return null;

  const commitReferenceFrames = buildDeckDraftReferenceFrames({
    house: input.house,
    houseLocalPolygon: input.houseLocalPolygon,
    moduleLengthM: input.moduleLengthM,
    moduleProjectionM: input.moduleProjectionM,
  });
  const geometryReferenceFrames = resolveGeometryDeckReferenceFrames(input.geometryHouseLookup);
  const referenceFrames = geometryReferenceFrames.length ? geometryReferenceFrames : commitReferenceFrames;
  const witnessFrame = resolveDeckReferenceFrameForPolygon({
    polygon: input.deckPolygon,
    referenceFrames,
    requestedEdgeId: input.deck.hostEdgeId,
  });
  if (!witnessFrame) return null;

  const referenceProjection = projectWorldPolygonToReferenceFrame({
    polygon: input.deckPolygon,
    frame: witnessFrame,
  });
  if (!referenceProjection) return null;

  const hostSpanM = Math.max(0, witnessFrame.spanEndM - witnessFrame.spanStartM);
  const availableHalfSpanM =
    referenceProjection.widthM <= hostSpanM + ZERO_DIMENSION_EPSILON_M
      ? Math.max(0, (hostSpanM - referenceProjection.widthM) / 2)
      : 0;

  return {
    kind: 'custom_outline',
    placement: 'floating',
    attachmentMode: 'floating',
    houseAttachmentSide: input.house.footprint.attachmentSide,
    semanticPlacementSide: null,
    semanticWitnessSide: witnessFrame.hostEdgeId,
    placementEdgeId: null,
    primaryHostEdgeId: null,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: witnessFrame.sourceEdgeId,
    hostEdgeStart: witnessFrame.hostEdgeStart,
    hostEdgeEnd: witnessFrame.hostEdgeEnd,
    hostSpanM,
    deckWidthM: referenceProjection.widthM,
    deckDepthM: referenceProjection.depthM,
    centerOffsetM: referenceProjection.centerOffsetM,
    referenceEdgeGapM: referenceProjection.nearGapM,
    minCenterOffsetM: -availableHalfSpanM,
    maxCenterOffsetM: availableHalfSpanM,
    renderedCenter: resolvePolygonCenter(input.deckPolygon),
    referenceFrames,
    commitReferenceFrames,
    crossEdgeReference: resolveWorldCrossEdgeReference({
      primaryFrame: witnessFrame,
      referenceFrames,
      polygon: input.deckPolygon,
    }),
  };
}

function buildDeckDragEligibility(input: {
  deck: HouseModel['decks'][number];
  deckInteraction: HouseFirstPlanDeckInteraction | null;
}): HouseFirstPlanShapeOverlay['deckDragEligibility'] {
  const capability = resolveDeckInteractionCapability({
    deck: input.deck,
    dragInteractionAvailable: Boolean(input.deckInteraction),
  });
  return {
    eligible: capability.dragEligible,
    reason: capability.dragReason ?? '',
  };
}

function buildOpeningInteraction(input: {
  opening: HouseModel['openings'][number];
  openingFrame: GeometryOpeningFrame | null;
}): HouseFirstPlanOpeningInteraction | null {
  const frame = input.openingFrame;
  if (!frame) return null;
  const widthM = Number(input.opening.widthM);
  const offsetAlongWallM = Number(input.opening.offsetAlongWallM);
  if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) return null;

  return {
    kind: 'opening',
    hostEdgeId: frame.hostEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    hostSpanM: frame.hostSpanM,
    openingWidthM: widthM,
    offsetAlongWallM,
    minOffsetAlongWallM: 0,
    maxOffsetAlongWallM: Math.max(0, frame.hostSpanM - widthM),
  };
}

function buildOpeningDragEligibility(input: {
  opening: HouseModel['openings'][number];
  openingInteraction: HouseFirstPlanOpeningInteraction | null;
}): HouseFirstPlanShapeOverlay['openingDragEligibility'] {
  if (!input.openingInteraction) {
    return {
      eligible: false,
      reason: 'This opening needs a resolvable host wall before drag is available.',
    };
  }
  if (input.openingInteraction.openingWidthM > input.openingInteraction.hostSpanM + ZERO_DIMENSION_EPSILON_M) {
    return {
      eligible: false,
      reason: 'This opening is wider than the selected wall span, so drag is blocked until the width is reduced.',
    };
  }
  return {
    eligible: true,
    reason: 'Drag the selected opening along the host wall, or click dimensions to edit.',
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
  geometryHouseContext: ModulePlanHouseContext | null | undefined;
}): HouseFirstPlanOverlay | null {
  const house = input.house;
  if (!house) return null;
  if (!input.geometryHouseContext) return null;

  const moduleLengthM = Math.max(0.5, parseMetres(input.moduleLengthM, DEFAULT_MODULE_LENGTH_M));
  const moduleProjectionM = Math.max(0.5, parseMetres(input.moduleProjectionM, DEFAULT_MODULE_PROJECTION_M));
  const geometryHouseLookup = buildGeometryHouseLookup(input.geometryHouseContext);
  if (!geometryHouseLookup.footprintPolygon?.length) return null;
  const canonicalHousePolygon = resolveCanonicalHouseLocalPolygon({
    house,
    moduleLengthM,
    moduleProjectionM,
  });
  const houseLocalPolygon = canonicalHousePolygon.localPolygon;
  const footprintPolygon = geometryHouseLookup.footprintPolygon;
  const footprintOffsetActive =
    Math.abs(parseMetres(house.footprint.params.offsetXM, 0)) > ZERO_DIMENSION_EPSILON_M ||
    Math.abs(parseMetres(house.footprint.params.setbackM, 0)) > ZERO_DIMENSION_EPSILON_M;
  const shapes: HouseFirstPlanShapeOverlay[] = [
    {
      ownerKind: 'footprint',
      ownerId: house.id,
      polygon: footprintPolygon,
      detailSegments: [],
      selected: input.selection.kind === 'footprint',
      custom: house.footprint.mode === 'custom_polygon',
      muted: input.selection.kind === 'deck',
      invalid: false,
      invalidMessage: null,
      deckInteraction: null,
      openingInteraction: null,
      deckDragEligibility: null,
      openingDragEligibility: null,
    },
  ];

  for (const deck of house.decks) {
    const localPolygon = parseLocalPolygon(deck.outline);
    const draftDeckPolygon = buildDeckWorldPolygon({
      localPolygon,
      attachmentSide: house.footprint.attachmentSide,
      moduleLengthM,
      moduleProjectionM,
    });
    const geometryDeckPolygon = geometryHouseLookup.deckPolygons.get(deck.id) ?? [];
    const fallbackDeckPolygon = draftDeckPolygon.length ? draftDeckPolygon : geometryDeckPolygon;
    const isAttachedPresetDeck = deck.shape === 'preset' && deck.isAttached;
    const renderedDeckSurfacePolygon = isAttachedPresetDeck && geometryDeckPolygon.length ? geometryDeckPolygon : null;
    const draftDeckReferenceFrames = buildDeckDraftReferenceFrames({
      house,
      houseLocalPolygon,
      moduleLengthM,
      moduleProjectionM,
    });
    const geometryDeckReferenceFrames = resolveGeometryDeckReferenceFrames(geometryHouseLookup);
    const renderDeckReferenceFrames = geometryDeckReferenceFrames.length ? geometryDeckReferenceFrames : draftDeckReferenceFrames;
    const presetDeckPolygon = renderedDeckSurfacePolygon
      ? null
      : buildPresetAttachedDeckWorldPolygon({
          deck,
          referenceFrames: renderDeckReferenceFrames,
          commitReferenceFrames: draftDeckReferenceFrames,
          fallbackPolygon: fallbackDeckPolygon,
          geometryHouseLookup,
        });
    const deckPolygon =
      renderedDeckSurfacePolygon ??
      (isAttachedPresetDeck && !footprintOffsetActive
        ? (presetDeckPolygon ?? (draftDeckPolygon.length ? draftDeckPolygon : geometryDeckPolygon))
        : draftDeckPolygon.length
          ? draftDeckPolygon
          : (presetDeckPolygon ?? geometryDeckPolygon));
    const selected = input.selection.kind === 'deck' && input.selection.targetId === deck.id;
    const deckInteraction =
      deck.shape === 'custom'
        ? buildCustomDeckInteraction({
            house,
            houseLocalPolygon,
            deck,
            moduleLengthM,
            moduleProjectionM,
            deckPolygon,
            geometryHouseLookup,
          })
        : buildPresetDeckInteraction({
            house,
            houseLocalPolygon,
            deck,
            moduleLengthM,
            moduleProjectionM,
            deckPolygon,
            geometryHouseLookup,
          });
    shapes.push({
      ownerKind: 'deck',
      ownerId: deck.id,
      polygon: deckPolygon,
      detailSegments: [],
      selected,
      custom: deck.shape === 'custom',
      muted: house.decks.length > 1 && !selected,
      invalid: deck.validation.status === 'invalid',
      invalidMessage: deck.validation.message,
      deckInteraction,
      openingInteraction: null,
      deckDragEligibility: buildDeckDragEligibility({
        deck,
        deckInteraction,
      }),
      openingDragEligibility: null,
    });
  }

  for (const opening of house.openings) {
    const selected = input.selection.kind === 'opening' && input.selection.targetId === opening.id;
    const resolvedOpeningHostEdgeId = opening.hostWallId
      ? resolveOpeningHostEdgeIdFromDerivedWall({
          house,
          opening,
        })
      : resolveOpeningHostEdgeIdFromCompatibility({
          opening,
          houseLocalPolygon,
        });
    const openingFrame = resolveOpeningFrameFromGeometry({
      resolvedHostEdgeId: resolvedOpeningHostEdgeId,
      opening,
      geometryHouseLookup,
      allowLegacyFallback: opening.hostWallId === null,
    });
    const widthM = Number(opening.widthM);
    const offsetAlongWallM = Number(opening.offsetAlongWallM);
    const openingPolygon =
      openingFrame && Number.isFinite(widthM) && Number.isFinite(offsetAlongWallM)
        ? buildOpeningPolygonFromGeometryFrame({
            frame: openingFrame,
            widthM,
            offsetAlongWallM,
          })
        : [];
    const detailSegments =
      opening.kind === 'slider' &&
      openingFrame &&
      Number.isFinite(widthM) &&
      Number.isFinite(offsetAlongWallM)
        ? buildSliderDetailSegments({
            frame: openingFrame,
            widthM,
            offsetAlongWallM,
            panelCount: opening.panelCount,
          })
        : [];
    const openingInteraction = selected
      ? buildOpeningInteraction({
          opening,
          openingFrame,
        })
      : null;
    shapes.push({
      ownerKind: 'opening',
      ownerId: opening.id,
      polygon: openingPolygon,
      detailSegments,
      selected,
      custom: false,
      muted: house.openings.length > 1 && !selected,
      invalid: opening.validation.status === 'invalid',
      invalidMessage: opening.validation.message,
      deckInteraction: null,
      openingInteraction,
      deckDragEligibility: null,
      openingDragEligibility: buildOpeningDragEligibility({
        opening,
        openingInteraction,
      }),
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
          polygon: footprintPolygon,
          localPolygon: houseLocalPolygon,
        }),
      );
    } else {
      presetAnnotations.push(
        ...buildHousePresetAnnotations({
          house,
          housePolygon: footprintPolygon,
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
        presetAnnotations.push(
          ...buildCustomDeckRelationshipAnnotations({
            deck,
            deckPolygon: shape.polygon,
            deckInteraction: shape.deckInteraction,
          }),
        );
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
    const resolvedOpeningHostEdgeId =
      opening && opening.hostWallId
        ? resolveOpeningHostEdgeIdFromDerivedWall({
            house,
            opening,
          })
        : opening
          ? resolveOpeningHostEdgeIdFromCompatibility({
              opening,
              houseLocalPolygon,
            })
          : null;
    const openingFrame = opening
      ? resolveOpeningFrameFromGeometry({
          resolvedHostEdgeId: resolvedOpeningHostEdgeId,
          opening,
          geometryHouseLookup,
          allowLegacyFallback: opening.hostWallId === null,
        })
      : null;
    if (opening && shape && openingFrame) {
      presetAnnotations.push(
        ...buildOpeningPresetAnnotations({
          opening,
          openingPolygon: shape.polygon,
          openingFrame,
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
