import type {
  GeometryMetadata,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  Line3,
  Polygon3,
  RoofPlane3D,
} from '../contracts';
import { planeFromPoints } from '../math3d';
import { isOrthogonalFootprint, isRectanglePolygon } from './footprintMath';
import {
  axisRange,
  boundingBox,
  line,
  point,
  rectangleCornersFromBox,
  type HouseRoofBuildResult,
} from './_internal';
import { buildRoofPlane } from './roofPlane';
import { buildJoinedRectilinearHippedRoof } from './roofJoinedHipped';
import { buildJoinedRectilinearGableRoof, buildLegacyJoinedRectilinearGableRoof } from './roofJoined';
import { buildRectangleHippedRoof } from './roofRectangleHipped';
import { buildRectangularRoof } from './roofRectangle';
import { applyRoofQa } from './roofQa';

export function invalidHouseRoof(input: {
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roofGeometry: string;
  reason: string;
  metadata?: GeometryMetadata;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [],
      roofFeatures: [],
      metadata: {
        roofForm: input.roofForm,
        roofGeometry: input.roofGeometry,
        roofTopologyFailureReason: input.reason,
        ...(input.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

export function buildFlatHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
}): HouseRoofBuildResult {
  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-flat-1',
          boundary: input.eavePolygon.map((candidate) =>
            point(candidate.x, candidate.y, input.eaveHeightMm),
          ),
          plane: planeFromPoints(
            point(input.eavePolygon[0]!.x, input.eavePolygon[0]!.y, input.eaveHeightMm),
            point(input.eavePolygon[1]!.x, input.eavePolygon[1]!.y, input.eaveHeightMm),
            point(input.eavePolygon[2]!.x, input.eavePolygon[2]!.y, input.eaveHeightMm),
          ),
          fallVector: { x: 0, y: 1, z: 0 },
          metadata: {
            roofForm: 'flat',
            roofGeometry: 'footprint_flat',
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'flat',
        roofGeometry: 'footprint_flat',
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

export function buildMonoHouseRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  fallDirection: HouseRoofPrimaryFallDirection;
}): HouseRoofBuildResult {
  const axis =
    input.fallDirection === 'positive_x' || input.fallDirection === 'negative_x' ? 'x' : 'y';
  const range = axisRange(input.eavePolygon, axis);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const boundary = input.eavePolygon.map((candidate) => {
    const coordinate = axis === 'x' ? candidate.x : candidate.y;
    const run =
      input.fallDirection === 'positive_x' || input.fallDirection === 'positive_y'
        ? range.max - coordinate
        : coordinate - range.min;
    return point(candidate.x, candidate.y, input.eaveHeightMm + Math.max(0, run) * risePerRun);
  });
  const plane = planeFromPoints(boundary[0]!, boundary[1]!, boundary[2]!);

  return applyRoofQa({
    roof: {
      roofPlanes: [
        {
          id: 'house-roof-mono-1',
          boundary,
          plane,
          fallVector:
            input.fallDirection === 'positive_x'
              ? { x: 1, y: 0, z: -risePerRun }
              : input.fallDirection === 'negative_x'
                ? { x: -1, y: 0, z: -risePerRun }
                : input.fallDirection === 'negative_y'
                  ? { x: 0, y: -1, z: -risePerRun }
                  : { x: 0, y: 1, z: -risePerRun },
          metadata: {
            roofForm: 'mono',
            roofGeometry: 'footprint_mono',
            roofPrimaryFallDirection: input.fallDirection,
            pitchDeg: input.roofPitchDeg,
          },
        },
      ],
      roofFeatures: [],
      metadata: {
        roofForm: 'mono',
        roofGeometry: 'footprint_mono',
        roofPrimaryFallDirection: input.fallDirection,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

export function buildRectangularGableRoof(input: {
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isRectanglePolygon(input.eavePolygon)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'rectangular_gable',
      reason: 'unsupported_gable_topology',
    });
  }

  const box = boundingBox(input.eavePolygon);
  const risePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const corners = rectangleCornersFromBox(box);
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  const roofPlanes: RoofPlane3D[] = [];
  let ridge: Line3;

  if (input.ridgeAxis === 'x') {
    const run = (box.maxY - box.minY) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(box.minX, centerY, ridgeZ);
    const ridgeEnd = point(box.maxX, centerY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-y',
        boundary: [
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.minY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-y',
        boundary: [
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(centerX, box.maxY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  } else {
    const run = (box.maxX - box.minX) / 2;
    const ridgeZ = input.eaveHeightMm + run * risePerRun;
    const ridgeStart = point(centerX, box.minY, ridgeZ);
    const ridgeEnd = point(centerX, box.maxY, ridgeZ);
    ridge = line(ridgeStart, ridgeEnd);
    roofPlanes.push(
      buildRoofPlane({
        id: 'house-roof-gable-min-x',
        boundary: [
          point(corners.minXMaxY.x, corners.minXMaxY.y, input.eaveHeightMm),
          point(corners.minXMinY.x, corners.minXMinY.y, input.eaveHeightMm),
          ridgeStart,
          ridgeEnd,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.minX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
      buildRoofPlane({
        id: 'house-roof-gable-max-x',
        boundary: [
          point(corners.maxXMinY.x, corners.maxXMinY.y, input.eaveHeightMm),
          point(corners.maxXMaxY.x, corners.maxXMaxY.y, input.eaveHeightMm),
          ridgeEnd,
          ridgeStart,
        ],
        highPoint: point(centerX, centerY, ridgeZ),
        lowPoint: point(box.maxX, centerY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
        metadata: { roofForm: 'gable', roofGeometry: 'rectangular_gable' },
      }),
    );
  }

  return applyRoofQa({
    roof: {
      roofPlanes,
      roofFeatures: [
        {
          id: 'house-roof-ridge-1',
          kind: 'ridge',
          line: ridge,
          metadata: {
            roofForm: 'gable',
            roofGeometry: 'rectangular_gable',
            ridgeAxis: input.ridgeAxis,
          },
        },
      ],
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectangular_gable',
        ridgeAxis: input.ridgeAxis,
      },
    },
    eavePolygon: input.eavePolygon,
  });
}

export function buildGabledHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  ridgeAxis: HouseRoofRidgeAxis;
}): HouseRoofBuildResult {
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { footprintFollowing: false, ridgeAxis: input.ridgeAxis },
    });
  }

  if (isRectanglePolygon(input.eavePolygon)) {
    return buildRectangularGableRoof({
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
      ridgeAxis: input.ridgeAxis,
    });
  }

  const roof = buildJoinedRectilinearGableRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'gable',
      roofGeometry: 'bent_spine_joined_gable',
      reason: 'unsupported_gable_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true, ridgeAxis: input.ridgeAxis },
    });
  }

  const bentSpineResult = applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      terminalClosures: roof.terminalClosures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'bent_spine_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof roof.metadata?.roofRejectedFacetCount === 'number'
        ? roof.metadata.roofRejectedFacetCount
        : 0,
  });
  if (bentSpineResult.metadata.roofQaStatus === 'valid') {
    return bentSpineResult;
  }

  const legacyRoof = buildLegacyJoinedRectilinearGableRoof(input);
  if (!legacyRoof.roofPlanes.length) {
    return bentSpineResult;
  }
  return applyRoofQa({
    roof: {
      roofPlanes: legacyRoof.roofPlanes,
      roofFeatures: legacyRoof.roofFeatures,
      metadata: {
        roofForm: 'gable',
        roofGeometry: 'rectilinear_joined_gable',
        footprintFollowing: true,
        ridgeAxis: input.ridgeAxis,
        ...(legacyRoof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount:
      typeof legacyRoof.metadata?.roofRejectedFacetCount === 'number'
        ? legacyRoof.metadata.roofRejectedFacetCount
        : 0,
  });
}

export function buildHippedHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  /**
   * Ridge axis for the rectangular-hipped case. When omitted, derived
   * from rectangle dimensions (legacy behaviour: ridge along the longer
   * dimension). Required when `openTerminalEndIds` carries any id, so the
   * unified builder can map ids to caps in the right axis convention.
   */
  ridgeAxis?: HouseRoofRidgeAxis;
  /**
   * Terminal-end ids (per `deriveHouseGableTerminalEndsFromFootprint`)
   * that should render as open gables. Only honoured by the rectangular
   * path in milestone 13 phase A; the joined / L-shape path ignores it
   * until phase B. Empty/null = legacy fully-hipped output.
   */
  openTerminalEndIds?: ReadonlyArray<string> | null;
}): HouseRoofBuildResult {
  const box = boundingBox(input.eavePolygon);
  if (!isOrthogonalFootprint(input.sourceFootprint)) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { footprintFollowing: false },
    });
  }
  if (isRectanglePolygon(input.eavePolygon)) {
    // Always derive the ridge axis from dimensions for the rectangular
    // hipped path -- the legacy `buildRectangleHippedRoof` ignored any
    // configured ridge axis and used `widthX >= widthY ? 'x' : 'y'`.
    // Honouring the supplied `input.ridgeAxis` would silently change
    // output for existing fixtures whose `config.roofRidgeAxis`
    // disagrees with the dimension-derived axis.
    const widthX = box.maxX - box.minX;
    const widthY = box.maxY - box.minY;
    const resolvedRidgeAxis: HouseRoofRidgeAxis = widthX >= widthY ? 'x' : 'y';
    // Map openTerminalEndIds to per-end caps. Terminal-end ids follow
    // the convention `house-gable-end-{x|y}-{1|2}` (1 = min-axis side,
    // 2 = max-axis side) per `buildBentSpineGableTerminalEndsX`. For a
    // simple rectangle there are exactly 2 terminal ends along the
    // ridge axis; matching by suffix is sufficient.
    const openIds = new Set(input.openTerminalEndIds ?? []);
    const startCap: 'hipped' | 'open_gable' = openIds.has(`house-gable-end-${resolvedRidgeAxis}-1`)
      ? 'open_gable'
      : 'hipped';
    const endCap: 'hipped' | 'open_gable' = openIds.has(`house-gable-end-${resolvedRidgeAxis}-2`)
      ? 'open_gable'
      : 'hipped';
    return applyRoofQa({
      roof: {
        ...buildRectangularRoof({
          ...box,
          eaveHeightMm: input.eaveHeightMm,
          roofPitchDeg: input.roofPitchDeg,
          ridgeAxis: resolvedRidgeAxis,
          startCap,
          endCap,
        }),
        metadata: {
          // Form metadata reflects the resolved cap pair so downstream
          // roof QA + visual code can distinguish hipped / gable /
          // dutch_hip without re-deriving from the cap inputs.
          roofForm:
            startCap === 'hipped' && endCap === 'hipped'
              ? 'hipped'
              : startCap === 'open_gable' && endCap === 'open_gable'
                ? 'gable'
                : 'dutch_hip',
          roofGeometry: 'rectangular_hipped',
          footprintFollowing: true,
        },
      },
      eavePolygon: input.eavePolygon,
    });
  }

  const roof = buildJoinedRectilinearHippedRoof(input);
  if (!roof.roofPlanes.length) {
    return invalidHouseRoof({
      eavePolygon: input.eavePolygon,
      roofForm: 'hipped',
      roofGeometry: 'rectilinear_joined_hipped',
      reason: 'unsupported_hipped_topology',
      metadata: { ...(roof.metadata ?? {}), footprintFollowing: true },
    });
  }

  return applyRoofQa({
    roof: {
      roofPlanes: roof.roofPlanes,
      roofFeatures: roof.roofFeatures,
      metadata: {
        roofForm: 'hipped',
        roofGeometry: 'rectilinear_joined_hipped',
        footprintFollowing: true,
        ...(roof.metadata ?? {}),
      },
    },
    eavePolygon: input.eavePolygon,
    rejectedFacetCount: typeof roof.metadata?.roofRejectedFacetCount === 'number' ? roof.metadata.roofRejectedFacetCount : 0,
  });
}

