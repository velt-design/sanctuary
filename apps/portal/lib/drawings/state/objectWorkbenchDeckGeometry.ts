import type {
  DeckAttachmentMode,
  DeckFloatingPresetRect,
  DeckShape,
  DeckPresetRect,
  HouseFormFootprintModel,
  WorkbenchAttachmentSide,
} from './objectFirstWorkbenchModel';

type AttachmentSide = WorkbenchAttachmentSide;
type HouseFootprintLocalPoint = HouseFormFootprintModel['polygon'][number];
type HouseFootprintParams = HouseFormFootprintModel['params'];

type LocalPolygonPoint = {
  alongM: number;
  depthM: number;
};

type DeckGeometryDraft = {
  id?: string | null;
  name?: string | null;
  shape?: DeckShape | null;
  presetType?: string | null;
  hostEdgeId?: string | null;
  primaryHostEdgeId?: string | null;
  secondaryHostEdgeId?: string | null;
  cornerVertexId?: string | null;
  attachmentMode?: DeckAttachmentMode | null;
  isAttached?: boolean | null;
  presetRect?: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline?: HouseFootprintLocalPoint[] | null;
};

type DeckHostEdgeFrame = {
  hostEdge: AttachmentSide;
  sourceEdgeId: string | null;
  axis: 'along' | 'depth';
  start: number;
  end: number;
  edgeCoordinate: number;
  outwardAxis: 'along' | 'depth';
  outwardDirection: -1 | 1;
};

const DEFAULT_ATTACHED_DECK_DEPTH_M = 3;
const DEFAULT_DETACHED_DECK_WIDTH_M = 3.6;
const DEFAULT_DETACHED_DECK_DEPTH_M = 3;
const DEFAULT_DETACHED_DECK_GAP_M = 0.6;
const MIN_DECK_WIDTH_M = 0.5;
const MIN_DECK_DEPTH_M = 0.3;
const MIN_DETACHED_DECK_GAP_M = 0.2;
const EPSILON = 1e-6;

function roundDeckMetres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatDeckMetres(value: number): string {
  return String(roundDeckMetres(value));
}

function parseFiniteDeckMetres(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHostEdgeId(value: string | null | undefined): AttachmentSide {
  if (value === 'front' || value === 'left' || value === 'right') return value;
  return 'rear';
}

function isSemanticHostEdgeId(value: string | null | undefined): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function resolveDeckGeometryHostEdgeId(value: string | null | undefined): string {
  const exactHostEdgeId = normalizeExactHostEdgeId(value);
  if (exactHostEdgeId) return exactHostEdgeId;
  return normalizeHostEdgeId(value);
}

function normalizeDeckAttachmentMode(input: {
  attachmentMode: DeckAttachmentMode | null | undefined;
  isAttached: boolean;
  secondaryHostEdgeId: string | null | undefined;
  cornerVertexId: string | null | undefined;
}): DeckAttachmentMode {
  if (input.attachmentMode === 'corner_dual_edge') return 'corner_dual_edge';
  if (
    input.isAttached &&
    typeof input.secondaryHostEdgeId === 'string' &&
    input.secondaryHostEdgeId.trim().length > 0 &&
    typeof input.cornerVertexId === 'string' &&
    input.cornerVertexId.trim().length > 0
  ) {
    return 'corner_dual_edge';
  }
  if (input.attachmentMode === 'single_edge') return 'single_edge';
  if (input.isAttached) return 'single_edge';
  return 'floating';
}

function normalizeDeckPrimaryHostEdgeId(deck: DeckGeometryDraft): string | null {
  return deck.primaryHostEdgeId ?? deck.hostEdgeId ?? null;
}

function normalizeDeckSecondaryHostEdgeId(deck: DeckGeometryDraft): string | null {
  return deck.secondaryHostEdgeId ?? null;
}

function normalizeDeckCornerVertexId(deck: DeckGeometryDraft): string | null {
  return deck.cornerVertexId ?? null;
}

export function parseDeckLocalPolygon(
  polygon: HouseFootprintLocalPoint[] | null | undefined,
): LocalPolygonPoint[] {
  return (polygon ?? [])
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

export function buildDeckReferenceHousePolygon(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  footprintParams: Pick<HouseFootprintParams, 'offsetXM' | 'setbackM'> | null | undefined;
}): HouseFootprintLocalPoint[] {
  const offsetXM = parseFiniteDeckMetres(input.footprintParams?.offsetXM ?? null) ?? 0;
  const setbackM = Math.max(0, parseFiniteDeckMetres(input.footprintParams?.setbackM ?? null) ?? 0);
  return parseDeckLocalPolygon(input.housePolygon).map((point) => ({
    alongM: formatDeckMetres(point.alongM + offsetXM),
    depthM: formatDeckMetres(point.depthM + setbackM),
  }));
}

function computeHouseBounds(housePolygon: LocalPolygonPoint[]) {
  const alongValues = housePolygon.map((point) => point.alongM);
  const depthValues = housePolygon.map((point) => point.depthM);
  return {
    minAlong: Math.min(...alongValues),
    maxAlong: Math.max(...alongValues),
    minDepth: Math.min(...depthValues),
    maxDepth: Math.max(...depthValues),
  };
}

type EdgeInterval = {
  start: number;
  end: number;
};

type HostEdgeCandidate = DeckHostEdgeFrame & {
  sourceEdgeId: string;
  sourceVertexIndex: number;
  startPoint: LocalPolygonPoint;
  endPoint: LocalPolygonPoint;
};

type DeckCornerAttachmentCandidate = {
  attachmentMode: 'corner_dual_edge';
  primaryFrame: HostEdgeCandidate;
  secondaryFrame: HostEdgeCandidate;
  primaryHostEdgeId: string;
  secondaryHostEdgeId: string;
  cornerVertexId: string;
  cornerPoint: LocalPolygonPoint;
  alongDirection: -1 | 1;
  depthDirection: -1 | 1;
};

function mergeTouchingIntervals(intervals: EdgeInterval[]): EdgeInterval[] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: EdgeInterval[] = [sorted[0]!];

  for (const interval of sorted.slice(1)) {
    const previous = merged[merged.length - 1]!;
    if (interval.start <= previous.end + EPSILON) {
      previous.end = Math.max(previous.end, interval.end);
      continue;
    }
    merged.push({ ...interval });
  }

  return merged;
}

