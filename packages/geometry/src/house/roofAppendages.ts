import type {
  AttachmentSide,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Point3,
  Polygon3,
  RoofPlane3D,
} from '../contracts';
import { planeFromPoints } from '../math3d';
import { type HouseRoofAppendageSupport, validateHouseRoofSelection } from '../houseRoofValidation';
import { isOrthogonalFootprint } from './footprintMath';
import {
  edgeOutwardVector,
  finiteNumber,
  point,
  positiveNumber,
  type HouseRoofBuildResult,
  type HouseRoofPerimeterEdge,
} from './_internal';
import { buildHouseRoofPerimeterEdges } from './perimeterEdges';
import { buildPrimaryHouseRoof, invalidHouseRoof } from './roofPrimary';

export type HouseRoofAppendageHostRun = {
  hostEdge: AttachmentSide;
  start: Point3;
  end: Point3;
  sourceEdgeIds: string[];
  sourceRoofPlaneId?: string | null;
  perimeterRole: 'drain_eave';
};

export type HouseRoofAppendageSupportAnalysis = HouseRoofAppendageSupport & {
  hostRunsBySide: Partial<Record<AttachmentSide, HouseRoofAppendageHostRun>>;
};

function attachmentSideFromPerimeterEdge(edge: HouseRoofPerimeterEdge): AttachmentSide | null {
  const dx = edge.eaveEnd.x - edge.eaveStart.x;
  const dy = edge.eaveEnd.y - edge.eaveStart.y;
  if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) return null;
  const outward = edgeOutwardVector(edge.perimeterPolygon, edge.index);
  if (Math.abs(outward.x) >= Math.abs(outward.y)) {
    return outward.x >= 0 ? 'right' : 'left';
  }
  return outward.y >= 0 ? 'front' : 'rear';
}

export function buildAppendageSupportAnalysisFromPerimeterEdges(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
}): HouseRoofAppendageSupportAnalysis {
  const orderedEdges = [...input.perimeterEdges].sort((left, right) => left.index - right.index);
  type CandidateEdge = HouseRoofPerimeterEdge & { hostEdge: AttachmentSide };
  const candidates = orderedEdges.map((edge) => ({
    edge,
    hostEdge: edge.edgeKind === 'drain_eave' ? attachmentSideFromPerimeterEdge(edge) : null,
  }));
  const runs: CandidateEdge[][] = [];
  let currentRun: CandidateEdge[] = [];

  for (const candidate of candidates) {
    if (!candidate.hostEdge) {
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
      continue;
    }
    const current = { ...candidate.edge, hostEdge: candidate.hostEdge };
    const previous = currentRun[currentRun.length - 1];
    if (
      previous &&
      previous.hostEdge === current.hostEdge &&
      previous.perimeterId === current.perimeterId &&
      previous.index + 1 === current.index
    ) {
      currentRun.push(current);
      continue;
    }
    if (currentRun.length > 0) runs.push(currentRun);
    currentRun = [current];
  }
  if (currentRun.length > 0) runs.push(currentRun);

  if (runs.length > 1) {
    const firstRun = runs[0]!;
    const lastRun = runs[runs.length - 1]!;
    const firstEdge = firstRun[0]!;
    const lastEdge = lastRun[lastRun.length - 1]!;
    const firstPerimeterLength = firstEdge.perimeterPolygon.length;
    if (
      firstRun[0]?.hostEdge === lastRun[0]?.hostEdge &&
      firstEdge.perimeterId === lastEdge.perimeterId &&
      firstEdge.index === 0 &&
      lastEdge.index === firstPerimeterLength - 1
    ) {
      runs[0] = [...lastRun, ...firstRun];
      runs.pop();
    }
  }

  const blockedReasonsBySide: Partial<Record<AttachmentSide, string>> = {
    rear: 'The rear edge does not expose one continuous exterior eave-like appendage run on this roof.',
    front: 'The front edge does not expose one continuous exterior eave-like appendage run on this roof.',
    left: 'The left edge does not expose one continuous exterior eave-like appendage run on this roof.',
    right: 'The right edge does not expose one continuous exterior eave-like appendage run on this roof.',
  };
  const runsBySide = new Map<AttachmentSide, CandidateEdge[][]>();
  for (const run of runs) {
    const hostEdge = run[0]?.hostEdge;
    if (!hostEdge) continue;
    const collection = runsBySide.get(hostEdge) ?? [];
    collection.push(run);
    runsBySide.set(hostEdge, collection);
  }

  const hostRunsBySide: Partial<Record<AttachmentSide, HouseRoofAppendageHostRun>> = {};
  const supportedHostEdges: AttachmentSide[] = [];
  for (const side of ['rear', 'front', 'left', 'right'] as const) {
    const sideRuns = runsBySide.get(side) ?? [];
    if (sideRuns.length === 1) {
      const run = sideRuns[0]!;
      supportedHostEdges.push(side);
      hostRunsBySide[side] = {
        hostEdge: side,
        start: run[0]!.eaveStart,
        end: run[run.length - 1]!.eaveEnd,
        sourceEdgeIds: run.map((edge) => edge.sourceEdgeId),
        sourceRoofPlaneId: run[0]!.sourceRoofPlaneId ?? null,
        perimeterRole: 'drain_eave',
      };
      delete blockedReasonsBySide[side];
      continue;
    }
    if (sideRuns.length > 1) {
      blockedReasonsBySide[side] = `The ${side} edge resolves to multiple exterior appendage runs on this roof.`;
    }
  }

  return {
    supportedHostEdges,
    hostRunsBySide,
    blockedReasonsBySide,
  };
}

