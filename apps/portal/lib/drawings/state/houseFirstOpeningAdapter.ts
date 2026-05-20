import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type {
  HouseFirstOpeningDraft,
  HouseModel,
} from './houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from './houseFirstWorkbenchModel';
import type { DerivedWallLookup } from './houseFirstWallLookup';

/**
 * Opening adapter — validates window/door/slider/stacker drafts
 * against their derived host wall and builds the `HouseModel.openings`
 * view-model. Extracted from `houseFirstWorkbenchAdapter` so the
 * opening-validation rules live in one named module.
 *
 * Validation classifies failures into typed codes
 * (`DeckValidationCode`-style) so the rail UI can render targeted
 * messages instead of a generic "invalid opening" warning. The
 * `codes` array preserves order so the first code drives the
 * single-line `message` used in the inspector header.
 *
 * Per-wall occupancy tracking (`occupiedByWall`) blocks overlapping
 * openings — but ONLY for valid drafts. An invalid draft that would
 * have overlapped is not added to the occupancy map (we report the
 * first failure code and stop validating that draft), so an
 * already-invalid second opening on the same wall doesn't get a
 * spurious "overlapping" code on top of its real failure.
 *
 * The 0.3m corner clearance for sliders/stackers is the lift-off
 * requirement for the sliding track hardware; reducing it without
 * coordinating with the costing engine would underestimate the
 * frame extrusion budget.
 */

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

export function buildSharedOpenings(input: {
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