function pickPrimaryEdgeInterval(intervals: EdgeInterval[]): EdgeInterval | null {
  if (!intervals.length) return null;
  return [...intervals].sort((left, right) => {
    const leftLength = left.end - left.start;
    const rightLength = right.end - right.start;
    if (Math.abs(rightLength - leftLength) > EPSILON) return rightLength - leftLength;
    return left.start - right.start;
  })[0]!;
}

function edgeCandidatesForHousePolygon(housePolygon: LocalPolygonPoint[]): HostEdgeCandidate[] {
  return housePolygon.flatMap((point, index) => {
    const nextPoint = housePolygon[(index + 1) % housePolygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const horizontal = Math.abs(point.depthM - nextPoint.depthM) <= EPSILON;
    const vertical = Math.abs(point.alongM - nextPoint.alongM) <= EPSILON;
    if (!horizontal && !vertical) return [];

    const midpoint = {
      alongM: (point.alongM + nextPoint.alongM) / 2,
      depthM: (point.depthM + nextPoint.depthM) / 2,
    };
    const probeDistanceM = 0.05;
    const normalA = horizontal
      ? { alongM: 0, depthM: 1 }
      : { alongM: 1, depthM: 0 };
    const normalB = horizontal
      ? { alongM: 0, depthM: -1 }
      : { alongM: -1, depthM: 0 };
    const probeA = {
      alongM: midpoint.alongM + normalA.alongM * probeDistanceM,
      depthM: midpoint.depthM + normalA.depthM * probeDistanceM,
    };
    const probeB = {
      alongM: midpoint.alongM + normalB.alongM * probeDistanceM,
      depthM: midpoint.depthM + normalB.depthM * probeDistanceM,
    };
    const probeAInside = pointInLocalPolygon(probeA, housePolygon);
    const probeBInside = pointInLocalPolygon(probeB, housePolygon);
    const outward =
      probeAInside && !probeBInside
        ? normalB
        : !probeAInside && probeBInside
          ? normalA
          : normalB;
    const hostEdge = horizontal
      ? (outward.depthM < 0 ? 'rear' : 'front')
      : (outward.alongM < 0 ? 'left' : 'right');

    return [
      {
        hostEdge,
        sourceEdgeId,
        axis: horizontal ? 'along' : 'depth',
        start: horizontal ? Math.min(point.alongM, nextPoint.alongM) : Math.min(point.depthM, nextPoint.depthM),
        end: horizontal ? Math.max(point.alongM, nextPoint.alongM) : Math.max(point.depthM, nextPoint.depthM),
        edgeCoordinate: horizontal ? point.depthM : point.alongM,
        outwardAxis: horizontal ? 'depth' : 'along',
        outwardDirection: horizontal
          ? (outward.depthM < 0 ? -1 : 1)
          : (outward.alongM < 0 ? -1 : 1),
        sourceVertexIndex: index,
        startPoint: point,
        endPoint: nextPoint,
      },
    ];
  });
}

function buildDeckCornerVertexId(vertexIndex: number): string {
  return `footprint-vertex-${vertexIndex + 1}`;
}

function pointsMatch(left: LocalPolygonPoint, right: LocalPolygonPoint): boolean {
  return Math.abs(left.alongM - right.alongM) <= EPSILON && Math.abs(left.depthM - right.depthM) <= EPSILON;
}

function resolveCornerVertexPoint(input: {
  primaryFrame: HostEdgeCandidate;
  secondaryFrame: HostEdgeCandidate;
  requestedCornerVertexId: string | null | undefined;
}): { cornerVertexId: string; cornerPoint: LocalPolygonPoint } | null {
  const primaryEndpoints = [
    { point: input.primaryFrame.startPoint, vertexIndex: input.primaryFrame.sourceVertexIndex },
    { point: input.primaryFrame.endPoint, vertexIndex: input.primaryFrame.sourceVertexIndex + 1 },
  ];
  const secondaryEndpoints = [
    { point: input.secondaryFrame.startPoint, vertexIndex: input.secondaryFrame.sourceVertexIndex },
    { point: input.secondaryFrame.endPoint, vertexIndex: input.secondaryFrame.sourceVertexIndex + 1 },
  ];
  const sharedEndpoint =
    primaryEndpoints.flatMap((primaryEndpoint) =>
      secondaryEndpoints
        .filter((secondaryEndpoint) => pointsMatch(primaryEndpoint.point, secondaryEndpoint.point))
        .map(() => primaryEndpoint),
    )[0] ?? null;
  if (!sharedEndpoint) return null;

  const cornerVertexId = buildDeckCornerVertexId(sharedEndpoint.vertexIndex);
  if (
    input.requestedCornerVertexId &&
    input.requestedCornerVertexId.trim().length > 0 &&
    input.requestedCornerVertexId.trim() !== cornerVertexId
  ) {
    return null;
  }

  return {
    cornerVertexId,
    cornerPoint: sharedEndpoint.point,
  };
}

function pointInLocalPolygon(point: LocalPolygonPoint, polygon: LocalPolygonPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const intersects =
      currentPoint.depthM > point.depthM !== previousPoint.depthM > point.depthM &&
      point.alongM <
        ((previousPoint.alongM - currentPoint.alongM) * (point.depthM - currentPoint.depthM)) /
          Math.max(previousPoint.depthM - currentPoint.depthM, Number.EPSILON) +
          currentPoint.alongM;
    if (intersects) inside = !inside;
  }
  return inside;
}

