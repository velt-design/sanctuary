import {
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import {
  deriveHouseGableTerminalEnds,
  buildHouseFootprintPresetSideLocalPoints,
  deriveHouseRoofCapabilities,
  preferredMonoFallDirectionForAttachmentSide,
  validateHouseRoofSelection,
  type Line3,
  type Polygon3,
} from '@sp/geometry';
import {
  makeDefaultHouseFootprintParams,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  normalizeHouseRoofMaterial,
  type CalculatorDrawingRotationQuarterTurns,
  type CalculatorHouseAttachmentStrategy,
  type CalculatorHouseFootprintMode,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
  type CalculatorHouseFootprintPreset,
  type CalculatorHouseRoofMaterial,
  type CalculatorHouseStoreyMode,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  DeckSupportClassification,
  DeckSupportWarningCode,
  DeckValidationCode,
  HouseAttachmentZoneKind,
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseFirstMigrationWarning,
  HouseModel,
  HouseRoofApproximationReason,
  HouseRoofAppendageForm,
  HouseRoofFieldSource,
  HouseRoofPrimaryFallDirection,
  HouseRoofProvenance,
  HouseRoofRidgeAxis,
  HouseRoofForm,
  PergolaModel,
  WorkbenchProjectModel,
} from './houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from './houseFirstWorkbenchModel';
import {
  buildDeckReferenceHousePolygon,
  parseDeckLocalPolygon,
  resolveDeckPresetGeometry,
  resolveDeckHostEdgeFrame,
} from './houseFirstDeckPresets';

type SharedFieldConfig<T> = {
  field: string;
  fallback: T;
  pick: (module: CalculatorModuleInputs) => T;
  normalize?: (value: T) => T;
  isBlank?: (value: T) => boolean;
};

type SharedFieldResult<T> = {
  value: T;
  warning: HouseFirstMigrationWarning | null;
  lowConfidence: boolean;
  source: Extract<HouseRoofFieldSource, 'legacy_shared_value' | 'default_fallback'>;
};

type DerivedRoofRidgeAxisResolution = {
  value: HouseRoofRidgeAxis;
  source: Extract<HouseRoofFieldSource, 'default_fallback'>;
  ambiguous: boolean;
  usedFallback: boolean;
};

function isBlankString(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${key}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function pickFirstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function resolveHouseRoofForm(module: CalculatorModuleInputs): HouseRoofForm {
  if (module.boxPerimeterEnabled) return 'flat';
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip' || module.pergolaStyle === 'hip_corner') return 'hipped';
  return 'mono';
}

function normalizeRoofDraftPitch(value: string | null | undefined, fallback: string): string {
  return isBlankString(value) ? fallback : String(value).trim();
}

function normalizeRoofPrimaryFallDirection(
  value: HouseFirstRoofDraft['primaryFallDirection'] | null | undefined,
): HouseRoofPrimaryFallDirection | null {
  if (
    value === 'positive_x' ||
    value === 'negative_x' ||
    value === 'positive_y' ||
    value === 'negative_y'
  ) {
    return value;
  }
  return null;
}

function normalizeRoofRidgeAxis(
  value: HouseFirstRoofDraft['ridgeAxis'] | null | undefined,
): HouseRoofRidgeAxis | null {
  return value === 'y' ? 'y' : value === 'x' ? 'x' : null;
}

function normalizeRoofOpenGableEndIds(
  value: HouseFirstRoofDraft['openGableEndIds'] | null | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((candidate): candidate is string => typeof candidate === 'string')
      .map((candidate) => candidate.trim())
      .filter((candidate) => candidate.length > 0),
  )];
}

function normalizeAppendageForm(
  value: string | null | undefined,
): HouseRoofAppendageForm | null {
  return value === 'mono' || value === 'flat' ? value : null;
}

function hasExplicitRoofPitch(value: string | null | undefined): boolean {
  return !isBlankString(value);
}

function hasExplicitRoofAppendage(
  value: HouseFirstRoofDraft['appendage'] | null | undefined,
): boolean {
  return value !== null && value !== undefined;
}

function isOrthogonal2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const alongStart = Number(start.alongM);
    const alongEnd = Number(end.alongM);
    const depthStart = Number(start.depthM);
    const depthEnd = Number(end.depthM);
    if (
      !Number.isFinite(alongStart) ||
      !Number.isFinite(alongEnd) ||
      !Number.isFinite(depthStart) ||
      !Number.isFinite(depthEnd)
    ) {
      return false;
    }
    if (Math.abs(alongStart - alongEnd) > 1e-6 && Math.abs(depthStart - depthEnd) > 1e-6) {
      return false;
    }
  }
  return true;
}

function isRectanglePolygon2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length !== 4 || !isOrthogonal2D(polygon)) return false;
  const along = polygon.map((point) => Number(point.alongM));
  const depth = polygon.map((point) => Number(point.depthM));
  return new Set(along.map((value) => value.toFixed(6))).size === 2 &&
    new Set(depth.map((value) => value.toFixed(6))).size === 2;
}

function inferLegacyRoofRidgeAxis(input: {
  footprintMode: CalculatorHouseFootprintMode;
  footprintPreset: CalculatorHouseFootprintPreset;
  footprintParams: CalculatorHouseFootprintParams;
  footprintPolygon: CalculatorHouseFootprintPolygonPoint[];
}): HouseRoofRidgeAxis {
  if (input.footprintMode === 'custom_polygon' && isRectanglePolygon2D(input.footprintPolygon)) {
    const alongValues = input.footprintPolygon.map((point) => Number(point.alongM));
    const depthValues = input.footprintPolygon.map((point) => Number(point.depthM));
    const spanAlong = Math.max(...alongValues) - Math.min(...alongValues);
    const spanDepth = Math.max(...depthValues) - Math.min(...depthValues);
    return spanAlong >= spanDepth ? 'x' : 'y';
  }
  if (input.footprintPreset === 'straight') {
    const widthM = Number(input.footprintParams.widthM);
    const bandDepthM = Number(input.footprintParams.bandDepthM);
    if (Number.isFinite(widthM) && Number.isFinite(bandDepthM) && bandDepthM > widthM) {
      return 'y';
    }
  }
  return 'x';
}

function resolveBoundingFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!polygon.length) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  if (
    alongValues.some((value) => !Number.isFinite(value)) ||
    depthValues.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

function resolveRectangularFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!isRectanglePolygon2D(polygon)) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

function hasAmbiguousRidgeAxisSelection(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  const spans = resolveRectangularFootprintSpans(polygon);
  if (!spans) return false;
  const longerSpan = Math.max(spans.alongM, spans.depthM);
  const shorterSpan = Math.min(spans.alongM, spans.depthM);
  if (!(Number.isFinite(longerSpan) && Number.isFinite(shorterSpan)) || shorterSpan <= 0) return false;
  return longerSpan < shorterSpan * 1.15;
}

function scoreGableTerminalTopology(input: {
  footprint: Polygon3;
  ridgeAxis: HouseRoofRidgeAxis;
}): number {
  return deriveHouseGableTerminalEnds({
    footprint: input.footprint,
    ridgeAxis: input.ridgeAxis,
  }).length;
}

function resolveDerivedMonoFallDirection(input: {
  attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
}): {
  value: HouseRoofPrimaryFallDirection;
  source: Extract<HouseRoofFieldSource, 'default_fallback'>;
} {
  return {
    value: preferredMonoFallDirectionForAttachmentSide(input.attachmentSide),
    source: 'default_fallback',
  };
}

