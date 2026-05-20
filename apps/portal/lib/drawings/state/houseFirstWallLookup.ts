import type {
  CalculatorHouseFootprintPolygonPoint,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type { HouseModel } from './houseFirstWorkbenchModel';
import { resolveDeckHostEdgeFrame } from './objectWorkbenchDeckGeometry';

/**
 * Derived wall lookup — converts the house footprint polygon into the
 * canonical "wall" graph the rest of the house-first pipeline consumes.
 * Each footprint edge becomes one wall with:
 *  - a stable `wall-${sourceEdgeId}` id (so the opening adapter can
 *    address walls without depending on iteration order)
 *  - a side classification (`front`/`right`/`rear`/`left`) derived from
 *    the host edge frame, used by openings + attachment zones to gate
 *    rules per side
 *  - a span length (`spanM`) the opening adapter uses to validate
 *    `widthM + offsetAlongWallM <= span`
 *
 * Lives in its own module so both `houseFirstOpeningAdapter` (the
 * consumer) and `houseFirstWorkbenchAdapter` (the producer in
 * `buildSharedHouse` + `buildDerivedEnvelopeLookup`) can depend on
 * this lookup without forming an import cycle.
 */

export type DerivedWallResolution = {
  wall: HouseModel['derivedWallGraph']['walls'][number];
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceEdgeId: string;
  spanM: number;
};

export type DerivedWallLookup = {
  graph: HouseModel['derivedWallGraph'];
  byWallId: Map<string, DerivedWallResolution>;
  byEdgeId: Map<string, DerivedWallResolution>;
  bySide: Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, DerivedWallResolution[]>;
};

export function formatDerivedWallLabel(
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>,
  index: number,
): string {
  const prefix = `${side.charAt(0).toUpperCase()}${side.slice(1)} wall`;
  return index === 1 ? prefix : `${prefix} ${index}`;
}

export function buildDerivedWallLookup(input: {
  houseId: string;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
}): DerivedWallLookup {
  const walls: HouseModel['derivedWallGraph']['walls'] = [];
  const byWallId = new Map<string, DerivedWallResolution>();
  const byEdgeId = new Map<string, DerivedWallResolution>();
  const bySide = new Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, DerivedWallResolution[]>();
  const sideCounts = new Map<NonNullable<CalculatorModuleInputs['attachmentSide']>, number>();

  for (let index = 0; index < input.housePolygon.length; index += 1) {
    const startPoint = input.housePolygon[index];
    const endPoint = input.housePolygon[(index + 1) % input.housePolygon.length];
    if (!startPoint || !endPoint) continue;

    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const frame = resolveDeckHostEdgeFrame({
      housePolygon: input.housePolygon,
      hostEdgeId: sourceEdgeId,
    });
    if (!frame?.sourceEdgeId) continue;

    const nextCount = (sideCounts.get(frame.hostEdge) ?? 0) + 1;
    sideCounts.set(frame.hostEdge, nextCount);

    const wall = {
      id: `wall-${frame.sourceEdgeId}`,
      label: formatDerivedWallLabel(frame.hostEdge, nextCount),
      sourceFormIds: [input.houseId],
      edgeIds: [frame.sourceEdgeId],
      kind: 'exterior' as const,
      polygon: [
        { alongM: String(startPoint.alongM), depthM: String(startPoint.depthM) },
        { alongM: String(endPoint.alongM), depthM: String(endPoint.depthM) },
      ],
    };
    const resolved = {
      wall,
      side: frame.hostEdge,
      sourceEdgeId: frame.sourceEdgeId,
      spanM: Math.max(0, frame.end - frame.start),
    } satisfies DerivedWallResolution;

    walls.push(wall);
    byWallId.set(wall.id, resolved);
    byEdgeId.set(frame.sourceEdgeId, resolved);
    const sideWalls = bySide.get(frame.hostEdge) ?? [];
    sideWalls.push(resolved);
    bySide.set(frame.hostEdge, sideWalls);
  }

  return {
    graph: {
      walls,
      mergeGroups: [],
    },
    byWallId,
    byEdgeId,
    bySide,
  };
}
