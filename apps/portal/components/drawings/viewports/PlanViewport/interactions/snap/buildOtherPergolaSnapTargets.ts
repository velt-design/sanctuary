import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { SnapLineTarget } from './snapEngine';

/**
 * Project the polygon edges of OTHER pergolas (not the active one) into
 * line snap targets the snap engine can match. Step 10 of the first-class
 * spatial-entities migration: pergola-to-pergola attachment formation.
 *
 * Input is the project's context-overlay shapes (already filtered upstream
 * to exclude the active pergola's outline + the house reference). Each
 * pergola_reference shape's polygon becomes one snap target per edge,
 * carrying `edgeKind: 'pergola_outline'` so the downstream attachment
 * helper (`pergolaAttachmentFromSnap`) maps it to
 * `spatialKind: 'pergola_outline'` with `host.objectFamily: 'pergolas'`.
 *
 * Stable edge id format: `pergola-edge-${pergolaSourceId}-${edgeIndex}`.
 * `sourceObjectId` is the pergola's source id (the host pergola), so the
 * resulting attachment's `host.objectId` points at the snapped pergola.
 *
 * Coordinate system: top-projection is world XY mm. Same plane the snap
 * engine queries; no further transform needed.
 */
export function buildOtherPergolaSnapTargets(input: {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
}): SnapLineTarget[] {
  const targets: SnapLineTarget[] = [];

  for (const shape of input.shapes) {
    if (shape.family !== 'pergola') continue;
    if (shape.kind !== 'outline') continue;
    const polygon = shape.polygon;
    if (polygon.length < 3) continue;

    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
      const start = polygon[edgeIndex]!;
      const end = polygon[(edgeIndex + 1) % polygon.length]!;
      targets.push({
        id: `pergola-edge-${shape.sourceObjectId}-${edgeIndex}`,
        sourceObjectId: shape.sourceObjectId,
        edgeKind: 'pergola_outline',
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
      });
    }
  }

  return targets;
}