function resolveDerivedRidgeAxis(input: {
  footprintMode: CalculatorHouseFootprintMode;
  footprintPreset: CalculatorHouseFootprintPreset;
  footprintParams: CalculatorHouseFootprintParams;
  footprintPolygon: CalculatorHouseFootprintPolygonPoint[];
}): DerivedRoofRidgeAxisResolution {
  const fallback = inferLegacyRoofRidgeAxis(input);
  const rectangularSpans = resolveRectangularFootprintSpans(input.footprintPolygon);
  if (rectangularSpans) {
    if (hasAmbiguousRidgeAxisSelection(input.footprintPolygon)) {
      return {
        value: fallback,
        source: 'default_fallback',
        ambiguous: true,
        usedFallback: true,
      };
    }
    return {
      value: rectangularSpans.alongM >= rectangularSpans.depthM ? 'x' : 'y',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }

  if (!isOrthogonal2D(input.footprintPolygon)) {
    return {
      value: fallback,
      source: 'default_fallback',
      ambiguous: true,
      usedFallback: true,
    };
  }

  const footprint = localPolygonToGeometryPolygon(input.footprintPolygon);
  const xScore = scoreGableTerminalTopology({ footprint, ridgeAxis: 'x' });
  const yScore = scoreGableTerminalTopology({ footprint, ridgeAxis: 'y' });
  if (xScore > yScore) {
    return {
      value: 'x',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }
  if (yScore > xScore) {
    return {
      value: 'y',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }

  const spans = resolveBoundingFootprintSpans(input.footprintPolygon);
  if (spans) {
    if (spans.alongM > spans.depthM * 1.05) {
      return {
        value: 'x',
        source: 'default_fallback',
        ambiguous: false,
        usedFallback: false,
      };
    }
    if (spans.depthM > spans.alongM * 1.05) {
      return {
        value: 'y',
        source: 'default_fallback',
        ambiguous: false,
        usedFallback: false,
      };
    }
  }

  return {
    value: fallback,
    source: 'default_fallback',
    ambiguous: true,
    usedFallback: true,
  };
}

function validateSharedRoof(input: {
  footprint: Polygon3;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofPrimaryFallDirectionExplicit: boolean;
  preferredMonoFallDirection: HouseRoofPrimaryFallDirection | null;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  attachmentRequiresDrainEdge: boolean;
  attachmentEdge: Line3 | null;
  roofRidgeAxis: HouseRoofRidgeAxis;
  roofRidgeAxisExplicit: boolean;
  preferredRidgeAxis: HouseRoofRidgeAxis | null;
  appendage: {
    enabled: boolean;
    form: HouseRoofAppendageForm;
    hostEdge: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  };
}): HouseModel['roof']['validation'] {
  const result = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.footprint,
    appendageEnabled: input.appendage.enabled,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofPrimaryFallDirectionExplicit: input.roofPrimaryFallDirectionExplicit,
    preferredMonoFallDirection: input.preferredMonoFallDirection,
    enforcePreferredMonoFallDirection: input.attachmentRequiresDrainEdge,
    roofRidgeAxis: input.roofRidgeAxis,
    roofRidgeAxisExplicit: input.roofRidgeAxisExplicit,
    preferredRidgeAxis: input.preferredRidgeAxis,
  });
  return {
    status: result.status,
    code: result.code,
    message: result.message,
    approximationReasons: [],
  };
}

function localPolygonToGeometryPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}

function buildLocalHouseAttachmentLine(input: {
  attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  zMm: number;
}): Line3 {
  const spanMm =
    input.attachmentSide === 'left' || input.attachmentSide === 'right'
      ? input.pergolaDepthMm
      : input.pergolaWidthMm;
  return {
    start: { x: 0, y: 0, z: input.zMm },
    end: { x: spanMm, y: 0, z: input.zMm },
  };
}

type LocalPolygonPoint = {
  alongM: number;
  depthM: number;
};

type DeckValidationContext = {
  housePolygon: LocalPolygonPoint[];
  existingDecks: Array<{ id: string; outline: LocalPolygonPoint[] }>;
};

function parseLocalPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): LocalPolygonPoint[] {
  return parseDeckLocalPolygon(polygon);
}

function localPolygonArea(polygon: LocalPolygonPoint[]): number {
  return polygon.reduce((sum, current, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return sum + current.alongM * next.depthM - next.alongM * current.depthM;
  }, 0) / 2;
}