function resolveDeckCornerAttachmentCandidate(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  primaryHostEdgeId: string | null | undefined;
  secondaryHostEdgeId: string | null | undefined;
  cornerVertexId: string | null | undefined;
}): DeckCornerAttachmentCandidate | null {
  const housePolygon = parseDeckLocalPolygon(input.housePolygon);
  if (!housePolygon.length) return null;
  const exactPrimaryHostEdgeId = normalizeExactHostEdgeId(input.primaryHostEdgeId);
  const exactSecondaryHostEdgeId = normalizeExactHostEdgeId(input.secondaryHostEdgeId);
  if (!exactPrimaryHostEdgeId || !exactSecondaryHostEdgeId || exactPrimaryHostEdgeId === exactSecondaryHostEdgeId) {
    return null;
  }

  const candidates = edgeCandidatesForHousePolygon(housePolygon);
  const primaryFrame = candidates.find((candidate) => candidate.sourceEdgeId === exactPrimaryHostEdgeId) ?? null;
  const secondaryFrame = candidates.find((candidate) => candidate.sourceEdgeId === exactSecondaryHostEdgeId) ?? null;
  if (!primaryFrame || !secondaryFrame || primaryFrame.axis === secondaryFrame.axis) return null;

  const cornerVertex = resolveCornerVertexPoint({
    primaryFrame,
    secondaryFrame,
    requestedCornerVertexId: input.cornerVertexId,
  });
  if (!cornerVertex) return null;

  const summedAlongDirection =
    (primaryFrame.outwardAxis === 'along' ? primaryFrame.outwardDirection : 0) +
    (secondaryFrame.outwardAxis === 'along' ? secondaryFrame.outwardDirection : 0);
  const summedDepthDirection =
    (primaryFrame.outwardAxis === 'depth' ? primaryFrame.outwardDirection : 0) +
    (secondaryFrame.outwardAxis === 'depth' ? secondaryFrame.outwardDirection : 0);

  return {
    attachmentMode: 'corner_dual_edge',
    primaryFrame,
    secondaryFrame,
    primaryHostEdgeId: primaryFrame.sourceEdgeId,
    secondaryHostEdgeId: secondaryFrame.sourceEdgeId,
    cornerVertexId: cornerVertex.cornerVertexId,
    cornerPoint: cornerVertex.cornerPoint,
    alongDirection: summedAlongDirection < 0 ? -1 : 1,
    depthDirection: summedDepthDirection < 0 ? -1 : 1,
  };
}

function normalizeExactHostEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

export function resolveDeckHostEdgeFrame(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
}): DeckHostEdgeFrame | null {
  const housePolygon = parseDeckLocalPolygon(input.housePolygon);
  if (!housePolygon.length) return null;
  const exactHostEdgeId = normalizeExactHostEdgeId(input.hostEdgeId);
  const edgeCandidates = edgeCandidatesForHousePolygon(housePolygon);

  if (exactHostEdgeId) {
    return edgeCandidates.find((candidate) => candidate.sourceEdgeId === exactHostEdgeId) ?? null;
  }

  const hostEdge = normalizeHostEdgeId(input.hostEdgeId);
  const sideCandidates = edgeCandidates.filter((candidate) => candidate.hostEdge === hostEdge);
  const intervals = mergeTouchingIntervals(
    sideCandidates.map((candidate) => ({
      start: candidate.start,
      end: candidate.end,
    })),
  );
  const primaryInterval = pickPrimaryEdgeInterval(intervals);
  const primaryCandidate =
    [...sideCandidates].sort((left, right) => {
      const leftLength = left.end - left.start;
      const rightLength = right.end - right.start;
      if (Math.abs(rightLength - leftLength) > EPSILON) return rightLength - leftLength;
      return left.start - right.start;
    })[0] ?? null;
  const bounds = computeHouseBounds(housePolygon);
  const edgeCoordinate =
    hostEdge === 'front'
      ? bounds.maxDepth
      : hostEdge === 'left'
        ? bounds.minAlong
        : hostEdge === 'right'
          ? bounds.maxAlong
          : bounds.minDepth;

  if (hostEdge === 'front') {
    return {
      hostEdge,
      sourceEdgeId: primaryCandidate?.sourceEdgeId ?? null,
      axis: 'along',
      start: primaryInterval?.start ?? bounds.minAlong,
      end: primaryInterval?.end ?? bounds.maxAlong,
      edgeCoordinate,
      outwardAxis: 'depth',
      outwardDirection: 1,
    };
  }
  if (hostEdge === 'left') {
    return {
      hostEdge,
      sourceEdgeId: primaryCandidate?.sourceEdgeId ?? null,
      axis: 'depth',
      start: primaryInterval?.start ?? bounds.minDepth,
      end: primaryInterval?.end ?? bounds.maxDepth,
      edgeCoordinate,
      outwardAxis: 'along',
      outwardDirection: -1,
    };
  }
  if (hostEdge === 'right') {
    return {
      hostEdge,
      sourceEdgeId: primaryCandidate?.sourceEdgeId ?? null,
      axis: 'depth',
      start: primaryInterval?.start ?? bounds.minDepth,
      end: primaryInterval?.end ?? bounds.maxDepth,
      edgeCoordinate,
      outwardAxis: 'along',
      outwardDirection: 1,
    };
  }
  return {
    hostEdge,
    sourceEdgeId: primaryCandidate?.sourceEdgeId ?? null,
    axis: 'along',
    start: primaryInterval?.start ?? bounds.minAlong,
    end: primaryInterval?.end ?? bounds.maxAlong,
    edgeCoordinate,
    outwardAxis: 'depth',
    outwardDirection: -1,
  };
}

function resolveCompatibleDeckGeometryHostEdgeId(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  semanticHostEdgeId: string | null | undefined;
  primaryHostEdgeId: string | null | undefined;
}): string {
  const exactPrimaryHostEdgeId = normalizeExactHostEdgeId(input.primaryHostEdgeId);
  const semanticHostEdgeId = isSemanticHostEdgeId(input.semanticHostEdgeId) ? input.semanticHostEdgeId : null;
  if (!exactPrimaryHostEdgeId) {
    return semanticHostEdgeId ?? resolveDeckGeometryHostEdgeId(input.primaryHostEdgeId ?? input.semanticHostEdgeId);
  }
  const exactFrame = resolveDeckHostEdgeFrame({
    housePolygon: input.housePolygon,
    hostEdgeId: exactPrimaryHostEdgeId,
  });
  if (exactFrame?.sourceEdgeId === exactPrimaryHostEdgeId) {
    return exactPrimaryHostEdgeId;
  }
  return semanticHostEdgeId ?? exactPrimaryHostEdgeId;
}

