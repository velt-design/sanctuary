import type { GeometryMetadata, Polygon3 } from '../contracts';
import { point2FromPoint3, roofPolygonIsSimple } from './roof2D';
import { offsetFootprintPolygon, isOrthogonalFootprint } from './footprintMath';
import { signedAreaXY, type HouseRoofBuildResult } from './_internal';

export type HouseRoofEaveOffsetRepairStatus = 'none' | 'repaired' | 'failed';

const HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE = 'eave_offset_self_overlap';

const REPAIR_STEP_MM = 50;
const MIN_REPAIR_SOURCE_OVERHANG_MM = 1;
const MIN_EAVE_AREA_MM2 = 1;

function stringMetadata(
  metadata: GeometryMetadata | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function eavePolygonTopologyCode(eavePolygon: Polygon3 | null): string | null {
  if (!eavePolygon || eavePolygon.length < 3) {
    return HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE;
  }
  if (
    eavePolygon.some(
      (candidate) =>
        !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y),
    ) ||
    Math.abs(signedAreaXY(eavePolygon)) <= MIN_EAVE_AREA_MM2
  ) {
    return HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE;
  }
  if (!roofPolygonIsSimple(eavePolygon.map(point2FromPoint3))) {
    return HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE;
  }
  return null;
}

function eaveOffsetFailureCode(roof: HouseRoofBuildResult): string | null {
  const failureReasons = [
    stringMetadata(roof.metadata, 'roofTopologyFailureReason'),
    stringMetadata(roof.metadata, 'roofWavefrontFailureReason'),
    stringMetadata(roof.metadata, 'roofQaFailureReason'),
  ];
  if (
    failureReasons.some(
      (reason) =>
        reason?.includes('overlapping_boundary_fragments') ||
        reason?.includes('unclosed_boundary_graph') ||
        reason?.includes('self_intersecting_merged_face') ||
        reason?.includes('missing_source_edge_face') ||
        reason?.includes('missing_source_edge_contact') ||
        reason?.includes('invalid_source_edge_coverage_face') ||
        reason === 'roof_area_mismatch' ||
        reason === 'self_intersecting_eave_polygon' ||
        reason === 'invalid_eave_polygon',
    )
  ) {
    return HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE;
  }
  return null;
}

function stampRepairMetadata(input: {
  roof: HouseRoofBuildResult;
  status: Exclude<HouseRoofEaveOffsetRepairStatus, 'none'>;
  requestedEaveOverhangMm: number;
  effectiveEaveOverhangMm: number;
}): HouseRoofBuildResult {
  const metadata: GeometryMetadata = {
    roofEaveOffsetRepairStatus: input.status,
    roofEaveOffsetRepairCode: HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE,
    roofRequestedEaveOverhangMm: input.requestedEaveOverhangMm,
    roofEffectiveEaveOverhangMm: input.effectiveEaveOverhangMm,
  };
  return {
    ...input.roof,
    roofPlanes: input.roof.roofPlanes.map((plane) => ({
      ...plane,
      metadata: { ...plane.metadata, ...metadata },
    })),
    roofFeatures: input.roof.roofFeatures.map((feature) => ({
      ...feature,
      metadata: { ...feature.metadata, ...metadata },
    })),
    metadata: {
      ...input.roof.metadata,
      ...metadata,
    },
  };
}

function stampRoofMetadata(
  roof: HouseRoofBuildResult,
  metadata: GeometryMetadata | undefined,
): HouseRoofBuildResult {
  if (!metadata || Object.keys(metadata).length === 0) return roof;
  return {
    ...roof,
    roofPlanes: roof.roofPlanes.map((plane) => ({
      ...plane,
      metadata: { ...plane.metadata, ...metadata },
    })),
    roofFeatures: roof.roofFeatures.map((feature) => ({
      ...feature,
      metadata: { ...feature.metadata, ...metadata },
    })),
    metadata: {
      ...roof.metadata,
      ...metadata,
    },
  };
}

function repairCandidateOffsets(requestedEaveOverhangMm: number): number[] {
  const candidates: number[] = [];
  for (
    let offsetMm = requestedEaveOverhangMm - REPAIR_STEP_MM;
    offsetMm > 0;
    offsetMm -= REPAIR_STEP_MM
  ) {
    candidates.push(Number(offsetMm.toFixed(6)));
  }
  candidates.push(0);
  return [...new Set(candidates)].filter((offsetMm) => offsetMm >= 0);
}

