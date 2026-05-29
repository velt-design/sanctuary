import type {
  AttachmentSide,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Polygon3,
} from './contracts';
import { deriveHouseGableTerminalEndsFromFootprint as deriveHouseGableTerminalEnds } from './house/roofJoined';

export type HouseRoofFootprintTopology = 'polygonal' | 'orthogonal' | 'rectangular';
export type HouseRoofFootprintRequirement = 'any' | 'orthogonal' | 'rectangular';
export type HouseRoofGeometryKind =
  | 'footprint_flat'
  | 'footprint_mono'
  | 'rectangular_gable'
  | 'bent_spine_joined_gable'
  | 'rectangular_hipped'
  | 'rectilinear_joined_hipped';

// PR-T8 (2026-05-29): `appendage` capability removed from the controls
// shape with the appendage feature cull.
export type HouseRoofControls = {
  pitch: boolean;
  material: true;
  primaryFallDirection: boolean;
  ridgeAxis: boolean;
};

export type HouseRoofFormBehavior = {
  controls: HouseRoofControls;
  selectedFormFootprintRequirement: HouseRoofFootprintRequirement;
};

/**
 * Picker-facing list of house roof forms. Milestone 13 session C (2026-05-14):
 * `'gable'` is retired from the `HouseRoofForm` type union. Legacy storage
 * data carrying `roofForm: 'gable'` is migrated to `'hipped' +
 * openGableEndIds: <all terminals>` at two upstream boundaries
 * (`normalizeHouseFormRoofIntent` for workbench drafts;
 * `migrateGableToHippedForGeometryInput` for the geometry input). Any
 * direct geometry caller that still sends `'gable'` is force-mapped by
 * `resolveHouseRoofForm` in `normalize.ts`. The result: every typed
 * `HouseRoofForm` value is one of `flat | mono | hipped`.
 */
export const HOUSE_ROOF_FORM_ORDER: readonly HouseRoofForm[] = ['flat', 'mono', 'hipped'];
export const MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG = 5;

export const HOUSE_ROOF_FORM_BEHAVIORS: Record<HouseRoofForm, HouseRoofFormBehavior> = {
  flat: {
    controls: {
      pitch: false,
      material: true,
      primaryFallDirection: false,
      ridgeAxis: false,
    },
    selectedFormFootprintRequirement: 'any',
  },
  mono: {
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: true,
      ridgeAxis: false,
    },
    selectedFormFootprintRequirement: 'orthogonal',
  },
  hipped: {
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: false,
      ridgeAxis: true,
    },
    selectedFormFootprintRequirement: 'orthogonal',
  },
};

export function isHouseRoofForm(value: unknown): value is HouseRoofForm {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HOUSE_ROOF_FORM_BEHAVIORS, value);
}

export function getHouseRoofFormBehavior(roofForm: HouseRoofForm): HouseRoofFormBehavior {
  // Milestone 13 session C: legacy serialized data may still carry
  // the retired `gable` form name even after the type union dropped
  // it. Map any unknown form to the `hipped` behavior so direct
  // callers that haven't routed through `resolveHouseRoofForm` still
  // get a sane footprint requirement (gable shape == fully-open
  // hipped topologically).
  return HOUSE_ROOF_FORM_BEHAVIORS[roofForm] ?? HOUSE_ROOF_FORM_BEHAVIORS.hipped;
}

export function houseRoofFormUsesMinimumVisiblePitch(roofForm: HouseRoofForm): boolean {
  return roofForm === 'hipped';
}

export function normalizeHouseRoofPitchDegForForm(input: {
  roofForm: HouseRoofForm;
  pitchDeg: number | null | undefined;
  fallbackPitchDeg: number;
}): number {
  if (input.roofForm === 'flat') return 0;
  const fallback = Number.isFinite(input.fallbackPitchDeg)
    ? input.fallbackPitchDeg
    : MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG;
  const pitch = typeof input.pitchDeg === 'number' && Number.isFinite(input.pitchDeg)
    ? input.pitchDeg
    : fallback;
  if (houseRoofFormUsesMinimumVisiblePitch(input.roofForm)) {
    return Math.max(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG, pitch);
  }
  return pitch;
}

