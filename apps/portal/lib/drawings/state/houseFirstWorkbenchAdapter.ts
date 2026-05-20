import {
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import {
  buildHouseFootprintPresetSideLocalPoints,
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
  HouseFirstPergolaDraft,
  HouseFirstRoofDraft,
  HouseFirstMigrationWarning,
  HouseModel,
  HouseRoofFieldSource,
  HouseRoofForm,
  HouseFirstWorkbenchProjectModel,
  PergolaModel,
} from './houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from './houseFirstWorkbenchModel';
import { resolveHouseRoofProjection } from './houseRoofFormAdapter';
import {
  buildDeckReferenceHousePolygon,
  parseDeckLocalPolygon,
  resolveDeckPresetGeometry,
  resolveDeckHostEdgeFrame,
} from './objectWorkbenchDeckGeometry';

type HouseFirstWorkbenchDraftCarrier = EstimateDrawingDraft & {
  houseFirst?: {
    roof?: HouseFirstRoofDraft | null;
    decks?: HouseFirstDeckDraft[] | null;
    openings?: HouseFirstOpeningDraft[] | null;
    pergolas?: HouseFirstPergolaDraft[] | null;
  } | null;
};

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
  // Milestone 13 session C: legacy `pergolaStyle === 'gable'` inherits
  // the same roof-form mapping as hipped (the unified Dutch-hip
  // builder produces gable-shape topology when all terminal ends are
  // opened, which the workbench draft normalize layer arranges).
  if (
    module.pergolaStyle === 'gable' ||
    module.pergolaStyle === 'hip' ||
    module.pergolaStyle === 'hip_corner'
  ) {
    return 'hipped';
  }
  return 'mono';
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

function collectHouseEdgeAttachmentContacts(input: {
  polygon: LocalPolygonPoint[];
  candidate: LocalPolygonPoint[];
}): Array<{ hostEdgeId: string; lengthMm: number }> {
  if (!input.polygon.length || !input.candidate.length) return [];
  const contacts = new Map<string, number>();

  for (let houseIndex = 0; houseIndex < input.polygon.length; houseIndex += 1) {
    const houseStart = input.polygon[houseIndex]!;
    const houseEnd = input.polygon[(houseIndex + 1) % input.polygon.length]!;
    for (let candidateIndex = 0; candidateIndex < input.candidate.length; candidateIndex += 1) {
      const candidateStart = input.candidate[candidateIndex]!;
      const candidateEnd = input.candidate[(candidateIndex + 1) % input.candidate.length]!;
      const horizontalMatch =
        Math.abs(houseStart.depthM - houseEnd.depthM) <= 1e-6 &&
        Math.abs(candidateStart.depthM - candidateEnd.depthM) <= 1e-6 &&
        Math.abs(houseStart.depthM - candidateStart.depthM) <= 1e-6;
      const verticalMatch =
        Math.abs(houseStart.alongM - houseEnd.alongM) <= 1e-6 &&
        Math.abs(candidateStart.alongM - candidateEnd.alongM) <= 1e-6 &&
        Math.abs(houseStart.alongM - candidateStart.alongM) <= 1e-6;
      if (!horizontalMatch && !verticalMatch) continue;
      const overlapM = horizontalMatch
        ? Math.max(
            0,
            Math.min(Math.max(houseStart.alongM, houseEnd.alongM), Math.max(candidateStart.alongM, candidateEnd.alongM)) -
              Math.max(Math.min(houseStart.alongM, houseEnd.alongM), Math.min(candidateStart.alongM, candidateEnd.alongM)),
          )
        : Math.max(
            0,
            Math.min(Math.max(houseStart.depthM, houseEnd.depthM), Math.max(candidateStart.depthM, candidateEnd.depthM)) -
              Math.max(Math.min(houseStart.depthM, houseEnd.depthM), Math.min(candidateStart.depthM, candidateEnd.depthM)),
          );
      if (overlapM <= 1e-6) continue;
      const hostEdgeId = `footprint-edge-${houseIndex + 1}`;
      contacts.set(hostEdgeId, Math.max(contacts.get(hostEdgeId) ?? 0, Math.round(overlapM * 1000)));
    }
  }

  return Array.from(contacts.entries())
    .map(([hostEdgeId, lengthMm]) => ({ hostEdgeId, lengthMm }))
    .sort((left, right) => right.lengthMm - left.lengthMm || left.hostEdgeId.localeCompare(right.hostEdgeId));
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
    attachmentContacts: Array<{
      hostEdgeId: string;
      lengthMm: number;
    }>;
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
  const attachmentContacts = collectHouseEdgeAttachmentContacts({
    polygon: context.housePolygon,
    candidate: outline,
  });
  const levelOffsetMm = Math.round(Number(deck.levelOffsetMm ?? '0') || 0);
  const isAttached = Boolean(deck.isAttached);
  const attachmentMode = deck.attachmentMode ?? (deck.secondaryHostEdgeId && deck.cornerVertexId ? 'corner_dual_edge' : isAttached ? 'single_edge' : 'floating');
  const requestedAttachmentContacts = [
    deck.primaryHostEdgeId ?? deck.hostEdgeId ?? null,
    attachmentMode === 'corner_dual_edge' ? deck.secondaryHostEdgeId ?? null : null,
  ]
    .filter((hostEdgeId): hostEdgeId is string => typeof hostEdgeId === 'string' && hostEdgeId.trim().length > 0)
    .map((hostEdgeId) => ({
      hostEdgeId,
      lengthMm: attachmentContacts.find((contact) => contact.hostEdgeId === hostEdgeId)?.lengthMm ?? 0,
    }));
  const minimumRequestedContactLengthMm =
    requestedAttachmentContacts.length > 0
      ? Math.min(...requestedAttachmentContacts.map((contact) => contact.lengthMm))
      : 0;
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

  if (isAttached && isBlankString((deck.primaryHostEdgeId ?? deck.hostEdgeId) ?? '')) {
    codes.push('attached_missing_host_edge');
    messages.push('Attached decks need a host edge.');
  }
  if (!isAttached && elevationMode === 'aligned_to_threshold') {
    codes.push('detached_threshold_alignment');
    messages.push('Detached decks cannot use threshold-aligned elevation.');
  }

  if (isAttached && minimumRequestedContactLengthMm < 200) {
    warningCodes.push('insufficient_host_edge_contact');
    warningMessages.push(
      attachmentMode === 'corner_dual_edge'
        ? 'Corner-attached deck contact is too small on one or both attached walls to classify cleanly.'
        : 'Attached deck contact to the selected host edge is too small to classify cleanly.',
    );
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
      attachmentContactLengthMm:
        requestedAttachmentContacts.length > 0
          ? Math.max(...requestedAttachmentContacts.map((contact) => contact.lengthMm))
          : nearestEdge.attachmentContactLengthMm,
      attachmentContacts,
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

function normalizeOpeningHostWallId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeExactOpeningHostEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

function normalizePergolaAttachmentZoneId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePergolaAttachmentEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

type DerivedWallResolution = {
  wall: HouseModel['derivedWallGraph']['walls'][number];
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceEdgeId: string;
  spanM: number;
};

type DerivedWallLookup = {
  graph: HouseModel['derivedWallGraph'];
  byWallId: Map<string, DerivedWallResolution>;
  byEdgeId: Map<string, DerivedWallResolution>;
  bySide: Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, DerivedWallResolution[]>;
};

type DerivedAttachmentZoneResolution = {
  zone: NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number];
  wall: HouseModel['derivedWallGraph']['walls'][number];
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceEdgeId: string;
};

type DerivedEnvelopeLookup = {
  envelope: NonNullable<HouseModel['derivedEnvelope']>;
  compatibilityZones: HouseModel['attachmentZones'];
  diagnostics: HouseModel['attachmentZoneDiagnostics'];
  byEdgeId: Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>;
  byZoneId: Map<string, DerivedAttachmentZoneResolution>;
  zonesByEdgeId: Map<string, DerivedAttachmentZoneResolution[]>;
  zonesBySideAndKind: Map<string, DerivedAttachmentZoneResolution[]>;
};

function formatDerivedWallLabel(
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>,
  index: number,
): string {
  const prefix = `${side.charAt(0).toUpperCase()}${side.slice(1)} wall`;
  return index === 1 ? prefix : `${prefix} ${index}`;
}

function buildDerivedWallLookup(input: {
  houseId: string;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
}): DerivedWallLookup {
  const walls: HouseModel['derivedWallGraph']['walls'] = [];
  const byWallId = new Map<string, DerivedWallResolution>();
  const byEdgeId = new Map<string, DerivedWallResolution>();
  const bySide = new Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, DerivedWallResolution[]>();
  const sideCounts = new Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, number>();

  for (let index = 0; index < input.housePolygon.length; index += 1) {
    const startPoint = input.housePolygon[index];
    const endPoint = input.housePolygon[(index + 1) % input.housePolygon.length];
    if (!startPoint || !endPoint) continue;

    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const frame = resolveDeckHostEdgeFrame({
      housePolygon: input.housePolygon,
      hostEdgeId: sourceEdgeId,
    });
    if (!frame?.sourceEdgeId) continue;

    const nextCount = (sideCounts.get(frame.hostEdge) ?? 0) + 1;
    sideCounts.set(frame.hostEdge, nextCount);

    const wall = {
      id: `wall-${frame.sourceEdgeId}`,
      label: formatDerivedWallLabel(frame.hostEdge, nextCount),
      sourceFormIds: [input.houseId],
      edgeIds: [frame.sourceEdgeId],
      kind: 'exterior' as const,
      polygon: [
        { alongM: String(startPoint.alongM), depthM: String(startPoint.depthM) },
        { alongM: String(endPoint.alongM), depthM: String(endPoint.depthM) },
      ],
    };
    const resolved = {
      wall,
      side: frame.hostEdge,
      sourceEdgeId: frame.sourceEdgeId,
      spanM: Math.max(0, frame.end - frame.start),
    } satisfies DerivedWallResolution;

    walls.push(wall);
    byWallId.set(wall.id, resolved);
    byEdgeId.set(frame.sourceEdgeId, resolved);
    const sideWalls = bySide.get(frame.hostEdge) ?? [];
    sideWalls.push(resolved);
    bySide.set(frame.hostEdge, sideWalls);
  }

  return {
    graph: {
      walls,
      mergeGroups: [],
    },
    byWallId,
    byEdgeId,
    bySide,
  };
}

function formatDerivedAttachmentZoneLabel(input: {
  edgeLabel: string;
  kind: HouseAttachmentZoneKind;
}): string {
  return `${input.edgeLabel} ${input.kind.replace('_', ' ')}`;
}

function buildDerivedEnvelopeLookup(input: {
  houseId: string;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  derivedWalls: DerivedWallLookup;
  roof: Pick<HouseModel['roof'], 'form' | 'validation'>;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  openings: HouseModel['openings'];
}): DerivedEnvelopeLookup {
  const edges: NonNullable<HouseModel['derivedEnvelope']>['edges'] = [];
  for (const resolvedWall of input.derivedWalls.byWallId.values()) {
    const [start, end] = resolvedWall.wall.polygon;
    if (!start || !end) continue;
    edges.push({
      id: resolvedWall.sourceEdgeId,
      label: resolvedWall.wall.label,
      semanticKind: 'wall_perimeter',
      sourceFormIds: [input.houseId],
      hostWallId: resolvedWall.wall.id,
      hostRoofZoneIds: [],
      start,
      end,
    });
  }

  const candidateKinds = resolveAttachmentStrategyZoneKinds(input.attachmentStrategy);
  const envelopeAttachmentZones: NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'] = [];
  const compatibilityZones: HouseModel['attachmentZones'] = [];
  const blocked: HouseModel['attachmentZoneDiagnostics']['blocked'] = [];
  const blockedKeys = new Set<string>();
  const openingsByWallId = new Map<string, HouseModel['openings']>();
  for (const opening of input.openings) {
    const key = opening.hostWallId ?? '';
    if (!key) continue;
    const existing = openingsByWallId.get(key) ?? [];
    existing.push(opening);
    openingsByWallId.set(key, existing);
  }

  for (const resolvedWall of input.derivedWalls.byWallId.values()) {
    const wallOpenings = openingsByWallId.get(resolvedWall.wall.id) ?? [];
    const hasAnyOpening = wallOpenings.some((opening) => opening.validation.status === 'valid');
    const hasLargeOpening = wallOpenings.some(
      (opening) =>
        opening.validation.status === 'valid' &&
        (opening.kind === 'slider' || opening.kind === 'stacker'),
    );

    for (const kind of candidateKinds) {
      let reason: HouseModel['attachmentZoneDiagnostics']['blocked'][number]['reason'] | null = null;
      if (kind === 'roof_edge' && input.roof.form === 'flat') {
        reason = 'unsupported_roof_form';
      } else if (
        (kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') &&
        input.roof.validation.status === 'invalid'
      ) {
        reason = 'invalid_roof_state';
      } else if (kind === 'wall' && hasAnyOpening) {
        reason = 'side_openings_block_wall';
      } else if ((kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') && hasLargeOpening) {
        reason = 'side_openings_block_roof_zone';
      }

      if (reason) {
        const blockedKey = `${resolvedWall.side}:${kind}:${reason}`;
        if (!blockedKeys.has(blockedKey)) {
          blocked.push({
            side: resolvedWall.side,
            kind,
            reason,
          });
          blockedKeys.add(blockedKey);
        }
        continue;
      }

      const zoneId = `zone-${kind}-${resolvedWall.sourceEdgeId}`;
      const label = formatDerivedAttachmentZoneLabel({
        edgeLabel: resolvedWall.wall.label,
        kind,
      });
      envelopeAttachmentZones.push({
        id: zoneId,
        label,
        kind,
        side: resolvedWall.side,
        sourceFormIds: [input.houseId],
        hostWallId: resolvedWall.wall.id,
        hostEdgeId: resolvedWall.sourceEdgeId,
        hostRoofZoneId: null,
      });
      compatibilityZones.push({
        id: zoneId,
        label,
        kind,
        side: resolvedWall.side,
      });
    }
  }

  const envelope: NonNullable<HouseModel['derivedEnvelope']> = {
    mergedFormIds: [input.houseId],
    footprint: input.housePolygon,
    wallGraph: input.derivedWalls.graph,
    roofZones: [],
    edges,
    attachmentZones: envelopeAttachmentZones,
  };

  const byEdgeId = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>();
  for (const edge of edges) {
    byEdgeId.set(edge.id, edge);
  }

  const byZoneId = new Map<string, DerivedAttachmentZoneResolution>();
  const zonesByEdgeId = new Map<string, DerivedAttachmentZoneResolution[]>();
  const zonesBySideAndKind = new Map<string, DerivedAttachmentZoneResolution[]>();
  for (const zone of envelopeAttachmentZones) {
    const wall = zone.hostWallId ? input.derivedWalls.byWallId.get(zone.hostWallId)?.wall ?? null : null;
    if (!wall || !zone.hostEdgeId) continue;
    const resolved = {
      zone,
      wall,
      side: zone.side,
      sourceEdgeId: zone.hostEdgeId,
    } satisfies DerivedAttachmentZoneResolution;
    byZoneId.set(zone.id, resolved);
    const edgeZones = zonesByEdgeId.get(zone.hostEdgeId) ?? [];
    edgeZones.push(resolved);
    zonesByEdgeId.set(zone.hostEdgeId, edgeZones);
    const sideKey = `${zone.side}:${zone.kind}`;
    const sideZones = zonesBySideAndKind.get(sideKey) ?? [];
    sideZones.push(resolved);
    zonesBySideAndKind.set(sideKey, sideZones);
  }

  return {
    envelope,
    compatibilityZones,
    diagnostics: { blocked },
    byEdgeId,
    byZoneId,
    zonesByEdgeId,
    zonesBySideAndKind,
  };
}

function buildSharedOpenings(input: {
  openingDrafts: HouseFirstOpeningDraft[] | null | undefined;
  derivedWalls: DerivedWallLookup;
  fallbackWallId: NonNullable<CalculatorModuleInputs['attachmentSide']>;
}): HouseModel['openings'] {
  const openings: HouseModel['openings'] = [];
  const occupiedByWall = new Map<string, Array<{ start: number; end: number }>>();

  for (const draft of input.openingDrafts ?? []) {
    if (!draft || typeof draft.id !== 'string' || draft.id.trim().length === 0) continue;
    const requestedHostWallId = normalizeOpeningHostWallId(draft.hostWallId);
    const requestedWallId = normalizeOpeningWallId(draft.wallId, input.fallbackWallId);
    const exactHostEdgeId = normalizeExactOpeningHostEdgeId(draft.hostEdgeId);
    const kind = normalizeWallOpeningKind(draft.kind);
    const exactWall = exactHostEdgeId ? input.derivedWalls.byEdgeId.get(exactHostEdgeId) ?? null : null;
    const sideWalls = input.derivedWalls.bySide.get(requestedWallId) ?? [];
    const resolvedWall =
      requestedHostWallId !== null
        ? input.derivedWalls.byWallId.get(requestedHostWallId) ?? null
        : exactWall ??
          (sideWalls.length === 1 ? sideWalls[0]! : null);
    const hostWallId = resolvedWall?.wall.id ?? requestedHostWallId ?? null;
    const wallId = resolvedWall?.side ?? requestedWallId;
    const hostEdgeId = resolvedWall?.sourceEdgeId ?? exactHostEdgeId;
    const panelCount = resolveOpeningPanelCount(kind, draft.panelCount);
    const widthM = parseFiniteOpeningMetres(draft.widthM, 1.8);
    const heightM = parseFiniteOpeningMetres(draft.heightM, 1.2);
    const sillHeightM = parseFiniteOpeningMetres(draft.sillHeightM, 0.9);
    const offsetAlongWallM = parseFiniteOpeningMetres(draft.offsetAlongWallM, 0.6);
    const wallSpanM = resolvedWall?.spanM ?? 0;
    const codes: HouseModel['openings'][number]['validation']['codes'] = [];

    if (!resolvedWall) {
      if (requestedHostWallId !== null && !input.derivedWalls.byWallId.has(requestedHostWallId)) {
        codes.push('missing_host_wall');
      } else if (requestedHostWallId === null && exactHostEdgeId === null && sideWalls.length > 1) {
        codes.push('ambiguous_host_wall');
      } else {
        codes.push('missing_host_wall');
      }
    }
    if (!Number.isFinite(widthM) || widthM < MIN_WINDOW_WIDTH_M) codes.push('invalid_width');
    if (!Number.isFinite(heightM) || heightM < MIN_WINDOW_HEIGHT_M) codes.push('invalid_height');
    if (!Number.isFinite(sillHeightM) || sillHeightM < 0) codes.push('invalid_sill_height');
    if (!Number.isFinite(offsetAlongWallM) || offsetAlongWallM < 0) codes.push('offset_out_of_bounds');
    if (resolvedWall && Number.isFinite(widthM) && widthM > wallSpanM + 1e-6) codes.push('span_exceeds_wall');
    if (resolvedWall && Number.isFinite(offsetAlongWallM) && offsetAlongWallM > wallSpanM + 1e-6) {
      codes.push('offset_out_of_bounds');
    }
    if (
      resolvedWall &&
      Number.isFinite(widthM) &&
      Number.isFinite(offsetAlongWallM) &&
      offsetAlongWallM + widthM > wallSpanM + 1e-6
    ) {
      codes.push('span_exceeds_wall');
    }
    if (
      (kind === 'slider' || kind === 'stacker') &&
      resolvedWall &&
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
    const occupancyKey = hostWallId ?? hostEdgeId ?? wallId;
    const existingIntervals = occupiedByWall.get(occupancyKey) ?? [];
    if (
      resolvedWall &&
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
        ? requestedHostWallId !== null && !input.derivedWalls.byWallId.has(requestedHostWallId)
          ? 'This opening no longer has a valid derived host wall. Select a new host wall before placing it.'
          : 'Select a valid derived host wall before placing this opening.'
        : codes[0] === 'ambiguous_host_wall'
          ? 'Select a specific derived host wall because this side has multiple wall segments.'
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
      hostWallId,
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
        attachmentMode: presetGeometry.attachmentMode,
        primaryHostEdgeId: presetGeometry.primaryHostEdgeId,
        secondaryHostEdgeId: presetGeometry.secondaryHostEdgeId,
        cornerVertexId: presetGeometry.cornerVertexId,
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
      attachmentMode: presetGeometry.attachmentMode,
      primaryHostEdgeId: presetGeometry.primaryHostEdgeId,
      secondaryHostEdgeId: presetGeometry.secondaryHostEdgeId,
      cornerVertexId: presetGeometry.cornerVertexId,
      isAttached: presetGeometry.attachmentMode !== 'floating',
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
  const roofProjection = resolveHouseRoofProjection({
    roofDraft: roofDraft ?? null,
    derivedHousePolygon,
    normalizedFootprintMode,
    normalizedFootprintPreset,
    normalizedFootprintParams,
    normalizedAttachmentSide,
    attachmentKind,
    attachmentStrategy,
    normalizedRoofMaterial,
    roofMaterialSource: roofMaterialResult.source,
    roofPitchSource: roofPitchResult.source,
    inferredPrimaryPitchDeg: roofPitchDeg,
    roofForm,
    firstModuleLengthMm,
    firstModuleProjectionMm,
    eaveHeightM,
    eaveOverhangMm,
  });
  for (const warning of roofProjection.warnings) warnings.push(warning);
  const derivedWalls = buildDerivedWallLookup({
    houseId: 'house-main',
    housePolygon: derivedHousePolygon,
  });
  const decks = buildSharedDecks({
    deckDrafts,
    housePolygon: derivedHousePolygon,
    footprintParams: normalizedFootprintParams,
  });
  const openings = buildSharedOpenings({
    openingDrafts,
    derivedWalls,
    fallbackWallId: normalizedAttachmentSide,
  });
  const derivedEnvelope = buildDerivedEnvelopeLookup({
    houseId: 'house-main',
    housePolygon: derivedHousePolygon,
    derivedWalls,
    roof: {
      form: roofProjection.roof.form,
      validation: roofProjection.roof.validation,
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
      // Roof view-model comes from the focused projection adapter
      // (`houseRoofFormAdapter`); the only field overlaid here is
      // `confidence`, which depends on whether any of the collect()'d
      // shared fields hit a low-confidence fallback inside this function.
      // Everything else (form, material, pitch, fall direction, ridge
      // axis, terminal ends, open gable IDs, appendage, geometry kind,
      // validation, provenance, capabilities, source) is owned by
      // `resolveHouseRoofProjection`.
      roof: {
        ...roofProjection.roof,
        confidence: lowConfidence ? 'low' : 'high',
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
      derivedEnvelope: derivedEnvelope.envelope,
      derivedWallGraph: derivedWalls.graph,
      decks,
      openings,
      attachmentZones: derivedEnvelope.compatibilityZones,
      attachmentZoneDiagnostics: derivedEnvelope.diagnostics,
    },
    warnings,
  };
}

function buildPergolas(input: {
  modules: ReturnType<typeof buildEstimateDrawingModules>;
  legacyPergolas: Array<{ id: string; label: string }>;
  house: HouseModel | null;
  pergolaDrafts: HouseFirstPergolaDraft[] | null | undefined;
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

  const draftByPergolaId = new Map<string, HouseFirstPergolaDraft>();
  for (const draft of input.pergolaDrafts ?? []) {
    if (!draft || typeof draft.id !== 'string' || draft.id.trim().length === 0) continue;
    draftByPergolaId.set(draft.id.trim(), draft);
  }

  const derivedEnvelope = input.house?.derivedEnvelope ?? null;
  const zonesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>();
  const edgesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>();
  const zonesByEdgeId = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  const zonesBySideAndKind = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  for (const edge of derivedEnvelope?.edges ?? []) {
    edgesById.set(edge.id, edge);
  }
  for (const zone of derivedEnvelope?.attachmentZones ?? []) {
    zonesById.set(zone.id, zone);
    if (zone.hostEdgeId) {
      const edgeZones = zonesByEdgeId.get(zone.hostEdgeId) ?? [];
      edgeZones.push(zone);
      zonesByEdgeId.set(zone.hostEdgeId, edgeZones);
    }
    const sideKey = `${zone.side}:${zone.kind}`;
    const sideZones = zonesBySideAndKind.get(sideKey) ?? [];
    sideZones.push(zone);
    zonesBySideAndKind.set(sideKey, sideZones);
  }

  const warnings: HouseFirstMigrationWarning[] = [];
  const pergolas: PergolaModel[] = Array.from(groups.entries()).map(([pergolaId, group]) => {
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
    const savedDraft = draftByPergolaId.get(pergolaId) ?? null;
    const requestedAttachmentZoneId = normalizePergolaAttachmentZoneId(savedDraft?.attachmentZoneId);
    const requestedAttachmentEdgeId = normalizePergolaAttachmentEdgeId(savedDraft?.attachmentEdgeId);
    let attachmentEdgeId =
      attachmentKind === 'freestanding'
        ? null
        : requestedAttachmentEdgeId;
    let attachmentZoneId =
      attachmentKind === 'freestanding'
        ? null
        : requestedAttachmentZoneId;
    let houseAttachmentZoneId: string | null = null;
    let resolvedAttachmentSide = normalizedAttachmentSide;
    let resolutionStatus: PergolaModel['attachment']['resolution']['status'] =
      attachmentKind === 'freestanding' ? 'resolved' : 'unresolved';
    let resolutionMessage: string | null = null;

    if (zoneKind === null) {
      attachmentEdgeId = null;
      attachmentZoneId = null;
    } else if (!derivedEnvelope) {
      resolutionMessage = 'This pergola no longer has a derived building envelope to attach to.';
    } else if (requestedAttachmentZoneId !== null) {
      const requestedZone = zonesById.get(requestedAttachmentZoneId) ?? null;
      if (requestedZone && requestedZone.kind === zoneKind && requestedZone.hostEdgeId) {
        attachmentZoneId = requestedZone.id;
        attachmentEdgeId = requestedZone.hostEdgeId;
        houseAttachmentZoneId = requestedZone.id;
        resolvedAttachmentSide = requestedZone.side;
        resolutionStatus = 'resolved';
      } else {
        resolutionMessage =
          `The saved ${zoneKind.replace('_', ' ')} host zone for this pergola is no longer available. Select a new host zone.`;
      }
    } else if (requestedAttachmentEdgeId !== null) {
      const compatibleZones = (zonesByEdgeId.get(requestedAttachmentEdgeId) ?? []).filter(
        (zone) => zone.kind === zoneKind,
      );
      const requestedEdge = edgesById.get(requestedAttachmentEdgeId) ?? null;
      if (requestedEdge && compatibleZones.length === 1) {
        const resolvedZone = compatibleZones[0]!;
        attachmentEdgeId = requestedEdge.id;
        attachmentZoneId = resolvedZone.id;
        houseAttachmentZoneId = resolvedZone.id;
        resolvedAttachmentSide = resolvedZone.side;
        resolutionStatus = 'resolved';
      } else {
        resolutionMessage =
          compatibleZones.length > 1
            ? `The saved host edge now resolves to multiple compatible ${zoneKind.replace('_', ' ')} zones. Select one explicitly.`
            : `The saved host edge no longer supports a ${zoneKind.replace('_', ' ')} attachment for this pergola. Select a new host edge.`;
      }
    } else {
      const legacyZones = zonesBySideAndKind.get(`${normalizedAttachmentSide}:${zoneKind}`) ?? [];
      if (legacyZones.length === 1) {
        const resolvedZone = legacyZones[0]!;
        attachmentEdgeId = resolvedZone.hostEdgeId ?? null;
        attachmentZoneId = resolvedZone.id;
        houseAttachmentZoneId = resolvedZone.id;
        resolvedAttachmentSide = resolvedZone.side;
        resolutionStatus = 'resolved';
      } else if (legacyZones.length > 1) {
        resolutionStatus = 'ambiguous';
        resolutionMessage =
          `Multiple compatible ${zoneKind.replace('_', ' ')} host edges exist on the ${normalizedAttachmentSide} side. Select the correct host edge for this pergola.`;
      } else {
        resolutionMessage =
          `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`;
      }
    }

    if (zoneKind && resolutionStatus !== 'resolved') {
      const warningField =
        requestedAttachmentZoneId !== null
          ? `houseFirst.pergolas.${pergolaId}.attachmentZoneId`
          : requestedAttachmentEdgeId !== null
            ? `houseFirst.pergolas.${pergolaId}.attachmentEdgeId`
            : `inputs.modules.${firstModule.moduleIndex}.attachmentSide`;
      warnings.push({
        id: `house-attachment-zone-${pergolaId}`,
        code: 'invalid_house_attachment_zone_overlay',
        severity: 'blocking',
        field: warningField,
        chosenModuleIndex: firstModule.moduleIndex,
        conflictingModuleIndexes: [],
        message:
          resolutionMessage ??
          `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`,
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
        attachmentEdgeId,
        attachmentZoneId,
        houseAttachmentZoneId,
        side: resolvedAttachmentSide,
        strategy: pickFirstDefined(moduleInput.houseAttachmentStrategy, null),
        resolution: {
          status: resolutionStatus,
          message: resolutionMessage,
        },
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
  draft?: HouseFirstWorkbenchDraftCarrier | null;
  ignoreModuleResults?: boolean;
}): HouseFirstWorkbenchProjectModel {
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
    pergolaDrafts: input.draft?.houseFirst?.pergolas ?? null,
  });

  return {
    source: 'legacy_estimate_snapshot',
    house: sharedHouse.house,
    pergolas: pergolaResult.pergolas,
    warnings: [...sharedHouse.warnings, ...pergolaResult.warnings],
  };
}