function localSegmentsIntersect(
  a1: LocalPolygonPoint,
  a2: LocalPolygonPoint,
  b1: LocalPolygonPoint,
  b2: LocalPolygonPoint,
): boolean {
  const epsilon = 1e-6;
  const orientation = (p: LocalPolygonPoint, q: LocalPolygonPoint, r: LocalPolygonPoint) =>
    (q.depthM - p.depthM) * (r.alongM - q.alongM) - (q.alongM - p.alongM) * (r.depthM - q.depthM);
  const onSegment = (p: LocalPolygonPoint, q: LocalPolygonPoint, r: LocalPolygonPoint) =>
    q.alongM <= Math.max(p.alongM, r.alongM) + epsilon &&
    q.alongM + epsilon >= Math.min(p.alongM, r.alongM) &&
    q.depthM <= Math.max(p.depthM, r.depthM) + epsilon &&
    q.depthM + epsilon >= Math.min(p.depthM, r.depthM);
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (Math.abs(o1) <= epsilon && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= epsilon && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= epsilon && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= epsilon && onSegment(b1, a2, b2)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function polygonSelfIntersects(polygon: LocalPolygonPoint[]): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    const a1 = polygon[index]!;
    const a2 = polygon[(index + 1) % polygon.length]!;
    for (let otherIndex = index + 1; otherIndex < polygon.length; otherIndex += 1) {
      if (Math.abs(index - otherIndex) <= 1 || (index === 0 && otherIndex === polygon.length - 1)) continue;
      const b1 = polygon[otherIndex]!;
      const b2 = polygon[(otherIndex + 1) % polygon.length]!;
      if (localSegmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function pointInLocalPolygon(point: LocalPolygonPoint, polygon: LocalPolygonPoint[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.depthM > point.depthM !== previous.depthM > point.depthM &&
      point.alongM <
        ((previous.alongM - current.alongM) * (point.depthM - current.depthM)) /
          (previous.depthM - current.depthM || 1) +
          current.alongM;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnLocalSegment(
  point: LocalPolygonPoint,
  start: LocalPolygonPoint,
  end: LocalPolygonPoint,
  epsilon = 1e-6,
): boolean {
  const cross =
    (point.depthM - start.depthM) * (end.alongM - start.alongM) -
    (point.alongM - start.alongM) * (end.depthM - start.depthM);
  if (Math.abs(cross) > epsilon) return false;
  const dot =
    (point.alongM - start.alongM) * (point.alongM - end.alongM) +
    (point.depthM - start.depthM) * (point.depthM - end.depthM);
  return dot <= epsilon;
}

function pointOnLocalPolygonBoundary(point: LocalPolygonPoint, polygon: LocalPolygonPoint[]): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    if (pointOnLocalSegment(point, start, end)) return true;
  }
  return false;
}

function distanceToLocalSegment(point: LocalPolygonPoint, start: LocalPolygonPoint, end: LocalPolygonPoint): number {
  const dx = end.alongM - start.alongM;
  const dy = end.depthM - start.depthM;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(point.alongM - start.alongM, point.depthM - start.depthM);
  const ratio = Math.min(
    1,
    Math.max(
      0,
      ((point.alongM - start.alongM) * dx + (point.depthM - start.depthM) * dy) / lengthSq,
    ),
  );
  const along = start.alongM + dx * ratio;
  const depth = start.depthM + dy * ratio;
  return Math.hypot(point.alongM - along, point.depthM - depth);
}

function nearestHouseEdge(polygon: LocalPolygonPoint[], candidate: LocalPolygonPoint[]): {
  id: string | null;
  distanceMm: number | null;
  attachmentContactLengthMm: number | null;
} {
  if (!polygon.length || !candidate.length) {
    return { id: null, distanceMm: null, attachmentContactLengthMm: null };
  }
  let selectedId: string | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;
  let attachmentContactLengthMm = 0;
  const sample = candidate.reduce(
    (acc, point) => ({
      alongM: acc.alongM + point.alongM / candidate.length,
      depthM: acc.depthM + point.depthM / candidate.length,
    }),
    { alongM: 0, depthM: 0 },
  );
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const distance = distanceToLocalSegment(sample, start, end);
    if (distance < selectedDistance) {
      selectedDistance = distance;
      selectedId = `side-${index + 1}`;
    }
    for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex += 1) {
      const candidateStart = candidate[candidateIndex]!;
      const candidateEnd = candidate[(candidateIndex + 1) % candidate.length]!;
      const horizontalMatch =
        Math.abs(start.depthM - end.depthM) <= 1e-6 &&
        Math.abs(candidateStart.depthM - candidateEnd.depthM) <= 1e-6 &&
        Math.abs(start.depthM - candidateStart.depthM) <= 1e-6;
      const verticalMatch =
        Math.abs(start.alongM - end.alongM) <= 1e-6 &&
        Math.abs(candidateStart.alongM - candidateEnd.alongM) <= 1e-6 &&
        Math.abs(start.alongM - candidateStart.alongM) <= 1e-6;
      if (horizontalMatch) {
        const overlap = Math.max(
          0,
          Math.min(Math.max(start.alongM, end.alongM), Math.max(candidateStart.alongM, candidateEnd.alongM)) -
            Math.max(Math.min(start.alongM, end.alongM), Math.min(candidateStart.alongM, candidateEnd.alongM)),
        );
        attachmentContactLengthMm = Math.max(attachmentContactLengthMm, Math.round(overlap * 1000));
      } else if (verticalMatch) {
        const overlap = Math.max(
          0,
          Math.min(Math.max(start.depthM, end.depthM), Math.max(candidateStart.depthM, candidateEnd.depthM)) -
            Math.max(Math.min(start.depthM, end.depthM), Math.min(candidateStart.depthM, candidateEnd.depthM)),
        );
        attachmentContactLengthMm = Math.max(attachmentContactLengthMm, Math.round(overlap * 1000));
      }
    }
  }
  return {
    id: selectedId,
    distanceMm: Number.isFinite(selectedDistance) ? Math.round(selectedDistance * 1000) : null,
    attachmentContactLengthMm,
  };
}

function outlinesOverlap(left: LocalPolygonPoint[], right: LocalPolygonPoint[]): boolean {
  if (!left.length || !right.length) return false;
  if (left.some((point) => pointInLocalPolygon(point, right))) return true;
  if (right.some((point) => pointInLocalPolygon(point, left))) return true;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex]!;
    const leftEnd = left[(leftIndex + 1) % left.length]!;
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex]!;
      const rightEnd = right[(rightIndex + 1) % right.length]!;
      if (localSegmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) return true;
    }
  }
  return false;
}

function validateDeckDraft(
  deck: HouseFirstDeckDraft,
  context: DeckValidationContext,
): {
  validation: {
    status: 'valid' | 'invalid';
    codes: DeckValidationCode[];
    messages: string[];
    message: string | null;
  };
  supportContext: {
    classification: DeckSupportClassification;
    nearestHouseEdgeId: string | null;
    nearestHouseEdgeDistanceMm: number | null;
    attachmentContactLengthMm: number | null;
    warningCodes: DeckSupportWarningCode[];
    warningMessages: string[];
  };
  topSurfaceElevationMm: number;
} {
  const outline = parseLocalPolygon(deck.outline ?? []);
  const codes: DeckValidationCode[] = [];
  const messages: string[] = [];
  const warningCodes: DeckSupportWarningCode[] = [];
  const warningMessages: string[] = [];
  const nearestEdge = nearestHouseEdge(context.housePolygon, outline);
  const levelOffsetMm = Math.round(Number(deck.levelOffsetMm ?? '0') || 0);
  const isAttached = Boolean(deck.isAttached);
  const elevationMode = deck.elevationMode ?? 'ground';

  if (outline.length < 3 || Math.abs(localPolygonArea(outline)) <= 1e-6) {
    codes.push('unsupported_house_intersection');
    messages.push('Deck outlines need at least three valid points.');
  } else {
    if (polygonSelfIntersects(outline)) {
      codes.push('self_intersecting_outline');
      messages.push('Deck outline cannot self-intersect.');
    }
    if (
      outline.some(
        (point) =>
          !pointOnLocalPolygonBoundary(point, context.housePolygon) &&
          pointInLocalPolygon(point, context.housePolygon),
      )
    ) {
      codes.push('outline_inside_house');
      messages.push('Deck outline overlaps the house interior in an unsupported way.');
    }
    for (const existing of context.existingDecks) {
      if (existing.id !== deck.id && outlinesOverlap(outline, existing.outline)) {
        codes.push('overlapping_decks');
        messages.push('Decks cannot overlap each other in this milestone.');
        break;
      }
    }
  }

  if (isAttached && isBlankString(deck.hostEdgeId ?? '')) {
    codes.push('attached_missing_host_edge');
    messages.push('Attached decks need a host edge.');
  }
  if (!isAttached && elevationMode === 'aligned_to_threshold') {
    codes.push('detached_threshold_alignment');
    messages.push('Detached decks cannot use threshold-aligned elevation.');
  }

  if (isAttached && (nearestEdge.attachmentContactLengthMm ?? 0) < 200) {
    warningCodes.push('insufficient_host_edge_contact');
    warningMessages.push('Attached deck contact to the selected host edge is too small to classify cleanly.');
  }
  if (!isAttached && (nearestEdge.distanceMm ?? Number.POSITIVE_INFINITY) < 150) {
    warningCodes.push('detached_too_close_to_house');
    warningMessages.push('Detached deck is too close to the house to classify cleanly.');
  }
  if (elevationMode === 'aligned_to_threshold' && Math.abs(levelOffsetMm) > 600) {
    warningCodes.push('threshold_alignment_offset');
    warningMessages.push('Threshold-aligned decks should stay close to the house threshold datum.');
  }
  if (codes.includes('outline_inside_house')) {
    warningCodes.push('unsupported_house_intersection');
    warningMessages.push('Deck outline crosses unsupported house geometry zones.');
  }

  const classification: DeckSupportClassification =
    isAttached && elevationMode === 'aligned_to_threshold'
      ? 'threshold_attached'
      : !isAttached && elevationMode === 'ground'
        ? 'ground_supported'
        : 'mixed_or_unclear';

  return {
    validation: {
      status: codes.length ? 'invalid' : 'valid',
      codes,
      messages,
      message: messages[0] ?? null,
    },
    supportContext: {
      classification,
      nearestHouseEdgeId: nearestEdge.id,
      nearestHouseEdgeDistanceMm: nearestEdge.distanceMm,
      attachmentContactLengthMm: nearestEdge.attachmentContactLengthMm,
      warningCodes,
      warningMessages,
    },
    topSurfaceElevationMm:
      elevationMode === 'ground'
        ? Math.max(0, levelOffsetMm)
        : elevationMode === 'aligned_to_threshold'
          ? levelOffsetMm
          : levelOffsetMm,
  };
}

