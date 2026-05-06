import type {
  HouseRoofFeature3D,
  HouseWallSegment3D,
  Point3,
  Polygon3,
  RoofPlane3D,
} from '../contracts';
import { lineLength, normalizeVector, planeFromOriginAxes, subtractPoints } from '../math3d';
import { ROOF_JOIN_EPSILON_MM, WORLD_Z } from './constants';
import {
  line,
  lineIntersectionT2D,
  point,
  type HouseRoofBuildResult,
} from './_internal';
import { roofFeatureHeightAtXY, roofHeightAtXY } from './roofPlane';

export function buildWallTopProfile(input: {
  start: Point3;
  end: Point3;
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  fallbackTopZ: number;
  terminalClosurePoint?: Point3 | null;
}): Point3[] {
  const intersections = input.roofFeatures
    .map((feature) =>
      lineIntersectionT2D(
        input.start,
        input.end,
        feature.line.start,
        feature.line.end,
      ),
    )
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const samples = [0, ...intersections, 1];
  if (input.terminalClosurePoint) {
    const dx = input.end.x - input.start.x;
    const dy = input.end.y - input.start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq > ROOF_JOIN_EPSILON_MM * ROOF_JOIN_EPSILON_MM) {
      const ratio =
        ((input.terminalClosurePoint.x - input.start.x) * dx +
          (input.terminalClosurePoint.y - input.start.y) * dy) /
        lengthSq;
      if (ratio > 1e-6 && ratio < 1 - 1e-6) {
        samples.push(ratio);
        samples.sort((left, right) => left - right);
      }
    }
  }

  return samples
    .filter((value, index, collection) => index === 0 || Math.abs(value - collection[index - 1]!) > 1e-6)
    .map((t) => {
    const x = input.start.x + (input.end.x - input.start.x) * t;
    const y = input.start.y + (input.end.y - input.start.y) * t;
    if (
      input.terminalClosurePoint &&
      Math.abs(input.terminalClosurePoint.x - x) <= 1e-6 &&
      Math.abs(input.terminalClosurePoint.y - y) <= 1e-6
    ) {
      return input.terminalClosurePoint;
    }
    const featureZ = input.roofFeatures.reduce((selected, feature) => {
      const z = roofFeatureHeightAtXY(feature.line, x, y);
      return z == null ? selected : Math.max(selected, z);
    }, Number.NEGATIVE_INFINITY);
    return point(
      x,
      y,
      Math.max(
        input.fallbackTopZ,
        Number.isFinite(featureZ) ? featureZ : Number.NEGATIVE_INFINITY,
        roofHeightAtXY({
          x,
          y,
          roofPlanes: input.roofPlanes,
          fallbackZ: input.fallbackTopZ,
        }),
      ),
    );
    });
}

export function wallBoundaryHasFlatTop(boundary: Polygon3): boolean {
  if (boundary.length !== 4) return false;
  return Math.abs(boundary[2]!.z - boundary[3]!.z) <= 1e-6;
}

export function buildWallSegments(
  footprint: Polygon3,
  wallHeightMm: number,
  roof?: HouseRoofBuildResult | null,
): HouseWallSegment3D[] {
  const segments: HouseWallSegment3D[] = [];
  const terminalClosureBySourceEdgeId = new Map(
    (roof?.terminalClosures ?? []).map((closure) => [closure.sourceEdgeId, closure]),
  );

  for (let index = 0; index < footprint.length; index += 1) {
    const sourceStart = footprint[index]!;
    const sourceEnd = footprint[(index + 1) % footprint.length]!;
    const groundStart = point(sourceStart.x, sourceStart.y, 0);
    const groundEnd = point(sourceEnd.x, sourceEnd.y, 0);
    const edgeLine = line(groundStart, groundEnd);
    if (lineLength(edgeLine) <= 0) continue;

    const edgeId = `footprint-edge-${index + 1}`;
    const xAxis = normalizeVector(subtractPoints(groundEnd, groundStart));
    const plane = planeFromOriginAxes(groundStart, xAxis, WORLD_Z);
    const roofForm = typeof roof?.metadata.roofForm === 'string' ? roof.metadata.roofForm : null;
    const usesRoofAlignedTop =
      (roofForm === 'mono' || roofForm === 'gable') && Boolean(roof?.roofPlanes.length);
    const terminalClosure = terminalClosureBySourceEdgeId.get(edgeId) ?? null;
    const topProfile =
      usesRoofAlignedTop
        ? buildWallTopProfile({
            start: groundStart,
            end: groundEnd,
            roofPlanes: roof?.roofPlanes ?? [],
            roofFeatures: roof?.roofFeatures ?? [],
            fallbackTopZ: wallHeightMm,
            terminalClosurePoint: terminalClosure?.point ?? null,
          })
        : [
            point(groundStart.x, groundStart.y, wallHeightMm),
            point(groundEnd.x, groundEnd.y, wallHeightMm),
          ];
    segments.push({
      id: `house-wall-${segments.length + 1}`,
      sourceEdgeId: edgeId,
      line: edgeLine,
      plane,
      boundary: [groundStart, groundEnd, ...topProfile.slice().reverse()],
      metadata:
        terminalClosure
          ? {
              houseWallClosureKind: 'terminal_gable',
              sourceRoofClosureEdgeId: terminalClosure.sourceEdgeId,
            }
          : undefined,
    });
  }

  return segments;
}