function fallbackPresetRect(input: {
  frame: DeckHostEdgeFrame;
  attached: boolean;
}): DeckPresetRect {
  const hostEdgeLengthM = Math.max(0, input.frame.end - input.frame.start);
  if (input.attached) {
    return {
      widthM: formatDeckMetres(hostEdgeLengthM),
      depthM: formatDeckMetres(DEFAULT_ATTACHED_DECK_DEPTH_M),
      centerOffsetM: '0',
      detachedGapM: null,
    };
  }
  return {
    widthM: formatDeckMetres(DEFAULT_DETACHED_DECK_WIDTH_M),
    depthM: formatDeckMetres(DEFAULT_DETACHED_DECK_DEPTH_M),
    centerOffsetM: '0',
    detachedGapM: formatDeckMetres(DEFAULT_DETACHED_DECK_GAP_M),
  };
}

export function sanitizeDeckPresetRect(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
  attached: boolean;
  presetRect: Partial<DeckPresetRect> | null | undefined;
  fallbackPresetRect?: DeckPresetRect | null | undefined;
}): DeckPresetRect | null {
  const frame = resolveDeckHostEdgeFrame({
    housePolygon: input.housePolygon,
    hostEdgeId: input.hostEdgeId,
  });
  if (!frame) return null;

  const defaults = fallbackPresetRect({
    frame,
    attached: input.attached,
  });
  const fallback = input.fallbackPresetRect ?? defaults;
  const hostEdgeLengthM = Math.max(0, frame.end - frame.start);

  const widthM = (() => {
    const parsed = parseFiniteDeckMetres(input.presetRect?.widthM ?? null);
    const fallbackValue = Math.max(
      MIN_DECK_WIDTH_M,
      parseFiniteDeckMetres(fallback.widthM) ?? parseFiniteDeckMetres(defaults.widthM) ?? MIN_DECK_WIDTH_M,
    );
    return Math.max(MIN_DECK_WIDTH_M, parsed ?? fallbackValue);
  })();
  const depthM = Math.max(
    MIN_DECK_DEPTH_M,
    parseFiniteDeckMetres(input.presetRect?.depthM ?? null) ??
      parseFiniteDeckMetres(fallback.depthM) ??
      parseFiniteDeckMetres(defaults.depthM) ??
      DEFAULT_ATTACHED_DECK_DEPTH_M,
  );
  const detachedGapM = input.attached
    ? null
    : formatDeckMetres(
        Math.max(
          MIN_DETACHED_DECK_GAP_M,
          parseFiniteDeckMetres(input.presetRect?.detachedGapM ?? null) ??
            parseFiniteDeckMetres(fallback.detachedGapM ?? null) ??
            parseFiniteDeckMetres(defaults.detachedGapM ?? null) ??
            DEFAULT_DETACHED_DECK_GAP_M,
        ),
      );

  const requestedCenterOffsetM =
    parseFiniteDeckMetres(input.presetRect?.centerOffsetM ?? null) ??
    parseFiniteDeckMetres(fallback.centerOffsetM) ??
    parseFiniteDeckMetres(defaults.centerOffsetM) ??
    0;
  const centerOffsetM = requestedCenterOffsetM;

  return {
    widthM: formatDeckMetres(widthM),
    depthM: formatDeckMetres(depthM),
    centerOffsetM: formatDeckMetres(centerOffsetM),
    detachedGapM,
  };
}

export function sanitizeDeckFloatingPresetRect(
  value: Partial<DeckFloatingPresetRect> | null | undefined,
  fallbackValue?: DeckFloatingPresetRect | null | undefined,
): DeckFloatingPresetRect | null {
  const widthM = Math.max(
    MIN_DECK_WIDTH_M,
    parseFiniteDeckMetres(value?.widthM ?? null) ??
      parseFiniteDeckMetres(fallbackValue?.widthM ?? null) ??
      DEFAULT_DETACHED_DECK_WIDTH_M,
  );
  const depthM = Math.max(
    MIN_DECK_DEPTH_M,
    parseFiniteDeckMetres(value?.depthM ?? null) ??
      parseFiniteDeckMetres(fallbackValue?.depthM ?? null) ??
      DEFAULT_DETACHED_DECK_DEPTH_M,
  );
  const centerAlongM =
    parseFiniteDeckMetres(value?.centerAlongM ?? null) ??
    parseFiniteDeckMetres(fallbackValue?.centerAlongM ?? null);
  const centerDepthM =
    parseFiniteDeckMetres(value?.centerDepthM ?? null) ??
    parseFiniteDeckMetres(fallbackValue?.centerDepthM ?? null);

  if (centerAlongM === null || centerDepthM === null) return null;
  if (!Number.isFinite(centerAlongM) || !Number.isFinite(centerDepthM)) return null;

  return {
    centerAlongM: formatDeckMetres(centerAlongM),
    centerDepthM: formatDeckMetres(centerDepthM),
    widthM: formatDeckMetres(widthM),
    depthM: formatDeckMetres(depthM),
  };
}