function resolvePergolaFamily(module: CalculatorModuleInputs): PergolaModel['family'] {
  if (module.boxPerimeterEnabled) return 'box';
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  if (module.pergolaStyle === 'pitched') return 'mono';
  return 'unknown';
}

function resolvePergolaAttachmentKind(
  module: CalculatorModuleInputs,
): PergolaModel['attachment']['kind'] {
  if (module.houseConnectionType === 'none') return 'freestanding';
  if (module.houseConnectionType === 'facade') return 'wall';
  return module.houseConnectionType;
}

const HOUSE_ATTACHMENT_SIDES = ['rear', 'front', 'left', 'right'] as const;

function formatAttachmentZoneLabel(
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>,
  kind: HouseAttachmentZoneKind,
): string {
  return `${side.charAt(0).toUpperCase()}${side.slice(1)} ${kind.replace('_', ' ')}`;
}

function resolveAttachmentStrategyZoneKinds(
  strategy: CalculatorHouseAttachmentStrategy | null,
): HouseAttachmentZoneKind[] {
  if (strategy === 'none') return [];
  const kinds = new Set<HouseAttachmentZoneKind>();
  if (strategy === 'facade_ledger' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('wall');
  }
  if (strategy === 'soffit_brackets' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('soffit');
  }
  if (strategy === 'fascia_under_gutter' || strategy === null) {
    kinds.add('fascia');
  }
  if (strategy === 'fascia_under_gutter') {
    kinds.add('roof_edge');
  }
  return Array.from(kinds);
}

