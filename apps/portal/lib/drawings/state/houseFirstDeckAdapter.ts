import {
  normalizeHouseFootprintPolygon,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import type {
  DeckSupportClassification,
  DeckSupportWarningCode,
  DeckValidationCode,
  HouseFirstDeckDraft,
  HouseModel,
} from './houseFirstWorkbenchModel';
import {
  buildDeckReferenceHousePolygon,
  parseDeckLocalPolygon,
  resolveDeckPresetGeometry,
} from './objectWorkbenchDeckGeometry';

/**
 * Deck adapter — validates deck drafts against the host house polygon,
 * derives the canonical preset geometry, and builds the `HouseModel.decks`
 * view-model. Extracted from `houseFirstWorkbenchAdapter` so the
 * deck-specific polygon math + validation rules live in one named
 * module instead of inline inside the 1.6k-line adapter.
 *
 * The polygon-math helpers (`parseLocalPolygon` through `outlinesOverlap`)
 * are deck-validation internals: `validateDeckDraft` is their only
 * consumer in the codebase. They're kept here rather than in a shared
 * geometry module because their semantics are deck-specific (e.g.
 * `nearestHouseEdge` returns `attachmentContactLengthMm`, a notion
 * meaningful only to decks). If a second caller ever appears, split
 * them out then.
 *
 * `isBlankString` is duplicated locally rather than imported from the
 * main adapter to keep this module free of upstream cycles — same
 * pattern as `houseRoofFormNormalize`. The implementations must stay
 * in lockstep.
 */

function isBlankString(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
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

export function buildSharedDecks(input: {
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
