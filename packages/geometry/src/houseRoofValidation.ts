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
      ridgeAxis: input.roofForm === 'gable' || input.roofForm === 'hipped',
      appendage: true,
    },
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
