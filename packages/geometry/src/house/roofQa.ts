import type { GeometryMetadata, Plane3, Polygon3, RoofPlane3D, Vector3 } from '../contracts';
import { ROOF_JOIN_EPSILON_MM, ROOF_REGION_MIN_AREA_MM2 } from './constants';
import {
  finiteRoofQaPoint,
  signedAreaXY,
  type HouseRoofBuildResult,
} from './_internal';
import {
  cleanRoofPolygon2D,
  point2FromPoint3,
  roofPolygonArea,
  roofPolygonCentroid,
  roofPolygonIsSimple,
  roofRegionInsideEave,
} from './roof2D';
import { pointInOrOnRoofPolygon } from './roofPlane';

type RoofQaStatus = 'valid' | 'invalid';

type HouseRoofQaResult = {
  status: RoofQaStatus;
  facetAreaMm2: number;
  eaveAreaMm2: number;
  areaDeltaMm2: number;
  rejectedFacetCount: number;
  failureReason: string | null;
};

const ROOF_QA_AREA_TOLERANCE_MIN_MM2 = 100;
const ROOF_QA_AREA_TOLERANCE_RATIO = 0.001;

function finiteRoofQaVector(candidate: Vector3): boolean {
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
}

function finiteRoofQaPlane(plane: Plane3): boolean {
  return (
    finiteRoofQaPoint(plane.origin) &&
    finiteRoofQaVector(plane.xAxis) &&
    finiteRoofQaVector(plane.yAxis) &&
    finiteRoofQaVector(plane.normal) &&
    Math.hypot(plane.xAxis.x, plane.xAxis.y, plane.xAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.yAxis.x, plane.yAxis.y, plane.yAxis.z) > ROOF_JOIN_EPSILON_MM &&
    Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) > ROOF_JOIN_EPSILON_MM
  );
}

function roofQaMetadata(result: HouseRoofQaResult): GeometryMetadata {
  return {
    roofQaStatus: result.status,
    roofQaFacetAreaMm2: Math.round(result.facetAreaMm2),
    roofQaEaveAreaMm2: Math.round(result.eaveAreaMm2),
    roofQaAreaDeltaMm2: Math.round(result.areaDeltaMm2),
    roofQaRejectedFacetCount: result.rejectedFacetCount,
    roofQaFailureReason: result.failureReason,
  };
}

function validateRoofPlaneForQa(roofPlane: RoofPlane3D, eavePolygon: Polygon3): string | null {
  if (roofPlane.boundary.length < 3) return `${roofPlane.id}:too_few_points`;
  if (!roofPlane.boundary.every(finiteRoofQaPoint)) return `${roofPlane.id}:non_finite_boundary`;
  if (!finiteRoofQaPlane(roofPlane.plane)) return `${roofPlane.id}:non_finite_plane`;

  const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
  if (footprint.length < 3) return `${roofPlane.id}:degenerate_plan`;
  if (roofPolygonArea(footprint) <= ROOF_REGION_MIN_AREA_MM2) return `${roofPlane.id}:zero_plan_area`;
  if (!roofPolygonIsSimple(footprint)) return `${roofPlane.id}:self_intersecting_plan`;
  if (!roofRegionInsideEave(footprint, eavePolygon)) return `${roofPlane.id}:outside_eave_or_spans_void`;

  const centroid = roofPolygonCentroid(footprint);
  const roofGeometry =
    typeof roofPlane.metadata?.roofGeometry === 'string'
      ? roofPlane.metadata.roofGeometry
      : null;
  if (
    roofGeometry !== 'footprint_flat' &&
    roofGeometry !== 'footprint_mono' &&
    !pointInOrOnRoofPolygon(centroid, eavePolygon)
  ) {
    return `${roofPlane.id}:centroid_outside_eave`;
  }
  return null;
}

export function validateHouseRoofQa(input: {
  roofPlanes: RoofPlane3D[];
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
  failureReason?: string | null;
}): HouseRoofQaResult {
  const eaveAreaMm2 = Math.abs(signedAreaXY(input.eavePolygon));
  let facetAreaMm2 = 0;
  let failureReason: string | null = input.failureReason ?? null;

  if (
    input.eavePolygon.length < 3 ||
    input.eavePolygon.some((candidate) => !finiteRoofQaPoint(candidate)) ||
    eaveAreaMm2 <= ROOF_REGION_MIN_AREA_MM2
  ) {
    failureReason = 'invalid_eave_polygon';
  } else {
    const eaveFootprint = cleanRoofPolygon2D(input.eavePolygon.map(point2FromPoint3));
    if (!roofPolygonIsSimple(eaveFootprint)) failureReason = 'self_intersecting_eave_polygon';
  }

  if (input.roofPlanes.length === 0 && !failureReason) {
    failureReason = 'missing_roof_facets';
  }

  for (const roofPlane of input.roofPlanes) {
    const footprint = cleanRoofPolygon2D(roofPlane.boundary.map(point2FromPoint3));
    if (footprint.length >= 3) {
      facetAreaMm2 += roofPolygonArea(footprint);
    }
    failureReason ??= validateRoofPlaneForQa(roofPlane, input.eavePolygon);
  }

  const rejectedFacetCount = Math.max(0, input.rejectedFacetCount ?? 0);
  if (rejectedFacetCount > 0 && !failureReason) {
    failureReason = 'rejected_roof_facets';
  }

  const areaDeltaMm2 = facetAreaMm2 - eaveAreaMm2;
  const areaToleranceMm2 = Math.max(ROOF_QA_AREA_TOLERANCE_MIN_MM2, eaveAreaMm2 * ROOF_QA_AREA_TOLERANCE_RATIO);
  if (!failureReason && Math.abs(areaDeltaMm2) > areaToleranceMm2) {
    failureReason = 'roof_area_mismatch';
  }

  return {
    status: failureReason ? 'invalid' : 'valid',
    facetAreaMm2,
    eaveAreaMm2,
    areaDeltaMm2,
    rejectedFacetCount,
    failureReason,
  };
}

export function applyRoofQa(input: {
  roof: HouseRoofBuildResult;
  eavePolygon: Polygon3;
  rejectedFacetCount?: number;
}): HouseRoofBuildResult {
  const topologyFailureReason =
    typeof input.roof.metadata.roofTopologyFailureReason === 'string'
      ? input.roof.metadata.roofTopologyFailureReason
      : null;
  const qaMetadata = roofQaMetadata(
    validateHouseRoofQa({
      roofPlanes: input.roof.roofPlanes,
      eavePolygon: input.eavePolygon,
      rejectedFacetCount: input.rejectedFacetCount,
      failureReason: topologyFailureReason,
    }),
  );
  const topologyMetadata = Object.fromEntries(
    Object.entries(input.roof.metadata).filter(
      ([key]) =>
        key === 'roofFacetMergeMode' ||
        key.startsWith('roofTopology') ||
        key.startsWith('roofWavefront'),
    ),
  );
  return {
    roofPlanes: input.roof.roofPlanes.map((roofPlane) => ({
      ...roofPlane,
      metadata: {
        ...roofPlane.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    roofFeatures: input.roof.roofFeatures.map((feature) => ({
      ...feature,
      metadata: {
        ...feature.metadata,
        ...topologyMetadata,
        ...qaMetadata,
      },
    })),
    terminalClosures: input.roof.terminalClosures,
    metadata: {
      ...input.roof.metadata,
      ...qaMetadata,
    },
  };
}