export function buildHippedRoofWithEaveOffsetRepair(input: {
  footprint: Polygon3;
  requestedEaveOverhangMm: number;
  initialEavePolygon: Polygon3;
  initialEaveMetadata?: GeometryMetadata;
  topologyAwareEavePolygon?: Polygon3 | null;
  topologyAwareEaveMetadata?: GeometryMetadata;
  buildRoof: (candidate: {
    sourceFootprint: Polygon3;
    eavePolygon: Polygon3;
  }) => HouseRoofBuildResult;
}): {
  roof: HouseRoofBuildResult;
  eavePolygon: Polygon3;
  sourceFootprint: Polygon3;
  repairStatus: HouseRoofEaveOffsetRepairStatus;
  repairCode: string | null;
  effectiveEaveOverhangMm: number;
} {
  const initialRoof = stampRoofMetadata(
    input.buildRoof({
      sourceFootprint: input.footprint,
      eavePolygon: input.initialEavePolygon,
    }),
    input.initialEaveMetadata,
  );
  const initialEaveTopologyStatus = stringMetadata(
    input.initialEaveMetadata,
    'eaveOffsetTopologyStatus',
  );
  if (
    stringMetadata(initialRoof.metadata, 'roofQaStatus') === 'valid' &&
    initialEaveTopologyStatus !== 'invalid'
  ) {
    return {
      roof: initialRoof,
      eavePolygon: input.initialEavePolygon,
      sourceFootprint: input.footprint,
      repairStatus: 'none',
      repairCode: null,
      effectiveEaveOverhangMm: input.requestedEaveOverhangMm,
    };
  }

  const initialTopologyCode =
    eavePolygonTopologyCode(input.initialEavePolygon) ??
    eaveOffsetFailureCode(initialRoof);
  if (
    initialTopologyCode !== HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE ||
    input.requestedEaveOverhangMm < MIN_REPAIR_SOURCE_OVERHANG_MM ||
    !isOrthogonalFootprint(input.footprint)
  ) {
    return {
      roof: initialRoof,
      eavePolygon: input.initialEavePolygon,
      sourceFootprint: input.footprint,
      repairStatus: 'none',
      repairCode: null,
      effectiveEaveOverhangMm: input.requestedEaveOverhangMm,
    };
  }

  if (input.topologyAwareEavePolygon && !eavePolygonTopologyCode(input.topologyAwareEavePolygon)) {
    const topologyAwareRoof = stampRoofMetadata(
      input.buildRoof({
        sourceFootprint: input.footprint,
        eavePolygon: input.topologyAwareEavePolygon,
      }),
      {
        ...input.topologyAwareEaveMetadata,
        eaveOffsetTopologyStatus:
          input.topologyAwareEaveMetadata?.eaveOffsetTopologyStatus === 'valid'
            ? 'resolved'
            : input.topologyAwareEaveMetadata?.eaveOffsetTopologyStatus ?? null,
      },
    );
    if (stringMetadata(topologyAwareRoof.metadata, 'roofQaStatus') === 'valid') {
      return {
        roof: topologyAwareRoof,
        eavePolygon: input.topologyAwareEavePolygon,
        sourceFootprint: input.footprint,
        repairStatus: 'none',
        repairCode: null,
        effectiveEaveOverhangMm: input.requestedEaveOverhangMm,
      };
    }
  }

  for (const candidateOffsetMm of repairCandidateOffsets(
    input.requestedEaveOverhangMm,
  )) {
    const candidateEavePolygon = offsetFootprintPolygon(
      input.footprint,
      candidateOffsetMm,
    );
    if (eavePolygonTopologyCode(candidateEavePolygon)) continue;
    const candidateRoof = input.buildRoof({
      sourceFootprint: input.footprint,
      eavePolygon: candidateEavePolygon as Polygon3,
    });
    if (stringMetadata(candidateRoof.metadata, 'roofQaStatus') !== 'valid') {
      continue;
    }
    return {
      roof: stampRepairMetadata({
        roof: candidateRoof,
        status: 'repaired',
        requestedEaveOverhangMm: input.requestedEaveOverhangMm,
        effectiveEaveOverhangMm: candidateOffsetMm,
      }),
      eavePolygon: candidateEavePolygon as Polygon3,
      sourceFootprint: input.footprint,
      repairStatus: 'repaired',
      repairCode: HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE,
      effectiveEaveOverhangMm: candidateOffsetMm,
    };
  }

  for (const candidateSourceFootprint of narrowReturnRepairFootprints({
    footprint: input.footprint,
    maxReturnWidthMm: input.requestedEaveOverhangMm * 2,
  })) {
    const candidateOffsets = [
      input.requestedEaveOverhangMm,
      ...repairCandidateOffsets(input.requestedEaveOverhangMm),
    ];
    for (const candidateOffsetMm of candidateOffsets) {
      const candidateEavePolygon = offsetFootprintPolygon(
        candidateSourceFootprint,
        candidateOffsetMm,
      );
      if (eavePolygonTopologyCode(candidateEavePolygon)) continue;
      const candidateRoof = input.buildRoof({
        sourceFootprint: candidateSourceFootprint,
        eavePolygon: candidateEavePolygon as Polygon3,
      });
      if (stringMetadata(candidateRoof.metadata, 'roofQaStatus') !== 'valid') {
        continue;
      }
      return {
        roof: stampRepairMetadata({
          roof: candidateRoof,
          status: 'repaired',
          requestedEaveOverhangMm: input.requestedEaveOverhangMm,
          effectiveEaveOverhangMm: candidateOffsetMm,
        }),
        eavePolygon: candidateEavePolygon as Polygon3,
        sourceFootprint: candidateSourceFootprint,
        repairStatus: 'repaired',
        repairCode: HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE,
        effectiveEaveOverhangMm: candidateOffsetMm,
      };
    }
  }

  return {
    roof: stampRepairMetadata({
      roof: initialRoof,
      status: 'failed',
      requestedEaveOverhangMm: input.requestedEaveOverhangMm,
      effectiveEaveOverhangMm: input.requestedEaveOverhangMm,
    }),
    eavePolygon: input.initialEavePolygon,
    sourceFootprint: input.footprint,
    repairStatus: 'failed',
    repairCode: HOUSE_EAVE_OFFSET_SELF_OVERLAP_CODE,
    effectiveEaveOverhangMm: input.requestedEaveOverhangMm,
  };
}