export function buildRectangularDeckOutline(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
  attached: boolean;
  attachmentMode?: DeckAttachmentMode | null | undefined;
  primaryHostEdgeId?: string | null | undefined;
  secondaryHostEdgeId?: string | null | undefined;
  cornerVertexId?: string | null | undefined;
  presetRect: Partial<DeckPresetRect> | null | undefined;
  fallbackPresetRect?: DeckPresetRect | null | undefined;
}): HouseFootprintLocalPoint[] {
  const attachmentMode = normalizeDeckAttachmentMode({
    attachmentMode: input.attachmentMode,
    isAttached: input.attached,
    secondaryHostEdgeId: input.secondaryHostEdgeId,
    cornerVertexId: input.cornerVertexId,
  });
  const primaryHostEdgeId = input.primaryHostEdgeId ?? input.hostEdgeId;
  const frame = resolveDeckHostEdgeFrame({
    housePolygon: input.housePolygon,
    hostEdgeId: primaryHostEdgeId,
  });
  const presetRect = sanitizeDeckPresetRect({
    housePolygon: input.housePolygon,
    hostEdgeId: primaryHostEdgeId,
    attached: input.attached,
    presetRect: input.presetRect,
    fallbackPresetRect: input.fallbackPresetRect,
  });
  if (!frame || !presetRect) return [];

  const widthM = Number(presetRect.widthM);
  const depthM = Number(presetRect.depthM);
  if (attachmentMode === 'corner_dual_edge') {
    const cornerAttachment = resolveDeckCornerAttachmentCandidate({
      housePolygon: input.housePolygon,
      primaryHostEdgeId,
      secondaryHostEdgeId: input.secondaryHostEdgeId,
      cornerVertexId: input.cornerVertexId,
    });
    if (!cornerAttachment) return [];
    const minAlongM = cornerAttachment.cornerPoint.alongM + Math.min(0, cornerAttachment.alongDirection * widthM);
    const maxAlongM = cornerAttachment.cornerPoint.alongM + Math.max(0, cornerAttachment.alongDirection * widthM);
    const minDepthM = cornerAttachment.cornerPoint.depthM + Math.min(0, cornerAttachment.depthDirection * depthM);
    const maxDepthM = cornerAttachment.cornerPoint.depthM + Math.max(0, cornerAttachment.depthDirection * depthM);
    return [
      { alongM: formatDeckMetres(minAlongM), depthM: formatDeckMetres(minDepthM) },
      { alongM: formatDeckMetres(maxAlongM), depthM: formatDeckMetres(minDepthM) },
      { alongM: formatDeckMetres(maxAlongM), depthM: formatDeckMetres(maxDepthM) },
      { alongM: formatDeckMetres(minAlongM), depthM: formatDeckMetres(maxDepthM) },
    ];
  }
  const centerOffsetM = Number(presetRect.centerOffsetM);
  const detachedGapM = input.attached ? 0 : Number(presetRect.detachedGapM ?? DEFAULT_DETACHED_DECK_GAP_M);
  const edgeMidpoint = (frame.start + frame.end) / 2;
  const center = edgeMidpoint + centerOffsetM;
  const halfWidth = widthM / 2;
  const start = center - halfWidth;
  const end = center + halfWidth;
  const near = frame.edgeCoordinate + frame.outwardDirection * detachedGapM;
  const far = near + frame.outwardDirection * depthM;

  const makePoint = (axisValue: number, outwardValue: number): HouseFootprintLocalPoint =>
    frame.axis === 'along'
      ? {
          alongM: formatDeckMetres(axisValue),
          depthM: formatDeckMetres(outwardValue),
        }
      : {
          alongM: formatDeckMetres(outwardValue),
          depthM: formatDeckMetres(axisValue),
        };

  if (frame.outwardDirection < 0) {
    return [
      makePoint(start, far),
      makePoint(end, far),
      makePoint(end, near),
      makePoint(start, near),
    ];
  }
  return [
    makePoint(start, near),
    makePoint(end, near),
    makePoint(end, far),
    makePoint(start, far),
  ];
}

