import type {
  AttachmentSide,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Polygon3,
} from './contracts';

export type HouseRoofFootprintTopology = 'polygonal' | 'orthogonal' | 'rectangular';
export type HouseRoofFootprintRequirement = 'any' | 'orthogonal' | 'rectangular';

export type HouseRoofCapabilities = {
  roofForm: HouseRoofForm;
  footprintTopology: HouseRoofFootprintTopology;
  controls: {
    pitch: true;
    material: true;
    primaryFallDirection: boolean;
    ridgeAxis: boolean;
    appendage: true;
  };
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
    | 'invalid_appendage'
    | 'invalid_mono_fall_direction'
    | 'invalid_ridge_axis'
    | null;
  message: string | null;
};

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

export function deriveHouseRoofCapabilities(input: {
  roofForm: HouseRoofForm;
  footprint: Polygon3;
}): HouseRoofCapabilities {
  const footprintTopology = classifyHouseRoofFootprintTopology(input.footprint);
  const selectedFormFootprintRequirement: HouseRoofFootprintRequirement =
    input.roofForm === 'mono'
      ? 'orthogonal'
      : input.roofForm === 'gable'
      ? 'orthogonal'
      : input.roofForm === 'hipped'
        ? 'orthogonal'
        : 'any';

  return {
    roofForm: input.roofForm,
    footprintTopology,
    controls: {
      pitch: true,
      material: true,
      primaryFallDirection: input.roofForm === 'mono',
      ridgeAxis: input.roofForm === 'gable',
      appendage: true,
    },
    selectedFormFootprintRequirement,
    selectedFormSupported: requirementSatisfied(footprintTopology, selectedFormFootprintRequirement),
    appendageFootprintRequirement: 'rectangular',
    appendageSupported: footprintTopology === 'rectangular',
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

  if (input.appendageEnabled && !capabilities.appendageSupported) {
    return {
      status: 'invalid',
      blockedBy: 'appendage',
      code: 'invalid_appendage',
      message: 'Appendage bands are currently limited to straight or rectangular house footprints.',
    };
  }

  return {
    status: 'valid',
    blockedBy: null,
    code: null,
    message: null,
  };
}
