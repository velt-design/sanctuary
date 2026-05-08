import type {
  AttachmentSide,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Polygon3,
} from './contracts';

export type HouseRoofFootprintTopology = 'polygonal' | 'orthogonal' | 'rectangular';
export type HouseRoofFootprintRequirement = 'any' | 'orthogonal' | 'rectangular';
export type HouseRoofGeometryKind =
  | 'footprint_flat'
  | 'footprint_mono'
  | 'rectangular_gable'
  | 'bent_spine_joined_gable'
  | 'rectangular_hipped'
  | 'rectilinear_joined_hipped';

export type HouseRoofControls = {
  pitch: boolean;
  material: true;
  primaryFallDirection: boolean;
  ridgeAxis: boolean;
  appendage: boolean;
};

export type HouseRoofFormBehavior = {
  controls: HouseRoofControls;
  selectedFormFootprintRequirement: HouseRoofFootprintRequirement;
};

/**
 * Picker-facing list of house roof forms. `'gable'` is intentionally
 * excluded after milestone 13 -- the legacy gable form is migrated at
 * normalize time to `'hipped'` with all terminal ends open (see
 * `buildHouseModelConfig` in `normalize.ts`), so going forward all new
 * houses pick `'hipped'` and use per-end open toggles to choose Dutch-hip
 * or fully-open-gable topology. `HouseRoofForm` itself still includes
 * `'gable'` so legacy saved data round-trips through storage unchanged
 * until the type retirement step lands.
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
      appendage: false,
    },
    selectedFormFootprintRequirement: 'any',
  },
  mono: {
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: true,
      ridgeAxis: false,
      appendage: true,
    },
    selectedFormFootprintRequirement: 'orthogonal',
  },
  gable: {
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: false,
      ridgeAxis: true,
      appendage: true,
    },
    selectedFormFootprintRequirement: 'orthogonal',
  },
  hipped: {
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: false,
      ridgeAxis: true,
      appendage: false,
    },
    selectedFormFootprintRequirement: 'orthogonal',
  },
};

export function isHouseRoofForm(value: unknown): value is HouseRoofForm {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HOUSE_ROOF_FORM_BEHAVIORS, value);
}

export function getHouseRoofFormBehavior(roofForm: HouseRoofForm): HouseRoofFormBehavior {
  return HOUSE_ROOF_FORM_BEHAVIORS[roofForm];
}

export function houseRoofFormUsesMinimumVisiblePitch(roofForm: HouseRoofForm): boolean {
  return roofForm === 'gable' || roofForm === 'hipped';
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

export type HouseRoofCapabilities = {
  roofForm: HouseRoofForm;
  footprintTopology: HouseRoofFootprintTopology;
  controls: HouseRoofControls;
  selectedFormFootprintRequirement: HouseRoofFootprintRequirement;
  selectedFormSupported: boolean;
  appendageFootprintRequirement: 'rectangular';
  appendageSupported: boolean;
};

export type HouseRoofSelectionValidation = {
  status: 'valid' | 'invalid';
  blockedBy: 'selected_form' | 'appendage' | 'orientation' | null;
  code:
    | 'unsupported_roof_topology'
    | 'unsupported_gable_topology'
    | 'unsupported_hipped_topology'
    | 'invalid_appendage_topology'
    | 'invalid_appendage_host_edge'
    | 'invalid_mono_fall_direction'
    | 'invalid_ridge_axis'
    | null;
  message: string | null;
};

export type HouseRoofAppendageSupport = {
  supportedHostEdges: AttachmentSide[];
  blockedReasonsBySide?: Partial<Record<AttachmentSide, string>>;
};

function formatAttachmentSideList(sides: AttachmentSide[]): string {
  if (sides.length === 0) return 'none';
  return sides
    .map((side) => side.charAt(0).toUpperCase() + side.slice(1))
    .join(', ');
}

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
}): HouseRoofGeometryKind | null {
  const footprintTopology = classifyHouseRoofFootprintTopology(input.footprint);
  switch (input.roofForm) {
    case 'flat':
      return 'footprint_flat';
    case 'mono':
      return footprintTopology === 'polygonal' ? null : 'footprint_mono';
    case 'gable':
      if (footprintTopology === 'rectangular') return 'rectangular_gable';
      return footprintTopology === 'orthogonal' ? 'bent_spine_joined_gable' : null;
    case 'hipped':
      if (footprintTopology === 'rectangular') return 'rectangular_hipped';
      return footprintTopology === 'orthogonal' ? 'rectilinear_joined_hipped' : null;
    default:
      return null;
  }
}

export function deriveHouseRoofAppendageSupportedHostEdges(input: {
  footprint: Polygon3;
}): AttachmentSide[] {
  if (!isOrthogonalFootprint(input.footprint)) return [];
  const minX = Math.min(...input.footprint.map((point) => point.x));
  const maxX = Math.max(...input.footprint.map((point) => point.x));
  const minY = Math.min(...input.footprint.map((point) => point.y));
  const maxY = Math.max(...input.footprint.map((point) => point.y));
  const counts: Record<AttachmentSide, number> = {
    rear: 0,
    front: 0,
    left: 0,
    right: 0,
  };
  for (let index = 0; index < input.footprint.length; index += 1) {
    const start = input.footprint[index]!;
    const end = input.footprint[(index + 1) % input.footprint.length]!;
    if (Math.abs(start.y - end.y) <= 1e-6) {
      if (Math.abs(start.y - minY) <= 1e-6 && Math.abs(end.y - minY) <= 1e-6) counts.rear += 1;
      if (Math.abs(start.y - maxY) <= 1e-6 && Math.abs(end.y - maxY) <= 1e-6) counts.front += 1;
    }
    if (Math.abs(start.x - end.x) <= 1e-6) {
      if (Math.abs(start.x - minX) <= 1e-6 && Math.abs(end.x - minX) <= 1e-6) counts.left += 1;
      if (Math.abs(start.x - maxX) <= 1e-6 && Math.abs(end.x - maxX) <= 1e-6) counts.right += 1;
    }
  }
  return (['rear', 'front', 'left', 'right'] as const).filter((side) => counts[side] === 1);
}

export function deriveHouseRoofCapabilities(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
}): HouseRoofCapabilities {
  const footprintTopology = classifyHouseRoofFootprintTopology(input.footprint);
  const roofGeometryKind = deriveHouseRoofGeometryKind(input);
  const appendageSupportedHostEdges = deriveHouseRoofAppendageSupportedHostEdges({
    footprint: input.footprint,
  });
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
    appendageFootprintRequirement: 'rectangular',
    appendageSupported: appendageSupportedHostEdges.length > 0,
  };
}

export function validateHouseRoofSelection(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
  appendageEnabled: boolean;
  roofPrimaryFallDirection?: HouseRoofPrimaryFallDirection | null;
  roofPrimaryFallDirectionExplicit?: boolean;
  preferredMonoFallDirection?: HouseRoofPrimaryFallDirection | null;
  enforcePreferredMonoFallDirection?: boolean;
  roofRidgeAxis?: HouseRoofRidgeAxis | null;
  roofRidgeAxisExplicit?: boolean;
  preferredRidgeAxis?: HouseRoofRidgeAxis | null;
  appendageHostEdge?: AttachmentSide | null;
  appendageSupport?: HouseRoofAppendageSupport | null;
}): HouseRoofSelectionValidation {
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: input.roofForm,
    footprint: input.footprint,
  });
  const appendageSupportedHostEdges =
    input.appendageSupport?.supportedHostEdges ??
    deriveHouseRoofAppendageSupportedHostEdges({
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
    if (input.roofForm === 'gable') {
      return {
        status: 'invalid',
        blockedBy: 'selected_form',
        code: 'unsupported_gable_topology',
        message: 'Gable roofs are currently limited to orthogonal house footprints in this milestone.',
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
    (input.roofForm === 'gable' || input.roofForm === 'hipped') &&
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

  if (input.appendageEnabled && appendageSupportedHostEdges.length === 0) {
    return {
      status: 'invalid',
      blockedBy: 'appendage',
      code: 'invalid_appendage_topology',
      message: 'Appendage bands require at least one continuous exterior perimeter run on the current house footprint.',
    };
  }

  if (
    input.appendageEnabled &&
    input.appendageHostEdge &&
    !appendageSupportedHostEdges.includes(input.appendageHostEdge)
  ) {
    const blockedReason = input.appendageSupport?.blockedReasonsBySide?.[input.appendageHostEdge] ?? null;
    return {
      status: 'invalid',
      blockedBy: 'appendage',
      code: 'invalid_appendage_host_edge',
      message: blockedReason
        ? `${blockedReason} Supported edges: ${formatAttachmentSideList(appendageSupportedHostEdges)}.`
        : `The ${input.appendageHostEdge} edge does not resolve to one continuous exterior appendage run on this footprint. Supported edges: ${formatAttachmentSideList(appendageSupportedHostEdges)}.`,
    };
  }

  return {
    status: 'valid',
    blockedBy: null,
    code: null,
    message: null,
  };
}