export function buildPrimaryHouseRoof(input: {
  sourceFootprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  /**
   * Per-terminal-end open-gable overlay (milestone 13 phase A).
   * Only honoured for the rectangular hipped path right now; joined /
   * L-shape paths treat it as a no-op until phase B lands. Open ends
   * convert that hip slope into a vertical gable wall via the unified
   * `buildRectangularRoof` builder.
   */
  openTerminalEndIds?: ReadonlyArray<string> | null;
}): HouseRoofBuildResult {
  return input.roofForm === 'flat'
    ? buildFlatHouseRoof({
        eavePolygon: input.eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      })
    : input.roofForm === 'mono'
      ? buildMonoHouseRoof({
          eavePolygon: input.eavePolygon,
          eaveHeightMm: input.eaveHeightMm,
          roofPitchDeg: input.roofPitchDeg,
          fallDirection: input.roofPrimaryFallDirection,
        })
      : input.roofForm === 'gable'
        ? buildGabledHouseRoof({
            sourceFootprint: input.sourceFootprint,
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            roofPitchDeg: input.roofPitchDeg,
            ridgeAxis: input.roofRidgeAxis,
          })
        : buildHippedHouseRoof({
            sourceFootprint: input.sourceFootprint,
            eavePolygon: input.eavePolygon,
            eaveHeightMm: input.eaveHeightMm,
            roofPitchDeg: input.roofPitchDeg,
            ridgeAxis: input.roofRidgeAxis,
            openTerminalEndIds: input.openTerminalEndIds ?? null,
          });
}
