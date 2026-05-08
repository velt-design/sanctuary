import type { HouseRoofFeature3D, HouseRoofRidgeAxis, RoofPlane3D } from '../contracts';
import { RIDGE_COLLAPSE_EPSILON_MM } from './constants';
import { line, point } from './_internal';
import { buildRoofPlane } from './roofPlane';

/**
 * Per-end cap state for a rectangular roof's ridge. The two ends of any
 * ridge are independent: each can be a hipped slope (the ridge stops
 * short of the eave; a triangular plane fills the gap) or an open gable
 * (the ridge extends to the eave; that face is a vertical gable wall).
 *
 * Milestone 13's "click hip triangle to open as gable" feature unifies
 * the legacy `roofForm: 'hipped'` and `roofForm: 'gable'` cases as
 * degenerate forms of this builder:
 *   `(hipped, hipped)` ≡ legacy hipped roof
 *   `(open_gable, open_gable)` ≡ legacy gable roof
 *   any other combination = Dutch-hip / half-hip (the new feature)
 */
export type RidgeEndCap = 'hipped' | 'open_gable';

export type BuildRectangularRoofInput = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  eaveHeightMm: number;
  roofPitchDeg: number;
  /**
   * Direction the ridge runs. The unified builder uses this to pick
   * which dimension produces the trapezoidal main slopes vs. the
   * triangular end (hip) slopes.
   */
  ridgeAxis: HouseRoofRidgeAxis;
  /**
   * Cap on the ridge-start (min-axis) end. 'hipped' = a triangular plane
   * fills the end and the ridge stops short of the eave by `halfShort`.
   * 'open_gable' = ridge extends to the eave; the end face is a vertical
   * gable wall (handled by `buildWallSegments` downstream via
   * `houseWallMode: 'open_gable_frame'`).
   */
  startCap: RidgeEndCap;
  /** Cap on the ridge-end (max-axis) end. Mirror of `startCap`. */
  endCap: RidgeEndCap;
};

export type BuildRectangularRoofResult = {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
};

/**
 * Unified rectangular roof builder. Replaces the legacy split between
 * `buildRectangleHippedRoof` (always both ends hipped) and
 * `buildRectangularGableRoof` (always both ends open). Per-end cap input
 * means the same builder produces hipped, gable, AND Dutch-hip roofs --
 * the "form" name is now a derived property of the cap pair, not a
 * primary input.
 *
 * Topology rules (ridge along X; mirror for Y):
 * - Always emit two trapezoidal main slopes spanning the long sides.
 *   Their top edges meet the ridge endpoints, which sit at the eave when
 *   the corresponding cap is open and inset by `halfShort` when hipped.
 * - For each `'hipped'` cap, emit one triangular hip plane at that end
 *   and two hip-line features (corner -> ridge endpoint).
 * - For each `'open_gable'` cap, skip the hip plane and the hip features.
 *   The end face becomes a gable wall via the wall-building step.
 * - Emit one ridge feature spanning between the resolved ridge endpoints.
 *
 * Pyramid collapse (ridge length ≤ epsilon) only arises with
 * `(hipped, hipped)` on a near-square footprint -- with any open cap
 * the ridge always has positive length. Behaviour preserved from the
 * legacy hipped builder: 4 triangular planes meeting at a centerpoint.
 *
 * Vertex orderings in plane boundaries match the legacy hipped + gable
 * builders byte-for-byte so the structural-equivalence asserts in tests
 * pin the migration.
 */
export function buildRectangularRoof(
  input: BuildRectangularRoofInput,
): BuildRectangularRoofResult {
  if (input.ridgeAxis === 'x') return buildAlongX(input);
  return buildAlongY(input);
}