function pointsAreCollinear(a: Polygon3[number], b: Polygon3[number], c: Polygon3[number]): boolean {
  return (
    (Math.abs(a.x - b.x) <= 1e-6 && Math.abs(b.x - c.x) <= 1e-6) ||
    (Math.abs(a.y - b.y) <= 1e-6 && Math.abs(b.y - c.y) <= 1e-6)
  );
}

function cleanOrthogonalFootprint(polygon: Polygon3): Polygon3 {
  const cleaned: Polygon3 = [];
  for (const candidate of polygon) {
    const previous = cleaned[cleaned.length - 1];
    if (
      previous &&
      Math.hypot(previous.x - candidate.x, previous.y - candidate.y) <= 1e-6
    ) {
      continue;
    }
    cleaned.push(candidate);
  }
  let changed = true;
  while (changed && cleaned.length >= 3) {
    changed = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      if (!pointsAreCollinear(previous, current, next)) continue;
      cleaned.splice(index, 1);
      changed = true;
      break;
    }
  }
  return cleaned;
}

function narrowReturnRepairFootprints(input: {
  footprint: Polygon3;
  maxReturnWidthMm: number;
}): Polygon3[] {
  const candidates: Polygon3[] = [];
  if (!Number.isFinite(input.maxReturnWidthMm) || input.maxReturnWidthMm <= 0) {
    return candidates;
  }
  for (let index = 0; index < input.footprint.length; index += 1) {
    const start = input.footprint[index]!;
    const end = input.footprint[(index + 1) % input.footprint.length]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= 1e-6 || length > input.maxReturnWidthMm) continue;
    const previous = input.footprint[
      (index - 1 + input.footprint.length) % input.footprint.length
    ]!;
    const next = input.footprint[(index + 2) % input.footprint.length]!;
    const previousAxis =
      Math.abs(previous.x - start.x) <= 1e-6 ? 'y' : 'x';
    const nextAxis = Math.abs(end.x - next.x) <= 1e-6 ? 'y' : 'x';
    if (previousAxis !== nextAxis) continue;
    if (
      Math.abs(previous.x - next.x) > 1e-6 &&
      Math.abs(previous.y - next.y) > 1e-6
    ) {
      continue;
    }
    const repaired = cleanOrthogonalFootprint(
      input.footprint.filter(
        (_point, pointIndex) =>
          pointIndex !== index &&
          pointIndex !== (index + 1) % input.footprint.length,
      ),
    );
    if (
      repaired.length >= 4 &&
      isOrthogonalFootprint(repaired) &&
      Math.abs(signedAreaXY(repaired)) > MIN_EAVE_AREA_MM2
    ) {
      candidates.push(repaired);
    }
  }
  return candidates;
}
