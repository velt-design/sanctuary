import type {
  CalculatorModuleInputs,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import type { DeckPresetRect, HouseFirstDeckDraft } from './houseFirstWorkbenchModel';

type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;

type LocalPolygonPoint = {
  alongM: number;
  depthM: number;
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

export function parseDeckLocalPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined,
): LocalPolygonPoint[] {
  return (polygon ?? [])
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

export function buildDeckReferenceHousePolygon(input: {
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
  footprintParams: Pick<CalculatorHouseFootprintParams, 'offsetXM' | 'setbackM'> | null | undefined;
}): CalculatorHouseFootprintPolygonPoint[] {
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
  const bounds = computeHouseBounds(housePolygon);
  return housePolygon.flatMap((point, index) => {
    const nextPoint = housePolygon[(index + 1) % housePolygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;

    if (
      Math.abs(point.depthM - nextPoint.depthM) <= EPSILON &&
      Math.abs(point.depthM - bounds.minDepth) <= EPSILON
    ) {
      return [
        {
          hostEdge: 'rear' as const,
          sourceEdgeId,
          axis: 'along' as const,
          start: Math.min(point.alongM, nextPoint.alongM),
          end: Math.max(point.alongM, nextPoint.alongM),
          edgeCoordinate: bounds.minDepth,
          outwardAxis: 'depth' as const,
          outwardDirection: -1 as const,
        },
      ];
    }

    if (
      Math.abs(point.depthM - nextPoint.depthM) <= EPSILON &&
      Math.abs(point.depthM - bounds.maxDepth) <= EPSILON
    ) {
      return [
        {
          hostEdge: 'front' as const,
          sourceEdgeId,
          axis: 'along' as const,
          start: Math.min(point.alongM, nextPoint.alongM),
          end: Math.max(point.alongM, nextPoint.alongM),
          edgeCoordinate: bounds.maxDepth,
          outwardAxis: 'depth' as const,
          outwardDirection: 1 as const,
        },
      ];
    }

    if (
      Math.abs(point.alongM - nextPoint.alongM) <= EPSILON &&
      Math.abs(point.alongM - bounds.minAlong) <= EPSILON
    ) {
      return [
        {
          hostEdge: 'left' as const,
          sourceEdgeId,
          axis: 'depth' as const,
          start: Math.min(point.depthM, nextPoint.depthM),
          end: Math.max(point.depthM, nextPoint.depthM),
          edgeCoordinate: bounds.minAlong,
          outwardAxis: 'along' as const,
          outwardDirection: -1 as const,
        },
      ];
    }

    if (
      Math.abs(point.alongM - nextPoint.alongM) <= EPSILON &&
      Math.abs(point.alongM - bounds.maxAlong) <= EPSILON
    ) {
      return [
        {
          hostEdge: 'right' as const,
          sourceEdgeId,
          axis: 'depth' as const,
          start: Math.min(point.depthM, nextPoint.depthM),
          end: Math.max(point.depthM, nextPoint.depthM),
          edgeCoordinate: bounds.maxAlong,
          outwardAxis: 'along' as const,
          outwardDirection: 1 as const,
        },
      ];
    }

    return [];
  });
}

function normalizeExactHostEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

export function resolveDeckHostEdgeFrame(input: {
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
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
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
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
    const resolved = Math.max(MIN_DECK_WIDTH_M, parsed ?? fallbackValue);
    return input.attached ? Math.min(resolved, hostEdgeLengthM || resolved) : resolved;
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
  const availableOffsetHalfSpanM =
    widthM <= hostEdgeLengthM + EPSILON ? Math.max(0, (hostEdgeLengthM - widthM) / 2) : 0;
  const centerOffsetM = input.attached
    ? clamp(requestedCenterOffsetM, -availableOffsetHalfSpanM, availableOffsetHalfSpanM)
    : requestedCenterOffsetM;

  return {
    widthM: formatDeckMetres(widthM),
    depthM: formatDeckMetres(depthM),
    centerOffsetM: formatDeckMetres(centerOffsetM),
    detachedGapM,
  };
}

export function buildRectangularDeckOutline(input: {
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
  attached: boolean;
  presetRect: Partial<DeckPresetRect> | null | undefined;
  fallbackPresetRect?: DeckPresetRect | null | undefined;
}): CalculatorHouseFootprintPolygonPoint[] {
  const frame = resolveDeckHostEdgeFrame({
    housePolygon: input.housePolygon,
    hostEdgeId: input.hostEdgeId,
  });
  const presetRect = sanitizeDeckPresetRect(input);
  if (!frame || !presetRect) return [];

  const widthM = Number(presetRect.widthM);
  const depthM = Number(presetRect.depthM);
  const centerOffsetM = Number(presetRect.centerOffsetM);
  const detachedGapM = input.attached ? 0 : Number(presetRect.detachedGapM ?? DEFAULT_DETACHED_DECK_GAP_M);
  const edgeMidpoint = (frame.start + frame.end) / 2;
  const center = edgeMidpoint + centerOffsetM;
  const halfWidth = widthM / 2;
  const start = center - halfWidth;
  const end = center + halfWidth;
  const near = frame.edgeCoordinate + frame.outwardDirection * detachedGapM;
  const far = near + frame.outwardDirection * depthM;

  const makePoint = (axisValue: number, outwardValue: number): CalculatorHouseFootprintPolygonPoint =>
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

export function inferDeckPresetRectFromOutline(input: {
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
  hostEdgeId: string | null | undefined;
  attached: boolean;
  outline: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
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

export function resolveDeckPresetGeometry(input: {
  deck: HouseFirstDeckDraft;
  housePolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
}): {
  hostEdgeId: AttachmentSide | string | null;
  presetRect: DeckPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
} {
  const attached = Boolean(input.deck.isAttached);
  const fallbackHostEdgeId = normalizeHostEdgeId(input.deck.hostEdgeId);
  const hostEdgeId = input.deck.shape === 'preset' ? fallbackHostEdgeId : input.deck.hostEdgeId ?? null;
  const inferredPresetRect =
    input.deck.shape === 'preset'
      ? inferDeckPresetRectFromOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          outline: input.deck.outline,
        })
      : null;
  const presetRect =
    input.deck.shape === 'preset'
      ? sanitizeDeckPresetRect({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect: input.deck.presetRect ?? inferredPresetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.presetRect ?? inferredPresetRect;
  const outline =
    input.deck.shape === 'preset'
      ? buildRectangularDeckOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.outline ?? [];

  return {
    hostEdgeId,
    presetRect,
    outline,
  };
}