function buildAlongX(input: BuildRectangularRoofInput): BuildRectangularRoofResult {
  const widthY = input.maxY - input.minY;
  const halfShort = widthY / 2;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;

  const ridgeStartX = input.startCap === 'hipped' ? input.minX + halfShort : input.minX;
  const ridgeEndX = input.endCap === 'hipped' ? input.maxX - halfShort : input.maxX;
  const ridgeLengthMm = ridgeEndX - ridgeStartX;

  const minXMinY = point(input.minX, input.minY, input.eaveHeightMm);
  const maxXMinY = point(input.maxX, input.minY, input.eaveHeightMm);
  const maxXMaxY = point(input.maxX, input.maxY, input.eaveHeightMm);
  const minXMaxY = point(input.minX, input.maxY, input.eaveHeightMm);

  // Pyramid collapse: only reachable with (hipped, hipped) on a
  // near-square footprint. Open caps push the ridge endpoints out to the
  // eave, which guarantees positive ridge length, so the input
  // combinations that enter this branch are exactly the legacy hipped
  // pyramid -- output matches `buildRectangleHippedRoof`'s pyramid path.
  if (ridgeLengthMm <= RIDGE_COLLAPSE_EPSILON_MM) {
    const peak = point(centerX, centerY, ridgeZ);
    return {
      roofPlanes: [
        buildRoofPlane({
          id: 'house-roof-min-y',
          boundary: [minXMinY, maxXMinY, peak],
          highPoint: peak,
          lowPoint: point(centerX, input.minY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-y',
          boundary: [maxXMaxY, minXMaxY, peak],
          highPoint: peak,
          lowPoint: point(centerX, input.maxY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-min-x',
          boundary: [minXMaxY, minXMinY, peak],
          highPoint: peak,
          lowPoint: point(input.minX, centerY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-x',
          boundary: [maxXMinY, maxXMaxY, peak],
          highPoint: peak,
          lowPoint: point(input.maxX, centerY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
      ],
      roofFeatures: [
        { id: 'house-roof-hip-1', kind: 'hip', line: line(minXMinY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-2', kind: 'hip', line: line(maxXMinY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-3', kind: 'hip', line: line(maxXMaxY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-4', kind: 'hip', line: line(minXMaxY, peak), metadata: { roofForm: 'hipped' } },
      ],
    };
  }

  const ridgeStart = point(ridgeStartX, centerY, ridgeZ);
  const ridgeEnd = point(ridgeEndX, centerY, ridgeZ);
  const highPoint = point(centerX, centerY, ridgeZ);

  const planes: RoofPlane3D[] = [];
  const features: HouseRoofFeature3D[] = [];

  // Main slopes -- always emitted. Boundaries match legacy hipped/gable
  // builders' vertex ordering.
  planes.push(
    buildRoofPlane({
      id: 'house-roof-min-y',
      boundary: [minXMinY, maxXMinY, ridgeEnd, ridgeStart],
      highPoint,
      lowPoint: point(centerX, input.minY, input.eaveHeightMm),
      ridgeAxis: 'x',
      pitchDeg: input.roofPitchDeg,
    }),
    buildRoofPlane({
      id: 'house-roof-max-y',
      boundary: [maxXMaxY, minXMaxY, ridgeStart, ridgeEnd],
      highPoint,
      lowPoint: point(centerX, input.maxY, input.eaveHeightMm),
      ridgeAxis: 'x',
      pitchDeg: input.roofPitchDeg,
    }),
  );

  // Hip plane on the start (min-x) end -- only when that cap is hipped.
  if (input.startCap === 'hipped') {
    planes.push(
      buildRoofPlane({
        id: 'house-roof-min-x',
        boundary: [minXMaxY, minXMinY, ridgeStart],
        highPoint: ridgeStart,
        lowPoint: point(input.minX, centerY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
      }),
    );
  }
  // Hip plane on the end (max-x) end -- only when that cap is hipped.
  if (input.endCap === 'hipped') {
    planes.push(
      buildRoofPlane({
        id: 'house-roof-max-x',
        boundary: [maxXMinY, maxXMaxY, ridgeEnd],
        highPoint: ridgeEnd,
        lowPoint: point(input.maxX, centerY, input.eaveHeightMm),
        ridgeAxis: 'x',
        pitchDeg: input.roofPitchDeg,
      }),
    );
  }

  // Ridge feature -- spans the resolved ridge endpoints.
  features.push({
    id: 'house-roof-ridge-1',
    kind: 'ridge',
    line: line(ridgeStart, ridgeEnd),
    metadata: { roofForm: capsToRoofFormMetadata(input.startCap, input.endCap) },
  });

  // Hip-line features at each closed-end pair of corners. IDs follow the
  // legacy hipped numbering (1..4 walking corners CCW from min-x/min-y)
  // so any consumer that filters by id stays valid.
  if (input.startCap === 'hipped') {
    features.push(
      { id: 'house-roof-hip-1', kind: 'hip', line: line(minXMinY, ridgeStart), metadata: { roofForm: 'hipped' } },
      { id: 'house-roof-hip-4', kind: 'hip', line: line(minXMaxY, ridgeStart), metadata: { roofForm: 'hipped' } },
    );
  }
  if (input.endCap === 'hipped') {
    features.push(
      { id: 'house-roof-hip-2', kind: 'hip', line: line(maxXMinY, ridgeEnd), metadata: { roofForm: 'hipped' } },
      { id: 'house-roof-hip-3', kind: 'hip', line: line(maxXMaxY, ridgeEnd), metadata: { roofForm: 'hipped' } },
    );
  }

  return { roofPlanes: planes, roofFeatures: features };
}

function buildAlongY(input: BuildRectangularRoofInput): BuildRectangularRoofResult {
  const widthX = input.maxX - input.minX;
  const halfShort = widthX / 2;
  const centerX = (input.minX + input.maxX) / 2;
  const centerY = (input.minY + input.maxY) / 2;
  const pitchRisePerRun = Math.tan((input.roofPitchDeg * Math.PI) / 180);
  const ridgeZ = input.eaveHeightMm + halfShort * pitchRisePerRun;

  const ridgeStartY = input.startCap === 'hipped' ? input.minY + halfShort : input.minY;
  const ridgeEndY = input.endCap === 'hipped' ? input.maxY - halfShort : input.maxY;
  const ridgeLengthMm = ridgeEndY - ridgeStartY;

  const minXMinY = point(input.minX, input.minY, input.eaveHeightMm);
  const maxXMinY = point(input.maxX, input.minY, input.eaveHeightMm);
  const maxXMaxY = point(input.maxX, input.maxY, input.eaveHeightMm);
  const minXMaxY = point(input.minX, input.maxY, input.eaveHeightMm);

  if (ridgeLengthMm <= RIDGE_COLLAPSE_EPSILON_MM) {
    // Pyramid collapse symmetric to the X-axis case. Same plane/feature
    // shape -- a near-square hipped pyramid is axis-agnostic.
    const peak = point(centerX, centerY, ridgeZ);
    return {
      roofPlanes: [
        buildRoofPlane({
          id: 'house-roof-min-y',
          boundary: [maxXMinY, minXMinY, peak],
          highPoint: peak,
          lowPoint: point(centerX, input.minY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-y',
          boundary: [minXMaxY, maxXMaxY, peak],
          highPoint: peak,
          lowPoint: point(centerX, input.maxY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-min-x',
          boundary: [minXMaxY, minXMinY, peak],
          highPoint: peak,
          lowPoint: point(input.minX, centerY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
        buildRoofPlane({
          id: 'house-roof-max-x',
          boundary: [maxXMinY, maxXMaxY, peak],
          highPoint: peak,
          lowPoint: point(input.maxX, centerY, input.eaveHeightMm),
          ridgeAxis: 'pyramid',
          pitchDeg: input.roofPitchDeg,
        }),
      ],
      roofFeatures: [
        { id: 'house-roof-hip-1', kind: 'hip', line: line(minXMinY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-2', kind: 'hip', line: line(maxXMinY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-3', kind: 'hip', line: line(maxXMaxY, peak), metadata: { roofForm: 'hipped' } },
        { id: 'house-roof-hip-4', kind: 'hip', line: line(minXMaxY, peak), metadata: { roofForm: 'hipped' } },
      ],
    };
  }

  const ridgeStart = point(centerX, ridgeStartY, ridgeZ);
  const ridgeEnd = point(centerX, ridgeEndY, ridgeZ);
  const highPoint = point(centerX, centerY, ridgeZ);

  const planes: RoofPlane3D[] = [];
  const features: HouseRoofFeature3D[] = [];

  // Trapezoidal main slopes are on the X-direction faces (min-x / max-x).
  // Vertex orderings match the legacy Y-axis hipped + gable builders.
  planes.push(
    buildRoofPlane({
      id: 'house-roof-min-x',
      boundary: [minXMaxY, minXMinY, ridgeStart, ridgeEnd],
      highPoint,
      lowPoint: point(input.minX, centerY, input.eaveHeightMm),
      ridgeAxis: 'y',
      pitchDeg: input.roofPitchDeg,
    }),
    buildRoofPlane({
      id: 'house-roof-max-x',
      boundary: [maxXMinY, maxXMaxY, ridgeEnd, ridgeStart],
      highPoint,
      lowPoint: point(input.maxX, centerY, input.eaveHeightMm),
      ridgeAxis: 'y',
      pitchDeg: input.roofPitchDeg,
    }),
  );

  // Triangular hip planes are on the Y-direction faces, gated per cap.
  if (input.startCap === 'hipped') {
    planes.push(
      buildRoofPlane({
        id: 'house-roof-min-y',
        boundary: [maxXMinY, minXMinY, ridgeStart],
        highPoint: ridgeStart,
        lowPoint: point(centerX, input.minY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
      }),
    );
  }
  if (input.endCap === 'hipped') {
    planes.push(
      buildRoofPlane({
        id: 'house-roof-max-y',
        boundary: [minXMaxY, maxXMaxY, ridgeEnd],
        highPoint: ridgeEnd,
        lowPoint: point(centerX, input.maxY, input.eaveHeightMm),
        ridgeAxis: 'y',
        pitchDeg: input.roofPitchDeg,
      }),
    );
  }

  features.push({
    id: 'house-roof-ridge-1',
    kind: 'ridge',
    line: line(ridgeStart, ridgeEnd),
    metadata: { roofForm: capsToRoofFormMetadata(input.startCap, input.endCap) },
  });

  // Hip-line corner connectors on each closed end. Hip ids match the
  // legacy Y-axis numbering convention.
  if (input.startCap === 'hipped') {
    features.push(
      { id: 'house-roof-hip-1', kind: 'hip', line: line(minXMinY, ridgeStart), metadata: { roofForm: 'hipped' } },
      { id: 'house-roof-hip-2', kind: 'hip', line: line(maxXMinY, ridgeStart), metadata: { roofForm: 'hipped' } },
    );
  }
  if (input.endCap === 'hipped') {
    features.push(
      { id: 'house-roof-hip-3', kind: 'hip', line: line(maxXMaxY, ridgeEnd), metadata: { roofForm: 'hipped' } },
      { id: 'house-roof-hip-4', kind: 'hip', line: line(minXMaxY, ridgeEnd), metadata: { roofForm: 'hipped' } },
    );
  }

  return { roofPlanes: planes, roofFeatures: features };
}

function capsToRoofFormMetadata(start: RidgeEndCap, end: RidgeEndCap): 'hipped' | 'gable' | 'dutch_hip' {
  if (start === 'hipped' && end === 'hipped') return 'hipped';
  if (start === 'open_gable' && end === 'open_gable') return 'gable';
  return 'dutch_hip';
}
