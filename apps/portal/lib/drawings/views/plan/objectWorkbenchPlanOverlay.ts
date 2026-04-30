import {
  buildCustomHouseFootprintPolygon,
  type Assembly3D,
  type GeometryPlanViewModel,
} from '@sp/geometry';
import type {
  CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import type {
  DeckObjectModel,
  HouseAssemblyModel,
  HouseFormModel,
  OpeningObjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchStatusFacade } from '@/lib/drawings/state/objectWorkbenchStatusModel';
import type {
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';

type AttachmentSide = 'rear' | 'front' | 'left' | 'right';
type DeckAttachmentMode = 'floating' | 'single_edge' | 'corner_dual_edge';
type OverlayRenderSource = 'geometry' | 'geometry_derived';

export type PlanPoint = {
  x: number;
  y: number;
};

export type PlanSegment = {
  start: PlanPoint;
  end: PlanPoint;
};

type LocalPoint = {
  alongM: number;
  depthM: number;
};

type GeometryPlanSurface = NonNullable<GeometryPlanViewModel['house']['surfaces']>[number];
type GeometryPlanLine = NonNullable<GeometryPlanViewModel['house']['lines']>[number];

export type ObjectWorkbenchPlanHousePolygonSource =
  | 'custom_saved'
  | 'preset_derived'
  | 'geometry_projection';

export type ObjectWorkbenchPlanDeckReferenceFrame = {
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

export type ObjectWorkbenchPlanDeckCrossEdgeReference = {
  hostEdgeId: AttachmentSide;
  gapM: number;
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
};

export type ObjectWorkbenchPlanDeckInteraction = {
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
  referenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[];
  commitReferenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[];
  crossEdgeReference: ObjectWorkbenchPlanDeckCrossEdgeReference | null;
};

export type ObjectWorkbenchPlanOpeningInteraction = {
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

export type ObjectWorkbenchPlanShapeOverlay = {
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  polygon: PlanPoint[];
  detailSegments: PlanSegment[];
  selected: boolean;
  custom: boolean;
  muted: boolean;
  invalid: boolean;
  invalidMessage: string | null;
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
  openingInteraction: ObjectWorkbenchPlanOpeningInteraction | null;
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
  source: OverlayRenderSource;
  geometrySourceId: string | null;
  renderStatus: WorkbenchPergolaRenderStatus;
};

export type ObjectWorkbenchPlanPresetDimensionAnnotation = {
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
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
};

export type ObjectWorkbenchPlanCustomEdgeCandidate = {
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

export type ObjectWorkbenchPlanOverlay = {
  housePolygonSource: ObjectWorkbenchPlanHousePolygonSource;
  shapes: ObjectWorkbenchPlanShapeOverlay[];
  presetAnnotations: ObjectWorkbenchPlanPresetDimensionAnnotation[];
  customEdgeCandidates: ObjectWorkbenchPlanCustomEdgeCandidate[];
};

export type ObjectWorkbenchPlanOverlaySelection = {
  kind: 'house' | 'footprint' | 'roof' | 'deck' | 'opening' | 'attachment_zone';
  targetId: string | null;
};

export type ObjectWorkbenchPlanOverlayInput = {
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  decks: DeckObjectModel[];
  openings: OpeningObjectModel[];
  selection: ObjectWorkbenchPlanOverlaySelection;
  geometryPlan: GeometryPlanViewModel | null | undefined;
  geometryAssembly?: Assembly3D | null | undefined;
  geometryRenderSource?: WorkbenchPergolaRenderSource;
  geometryRenderStatus?: WorkbenchPergolaRenderStatus;
  moduleLengthM?: string | null;
  moduleProjectionM?: string | null;
  status: ObjectWorkbenchStatusFacade;
};

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

type GeometryPlanLookup = {
  footprint: {
    id: string;
    polygon: PlanPoint[];
  } | null;
  deckSurfaces: Map<string, { id: string; polygon: PlanPoint[] }>;
  referenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[];
  openingFrames: Map<string, GeometryOpeningFrame>;
};

const ZERO_DIMENSION_EPSILON_M = 1e-6;
const ZERO_DIMENSION_LABEL_LENGTH_M = 0.18;
const EDGE_LABEL_OFFSET_M = 0.9;
const EDGE_NORMAL_PROBE_M = 0.12;
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

function parseMetres(value: string | number | null | undefined, fallback = 0): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function metadataString(
  metadata: GeometryPlanSurface['metadata'] | GeometryPlanLine['metadata'],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isAttachmentSide(value: string | null | undefined): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function normalizeSourceId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pointToMetres(point: { x: number; y: number }): PlanPoint {
  return {
    x: Number((point.x / 1000).toFixed(6)),
    y: Number((point.y / 1000).toFixed(6)),
  };
}

function lineToMetres(line: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  return {
    start: pointToMetres(line.start),
    end: pointToMetres(line.end),
  };
}

function polygonToMetres(polygon: Array<{ x: number; y: number }>): PlanPoint[] {
  return polygon.map(pointToMetres);
}

function parseLocalPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined,
): LocalPoint[] {
  return (polygon ?? [])
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

function polygonCenter(polygon: readonly PlanPoint[]): PlanPoint {
  if (!polygon.length) return { x: 0, y: 0 };
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function pointInPolygon(point: PlanPoint, polygon: readonly PlanPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function midpoint(start: PlanPoint, end: PlanPoint): PlanPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function resolveOutwardUnit(input: {
  start: PlanPoint;
  end: PlanPoint;
  footprint: readonly PlanPoint[];
}): { x: number; y: number } {
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= ZERO_DIMENSION_EPSILON_M) return { x: 0, y: -1 };
  const normalA = { x: -dy / length, y: dx / length };
  const normalB = { x: -normalA.x, y: -normalA.y };
  const center = midpoint(input.start, input.end);
  const probeA = {
    x: center.x + normalA.x * EDGE_NORMAL_PROBE_M,
    y: center.y + normalA.y * EDGE_NORMAL_PROBE_M,
  };
  const probeB = {
    x: center.x + normalB.x * EDGE_NORMAL_PROBE_M,
    y: center.y + normalB.y * EDGE_NORMAL_PROBE_M,
  };
  if (pointInPolygon(probeA, input.footprint) && !pointInPolygon(probeB, input.footprint)) return normalB;
  if (!pointInPolygon(probeA, input.footprint) && pointInPolygon(probeB, input.footprint)) return normalA;
  return normalA;
}

function frameSideFromOutward(input: {
  horizontal: boolean;
  outward: { x: number; y: number };
}): AttachmentSide {
  if (input.horizontal) return input.outward.y < 0 ? 'rear' : 'front';
  return input.outward.x < 0 ? 'left' : 'right';
}

function buildGeometryLookup(geometryPlan: GeometryPlanViewModel): GeometryPlanLookup {
  const footprintSurface = (geometryPlan.house.surfaces ?? []).find((surface) => surface.kind === 'footprint') ?? null;
  const footprint = footprintSurface
    ? {
        id: footprintSurface.id,
        polygon: polygonToMetres(footprintSurface.boundary),
      }
    : null;
  const deckSurfaces = new Map<string, { id: string; polygon: PlanPoint[] }>();
  for (const surface of geometryPlan.house.surfaces ?? []) {
    if (surface.kind !== 'deck') continue;
    deckSurfaces.set(surface.id, {
      id: surface.id,
      polygon: polygonToMetres(surface.boundary),
    });
  }

  const referenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[] = [];
  const openingFrames = new Map<string, GeometryOpeningFrame>();
  if (footprint?.polygon.length) {
    for (const planLine of geometryPlan.house.lines ?? []) {
      if (planLine.kind !== 'wall_segment') continue;
      if (metadataString(planLine.metadata, 'houseWallMode') === 'open_gable_frame') continue;
      const sourceEdgeId = normalizeSourceId(metadataString(planLine.metadata, 'sourceEdgeId') ?? planLine.id);
      if (!sourceEdgeId) continue;
      const line = lineToMetres(planLine.line);
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const hostSpanM = Math.hypot(dx, dy);
      if (hostSpanM <= ZERO_DIMENSION_EPSILON_M) continue;
      const alongUnitX = dx / hostSpanM;
      const alongUnitY = dy / hostSpanM;
      const outward = resolveOutwardUnit({
        start: line.start,
        end: line.end,
        footprint: footprint.polygon,
      });
      const frame: GeometryOpeningFrame = {
        hostEdgeId: sourceEdgeId,
        hostEdgeStart: line.start,
        hostEdgeEnd: line.end,
        hostSpanM,
        alongUnitX,
        alongUnitY,
        outwardUnitX: outward.x,
        outwardUnitY: outward.y,
      };
      openingFrames.set(sourceEdgeId, frame);

      const horizontal = Math.abs(dy) <= ZERO_DIMENSION_EPSILON_M;
      const vertical = Math.abs(dx) <= ZERO_DIMENSION_EPSILON_M;
      if (!horizontal && !vertical) continue;
      const spanStartM = horizontal ? Math.min(line.start.x, line.end.x) : Math.min(line.start.y, line.end.y);
      const spanEndM = horizontal ? Math.max(line.start.x, line.end.x) : Math.max(line.start.y, line.end.y);
      const edgeCoordinateM = horizontal ? line.start.y : line.start.x;
      const frameAlongUnitX = horizontal ? 1 : 0;
      const frameAlongUnitY = horizontal ? 0 : 1;
      referenceFrames.push({
        hostEdgeId: frameSideFromOutward({ horizontal, outward }),
        sourceEdgeId,
        axis: horizontal ? 'along' : 'depth',
        spanStartM,
        spanEndM,
        edgeCoordinateM,
        outwardDirection: horizontal ? (outward.y < 0 ? -1 : 1) : (outward.x < 0 ? -1 : 1),
        hostEdgeStart: horizontal
          ? { x: spanStartM, y: line.start.y }
          : { x: line.start.x, y: spanStartM },
        hostEdgeEnd: horizontal
          ? { x: spanEndM, y: line.start.y }
          : { x: line.start.x, y: spanEndM },
        alongUnitX: frameAlongUnitX,
        alongUnitY: frameAlongUnitY,
        outwardUnitX: outward.x,
        outwardUnitY: outward.y,
      });
    }
  }

  return {
    footprint,
    deckSurfaces,
    referenceFrames,
    openingFrames,
  };
}

function findFrameByEdgeId(
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  const normalized = normalizeSourceId(edgeId);
  if (!normalized) return null;
  if (isAttachmentSide(normalized)) {
    return frames.find((frame) => frame.hostEdgeId === normalized) ?? null;
  }
  return frames.find((frame) => frame.sourceEdgeId === normalized) ?? null;
}

function pointOnFrame(
  frame: ObjectWorkbenchPlanDeckReferenceFrame,
  alongM: number,
  outwardM: number,
): PlanPoint {
  return {
    x: frame.hostEdgeStart.x + frame.alongUnitX * (alongM - frame.spanStartM) + frame.outwardUnitX * outwardM,
    y: frame.hostEdgeStart.y + frame.alongUnitY * (alongM - frame.spanStartM) + frame.outwardUnitY * outwardM,
  };
}

function projectPointToReferenceFrame(point: PlanPoint, frame: ObjectWorkbenchPlanDeckReferenceFrame) {
  const relative = {
    x: point.x - frame.hostEdgeStart.x,
    y: point.y - frame.hostEdgeStart.y,
  };
  return {
    alongM: relative.x * frame.alongUnitX + relative.y * frame.alongUnitY + frame.spanStartM,
    outwardM: relative.x * frame.outwardUnitX + relative.y * frame.outwardUnitY,
  };
}

function projectPolygonToReferenceFrame(input: {
  polygon: readonly PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}) {
  if (!input.polygon.length) return null;
  const projections = input.polygon.map((point) => projectPointToReferenceFrame(point, input.frame));
  const alongValues = projections.map((projection) => projection.alongM);
  const outwardValues = projections.map((projection) => projection.outwardM);
  const alongMinM = Math.min(...alongValues);
  const alongMaxM = Math.max(...alongValues);
  const outwardMinM = Math.min(...outwardValues);
  const outwardMaxM = Math.max(...outwardValues);
  return {
    alongMinM,
    alongMaxM,
    nearGapM: Math.max(0, outwardMinM),
    widthM: Math.max(0, alongMaxM - alongMinM),
    depthM: Math.max(0, outwardMaxM - outwardMinM),
    centerOffsetM: (alongMinM + alongMaxM) / 2 - (input.frame.spanStartM + input.frame.spanEndM) / 2,
  };
}

function scoreFrameForPolygon(input: {
  polygon: readonly PlanPoint[];
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
}) {
  const projection = projectPolygonToReferenceFrame(input);
  if (!projection) return Number.POSITIVE_INFINITY;
  const spanOverlapM =
    Math.min(projection.alongMaxM, input.frame.spanEndM) -
    Math.max(projection.alongMinM, input.frame.spanStartM);
  const overlapPenaltyM = spanOverlapM > 0 ? 0 : Math.abs(spanOverlapM);
  return projection.nearGapM + overlapPenaltyM * 2;
}

function findFrameForPolygon(
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[],
  polygon: readonly PlanPoint[],
  requestedEdgeId?: string | null,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  return (
    findFrameByEdgeId(frames, requestedEdgeId) ??
    [...frames].sort(
      (left, right) =>
        scoreFrameForPolygon({ polygon, frame: left }) -
        scoreFrameForPolygon({ polygon, frame: right }),
    )[0] ??
    null
  );
}

function buildRectPolygonOnFrame(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  widthM: number;
  depthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
}): PlanPoint[] {
  const frameMidM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = frameMidM + input.centerOffsetM;
  const startAlongM = centerAlongM - input.widthM / 2;
  const endAlongM = centerAlongM + input.widthM / 2;
  const near = input.referenceEdgeGapM;
  const far = input.referenceEdgeGapM + input.depthM;
  return [
    pointOnFrame(input.frame, startAlongM, near),
    pointOnFrame(input.frame, endAlongM, near),
    pointOnFrame(input.frame, endAlongM, far),
    pointOnFrame(input.frame, startAlongM, far),
  ];
}

function resolveDeckPolygon(input: {
  deck: DeckObjectModel;
  lookup: GeometryPlanLookup;
}): {
  polygon: PlanPoint[];
  geometrySourceId: string | null;
  source: OverlayRenderSource;
} | null {
  const geometryDeckSurface = input.lookup.deckSurfaces.get(input.deck.id) ?? null;
  if (geometryDeckSurface?.polygon.length) {
    return {
      polygon: geometryDeckSurface.polygon,
      geometrySourceId: geometryDeckSurface.id,
      source: 'geometry',
    };
  }

  if (input.deck.floatingRect) {
    const centerAlongM = parseMetres(input.deck.floatingRect.centerAlongM, Number.NaN);
    const centerDepthM = parseMetres(input.deck.floatingRect.centerDepthM, Number.NaN);
    const widthM = parseMetres(input.deck.floatingRect.widthM, Number.NaN);
    const depthM = parseMetres(input.deck.floatingRect.depthM, Number.NaN);
    if (
      Number.isFinite(centerAlongM) &&
      Number.isFinite(centerDepthM) &&
      Number.isFinite(widthM) &&
      Number.isFinite(depthM) &&
      widthM > 0 &&
      depthM > 0
    ) {
      const halfWidthM = widthM / 2;
      const halfDepthM = depthM / 2;
      return {
        polygon: [
          { x: centerAlongM - halfWidthM, y: centerDepthM - halfDepthM },
          { x: centerAlongM + halfWidthM, y: centerDepthM - halfDepthM },
          { x: centerAlongM + halfWidthM, y: centerDepthM + halfDepthM },
          { x: centerAlongM - halfWidthM, y: centerDepthM + halfDepthM },
        ],
        geometrySourceId: input.deck.id,
        source: 'geometry_derived',
      };
    }
  }

  if (!input.deck.presetRect) return null;
  const widthM = parseMetres(input.deck.presetRect.widthM, Number.NaN);
  const depthM = parseMetres(input.deck.presetRect.depthM, Number.NaN);
  const centerOffsetM = parseMetres(input.deck.presetRect.centerOffsetM, 0);
  if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) return null;
  const requestedEdgeId =
    input.deck.primaryHostEdgeId ??
    input.deck.hostEdgeId ??
    null;
  const frame = findFrameByEdgeId(input.lookup.referenceFrames, requestedEdgeId) ?? input.lookup.referenceFrames[0] ?? null;
  if (!frame) return null;
  const gapM = input.deck.isAttached ? 0 : parseMetres(input.deck.presetRect.detachedGapM, 0);
  return {
    polygon: buildRectPolygonOnFrame({
      frame,
      widthM,
      depthM,
      centerOffsetM,
      referenceEdgeGapM: Math.max(0, gapM),
    }),
    geometrySourceId: frame.sourceEdgeId,
    source: 'geometry_derived',
  };
}

function geometryOpeningFrameFromDeckFrame(frame: ObjectWorkbenchPlanDeckReferenceFrame): GeometryOpeningFrame {
  return {
    hostEdgeId: frame.sourceEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    hostSpanM: frame.spanEndM - frame.spanStartM,
    alongUnitX: frame.alongUnitX,
    alongUnitY: frame.alongUnitY,
    outwardUnitX: frame.outwardUnitX,
    outwardUnitY: frame.outwardUnitY,
  };
}

function findOpeningFrame(
  lookup: GeometryPlanLookup,
  hostEdgeId: string | null | undefined,
): GeometryOpeningFrame | null {
  if (!hostEdgeId) return null;
  const openingFrame = lookup.openingFrames.get(hostEdgeId);
  if (openingFrame) return openingFrame;
  const referenceFrame = findFrameByEdgeId(lookup.referenceFrames, hostEdgeId);
  return referenceFrame ? geometryOpeningFrameFromDeckFrame(referenceFrame) : null;
}

function buildDeckInteraction(input: {
  deck: DeckObjectModel;
  polygon: PlanPoint[];
  lookup: GeometryPlanLookup;
  houseAttachmentSide: AttachmentSide;
}): ObjectWorkbenchPlanDeckInteraction | null {
  if (input.polygon.length < 3 || !input.lookup.referenceFrames.length) return null;
  const placementFrame = input.deck.isAttached
    ? findFrameForPolygon(
        input.lookup.referenceFrames,
        input.polygon,
        input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId,
      )
    : null;
  const witnessFrame =
    findFrameForPolygon(
      input.lookup.referenceFrames,
      input.polygon,
      input.deck.isAttached
        ? input.deck.primaryHostEdgeId ?? input.deck.hostEdgeId
        : input.deck.hostEdgeId ?? input.deck.primaryHostEdgeId,
    ) ?? placementFrame;
  const interactionFrame = placementFrame ?? witnessFrame;
  if (!interactionFrame || !witnessFrame) return null;

  const projection = projectPolygonToReferenceFrame({
    polygon: input.polygon,
    frame: witnessFrame,
  });
  if (!projection) return null;

  const presetWidthM = parseMetres(input.deck.presetRect?.widthM, projection.widthM);
  const presetDepthM = parseMetres(input.deck.presetRect?.depthM, projection.depthM);
  const useCommittedPresetDimensions = input.deck.shape === 'preset' && !input.deck.isAttached;
  const deckWidthM = Math.max(
    ZERO_DIMENSION_EPSILON_M,
    useCommittedPresetDimensions ? presetWidthM || projection.widthM : projection.widthM,
  );
  const deckDepthM = Math.max(
    ZERO_DIMENSION_EPSILON_M,
    useCommittedPresetDimensions ? presetDepthM || projection.depthM : projection.depthM,
  );
  const hostSpanM = Math.max(0, interactionFrame.spanEndM - interactionFrame.spanStartM);
  const availableHalfSpanM = deckWidthM <= hostSpanM ? Math.max(0, (hostSpanM - deckWidthM) / 2) : 0;
  const attachmentMode: DeckAttachmentMode =
    input.deck.attachmentMode ??
    (input.deck.secondaryHostEdgeId && input.deck.cornerVertexId
      ? 'corner_dual_edge'
      : input.deck.isAttached && input.deck.shape !== 'custom'
        ? 'single_edge'
        : 'floating');
  const placement = input.deck.isAttached && input.deck.shape !== 'custom' ? 'snapped' : 'floating';

  return {
    kind: input.deck.shape === 'custom' ? 'custom_outline' : 'preset_rect',
    placement,
    attachmentMode,
    houseAttachmentSide: input.houseAttachmentSide,
    semanticPlacementSide: placementFrame?.hostEdgeId ?? null,
    semanticWitnessSide: witnessFrame.hostEdgeId,
    placementEdgeId: placementFrame?.sourceEdgeId ?? null,
    primaryHostEdgeId: placementFrame?.sourceEdgeId ?? input.deck.primaryHostEdgeId ?? null,
    secondaryHostEdgeId: input.deck.secondaryHostEdgeId ?? null,
    cornerVertexId: input.deck.cornerVertexId ?? null,
    witnessEdgeId: witnessFrame.sourceEdgeId,
    hostEdgeStart: interactionFrame.hostEdgeStart,
    hostEdgeEnd: interactionFrame.hostEdgeEnd,
    hostSpanM,
    deckWidthM,
    deckDepthM,
    centerOffsetM: placement === 'snapped'
      ? parseMetres(input.deck.presetRect?.centerOffsetM, projection.centerOffsetM)
      : projection.centerOffsetM,
    referenceEdgeGapM: placement === 'snapped' ? 0 : projection.nearGapM,
    minCenterOffsetM: placement === 'snapped' ? Number.NEGATIVE_INFINITY : -availableHalfSpanM,
    maxCenterOffsetM: placement === 'snapped' ? Number.POSITIVE_INFINITY : availableHalfSpanM,
    renderedCenter: polygonCenter(input.polygon),
    referenceFrames: [...input.lookup.referenceFrames],
    commitReferenceFrames: [...input.lookup.referenceFrames],
    crossEdgeReference: null,
  };
}

function buildDeckDragEligibility(input: {
  deck: DeckObjectModel;
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
}): ObjectWorkbenchPlanShapeOverlay['deckDragEligibility'] {
  if (!input.deckInteraction) {
    return {
      eligible: false,
      reason: input.deck.shape === 'custom'
        ? 'This custom deck needs a resolvable house reference edge before translation and relationship dims are available.'
        : 'This preset deck needs a resolvable house reference edge before drag and relationship dims are available.',
    };
  }
  return {
    eligible: true,
    reason: input.deck.shape === 'custom'
      ? 'Drag the selected custom deck body to translate it relative to the house, or click relationship dimensions and outline edges to edit.'
      : 'Drag the selected deck body to move it freely. Release near a house edge to snap it back, or click dimensions to edit.',
  };
}

function createOffsetDimensionGeometry(input: {
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: readonly PlanPoint[];
  offsetM?: number;
}) {
  const dx = input.segmentEnd.x - input.segmentStart.x;
  const dy = input.segmentEnd.y - input.segmentStart.y;
  const length = Math.hypot(dx, dy);
  if (length <= ZERO_DIMENSION_EPSILON_M) {
    return {
      witnessStart: input.segmentStart,
      witnessEnd: input.segmentEnd,
      lineStart: {
        x: input.segmentStart.x,
        y: input.segmentStart.y - EDGE_LABEL_OFFSET_M,
      },
      lineEnd: {
        x: input.segmentStart.x + ZERO_DIMENSION_LABEL_LENGTH_M,
        y: input.segmentStart.y - EDGE_LABEL_OFFSET_M,
      },
    };
  }
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

function makeAnnotation(input: {
  id: string;
  targetKind: ObjectWorkbenchPlanPresetDimensionAnnotation['targetKind'];
  emphasis: ObjectWorkbenchPlanPresetDimensionAnnotation['emphasis'];
  ownerKind: ObjectWorkbenchPlanPresetDimensionAnnotation['ownerKind'];
  ownerId: string;
  fieldKey: string;
  rawValue: string;
  displayValue: string;
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: readonly PlanPoint[];
  deckInteraction?: ObjectWorkbenchPlanDeckInteraction | null;
}): ObjectWorkbenchPlanPresetDimensionAnnotation | null {
  const dimension = createOffsetDimensionGeometry({
    segmentStart: input.segmentStart,
    segmentEnd: input.segmentEnd,
    polygon: input.polygon,
  });
  if (!dimension) return null;
  return {
    id: input.id,
    targetKind: input.targetKind,
    emphasis: input.emphasis,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    fieldKey: input.fieldKey,
    rawValue: input.rawValue,
    displayValue: input.displayValue,
    witnessStart: dimension.witnessStart,
    witnessEnd: dimension.witnessEnd,
    lineStart: dimension.lineStart,
    lineEnd: dimension.lineEnd,
    deckInteraction: input.deckInteraction ?? null,
  };
}

function buildDeckAnnotations(input: {
  deck: DeckObjectModel;
  polygon: PlanPoint[];
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
}): ObjectWorkbenchPlanPresetDimensionAnnotation[] {
  const annotations: Array<ObjectWorkbenchPlanPresetDimensionAnnotation | null> = [];
  if (input.polygon.length < 3) return [];
  const [first, second, third] = input.polygon;
  if (!first || !second || !third) return [];
  if (input.deck.presetRect) {
    const widthM = parseMetres(input.deck.presetRect.widthM, 0);
    const depthM = parseMetres(input.deck.presetRect.depthM, 0);
    annotations.push(
      makeAnnotation({
        id: `${input.deck.id}:widthM`,
        targetKind: 'deck_preset_param',
        emphasis: 'driving',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'widthM',
        rawValue: input.deck.presetRect.widthM,
        displayValue: formatDisplayMetres(widthM),
        segmentStart: first,
        segmentEnd: second,
        polygon: input.polygon,
        deckInteraction: input.deckInteraction,
      }),
      makeAnnotation({
        id: `${input.deck.id}:depthM`,
        targetKind: 'deck_preset_param',
        emphasis: 'driving',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'depthM',
        rawValue: input.deck.presetRect.depthM,
        displayValue: formatDisplayMetres(depthM),
        segmentStart: second,
        segmentEnd: third,
        polygon: input.polygon,
        deckInteraction: input.deckInteraction,
      }),
    );
  }

  const interaction = input.deckInteraction;
  if (!interaction) return annotations.filter((annotation): annotation is ObjectWorkbenchPlanPresetDimensionAnnotation => Boolean(annotation));
  const frame = findFrameByEdgeId(
    interaction.referenceFrames,
    interaction.placement === 'snapped'
      ? interaction.primaryHostEdgeId ?? interaction.placementEdgeId
      : interaction.witnessEdgeId,
  );
  const projection = frame
    ? projectPolygonToReferenceFrame({
        polygon: input.polygon,
        frame,
      })
    : null;
  if (!frame || !projection) return annotations.filter((annotation): annotation is ObjectWorkbenchPlanPresetDimensionAnnotation => Boolean(annotation));

  if (interaction.placement === 'snapped') {
    const hostStartGapM = Math.max(0, projection.alongMinM - frame.spanStartM);
    const hostEndGapM = Math.max(0, frame.spanEndM - projection.alongMaxM);
    annotations.push(
      makeAnnotation({
        id: `${input.deck.id}:hostStartGapM`,
        targetKind: 'deck_host_edge_reference',
        emphasis: 'relationship',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'hostStartGapM',
        rawValue: formatRawMetres(hostStartGapM),
        displayValue: formatDisplayMetres(hostStartGapM),
        segmentStart: pointOnFrame(frame, frame.spanStartM, 0),
        segmentEnd: pointOnFrame(frame, projection.alongMinM, 0),
        polygon: input.polygon,
        deckInteraction: interaction,
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
        segmentStart: pointOnFrame(frame, projection.alongMaxM, 0),
        segmentEnd: pointOnFrame(frame, frame.spanEndM, 0),
        polygon: input.polygon,
        deckInteraction: interaction,
      }),
    );
  } else {
    const centerAlongM = (projection.alongMinM + projection.alongMaxM) / 2;
    annotations.push(
      makeAnnotation({
        id: `${input.deck.id}:crossEdgeGapM`,
        targetKind: 'deck_host_edge_reference',
        emphasis: 'relationship',
        ownerKind: 'deck',
        ownerId: input.deck.id,
        fieldKey: 'crossEdgeGapM',
        rawValue: formatRawMetres(interaction.referenceEdgeGapM),
        displayValue: formatDisplayMetres(interaction.referenceEdgeGapM),
        segmentStart: pointOnFrame(frame, centerAlongM, 0),
        segmentEnd: pointOnFrame(frame, centerAlongM, interaction.referenceEdgeGapM),
        polygon: input.polygon,
        deckInteraction: interaction,
      }),
    );
  }

  return annotations.filter((annotation): annotation is ObjectWorkbenchPlanPresetDimensionAnnotation => Boolean(annotation));
}

function findOpeningHostEdgeId(input: {
  opening: OpeningObjectModel;
  houseAssembly: HouseAssemblyModel | null;
}): string | null {
  if (input.opening.hostEdgeId) return input.opening.hostEdgeId;
  const envelope = input.houseAssembly?.derivedEnvelope ?? null;
  if (!envelope || !input.opening.hostWallId) return null;
  const wall = envelope.wallGraph.walls.find((candidate) => candidate.id === input.opening.hostWallId) ?? null;
  return wall?.edgeIds[0] ?? null;
}

function resolveOpeningFrameForOverlay(input: {
  opening: OpeningObjectModel;
  houseAssembly: HouseAssemblyModel | null;
  lookup: GeometryPlanLookup;
}): {
  frame: GeometryOpeningFrame;
  exact: boolean;
} | null {
  const hostEdgeId = findOpeningHostEdgeId({
    opening: input.opening,
    houseAssembly: input.houseAssembly,
  });
  const exactOpeningFrame = findOpeningFrame(input.lookup, hostEdgeId);
  if (exactOpeningFrame) {
    return {
      frame: exactOpeningFrame,
      exact: true,
    };
  }
  const fallbackReferenceFrame = input.opening.wallId
    ? input.lookup.referenceFrames.find((candidate) => candidate.hostEdgeId === input.opening.wallId) ?? null
    : null;
  const fallbackFrame = fallbackReferenceFrame ? geometryOpeningFrameFromDeckFrame(fallbackReferenceFrame) : null;
  return fallbackFrame
    ? {
        frame: fallbackFrame,
        exact: false,
      }
    : null;
}

function buildOpeningPolygonFromFrame(input: {
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
  if (panelCount <= 1) return [];
  return Array.from({ length: panelCount - 1 }, (_, index) => {
    const alongM = input.offsetAlongWallM + (input.widthM * (index + 1)) / panelCount;
    const wallPoint = {
      x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * alongM,
      y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * alongM,
    };
    return {
      start: wallPoint,
      end: {
        x: wallPoint.x - input.frame.outwardUnitX * OPENING_PLAN_THICKNESS_M,
        y: wallPoint.y - input.frame.outwardUnitY * OPENING_PLAN_THICKNESS_M,
      },
    };
  });
}

function buildOpeningInteraction(input: {
  opening: OpeningObjectModel;
  frame: GeometryOpeningFrame | null;
}): ObjectWorkbenchPlanOpeningInteraction | null {
  if (!input.frame) return null;
  const widthM = parseMetres(input.opening.widthM, Number.NaN);
  const offsetAlongWallM = parseMetres(input.opening.offsetAlongWallM, Number.NaN);
  if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) return null;
  return {
    kind: 'opening',
    hostEdgeId: input.frame.hostEdgeId,
    hostEdgeStart: input.frame.hostEdgeStart,
    hostEdgeEnd: input.frame.hostEdgeEnd,
    hostSpanM: input.frame.hostSpanM,
    openingWidthM: widthM,
    offsetAlongWallM,
    minOffsetAlongWallM: 0,
    maxOffsetAlongWallM: Math.max(0, input.frame.hostSpanM - widthM),
  };
}

function buildOpeningAnnotations(input: {
  opening: OpeningObjectModel;
  polygon: PlanPoint[];
  frame: GeometryOpeningFrame;
}): ObjectWorkbenchPlanPresetDimensionAnnotation[] {
  const widthM = parseMetres(input.opening.widthM, Number.NaN);
  const offsetAlongWallM = parseMetres(input.opening.offsetAlongWallM, Number.NaN);
  if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) return [];
  const openingStart = {
    x: input.frame.hostEdgeStart.x + input.frame.alongUnitX * offsetAlongWallM,
    y: input.frame.hostEdgeStart.y + input.frame.alongUnitY * offsetAlongWallM,
  };
  const openingEnd = {
    x: openingStart.x + input.frame.alongUnitX * widthM,
    y: openingStart.y + input.frame.alongUnitY * widthM,
  };
  const offsetStart = input.frame.hostEdgeStart;
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
      polygon: input.polygon,
    }),
    makeAnnotation({
      id: `${input.opening.id}:offsetAlongWallM`,
      targetKind: 'opening_param',
      emphasis: 'relationship',
      ownerKind: 'opening',
      ownerId: input.opening.id,
      fieldKey: 'offsetAlongWallM',
      rawValue: input.opening.offsetAlongWallM,
      displayValue: formatDisplayMetres(offsetAlongWallM),
      segmentStart: offsetStart,
      segmentEnd: openingStart,
      polygon: input.polygon,
    }),
  ].filter((annotation): annotation is ObjectWorkbenchPlanPresetDimensionAnnotation => Boolean(annotation));
}

function buildFootprintAnnotations(input: {
  houseForm: HouseFormModel;
  polygon: PlanPoint[];
}): ObjectWorkbenchPlanPresetDimensionAnnotation[] {
  if (input.polygon.length < 2) return [];
  const widthM = parseMetres(input.houseForm.footprint.params.widthM, Number.NaN);
  if (!Number.isFinite(widthM) || widthM <= 0) return [];
  return [
    makeAnnotation({
      id: `${input.houseForm.id}:widthM`,
      targetKind: 'house_preset_param',
      emphasis: 'driving',
      ownerKind: 'footprint',
      ownerId: input.houseForm.id,
      fieldKey: 'widthM',
      rawValue: input.houseForm.footprint.params.widthM,
      displayValue: formatDisplayMetres(widthM),
      segmentStart: input.polygon[0]!,
      segmentEnd: input.polygon[1]!,
      polygon: input.polygon,
    }),
  ].filter((annotation): annotation is ObjectWorkbenchPlanPresetDimensionAnnotation => Boolean(annotation));
}

function makeCustomEdgeCandidate(input: {
  id: string;
  targetKind: ObjectWorkbenchPlanCustomEdgeCandidate['targetKind'];
  ownerKind: ObjectWorkbenchPlanCustomEdgeCandidate['ownerKind'];
  ownerId: string;
  edgeIndex: number;
  segmentStart: PlanPoint;
  segmentEnd: PlanPoint;
  polygon: readonly PlanPoint[];
  lengthM: number;
  localPolygon: CalculatorHouseFootprintPolygonPoint[];
}): ObjectWorkbenchPlanCustomEdgeCandidate | null {
  const dimension = createOffsetDimensionGeometry({
    segmentStart: input.segmentStart,
    segmentEnd: input.segmentEnd,
    polygon: input.polygon,
  });
  if (!dimension) return null;
  return {
    id: input.id,
    targetKind: input.targetKind,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    edgeIndex: input.edgeIndex,
    rawValue: formatRawMetres(input.lengthM),
    displayValue: formatDisplayMetres(input.lengthM),
    localPolygon: input.localPolygon,
    witnessStart: dimension.witnessStart,
    witnessEnd: dimension.witnessEnd,
    lineStart: dimension.lineStart,
    lineEnd: dimension.lineEnd,
  };
}

function buildCustomEdgeCandidates(input: {
  ownerKind: 'footprint' | 'deck';
  ownerId: string;
  polygon: PlanPoint[];
  localPolygon: LocalPoint[];
}): ObjectWorkbenchPlanCustomEdgeCandidate[] {
  if (input.localPolygon.length !== input.polygon.length) return [];
  return input.polygon
    .map((start, index) => {
      const end = input.polygon[(index + 1) % input.polygon.length]!;
      const localStart = input.localPolygon[index]!;
      const localEnd = input.localPolygon[(index + 1) % input.localPolygon.length]!;
      const lengthM = Math.hypot(localEnd.alongM - localStart.alongM, localEnd.depthM - localStart.depthM);
      return makeCustomEdgeCandidate({
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
    })
    .filter((candidate): candidate is ObjectWorkbenchPlanCustomEdgeCandidate => Boolean(candidate));
}

export function resizeObjectWorkbenchCustomPolygonEdge(input: {
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
  if (currentLength <= ZERO_DIMENSION_EPSILON_M) return null;
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
  return validation.ok ? serializedPolygon : null;
}

export function buildObjectWorkbenchPlanOverlay(input: ObjectWorkbenchPlanOverlayInput): ObjectWorkbenchPlanOverlay | null {
  if (input.geometryRenderSource && input.geometryRenderSource !== 'geometry') return null;
  if (input.geometryRenderStatus && input.geometryRenderStatus !== 'geometry_ready') return null;
  const geometryPlan = input.geometryPlan;
  if (!geometryPlan) return null;

  const lookup = buildGeometryLookup(geometryPlan);
  const footprint = lookup.footprint;
  if (!footprint?.polygon.length) return null;
  const houseForm = input.houseForm ?? input.houseAssembly?.houseForms[0] ?? null;
  const houseAttachmentSide = houseForm?.footprint.attachmentSide ?? 'rear';
  const shapes: ObjectWorkbenchPlanShapeOverlay[] = [
    {
      ownerKind: 'footprint',
      ownerId: houseForm?.id ?? footprint.id,
      polygon: footprint.polygon,
      detailSegments: [],
      selected: input.selection.kind === 'footprint',
      custom: houseForm?.footprint.mode === 'custom_polygon',
      muted: input.selection.kind === 'deck',
      invalid: false,
      invalidMessage: null,
      deckInteraction: null,
      openingInteraction: null,
      deckDragEligibility: null,
      openingDragEligibility: null,
      source: 'geometry',
      geometrySourceId: footprint.id,
      renderStatus: 'geometry_ready',
    },
  ];

  for (const deck of input.decks) {
    const resolved = resolveDeckPolygon({ deck, lookup });
    if (!resolved?.polygon.length) continue;
    const selected = input.selection.kind === 'deck' && input.selection.targetId === deck.id;
    const deckInteraction = buildDeckInteraction({
      deck,
      polygon: resolved.polygon,
      lookup,
      houseAttachmentSide,
    });
    const deckStatus = input.status.deckStatuses[deck.id] ?? null;
    shapes.push({
      ownerKind: 'deck',
      ownerId: deck.id,
      polygon: resolved.polygon,
      detailSegments: [],
      selected,
      custom: deck.shape === 'custom',
      muted: input.decks.length > 1 && !selected,
      invalid: (deck.validation?.status ?? deckStatus?.validation.status ?? 'valid') === 'invalid',
      invalidMessage: deck.validation?.message ?? deckStatus?.validation.message ?? null,
      deckInteraction,
      openingInteraction: null,
      deckDragEligibility: buildDeckDragEligibility({
        deck,
        deckInteraction,
      }),
      openingDragEligibility: null,
      source: resolved.source,
      geometrySourceId: resolved.geometrySourceId,
      renderStatus: 'geometry_ready',
    });
  }

  for (const opening of input.openings) {
    const resolvedOpeningFrame = resolveOpeningFrameForOverlay({
      opening,
      houseAssembly: input.houseAssembly,
      lookup,
    });
    if (!resolvedOpeningFrame) continue;
    const openingFrame = resolvedOpeningFrame.frame;
    const widthM = parseMetres(opening.widthM, Number.NaN);
    const offsetAlongWallM = parseMetres(opening.offsetAlongWallM, Number.NaN);
    if (!Number.isFinite(widthM) || !Number.isFinite(offsetAlongWallM)) continue;
    const polygon = buildOpeningPolygonFromFrame({
      frame: openingFrame,
      widthM,
      offsetAlongWallM,
    });
    const selected = input.selection.kind === 'opening' && input.selection.targetId === opening.id;
    const openingInteraction = selected && resolvedOpeningFrame.exact
      ? buildOpeningInteraction({
          opening,
          frame: openingFrame,
        })
      : null;
    const openingStatus = input.status.openingStatuses[opening.id] ?? null;
    shapes.push({
      ownerKind: 'opening',
      ownerId: opening.id,
      polygon,
      detailSegments:
        opening.kind === 'slider'
          ? buildSliderDetailSegments({
              frame: openingFrame,
              widthM,
              offsetAlongWallM,
              panelCount: opening.panelCount,
            })
          : [],
      selected,
      custom: false,
      muted: input.openings.length > 1 && !selected,
      invalid: (opening.validation?.status ?? openingStatus?.validation.status ?? 'valid') === 'invalid',
      invalidMessage: opening.validation?.message ?? openingStatus?.validation.message ?? null,
      deckInteraction: null,
      openingInteraction,
      deckDragEligibility: null,
      openingDragEligibility: {
        eligible: Boolean(openingInteraction),
        reason: openingInteraction
          ? 'Drag the selected opening along the host wall, or click dimensions to edit.'
          : 'This opening needs a resolvable host wall before drag is available.',
      },
      source: 'geometry_derived',
      geometrySourceId: openingFrame.hostEdgeId,
      renderStatus: 'geometry_ready',
    });
  }

  const presetAnnotations: ObjectWorkbenchPlanPresetDimensionAnnotation[] = [];
  const customEdgeCandidates: ObjectWorkbenchPlanCustomEdgeCandidate[] = [];
  if (input.selection.kind === 'footprint' && houseForm?.footprint.mode === 'custom_polygon') {
    customEdgeCandidates.push(
      ...buildCustomEdgeCandidates({
        ownerKind: 'footprint',
        ownerId: houseForm.id,
        polygon: footprint.polygon,
        localPolygon: parseLocalPolygon(houseForm.footprint.polygon),
      }),
    );
  } else if (input.selection.kind === 'footprint' && houseForm) {
    presetAnnotations.push(
      ...buildFootprintAnnotations({
        houseForm,
        polygon: footprint.polygon,
      }),
    );
  } else if (input.selection.kind === 'deck' && input.selection.targetId) {
    const deck = input.decks.find((candidate) => candidate.id === input.selection.targetId);
    const shape = shapes.find((candidate) => candidate.ownerKind === 'deck' && candidate.ownerId === input.selection.targetId);
    if (deck && shape) {
      if (deck.shape === 'custom') {
        customEdgeCandidates.push(
          ...buildCustomEdgeCandidates({
            ownerKind: 'deck',
            ownerId: deck.id,
            polygon: shape.polygon,
            localPolygon: parseLocalPolygon(deck.outline),
          }),
        );
      }
      presetAnnotations.push(
        ...buildDeckAnnotations({
          deck,
          polygon: shape.polygon,
          deckInteraction: shape.deckInteraction,
        }),
      );
    }
  } else if (input.selection.kind === 'opening' && input.selection.targetId) {
    const opening = input.openings.find((candidate) => candidate.id === input.selection.targetId);
    const shape = shapes.find((candidate) => candidate.ownerKind === 'opening' && candidate.ownerId === input.selection.targetId);
    const resolvedOpeningFrame = opening
      ? resolveOpeningFrameForOverlay({
          opening,
          houseAssembly: input.houseAssembly,
          lookup,
        })
      : null;
    const frame = shape?.openingInteraction
      ? ({
          hostEdgeId: shape.openingInteraction.hostEdgeId,
          hostEdgeStart: shape.openingInteraction.hostEdgeStart,
          hostEdgeEnd: shape.openingInteraction.hostEdgeEnd,
          hostSpanM: shape.openingInteraction.hostSpanM,
          alongUnitX:
            (shape.openingInteraction.hostEdgeEnd.x - shape.openingInteraction.hostEdgeStart.x) /
            Math.max(shape.openingInteraction.hostSpanM, ZERO_DIMENSION_EPSILON_M),
          alongUnitY:
            (shape.openingInteraction.hostEdgeEnd.y - shape.openingInteraction.hostEdgeStart.y) /
            Math.max(shape.openingInteraction.hostSpanM, ZERO_DIMENSION_EPSILON_M),
          outwardUnitX: 0,
          outwardUnitY: -1,
        } satisfies GeometryOpeningFrame)
      : resolvedOpeningFrame?.frame ?? null;
    if (opening && shape && frame) {
      presetAnnotations.push(
        ...buildOpeningAnnotations({
          opening,
          polygon: shape.polygon,
          frame,
        }),
      );
    }
  }

  return {
    housePolygonSource: 'geometry_projection',
    shapes,
    presetAnnotations,
    customEdgeCandidates,
  };
}
