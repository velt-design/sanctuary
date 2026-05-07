import type { HouseModel3D } from '@sp/geometry';
import type { SnapLineTarget } from './snapEngine';

/**
 * Project a `HouseModel3D` into the plan-space line snap targets the snap
 * engine consumes. Step 7b of the first-class spatial-entities migration:
 * roof eaves and wall segments become first-class snap candidates that the
 * `EdgeDragTool` can match a dragged pergola/deck edge against.
 *
 * Coordinate system: top-projection plan space is world XY mm (z dropped).
 * House model 3D coords are already in world space, so projection is just
 * `{ x, y }` — no transform needed.
 *
 * Output shape:
 * - Wall segments → `edgeKind: 'wall'`, id `wall-${segment.id}`
 * - Drain eaves → `edgeKind: 'roof_eave'`, id reused from `eave.id`
 *
 * Other perimeter-edge kinds (`weather_flashed_edge`, `house_apron_edge`)
 * are not pergola attachment targets in v1 and are filtered out at the
 * `HouseModel3D.roofEaves` build step. See `houseModel.ts`.
 */
export function buildHouseSnapTargets(input: {
  houseModel: HouseModel3D | null | undefined;
  /** Stable id for the source house form / assembly. */
  houseObjectId: string;
}): SnapLineTarget[] {
  const model = input.houseModel;
  if (!model) return [];

  const targets: SnapLineTarget[] = [];

  for (const wall of model.wallSegments) {
    targets.push({
      id: `wall-${wall.id}`,
      sourceObjectId: input.houseObjectId,
      edgeKind: 'wall',
      start: { x: wall.line.start.x, y: wall.line.start.y },
      end: { x: wall.line.end.x, y: wall.line.end.y },
    });
  }

  for (const eave of model.roofEaves ?? []) {
    targets.push({
      id: eave.id,
      sourceObjectId: input.houseObjectId,
      edgeKind: 'roof_eave',
      start: { x: eave.eaveLine.start.x, y: eave.eaveLine.start.y },
      end: { x: eave.eaveLine.end.x, y: eave.eaveLine.end.y },
    });
  }

  return targets;
}
