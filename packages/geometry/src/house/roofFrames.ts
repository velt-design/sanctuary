import type { HouseRoofFeature3D, HouseWallSegment3D } from '../contracts';
import { lineLength } from '../math3d';
import { ROOF_JOIN_FEATURE_MIN_LENGTH_MM } from './constants';
import { line, type HouseGableTerminalEnd } from './_internal';

export function houseWallIsOpenGableFrame(
  wall: Pick<HouseWallSegment3D, 'metadata'>,
): boolean {
  return wall.metadata?.houseWallMode === 'open_gable_frame';
}

export function buildOpenGableFrameFeatures(input: {
  wallSegments: HouseWallSegment3D[];
  openTerminalEnds: HouseGableTerminalEnd[];
  roofGeometry: string | null;
}): HouseRoofFeature3D[] {
  const wallBySourceEdgeId = new Map(
    input.wallSegments.map((segment) => [segment.sourceEdgeId ?? '', segment]),
  );
  const features: HouseRoofFeature3D[] = [];

  for (const terminalEnd of input.openTerminalEnds) {
    const wall = wallBySourceEdgeId.get(terminalEnd.sourceEdgeId);
    if (!wall) continue;
    const topProfile = wall.boundary.slice(2).reverse();
    // A flat-top wall whose boundary was not reshaped has a 2-point top
    // profile; a triangular gable wall (one apex point) has a 1-point top
    // profile. Both deserve frame features (the verticals trace from the
    // eave corners up to either the wall-height corners or the apex).
    // Only skip degenerate cases with no top profile at all.
    if (topProfile.length < 1) continue;

    const startVertical = line(wall.line.start, topProfile[0]!);
    if (lineLength(startVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-a`,
        kind: 'gable_end_frame',
        line: startVertical,
        metadata: {
          roofForm: 'hipped',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }

    for (let index = 0; index < topProfile.length - 1; index += 1) {
      const topSegment = line(topProfile[index]!, topProfile[index + 1]!);
      if (lineLength(topSegment) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) continue;
      features.push({
        id: `${terminalEnd.id}-top-${index + 1}`,
        kind: 'gable_end_frame',
        line: topSegment,
        metadata: {
          roofForm: 'hipped',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_top_chord',
        },
      });
    }

    const endVertical = line(wall.line.end, topProfile[topProfile.length - 1]!);
    if (lineLength(endVertical) > ROOF_JOIN_FEATURE_MIN_LENGTH_MM) {
      features.push({
        id: `${terminalEnd.id}-side-b`,
        kind: 'gable_end_frame',
        line: endVertical,
        metadata: {
          roofForm: 'hipped',
          roofGeometry: input.roofGeometry,
          gableEndId: terminalEnd.id,
          sourceEdgeId: terminalEnd.sourceEdgeId,
          houseFrameRole: 'gable_end_post',
        },
      });
    }
  }

  return features;
}