export function buildHouseRoofAppendageBand(input: {
  hostRun: HouseRoofAppendageHostRun;
  form: HouseRoofAppendageForm;
  pitchDeg: number;
  attachZ: number;
}): RoofPlane3D[] {
  const bandDepthMm = 1200;
  const risePerRun = Math.tan((input.pitchDeg * Math.PI) / 180);
  const outerZ = input.form === 'flat' ? input.attachZ : input.attachZ - bandDepthMm * risePerRun;
  const outward =
    input.hostRun.hostEdge === 'front'
      ? { x: 0, y: 1, z: 0 }
      : input.hostRun.hostEdge === 'left'
        ? { x: -1, y: 0, z: 0 }
        : input.hostRun.hostEdge === 'right'
          ? { x: 1, y: 0, z: 0 }
          : { x: 0, y: -1, z: 0 };
  const start = point(input.hostRun.start.x, input.hostRun.start.y, input.attachZ);
  const end = point(input.hostRun.end.x, input.hostRun.end.y, input.attachZ);
  const outerStart = point(
    start.x + outward.x * bandDepthMm,
    start.y + outward.y * bandDepthMm,
    outerZ,
  );
  const outerEnd = point(
    end.x + outward.x * bandDepthMm,
    end.y + outward.y * bandDepthMm,
    outerZ,
  );

  switch (input.hostRun.hostEdge) {
    case 'front':
      return [
        {
          id: 'house-roof-appendage-front',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 0, y: 1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'front' },
        },
      ];
    case 'left':
      return [
        {
          id: 'house-roof-appendage-left',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: -1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'left' },
        },
      ];
    case 'right':
      return [
        {
          id: 'house-roof-appendage-right',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 1, y: 0, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'right' },
        },
      ];
    case 'rear':
    default:
      return [
        {
          id: 'house-roof-appendage-rear',
          boundary: [start, end, outerEnd, outerStart],
          plane: planeFromPoints(start, end, outerEnd),
          fallVector: { x: 0, y: -1, z: input.form === 'flat' ? 0 : -risePerRun },
          metadata: { roofGeometry: 'appendage_band', roofAppendageHostEdge: 'rear' },
        },
      ];
  }
}

export function deriveHouseRoofAppendageSupportFromPrimaryRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofForm: HouseRoofForm;
  primaryRoof: HouseRoofBuildResult;
  attachmentSourceEdgeId?: string | null;
}): HouseRoofAppendageSupportAnalysis {
  if (input.primaryRoof.metadata.roofQaStatus !== 'valid' || !isOrthogonalFootprint(input.sourceFootprint)) {
    return {
      supportedHostEdges: [],
      hostRunsBySide: {},
      blockedReasonsBySide: {
        rear: 'The rear edge does not expose one continuous exterior eave-like appendage run on this roof.',
        front: 'The front edge does not expose one continuous exterior eave-like appendage run on this roof.',
        left: 'The left edge does not expose one continuous exterior eave-like appendage run on this roof.',
        right: 'The right edge does not expose one continuous exterior eave-like appendage run on this roof.',
      },
    };
  }

  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    roofForm: input.roofForm,
    roofPlanes: input.primaryRoof.roofPlanes,
    eaveHeightMm: input.eaveHeightMm,
    joinSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  return buildAppendageSupportAnalysisFromPerimeterEdges({
    perimeterEdges,
  });
}