export function normalizeHouseRoofPitchInputForForm(input: {
  roofForm: HouseRoofForm;
  value: string | number | null | undefined;
  fallbackValue?: string | number | null | undefined;
}): string {
  if (input.roofForm === 'flat') return '0';
  const rawValue =
    input.value !== null && input.value !== undefined && String(input.value).trim().length > 0
      ? String(input.value).trim()
      : input.fallbackValue !== null &&
          input.fallbackValue !== undefined &&
          String(input.fallbackValue).trim().length > 0
        ? String(input.fallbackValue).trim()
        : '';
  if (!houseRoofFormUsesMinimumVisiblePitch(input.roofForm)) {
    return rawValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG) {
    return String(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG);
  }
  return rawValue;
}

// PR-T8 (2026-05-29): `appendageFootprintRequirement` /
// `appendageSupported` removed from the capabilities shape.
export type HouseRoofCapabilities = {
  roofForm: HouseRoofForm;
  footprintTopology: HouseRoofFootprintTopology;
  controls: HouseRoofControls;
  selectedFormFootprintRequirement: HouseRoofFootprintRequirement;
  selectedFormSupported: boolean;
};

// PR-T8 (2026-05-29): `invalid_appendage_topology` and
// `invalid_appendage_host_edge` codes removed alongside the appendage
// feature. `blockedBy: 'appendage'` removed too.
export type HouseRoofSelectionValidation = {
  status: 'valid' | 'invalid';
  blockedBy: 'selected_form' | 'orientation' | null;
  code:
    | 'unsupported_roof_topology'
    | 'unsupported_gable_topology'
    | 'unsupported_hipped_topology'
    | 'invalid_mono_fall_direction'
    | 'invalid_ridge_axis'
    | null;
  message: string | null;
};

// PR-T8 (2026-05-29): `HouseRoofAppendageSupport` type + the
// `formatAttachmentSideList` helper (only used to format appendage
// error messages) removed alongside the appendage feature cull.

export function preferredMonoFallDirectionForAttachmentSide(
  attachmentSide: AttachmentSide,
): HouseRoofPrimaryFallDirection {
  switch (attachmentSide) {
    case 'front':
      return 'positive_y';
    case 'left':
      return 'negative_x';
    case 'right':
      return 'positive_x';
    case 'rear':
    default:
      return 'negative_y';
  }
}

function signedAreaXY(polygon: Polygon3): number {
  return polygon.reduce((sum, current, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function isOrthogonalFootprint(polygon: Polygon3): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    if (Math.hypot(dx, dy) <= 1e-6) return false;
    if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) return false;
  }
  return Math.abs(signedAreaXY(polygon)) > 1e-6;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 1_000_000) / 1_000_000))].sort((left, right) => left - right);
}

function isRectangleFootprint(polygon: Polygon3): boolean {
  if (polygon.length !== 4 || !isOrthogonalFootprint(polygon)) return false;
  const xs = uniqueSorted(polygon.map((candidate) => candidate.x));
  const ys = uniqueSorted(polygon.map((candidate) => candidate.y));
  return xs.length === 2 && ys.length === 2;
}

function requirementSatisfied(
  topology: HouseRoofFootprintTopology,
  requirement: HouseRoofFootprintRequirement,
): boolean {
  if (requirement === 'any') return true;
  if (requirement === 'orthogonal') return topology === 'orthogonal' || topology === 'rectangular';
  return topology === 'rectangular';
}

export function classifyHouseRoofFootprintTopology(footprint: Polygon3): HouseRoofFootprintTopology {
  if (isRectangleFootprint(footprint)) return 'rectangular';
  if (isOrthogonalFootprint(footprint)) return 'orthogonal';
  return 'polygonal';
}