export function buildFloatingDeckOutline(input: {
  floatingRect: Partial<DeckFloatingPresetRect> | null | undefined;
}): HouseFootprintLocalPoint[] {
  const floatingRect = sanitizeDeckFloatingPresetRect(input.floatingRect);
  if (!floatingRect) return [];

  const centerAlongM = Number(floatingRect.centerAlongM);
  const centerDepthM = Number(floatingRect.centerDepthM);
  const widthM = Number(floatingRect.widthM);
  const depthM = Number(floatingRect.depthM);
  const halfWidthM = widthM / 2;
  const halfDepthM = depthM / 2;
  const minAlong = centerAlongM - halfWidthM;
  const maxAlong = centerAlongM + halfWidthM;
  const minDepth = centerDepthM - halfDepthM;
  const maxDepth = centerDepthM + halfDepthM;

  return [
    { alongM: formatDeckMetres(minAlong), depthM: formatDeckMetres(minDepth) },
    { alongM: formatDeckMetres(maxAlong), depthM: formatDeckMetres(minDepth) },
    { alongM: formatDeckMetres(maxAlong), depthM: formatDeckMetres(maxDepth) },
    { alongM: formatDeckMetres(minAlong), depthM: formatDeckMetres(maxDepth) },
  ];
}

export function inferDeckPresetRectFromOutline(input: {
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
  attached: boolean;
  outline: HouseFootprintLocalPoint[] | null | undefined;
}): DeckPresetRect | null {
  const frame = resolveDeckHostEdgeFrame({
    housePolygon: input.housePolygon,
    hostEdgeId: input.hostEdgeId,
  });
  const outline = parseDeckLocalPolygon(input.outline);
  if (!frame || outline.length < 3) return null;

  const axisValues = outline.map((point) => (frame.axis === 'along' ? point.alongM : point.depthM));
  const outwardValues = outline.map((point) => (frame.outwardAxis === 'along' ? point.alongM : point.depthM));
  const minAxis = Math.min(...axisValues);
  const maxAxis = Math.max(...axisValues);
  const minOutward = Math.min(...outwardValues);
  const maxOutward = Math.max(...outwardValues);
  const widthM = Math.max(MIN_DECK_WIDTH_M, maxAxis - minAxis);
  const depthM = Math.max(MIN_DECK_DEPTH_M, maxOutward - minOutward);
  const hostMidpoint = (frame.start + frame.end) / 2;
  const centerOffsetM = ((minAxis + maxAxis) / 2) - hostMidpoint;
  const near =
    frame.outwardDirection > 0
      ? minOutward
      : maxOutward;
  const detachedGapM = input.attached ? null : Math.max(0, Math.abs(near - frame.edgeCoordinate));

  return sanitizeDeckPresetRect({
    housePolygon: input.housePolygon,
    hostEdgeId: input.hostEdgeId,
    attached: input.attached,
    presetRect: {
      widthM: formatDeckMetres(widthM),
      depthM: formatDeckMetres(depthM),
      centerOffsetM: formatDeckMetres(centerOffsetM),
      detachedGapM: detachedGapM === null ? null : formatDeckMetres(detachedGapM),
    },
  });
}

export function inferDeckFloatingPresetRectFromOutline(input: {
  outline: HouseFootprintLocalPoint[] | null | undefined;
}): DeckFloatingPresetRect | null {
  const outline = parseDeckLocalPolygon(input.outline);
  if (outline.length < 3) return null;

  const alongValues = outline.map((point) => point.alongM);
  const depthValues = outline.map((point) => point.depthM);
  const minAlong = Math.min(...alongValues);
  const maxAlong = Math.max(...alongValues);
  const minDepth = Math.min(...depthValues);
  const maxDepth = Math.max(...depthValues);

  return sanitizeDeckFloatingPresetRect({
    centerAlongM: formatDeckMetres((minAlong + maxAlong) / 2),
    centerDepthM: formatDeckMetres((minDepth + maxDepth) / 2),
    widthM: formatDeckMetres(Math.max(MIN_DECK_WIDTH_M, maxAlong - minAlong)),
    depthM: formatDeckMetres(Math.max(MIN_DECK_DEPTH_M, maxDepth - minDepth)),
  });
}