export function buildSharedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  roofAppendage?: {
    enabled?: boolean | null;
    form?: HouseRoofAppendageForm | null;
    hostEdge?: AttachmentSide | null;
    pitchDeg?: number | null;
    dropMm?: number | null;
  } | null;
  attachmentSourceEdgeId?: string | null;
  /**
   * Terminal-end ids that should render as open gables instead of hipped
   * slopes. Milestone 13 phase A: only the rectangular hipped path
   * honours this; joined / L-shape hipped roofs treat it as a no-op
   * until phase B lands. Empty/missing means all terminal ends are
   * hipped (legacy behaviour).
   */
  openTerminalEndIds?: ReadonlyArray<string> | null;
}): HouseRoofBuildResult {
  const roofSelectionValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
    appendageEnabled: false,
  });
  if (
    roofSelectionValidation.code === 'unsupported_roof_topology' ||
    roofSelectionValidation.code === 'unsupported_gable_topology' ||
    roofSelectionValidation.code === 'unsupported_hipped_topology' ||
    roofSelectionValidation.code === 'invalid_mono_fall_direction' ||
    roofSelectionValidation.code === 'invalid_ridge_axis'
  ) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: input.roofForm,
      roofGeometry: input.roofForm === 'gable' ? 'bent_spine_joined_gable' : 'rectilinear_joined_hipped',
      reason: roofSelectionValidation.code,
    });
  }

  const primary = buildPrimaryHouseRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    roofForm: input.roofForm,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofRidgeAxis: input.roofRidgeAxis,
    openTerminalEndIds: input.openTerminalEndIds ?? null,
  });

  if (!input.roofAppendage?.enabled || primary.metadata.roofQaStatus !== 'valid') {
    return primary;
  }
  const appendageSupport = deriveHouseRoofAppendageSupportFromPrimaryRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon: input.eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: input.roofForm,
    primaryRoof: primary,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  const appendageValidation = validateHouseRoofSelection({
    roofForm: input.roofForm,
    footprint: input.sourceFootprint,
    appendageEnabled: Boolean(input.roofAppendage?.enabled),
    appendageHostEdge: input.roofAppendage?.hostEdge ?? 'rear',
    appendageSupport,
  });
  if (
    appendageValidation.code === 'invalid_appendage_topology' ||
    appendageValidation.code === 'invalid_appendage_host_edge'
  ) {
    return {
      ...primary,
      metadata: {
        ...primary.metadata,
        roofQaStatus: 'invalid',
        roofQaFailureReason: appendageValidation.code,
        roofTopologyFailureReason: appendageValidation.code,
      },
    };
  }

  const roofAppendage = input.roofAppendage ?? null;
  const hostRun = appendageSupport.hostRunsBySide[roofAppendage?.hostEdge ?? 'rear'];
  if (!hostRun) {
    return {
      ...primary,
      metadata: {
        ...primary.metadata,
        roofQaStatus: 'invalid',
        roofQaFailureReason: 'invalid_appendage_host_edge',
        roofTopologyFailureReason: 'invalid_appendage_host_edge',
      },
    };
  }
  const appendagePlanes = buildHouseRoofAppendageBand({
    hostRun,
    form: roofAppendage?.form ?? 'mono',
    pitchDeg: finiteNumber(roofAppendage?.pitchDeg, input.roofPitchDeg),
    attachZ: input.eaveHeightMm - positiveNumber(roofAppendage?.dropMm, 450),
  }).map((plane) => ({
    ...plane,
    metadata: {
      ...plane.metadata,
      roofForm: input.roofForm,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
    },
  }));

  return {
    roofPlanes: [...primary.roofPlanes, ...appendagePlanes],
    roofFeatures: primary.roofFeatures,
    metadata: {
      ...primary.metadata,
      roofAppendageEnabled: true,
      roofAppendageForm: roofAppendage?.form ?? 'mono',
      roofAppendageHostEdge: roofAppendage?.hostEdge ?? 'rear',
    },
  };
}