export function deriveHouseRoofGeometryKind(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
  /**
   * Milestone 13 session C: when the hipped form is dispatched with
   * every active-axis terminal end opened, the geometry pipeline
   * routes through the bent-spine joined-gable builder (legacy gable
   * topology). Surfacing that distinction here lets the rail report
   * the active geometry kind without re-running the dispatcher.
   * Optional -- callers that do not track open-end state still get
   * the default hipped classification.
   */
  openGableEndIds?: ReadonlyArray<string> | null;
  roofRidgeAxis?: 'x' | 'y' | null;
}): HouseRoofGeometryKind | null {
  const footprintTopology = classifyHouseRoofFootprintTopology(input.footprint);
  switch (input.roofForm) {
    case 'flat':
      return 'footprint_flat';
    case 'mono':
      return footprintTopology === 'polygonal' ? null : 'footprint_mono';
    case 'hipped': {
      if (footprintTopology === 'polygonal') return null;
      const openIds = input.openGableEndIds;
      if (openIds && openIds.length > 0) {
        const ridgeAxis = input.roofRidgeAxis ?? 'x';
        const terminalIds = deriveHouseGableTerminalEnds({
          footprint: input.footprint,
          ridgeAxis,
        }).map((end) => end.id);
        const openSet = new Set(openIds);
        const allOpen =
          terminalIds.length > 0 && terminalIds.every((id) => openSet.has(id));
        if (allOpen) {
          return footprintTopology === 'rectangular'
            ? 'rectangular_hipped'
            : 'bent_spine_joined_gable';
        }
      }
      if (footprintTopology === 'rectangular') return 'rectangular_hipped';
      return 'rectilinear_joined_hipped';
    }
    default:
      return null;
  }
}

// PR-T8 (2026-05-29): `deriveHouseRoofAppendageSupportedHostEdges`
// removed alongside the appendage feature cull.

export function deriveHouseRoofCapabilities(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
}): HouseRoofCapabilities {
  const footprintTopology = classifyHouseRoofFootprintTopology(input.footprint);
  const roofGeometryKind = deriveHouseRoofGeometryKind(input);
  const behavior = getHouseRoofFormBehavior(input.roofForm);
  const selectedFormFootprintRequirement = behavior.selectedFormFootprintRequirement;

  return {
    roofForm: input.roofForm,
    footprintTopology,
    controls: behavior.controls,
    selectedFormFootprintRequirement,
    selectedFormSupported:
      input.roofForm === 'flat'
        ? true
        : roofGeometryKind !== null && requirementSatisfied(footprintTopology, selectedFormFootprintRequirement),
  };
}

export function validateHouseRoofSelection(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
  roofPrimaryFallDirection?: HouseRoofPrimaryFallDirection | null;
  roofPrimaryFallDirectionExplicit?: boolean;
  preferredMonoFallDirection?: HouseRoofPrimaryFallDirection | null;
  enforcePreferredMonoFallDirection?: boolean;
  roofRidgeAxis?: HouseRoofRidgeAxis | null;
  roofRidgeAxisExplicit?: boolean;
  preferredRidgeAxis?: HouseRoofRidgeAxis | null;
}): HouseRoofSelectionValidation {
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: input.roofForm,
    footprint: input.footprint,
  });

  if (!capabilities.selectedFormSupported) {
    if (input.roofForm === 'mono') {
      return {
        status: 'invalid',
        blockedBy: 'selected_form',
        code: 'unsupported_roof_topology',
        message: 'Mono roofs are currently limited to orthogonal house footprints in this milestone.',
      };
    }
    if (input.roofForm === 'hipped') {
      return {
        status: 'invalid',
        blockedBy: 'selected_form',
        code: 'unsupported_hipped_topology',
        message: 'Hipped roofs require an orthogonal footprint with clean roof topology in this milestone.',
      };
    }
  }

  if (
    input.roofForm === 'mono' &&
    input.roofPrimaryFallDirectionExplicit &&
    input.enforcePreferredMonoFallDirection &&
    input.preferredMonoFallDirection &&
    input.roofPrimaryFallDirection &&
    input.roofPrimaryFallDirection !== input.preferredMonoFallDirection
  ) {
    return {
      status: 'invalid',
      blockedBy: 'orientation',
      code: 'invalid_mono_fall_direction',
      message: 'This mono fall direction drains back into the attachment side. Choose the outward drain direction for the current house attachment.',
    };
  }

  if (
    input.roofForm === 'hipped' &&
    input.roofRidgeAxisExplicit &&
    input.preferredRidgeAxis &&
    input.roofRidgeAxis &&
    input.roofRidgeAxis !== input.preferredRidgeAxis
  ) {
    return {
      status: 'invalid',
      blockedBy: 'orientation',
      code: 'invalid_ridge_axis',
      message: 'This ridge orientation does not match the current house footprint. Choose the axis that follows the stronger roof span/topology.',
    };
  }

  // PR-T8 (2026-05-29): the two appendage-related validation branches
  // (`invalid_appendage_topology` and `invalid_appendage_host_edge`)
  // were removed alongside the appendage feature cull.

  return {
    status: 'valid',
    blockedBy: null,
    code: null,
    message: null,
  };
}
