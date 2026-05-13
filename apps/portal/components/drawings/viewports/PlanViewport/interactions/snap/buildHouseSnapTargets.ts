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
 * - Roof perimeter eaves → `edgeKind: 'roof_eave'`, id reused from `eave.id`
 *
 * `kinds` selects which subset to emit. Default `'walls_and_eaves'` is the
 * pergola edge-drag case. Decks pass `'walls'` because they sit at ground
 * level — snapping a deck edge to a gutter-height eave is meaningless.
 *
 * `HouseModel3D.roofEaves` now includes every attachable perimeter edge
 * (`drain_eave`, `weather_flashed_edge`, `house_apron_edge`) so pergolas
 * can snap to a Dutch-hip's opened gable end and to L-/U-shape inner
 * apron edges, not just to draining eaves. See `houseModel.ts`.
 */
export function buildHouseSnapTargets(input: {
  houseModel: HouseModel3D | null | undefined;
  /** Stable id for the source house form / assembly. */
  houseObjectId: string;
  kinds?: 'walls' | 'walls_and_eaves';
}): SnapLineTarget[] {
  const model = input.houseModel;
  if (!model) return [];
  const kinds = input.kinds ?? 'walls_and_eaves';

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

  if (kinds === 'walls_and_eaves') {
    for (const eave of model.roofEaves ?? []) {
      targets.push({
        id: eave.id,
        sourceObjectId: input.houseObjectId,
        edgeKind: 'roof_eave',
        start: { x: eave.eaveLine.start.x, y: eave.eaveLine.start.y },
        end: { x: eave.eaveLine.end.x, y: eave.eaveLine.end.y },
      });
    }
  }

  return targets;
}