function deriveSharedAttachmentZones(input: {
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  roof: Pick<HouseModel['roof'], 'form' | 'validation'>;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  openings: HouseModel['openings'];
}): {
  zones: HouseModel['attachmentZones'];
  diagnostics: HouseModel['attachmentZoneDiagnostics'];
} {
  const candidateKinds = resolveAttachmentStrategyZoneKinds(input.attachmentStrategy);
  const zones: HouseModel['attachmentZones'] = [];
  const blocked: HouseModel['attachmentZoneDiagnostics']['blocked'] = [];
  if (!candidateKinds.length) {
    return {
      zones,
      diagnostics: { blocked },
    };
  }

  for (const side of HOUSE_ATTACHMENT_SIDES) {
    const frame = resolveDeckHostEdgeFrame({
      housePolygon: input.housePolygon,
      hostEdgeId: side,
    });
    const sideOpenings = input.openings.filter(
      (opening) => opening.wallId === side && opening.validation.status === 'valid',
    );
    const hasAnyOpening = sideOpenings.length > 0;
    const hasLargeOpening = sideOpenings.some(
      (opening) => opening.kind === 'slider' || opening.kind === 'stacker',
    );

    for (const kind of candidateKinds) {
      if (!frame) {
        blocked.push({
          side,
          kind,
          reason: 'missing_host_edge',
        });
        continue;
      }
      if (kind === 'roof_edge' && input.roof.form === 'flat') {
        blocked.push({
          side,
          kind,
          reason: 'unsupported_roof_form',
        });
        continue;
      }
      if ((kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') && input.roof.validation.status === 'invalid') {
        blocked.push({
          side,
          kind,
          reason: 'invalid_roof_state',
        });
        continue;
      }
      if (kind === 'wall' && hasAnyOpening) {
        blocked.push({
          side,
          kind,
          reason: 'side_openings_block_wall',
        });
        continue;
      }
      if ((kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') && hasLargeOpening) {
        blocked.push({
          side,
          kind,
          reason: 'side_openings_block_roof_zone',
        });
        continue;
      }
      zones.push({
        id: `zone-${kind}-${side}`,
        label: formatAttachmentZoneLabel(side, kind),
        kind,
        side,
      });
    }
  }

  return {
    zones,
    diagnostics: { blocked },
  };
}

const MIN_WINDOW_WIDTH_M = 0.3;
const MIN_WINDOW_HEIGHT_M = 0.3;
const MIN_SLIDER_CORNER_CLEARANCE_M = 0.3;

function formatOpeningMetres(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function parseFiniteOpeningMetres(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOpeningWallId(
  value: string | null | undefined,
  fallback: NonNullable<CalculatorModuleInputs['attachmentSide']>,
): NonNullable<CalculatorModuleInputs['attachmentSide']> {
  if (value === 'front' || value === 'left' || value === 'right' || value === 'rear') return value;
  return fallback;
}

function normalizeExactOpeningHostEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

function buildSharedOpenings(input: {
  openingDrafts: HouseFirstOpeningDraft[] | null | undefined;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  fallbackWallId: NonNullable<CalculatorModuleInputs['attachmentSide']>;
}): HouseModel['openings'] {
  const openings: HouseModel['openings'] = [];
  const occupiedByWall = new Map<string, Array<{ start: number; end: number }>>();

  for (const draft of input.openingDrafts ?? []) {
    if (!draft || typeof draft.id !== 'string' || draft.id.trim().length === 0) continue;
    const requestedWallId = normalizeOpeningWallId(draft.wallId, input.fallbackWallId);
    const exactHostEdgeId = normalizeExactOpeningHostEdgeId(draft.hostEdgeId);
    const kind = normalizeWallOpeningKind(draft.kind);
    const exactFrame = exactHostEdgeId
      ? resolveDeckHostEdgeFrame({
          housePolygon: input.housePolygon,
          hostEdgeId: exactHostEdgeId,
        })
      : null;
    const frame =
      exactFrame && exactFrame.hostEdge === requestedWallId
        ? exactFrame
        : resolveDeckHostEdgeFrame({
            housePolygon: input.housePolygon,
            hostEdgeId: requestedWallId,
          });
    const wallId = frame?.hostEdge ?? requestedWallId;
    const hostEdgeId = frame?.sourceEdgeId ?? exactHostEdgeId;
    const panelCount = resolveOpeningPanelCount(kind, draft.panelCount);
    const widthM = parseFiniteOpeningMetres(draft.widthM, 1.8);
    const heightM = parseFiniteOpeningMetres(draft.heightM, 1.2);
    const sillHeightM = parseFiniteOpeningMetres(draft.sillHeightM, 0.9);
    const offsetAlongWallM = parseFiniteOpeningMetres(draft.offsetAlongWallM, 0.6);
    const wallSpanM = frame ? Math.max(0, frame.end - frame.start) : 0;
    const codes: HouseModel['openings'][number]['validation']['codes'] = [];

    if (!frame) codes.push('missing_host_wall');
    if (!Number.isFinite(widthM) || widthM < MIN_WINDOW_WIDTH_M) codes.push('invalid_width');
    if (!Number.isFinite(heightM) || heightM < MIN_WINDOW_HEIGHT_M) codes.push('invalid_height');
    if (!Number.isFinite(sillHeightM) || sillHeightM < 0) codes.push('invalid_sill_height');
    if (!Number.isFinite(offsetAlongWallM) || offsetAlongWallM < 0) codes.push('offset_out_of_bounds');
    if (frame && Number.isFinite(widthM) && widthM > wallSpanM + 1e-6) codes.push('span_exceeds_wall');
    if (frame && Number.isFinite(offsetAlongWallM) && offsetAlongWallM > wallSpanM + 1e-6) codes.push('offset_out_of_bounds');
    if (
      frame &&
      Number.isFinite(widthM) &&
      Number.isFinite(offsetAlongWallM) &&
      offsetAlongWallM + widthM > wallSpanM + 1e-6
    ) {
      codes.push('span_exceeds_wall');
    }
    if (
      (kind === 'slider' || kind === 'stacker') &&
      frame &&
      Number.isFinite(widthM) &&
      Number.isFinite(offsetAlongWallM) &&
      offsetAlongWallM >= 0 &&
      widthM >= 0
    ) {
      const rightClearanceM = wallSpanM - (offsetAlongWallM + widthM);
      if (
        offsetAlongWallM < MIN_SLIDER_CORNER_CLEARANCE_M - 1e-6 ||
        rightClearanceM < MIN_SLIDER_CORNER_CLEARANCE_M - 1e-6
      ) {
        codes.push('insufficient_corner_clearance');
      }
    }

    const intervalStart = offsetAlongWallM;
    const intervalEnd = offsetAlongWallM + widthM;
    const occupancyKey = hostEdgeId ?? wallId;
    const existingIntervals = occupiedByWall.get(occupancyKey) ?? [];
    if (
      frame &&
      codes.length === 0 &&
      existingIntervals.some(
        (interval) =>
          Math.min(interval.end, intervalEnd) - Math.max(interval.start, intervalStart) > 1e-6,
      )
    ) {
      codes.push('overlapping_openings');
    }

    const message =
      codes[0] === 'missing_host_wall'
        ? 'Select a valid wall before placing this opening.'
        : codes[0] === 'invalid_width'
          ? 'Opening width must be at least 0.3m.'
          : codes[0] === 'invalid_height'
            ? 'Opening height must be at least 0.3m.'
            : codes[0] === 'invalid_sill_height'
              ? 'Opening base height must be zero or greater.'
              : codes[0] === 'offset_out_of_bounds'
                ? 'Opening offset must stay on the selected wall.'
                : codes[0] === 'span_exceeds_wall'
                  ? 'Opening width extends beyond the selected wall span.'
                  : codes[0] === 'insufficient_corner_clearance'
                    ? `Sliders and stackers need at least ${MIN_SLIDER_CORNER_CLEARANCE_M.toFixed(1)}m clearance from each wall corner.`
                    : codes[0] === 'overlapping_openings'
                      ? 'Openings on the same wall cannot overlap.'
                      : null;

    const opening: HouseModel['openings'][number] = {
      id: draft.id.trim(),
      label: draft.label?.trim() || `Window ${openings.length + 1}`,
      kind,
      panelCount,
      wallId,
      hostEdgeId,
      widthM: formatOpeningMetres(widthM),
      heightM: formatOpeningMetres(heightM),
      sillHeightM: formatOpeningMetres(sillHeightM),
      offsetAlongWallM: formatOpeningMetres(offsetAlongWallM),
      validation: {
        status: codes.length ? 'invalid' : 'valid',
        codes,
        message,
      },
    };
    openings.push(opening);
    if (!codes.length) {
      existingIntervals.push({ start: intervalStart, end: intervalEnd });
      occupiedByWall.set(occupancyKey, existingIntervals);
    }
  }

  return openings;
}

function buildSharedDecks(input: {
  deckDrafts: HouseFirstDeckDraft[] | null | undefined;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  footprintParams: CalculatorHouseFootprintParams;
}): HouseModel['decks'] {
  const deckDrafts = input.deckDrafts ?? [];
  const existingDecks: Array<{ id: string; outline: LocalPolygonPoint[] }> = [];
  const decks: HouseModel['decks'] = [];
  const deckReferenceHousePolygon = buildDeckReferenceHousePolygon({
    housePolygon: input.housePolygon,
    footprintParams: input.footprintParams,
  });

  for (const draft of deckDrafts) {
    if (!draft || typeof draft.id !== 'string' || draft.id.trim().length === 0) continue;
    const presetGeometry = resolveDeckPresetGeometry({
      deck: {
        ...draft,
        outline: normalizeHouseFootprintPolygon(draft.outline),
      },
      housePolygon: deckReferenceHousePolygon,
    });
    const outline = normalizeHouseFootprintPolygon(presetGeometry.outline);
    const evaluated = validateDeckDraft(
      {
        ...draft,
        hostEdgeId: presetGeometry.hostEdgeId,
        presetRect: presetGeometry.presetRect,
        outline,
      },
      {
        housePolygon: parseLocalPolygon(deckReferenceHousePolygon),
        existingDecks,
      },
    );
    const deck: HouseModel['decks'][number] = {
      id: draft.id.trim(),
      name: draft.name?.trim() || `Deck ${decks.length + 1}`,
      kind: draft.kind === 'landing' ? 'landing' : 'deck',
      shape: draft.shape === 'custom' ? 'custom' : 'preset',
      presetType:
        draft.presetType === 'rect_detached'
          ? 'rect_detached'
          : draft.presetType === 'rect_attached'
            ? 'rect_attached'
            : null,
      presetRect: presetGeometry.presetRect,
      floatingRect: presetGeometry.floatingRect,
      outline,
      elevationMode:
        draft.elevationMode === 'aligned_to_threshold' || draft.elevationMode === 'stepped'
          ? draft.elevationMode
          : 'ground',
      levelOffsetMm: draft.levelOffsetMm?.trim() || '0',
      hostEdgeId: presetGeometry.hostEdgeId,
      isAttached: Boolean(draft.isAttached),
      surfaceMaterial:
        draft.surfaceMaterial === 'composite' || draft.surfaceMaterial === 'concrete'
          ? draft.surfaceMaterial
          : 'timber_decking',
      topSurfaceElevationMm: evaluated.topSurfaceElevationMm,
      supportContext: evaluated.supportContext,
      validation: evaluated.validation,
    };
    decks.push(deck);
    existingDecks.push({ id: deck.id, outline: parseLocalPolygon(deck.outline) });
  }

  return decks;
}

function normalizeStoreyMode(value: CalculatorModuleInputs['houseStoreyMode']): CalculatorHouseStoreyMode {
  if (value === 'double_storey' || value === 'custom') return value;
  return 'single_storey';
}

function isBlankFootprintParams(value: CalculatorHouseFootprintParams | undefined): boolean {
  return stableStringify(normalizeHouseFootprintParams(value)) === stableStringify(makeDefaultHouseFootprintParams());
}

function resolveSharedHouseField<T>(
  modules: CalculatorModuleInputs[],
  config: SharedFieldConfig<T>,
): SharedFieldResult<T> {
  const normalizedEntries = modules.map((module, moduleIndex) => {
    const rawValue = config.pick(module);
    const value = config.normalize ? config.normalize(rawValue) : rawValue;
    return {
      moduleIndex,
      value,
      comparable: stableStringify(value),
      blank: config.isBlank ? config.isBlank(value) : value === null || value === undefined,
    };
  });
  const populated = normalizedEntries.filter((entry) => !entry.blank);
  if (!populated.length) {
    return {
      value: config.fallback,
      warning: null,
      lowConfidence: false,
      source: 'default_fallback',
    };
  }

  const firstPopulated = populated[0]!;
  const conflict = populated.find((entry) => entry.comparable !== firstPopulated.comparable);
  if (!conflict) {
    return {
      value: firstPopulated.value,
      warning: null,
      lowConfidence: false,
      source: 'legacy_shared_value',
    };
  }

  const conflictingModuleIndexes = Array.from(
    new Set(populated.map((entry) => entry.moduleIndex)),
  );
  return {
    value: firstPopulated.value,
    warning: {
      id: `house-field-${config.field}`,
      code: 'conflicting_house_field',
      severity: 'blocking',
      field: config.field,
      chosenModuleIndex: firstPopulated.moduleIndex,
      conflictingModuleIndexes,
      message: `Legacy modules disagree on house ${config.field}. Using module ${firstPopulated.moduleIndex + 1} as the temporary shared value.`,
    },
    lowConfidence: true,
    source: 'legacy_shared_value',
  };
}

function buildSharedHouse(
  modules: CalculatorModuleInputs[],
  roofDraft?: HouseFirstRoofDraft | null,
  deckDrafts?: HouseFirstDeckDraft[] | null,
  openingDrafts?: HouseFirstOpeningDraft[] | null,
): {
  house: HouseModel | null;
  warnings: HouseFirstMigrationWarning[];
} {
  if (!modules.length) {
    return {
      house: null,
      warnings: [],
    };
  }

  const warnings: HouseFirstMigrationWarning[] = [];
  let lowConfidence = false;
  const collectResult = <T,>(config: SharedFieldConfig<T>) => {
    const result = resolveSharedHouseField(modules, config);
    if (result.warning) warnings.push(result.warning);
    if (result.lowConfidence) lowConfidence = true;
    return result;
  };
  const collect = <T,>(config: SharedFieldConfig<T>) => collectResult(config).value;

  const preset = collect({
    field: 'footprint preset',
    fallback: 'straight',
    pick: (module) => module.houseFootprintPreset,
    normalize: (value) => normalizeHouseFootprintPreset(value),
  });
  const footprintMode = collect({
    field: 'footprint mode',
    fallback: 'preset',
    pick: (module) => module.houseFootprintMode,
    normalize: (value) => normalizeHouseFootprintMode(value),
  });
  const footprintParams = collect({
    field: 'footprint params',
    fallback: makeDefaultHouseFootprintParams(),
    pick: (module) => module.houseFootprintParams,
    normalize: (value) => normalizeHouseFootprintParams(value),
    isBlank: (value) => isBlankFootprintParams(value),
  });
  const footprintPolygon = collect({
    field: 'footprint polygon',
    fallback: [] as CalculatorHouseFootprintPolygonPoint[],
    pick: (module) => module.houseFootprintPolygon,
    normalize: (value) => normalizeHouseFootprintPolygon(value),
    isBlank: (value) => normalizeHouseFootprintPolygon(value).length === 0,
  });
  const drawingRotationQuarterTurns = collect({
    field: 'drawing rotation',
    fallback: 0,
    pick: (module) => module.drawingRotationQuarterTurns ?? 0,
    normalize: (value) => normalizeDrawingRotationQuarterTurns(value),
  });
  const attachmentSide = collect({
    field: 'attachment side',
    fallback: 'rear',
    pick: (module) => module.attachmentSide ?? 'rear',
    normalize: (value) => normalizeAttachmentSide(value),
  });
  const storeyMode = collect({
    field: 'storey mode',
    fallback: 'single_storey' as const,
    pick: (module) => module.houseStoreyMode,
    normalize: (value) => normalizeStoreyMode(value),
  });
  const attachmentStrategy = collect({
    field: 'attachment strategy',
    fallback: null as CalculatorHouseAttachmentStrategy | null,
    pick: (module) => pickFirstDefined(module.houseAttachmentStrategy, null),
    isBlank: (value) => value === null,
  });
  const eaveHeightM = collect({
    field: 'eave height',
    fallback: '',
    pick: (module) => module.houseEaveHeightM ?? '',
    isBlank: isBlankString,
  });
  const wallHeightM = collect({
    field: 'wall height',
    fallback: '',
    pick: (module) => module.houseWallHeightM ?? '',
    isBlank: isBlankString,
  });
  const roofPitchResult = collectResult({
    field: 'roof pitch',
    fallback: '',
    pick: (module) => module.houseRoofPitchDeg ?? '',
    isBlank: isBlankString,
  });
  const roofPitchDeg = roofPitchResult.value;
  const soffitDepthMm = collect({
    field: 'soffit depth',
    fallback: '',
    pick: (module) => module.houseSoffitDepthMm ?? '',
    isBlank: isBlankString,
  });
  const fasciaHeightMm = collect({
    field: 'fascia height',
    fallback: '',
    pick: (module) => module.houseFasciaHeightMm ?? '',
    isBlank: isBlankString,
  });
  const gutterWidthMm = collect({
    field: 'gutter width',
    fallback: '',
    pick: (module) => module.houseGutterWidthMm ?? '',
    isBlank: isBlankString,
  });
  const gutterDepthMm = collect({
    field: 'gutter depth',
    fallback: '',
    pick: (module) => module.houseGutterDepthMm ?? '',
    isBlank: isBlankString,
  });
  const gutterProjectionMm = collect({
    field: 'gutter projection',
    fallback: '',
    pick: (module) => module.houseGutterProjectionMm ?? '',
    isBlank: isBlankString,
  });
  const eaveOverhangMm = collect({
    field: 'eave overhang',
    fallback: '',
    pick: (module) => module.houseEaveOverhangMm ?? '',
    isBlank: isBlankString,
  });
  const roofMaterialResult = collectResult({
    field: 'roof material',
    fallback: 'corrugated_iron',
    pick: (module) => module.houseRoofMaterial,
    normalize: (value) => normalizeHouseRoofMaterial(value),
  });
  const roofMaterial = roofMaterialResult.value;
  const roofForm = collect({
    field: 'roof form',
    fallback: 'mono' as const,
    pick: (module) => resolveHouseRoofForm(module),
  });

  const sourceModuleIds = modules.map((_, index) => `module-${index + 1}`);
  const attachmentKind = resolvePergolaAttachmentKind(modules[0]!);
  const normalizedFootprintMode = normalizeHouseFootprintMode(footprintMode) as CalculatorHouseFootprintMode;
  const normalizedFootprintPreset = normalizeHouseFootprintPreset(preset) as CalculatorHouseFootprintPreset;
  const normalizedFootprintParams = normalizeHouseFootprintParams(footprintParams);
  const normalizedFootprintPolygon = normalizeHouseFootprintPolygon(footprintPolygon);
  const normalizedDrawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(
    drawingRotationQuarterTurns,
  ) as CalculatorDrawingRotationQuarterTurns;
  const normalizedAttachmentSide = normalizeAttachmentSide(
    attachmentSide,
  ) as NonNullable<CalculatorModuleInputs['attachmentSide']>;
  const normalizedRoofMaterial = normalizeHouseRoofMaterial(roofMaterial) as CalculatorHouseRoofMaterial;
  const normalizedStoreyMode = normalizeStoreyMode(storeyMode) as CalculatorHouseStoreyMode;
  const firstModuleLengthMm = Math.round((Number(modules[0]!.lengthM) || 6) * 1000);
  const firstModuleProjectionMm = Math.round((Number(modules[0]!.projectionM) || 3) * 1000);
  const derivedHousePolygon =
    normalizedFootprintMode === 'custom_polygon'
      ? normalizedFootprintPolygon
      : buildHouseFootprintPresetSideLocalPoints({
          pergolaWidthMm: firstModuleLengthMm,
          pergolaDepthMm: firstModuleProjectionMm,
          preset: normalizedFootprintPreset,
          params: normalizedFootprintParams,
          attachmentSide: normalizedAttachmentSide,
        }).map((point) => ({
          alongM: String(point.alongM),
          depthM: String(point.depthM),
        }));
  const inferredPrimaryPitchDeg = roofPitchDeg;
  const derivedMonoFallDirection = resolveDerivedMonoFallDirection({
    attachmentSide: normalizedAttachmentSide,
  });
  const derivedRidgeAxis = resolveDerivedRidgeAxis({
    footprintMode: normalizedFootprintMode,
    footprintPreset: normalizedFootprintPreset,
    footprintParams: normalizedFootprintParams,
    footprintPolygon: derivedHousePolygon,
  });
  const normalizedRoofDraft = roofDraft ?? null;
  const explicitRoofForm = normalizedRoofDraft?.form ?? null;
  const explicitRoofMaterial = normalizedRoofDraft?.material ?? null;
  const explicitRoofPitchDeg = normalizedRoofDraft?.primaryPitchDeg ?? null;
  const explicitPrimaryFallDirection = normalizeRoofPrimaryFallDirection(
    normalizedRoofDraft?.primaryFallDirection,
  );
  const explicitRidgeAxis = normalizeRoofRidgeAxis(normalizedRoofDraft?.ridgeAxis);
  const explicitOpenGableEndIds = normalizedRoofDraft?.openGableEndIds;
  const explicitAppendage = normalizedRoofDraft?.appendage ?? null;
  const sharedRoofForm = explicitRoofForm ?? roofForm;
  const sharedRoofPitchDeg = normalizeRoofDraftPitch(
    explicitRoofPitchDeg,
    inferredPrimaryPitchDeg,
  );
  const sharedRoofMaterial =
    explicitRoofMaterial
      ? (normalizeHouseRoofMaterial(explicitRoofMaterial) as CalculatorHouseRoofMaterial)
      : normalizedRoofMaterial;
  const sharedPrimaryFallDirection =
    explicitPrimaryFallDirection ??
    derivedMonoFallDirection.value;
  const sharedRidgeAxis =
    explicitRidgeAxis ??
    derivedRidgeAxis.value;
  const roofProvenance: HouseRoofProvenance = {
    form: explicitRoofForm ? 'house_first_draft' : 'legacy_pergola_inference',
    material: explicitRoofMaterial ? 'house_first_draft' : roofMaterialResult.source,
    primaryPitchDeg: hasExplicitRoofPitch(explicitRoofPitchDeg)
      ? 'house_first_draft'
      : roofPitchResult.source,
    primaryFallDirection: explicitPrimaryFallDirection
      ? 'house_first_draft'
      : derivedMonoFallDirection.source,
    ridgeAxis: explicitRidgeAxis ? 'house_first_draft' : derivedRidgeAxis.source,
    openGableEndIds: Array.isArray(explicitOpenGableEndIds) ? 'house_first_draft' : 'default_fallback',
    appendage: hasExplicitRoofAppendage(explicitAppendage) ? 'house_first_draft' : 'default_fallback',
  };
  const terminalEnds = deriveHouseGableTerminalEnds({
    footprint: localPolygonToGeometryPolygon(derivedHousePolygon),
    ridgeAxis: sharedRidgeAxis,
  });
  const validTerminalEndIds = new Set(terminalEnds.map((end) => end.id));
  const requestedOpenGableEndIds = normalizeRoofOpenGableEndIds(
    normalizedRoofDraft?.openGableEndIds,
  );
  const openGableEndIds = requestedOpenGableEndIds.filter((id) => validTerminalEndIds.has(id));
  if (requestedOpenGableEndIds.length !== openGableEndIds.length) {
    warnings.push({
      id: 'house-roof-open-gable-ends',
      code: 'invalid_house_first_roof_overlay',
      severity: 'blocking',
      field: 'houseFirst.roof.openGableEndIds',
      chosenModuleIndex: 0,
      conflictingModuleIndexes: [],
      message: 'Some saved open gable ends no longer match the current footprint or ridge orientation and were cleared.',
    });
  }
  const appendage = {
    enabled: Boolean(explicitAppendage?.enabled),
    form: normalizeAppendageForm(explicitAppendage?.form) ?? 'mono',
    hostEdge: normalizeAttachmentSide(
      explicitAppendage?.hostEdge ?? normalizedAttachmentSide,
    ) as NonNullable<CalculatorModuleInputs['attachmentSide']>,
    pitchDeg: normalizeRoofDraftPitch(
      explicitAppendage?.pitchDeg ?? null,
      sharedRoofPitchDeg,
    ),
    dropMm: normalizeRoofDraftPitch(
      explicitAppendage?.dropMm ?? null,
      '450',
    ),
  };
  const validation = validateSharedRoof({
    footprint: localPolygonToGeometryPolygon(derivedHousePolygon),
    roofForm: sharedRoofForm,
    roofPrimaryFallDirection: sharedPrimaryFallDirection,
    roofPrimaryFallDirectionExplicit: explicitPrimaryFallDirection !== null,
    preferredMonoFallDirection:
      sharedRoofForm === 'mono'
        ? derivedMonoFallDirection.value
        : null,
    attachmentStrategy,
    attachmentRequiresDrainEdge:
      attachmentKind === 'soffit' || attachmentKind === 'fascia',
    attachmentEdge:
      attachmentKind === 'freestanding' || attachmentKind === 'wall'
        ? null
        : buildLocalHouseAttachmentLine({
            attachmentSide: normalizedAttachmentSide,
            pergolaWidthMm: firstModuleLengthMm,
            pergolaDepthMm: firstModuleProjectionMm,
            zMm: 0,
          }),
    roofRidgeAxis: sharedRidgeAxis,
    roofRidgeAxisExplicit: explicitRidgeAxis !== null,
    preferredRidgeAxis:
      sharedRoofForm === 'gable' || sharedRoofForm === 'hipped'
        ? derivedRidgeAxis.value
        : null,
    appendage: {
      enabled: appendage.enabled,
      form: appendage.form,
      hostEdge: appendage.hostEdge,
    },
  });
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: sharedRoofForm,
    footprint: localPolygonToGeometryPolygon(derivedHousePolygon),
  });
  const approximationReasons = new Set<HouseRoofApproximationReason>();
  if (roofProvenance.form === 'legacy_pergola_inference') {
    approximationReasons.add('inferred_form');
  }
  if (
    sharedRoofForm === 'mono' &&
    explicitPrimaryFallDirection === null &&
    roofProvenance.primaryFallDirection === 'legacy_pergola_inference'
  ) {
    approximationReasons.add('inferred_fall_direction');
  }
  const ridgeAxisRelevant = sharedRoofForm === 'gable' || sharedRoofForm === 'hipped';
  if (ridgeAxisRelevant && explicitRidgeAxis === null && derivedRidgeAxis.usedFallback) {
    approximationReasons.add('inferred_ridge_axis');
  }
  if (
    ridgeAxisRelevant &&
    explicitRidgeAxis === null &&
    derivedRidgeAxis.ambiguous
  ) {
    approximationReasons.add('ambiguous_ridge_axis');
  }
  const roofApproximationReasons = Array.from(approximationReasons);
  const roofValidation: HouseModel['roof']['validation'] =
    validation.status === 'invalid'
      ? {
          ...validation,
          approximationReasons: roofApproximationReasons,
        }
      : {
          ...validation,
          status: roofApproximationReasons.length > 0 ? 'approximate' : 'valid',
          approximationReasons: roofApproximationReasons,
        };
  const hasExplicitRoofDraftField =
    explicitRoofForm !== null ||
    explicitRoofMaterial !== null ||
    hasExplicitRoofPitch(explicitRoofPitchDeg) ||
    explicitPrimaryFallDirection !== null ||
    explicitRidgeAxis !== null ||
    (explicitOpenGableEndIds !== undefined && explicitOpenGableEndIds !== null) ||
    hasExplicitRoofAppendage(explicitAppendage);
  const decks = buildSharedDecks({
    deckDrafts,
    housePolygon: derivedHousePolygon,
    footprintParams: normalizedFootprintParams,
  });
  const openings = buildSharedOpenings({
    openingDrafts,
    housePolygon: derivedHousePolygon,
    fallbackWallId: normalizedAttachmentSide,
  });
  const attachmentZones = deriveSharedAttachmentZones({
    housePolygon: derivedHousePolygon,
    roof: {
      form: sharedRoofForm,
      validation: roofValidation,
    },
    attachmentStrategy,
    openings,
  });

  return {
    house: {
      id: 'house-main',
      label: 'House',
      confidence: lowConfidence ? 'low' : 'high',
      lowConfidence,
      sourceModuleIndexes: modules.map((_, index) => index),
      sourceModuleIds,
      footprint: {
        mode: normalizedFootprintMode,
        preset: normalizedFootprintPreset,
        params: normalizedFootprintParams,
        polygon: normalizedFootprintPolygon,
        drawingRotationQuarterTurns: normalizedDrawingRotationQuarterTurns,
        attachmentSide: normalizedAttachmentSide,
      },
      roof: {
        id: 'house-roof-main',
        form: sharedRoofForm,
        material: sharedRoofMaterial,
        pitchDeg: sharedRoofPitchDeg,
        primaryPitchDeg: sharedRoofPitchDeg,
        primaryFallDirection: sharedPrimaryFallDirection,
        ridgeAxis: sharedRidgeAxis,
        openGableEndIds,
        terminalEnds: terminalEnds.map((end) => ({
          ...end,
          isOpen: openGableEndIds.includes(end.id),
        })),
        appendage,
        validation: roofValidation,
        provenance: roofProvenance,
        capabilities,
        confidence: lowConfidence ? 'low' : 'high',
        source: hasExplicitRoofDraftField ? 'house_first_draft' : 'legacy_module_inference',
      },
      storeyMode: normalizedStoreyMode,
      attachmentStrategy,
      eaveHeightM,
      wallHeightM,
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      decks,
      openings,
      attachmentZones: attachmentZones.zones,
      attachmentZoneDiagnostics: attachmentZones.diagnostics,
    },
    warnings,
  };
}

function buildPergolas(input: {
  modules: ReturnType<typeof buildEstimateDrawingModules>;
  legacyPergolas: Array<{ id: string; label: string }>;
  house: HouseModel | null;
}): {
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
} {
  const groups = new Map<
    string,
    {
      label: string;
      modules: Array<{ moduleId: string; moduleIndex: number; moduleInput: CalculatorModuleInputs }>;
    }
  >();

  input.modules.forEach((module, moduleIndex) => {
    const pergolaId = module.input.pergolaId ?? `pergola-${moduleIndex + 1}`;
    const label =
      input.legacyPergolas.find((pergola) => pergola.id === pergolaId)?.label ??
      `Pergola ${groups.size + 1}`;
    const group = groups.get(pergolaId);
    if (group) {
      group.modules.push({ moduleId: module.id, moduleIndex, moduleInput: module.input });
      return;
    }
    groups.set(pergolaId, {
      label,
      modules: [{ moduleId: module.id, moduleIndex, moduleInput: module.input }],
    });
  });

  const warnings: HouseFirstMigrationWarning[] = [];
  const pergolas = Array.from(groups.entries()).map(([pergolaId, group]) => {
    const firstModule = group.modules[0]!;
    const moduleInput = firstModule.moduleInput;
    const attachmentKind = resolvePergolaAttachmentKind(moduleInput);
    const normalizedAttachmentSide = normalizeAttachmentSide(
      moduleInput.attachmentSide ?? 'rear',
    ) as NonNullable<CalculatorModuleInputs['attachmentSide']>;
    const zoneKind = attachmentKind === 'freestanding'
      ? null
      : attachmentKind === 'wall'
        ? 'wall'
        : attachmentKind;
    const houseAttachmentZoneId =
      zoneKind && input.house
        ? input.house.attachmentZones.find(
            (zone) =>
              zone.kind === zoneKind &&
              zone.side === normalizedAttachmentSide,
          )?.id ?? null
        : null;
    if (zoneKind && input.house && houseAttachmentZoneId === null) {
      warnings.push({
        id: `house-attachment-zone-${pergolaId}`,
        code: 'invalid_house_attachment_zone_overlay',
        severity: 'blocking',
        field: `pergolas.${pergolaId}.attachment.houseAttachmentZoneId`,
        chosenModuleIndex: firstModule.moduleIndex,
        conflictingModuleIndexes: [],
        message: `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} attachment zone for this pergola. The saved shared-zone reference was cleared.`,
      });
    }

    return {
      id: pergolaId,
      label: group.label,
      family: resolvePergolaFamily(moduleInput),
      confidence: input.house?.lowConfidence ? 'low' : 'high',
      sourceModuleIndexes: group.modules.map((module) => module.moduleIndex),
      sourceModuleIds: group.modules.map((module) => module.moduleId),
      attachment: {
        id: `attachment-${pergolaId}`,
        kind: attachmentKind,
        houseAttachmentZoneId,
        side: normalizedAttachmentSide,
        strategy: pickFirstDefined(moduleInput.houseAttachmentStrategy, null),
      },
    };
  });

  return {
    pergolas,
    warnings,
  };
}

export function buildHouseFirstWorkbenchProjectModel(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
}): WorkbenchProjectModel {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
  const modules = buildEstimateDrawingModules(effectiveSnapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const sharedHouse = buildSharedHouse(
    modules.map((module) => module.input),
    input.draft?.houseFirst?.roof ?? null,
    input.draft?.houseFirst?.decks ?? null,
    input.draft?.houseFirst?.openings ?? null,
  );
  const pergolaResult = buildPergolas({
    modules,
    legacyPergolas: calculatorInputs?.pergolas ?? [],
    house: sharedHouse.house,
  });

  return {
    source: 'legacy_estimate_snapshot',
    house: sharedHouse.house,
    pergolas: pergolaResult.pergolas,
    warnings: [...sharedHouse.warnings, ...pergolaResult.warnings],
  };
}