export function resolveDeckPresetGeometry(input: {
  deck: DeckGeometryDraft;
  housePolygon: HouseFootprintLocalPoint[] | null | undefined;
}): {
  hostEdgeId: AttachmentSide | string | null;
  attachmentMode: DeckAttachmentMode;
  primaryHostEdgeId: string | null;
  secondaryHostEdgeId: string | null;
  cornerVertexId: string | null;
  presetRect: DeckPresetRect | null;
  floatingRect: DeckFloatingPresetRect | null;
  outline: HouseFootprintLocalPoint[];
} {
  const attached = Boolean(input.deck.isAttached);
  const normalizedAttachmentMode = normalizeDeckAttachmentMode({
    attachmentMode: input.deck.attachmentMode,
    isAttached: attached,
    secondaryHostEdgeId: input.deck.secondaryHostEdgeId,
    cornerVertexId: input.deck.cornerVertexId,
  });
  const fallbackPrimaryHostEdgeId = resolveCompatibleDeckGeometryHostEdgeId({
    housePolygon: input.housePolygon,
    semanticHostEdgeId: input.deck.hostEdgeId,
    primaryHostEdgeId: normalizeDeckPrimaryHostEdgeId(input.deck),
  });
  const fallbackSecondaryHostEdgeId = normalizeExactHostEdgeId(normalizeDeckSecondaryHostEdgeId(input.deck));
  const fallbackCornerVertexId = normalizeDeckCornerVertexId(input.deck);
  const cornerAttachment =
    input.deck.shape === 'preset' && normalizedAttachmentMode === 'corner_dual_edge'
      ? resolveDeckCornerAttachmentCandidate({
          housePolygon: input.housePolygon,
          primaryHostEdgeId: fallbackPrimaryHostEdgeId,
          secondaryHostEdgeId: fallbackSecondaryHostEdgeId,
          cornerVertexId: fallbackCornerVertexId,
        })
      : null;
  const attachmentMode =
    input.deck.shape === 'preset' && cornerAttachment
      ? 'corner_dual_edge'
      : input.deck.shape === 'preset' && attached
        ? 'single_edge'
        : 'floating';
  const primaryHostEdgeId =
    cornerAttachment?.primaryHostEdgeId ??
    (input.deck.shape === 'preset' ? fallbackPrimaryHostEdgeId : normalizeDeckPrimaryHostEdgeId(input.deck));
  const secondaryHostEdgeId = cornerAttachment?.secondaryHostEdgeId ?? null;
  const cornerVertexId = cornerAttachment?.cornerVertexId ?? null;
  const hostEdgeId =
    input.deck.shape === 'preset'
      ? (isSemanticHostEdgeId(input.deck.hostEdgeId) ? input.deck.hostEdgeId : primaryHostEdgeId)
      : input.deck.hostEdgeId ?? null;
  const inferredPresetRect =
    input.deck.shape === 'preset'
      ? inferDeckPresetRectFromOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: primaryHostEdgeId,
          attached,
          outline: input.deck.outline,
        })
      : null;
  const presetRect =
    input.deck.shape === 'preset'
      ? sanitizeDeckPresetRect({
          housePolygon: input.housePolygon,
          hostEdgeId: primaryHostEdgeId,
          attached,
          // Floating presets still keep the legacy edge-relative presetRect for compatibility,
          // but PR2 stops using it as the geometry source of truth.
          presetRect: input.deck.presetRect ?? inferredPresetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.presetRect ?? inferredPresetRect;
  const legacyPresetOutline =
    input.deck.shape === 'preset'
      ? buildRectangularDeckOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: primaryHostEdgeId,
          attached,
          attachmentMode,
          primaryHostEdgeId,
          secondaryHostEdgeId,
          cornerVertexId,
          presetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : [];
  const inferredFloatingRectFromOutline =
    input.deck.shape === 'preset' && !attached
      ? inferDeckFloatingPresetRectFromOutline({
          outline: input.deck.outline?.length ? input.deck.outline : legacyPresetOutline,
        })
      : null;
  const floatingRect =
    input.deck.shape === 'preset' && !attached
      ? sanitizeDeckFloatingPresetRect(input.deck.floatingRect ?? inferredFloatingRectFromOutline, inferredFloatingRectFromOutline)
      : null;
  const outline =
    input.deck.shape !== 'preset'
      ? input.deck.outline ?? []
      : attached
        ? legacyPresetOutline
        : buildFloatingDeckOutline({
            floatingRect: floatingRect ?? inferredFloatingRectFromOutline,
          });

  return {
    hostEdgeId,
    attachmentMode,
    primaryHostEdgeId,
    secondaryHostEdgeId,
    cornerVertexId,
    presetRect,
    floatingRect,
    outline,
  };
}
