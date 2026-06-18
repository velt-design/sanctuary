import type { Point3, Polygon3 } from "../../contracts";
import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type HouseComposition,
} from "./types";

/**
 * PR-COMP1 (2026-06-18): compute the union polygon (CCW,
 * orthogonal, mm) of a `HouseComposition`'s primitives.
 *
 * Algorithm:
 *   1. Collect all unique x and y coordinates from the rectangle
 *      corners → a grid of axis-aligned cells.
 *   2. For each cell, mark it "inside" iff any rectangle covers
 *      the cell's center.
 *   3. Emit boundary edges where an inside cell borders an outside
 *      cell (or the grid boundary). Trace those edges into a
 *      closed CCW loop.
 *   4. Collinear-cleanup the loop (merges colinear segments into
 *      single edges).
 *
 * Throws on:
 *   - empty composition (caller should have validated first)
 *   - non-rectangle primitive (v1 limit)
 *   - disconnected union (the result would be multiple polygons —
 *     a composition this PR doesn't yet support; v1 expects a
 *     single connected union)
 *
 * Callers should run `validateHouseComposition` first; this
 * function trusts its input.
 */
export function composeFootprintFromComposition(
  composition: HouseComposition,
): Polygon3 {
  if (composition.primitives.length === 0) {
    throw new Error("composeFootprintFromComposition: empty composition");
  }
  const rectangles: AxisAlignedRectangle[] = [];
  for (const primitive of composition.primitives) {
    if (!isAxisAlignedRectangle(primitive)) {
      throw new Error(
        `composeFootprintFromComposition: unsupported primitive kind ${primitive.kind}`,
      );
    }
    rectangles.push(primitive);
  }

  const xs = uniqueSorted(
    rectangles.flatMap((rect) => [
      rect.originXMm,
      rect.originXMm + rect.widthMm,
    ]),
  );
  const ys = uniqueSorted(
    rectangles.flatMap((rect) => [
      rect.originYMm,
      rect.originYMm + rect.depthMm,
    ]),
  );

  const xCells = xs.length - 1;
  const yCells = ys.length - 1;
  const included = new Set<number>();
  const cellIndex = (xi: number, yi: number): number => xi * yCells + yi;

  for (let xi = 0; xi < xCells; xi += 1) {
    for (let yi = 0; yi < yCells; yi += 1) {
      const x0 = xs[xi]!;
      const x1 = xs[xi + 1]!;
      const y0 = ys[yi]!;
      const y1 = ys[yi + 1]!;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (anyRectangleContainsPoint(rectangles, cx, cy)) {
        included.add(cellIndex(xi, yi));
      }
    }
  }

  if (included.size === 0) {
    throw new Error("composeFootprintFromComposition: empty union");
  }

  type BoundaryEdge = {
    start: Point3;
    end: Point3;
    startKey: string;
    endKey: string;
    used: boolean;
  };
  const edges: BoundaryEdge[] = [];
  const addEdge = (start: Point3, end: Point3): void => {
    edges.push({
      start,
      end,
      startKey: pointKey(start),
      endKey: pointKey(end),
      used: false,
    });
  };

  for (const key of included) {
    const xi = Math.floor(key / yCells);
    const yi = key % yCells;
    const x0 = xs[xi]!;
    const x1 = xs[xi + 1]!;
    const y0 = ys[yi]!;
    const y1 = ys[yi + 1]!;
    const has = (cxi: number, cyi: number): boolean => {
      if (cxi < 0 || cxi >= xCells || cyi < 0 || cyi >= yCells) return false;
      return included.has(cellIndex(cxi, cyi));
    };
    if (!has(xi, yi - 1)) addEdge(p(x0, y0), p(x1, y0));
    if (!has(xi + 1, yi)) addEdge(p(x1, y0), p(x1, y1));
    if (!has(xi, yi + 1)) addEdge(p(x1, y1), p(x0, y1));
    if (!has(xi - 1, yi)) addEdge(p(x0, y1), p(x0, y0));
  }

  const loops = traceBoundaryLoops(edges);
  if (loops.length !== 1) {
    throw new Error(
      `composeFootprintFromComposition: expected 1 boundary loop, got ${loops.length}`,
    );
  }
  return cleanPolygon(loops[0]!);
}

// --- Local helpers (mirror the orthogonalEaveOffset style; kept
//     local to keep the composition module self-contained). ---

const EPSILON = 1e-6;

function stableCoord(value: number): number {
  const stable = Number(value.toFixed(6));
  return Object.is(stable, -0) ? 0 : stable;
}

function p(x: number, y: number): Point3 {
  return { x: stableCoord(x), y: stableCoord(y), z: 0 };
}

function pointKey(candidate: Pick<Point3, "x" | "y">): string {
  return `${stableCoord(candidate.x)},${stableCoord(candidate.y)}`;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map(stableCoord))].sort((a, b) => a - b);
}

function anyRectangleContainsPoint(
  rectangles: readonly AxisAlignedRectangle[],
  x: number,
  y: number,
): boolean {
  for (const rect of rectangles) {
    const x0 = rect.originXMm;
    const x1 = rect.originXMm + rect.widthMm;
    const y0 = rect.originYMm;
    const y1 = rect.originYMm + rect.depthMm;
    if (x > x0 && x < x1 && y > y0 && y < y1) return true;
  }
  return false;
}

function pointsEqual(a: Point3, b: Point3): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function collinearOrthogonal(a: Point3, b: Point3, c: Point3): boolean {
  return (
    (Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - c.x) <= EPSILON) ||
    (Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - c.y) <= EPSILON)
  );
}

function cleanPolygon(polygon: Polygon3): Polygon3 {
  const deduped: Polygon3 = [];
  for (const candidate of polygon) {
    const stable = p(candidate.x, candidate.y);
    const previous = deduped[deduped.length - 1];
    if (previous && pointsEqual(previous, stable)) continue;
    deduped.push(stable);
  }
  if (
    deduped.length > 1 &&
    pointsEqual(deduped[0]!, deduped[deduped.length - 1]!)
  ) {
    deduped.pop();
  }
  let changed = true;
  while (changed && deduped.length >= 3) {
    changed = false;
    for (let i = 0; i < deduped.length; i += 1) {
      const previous = deduped[(i - 1 + deduped.length) % deduped.length]!;
      const current = deduped[i]!;
      const next = deduped[(i + 1) % deduped.length]!;
      if (!collinearOrthogonal(previous, current, next)) continue;
      deduped.splice(i, 1);
      changed = true;
      break;
    }
  }
  return deduped;
}

type BoundaryEdge = {
  start: Point3;
  end: Point3;
  startKey: string;
  endKey: string;
  used: boolean;
};

function traceBoundaryLoops(edges: BoundaryEdge[]): Polygon3[] {
  const byStart = new Map<string, BoundaryEdge[]>();
  for (const edge of edges) {
    const list = byStart.get(edge.startKey) ?? [];
    list.push(edge);
    byStart.set(edge.startKey, list);
  }
  const loops: Polygon3[] = [];
  for (const seed of edges) {
    if (seed.used) continue;
    const startKey = seed.startKey;
    let current: BoundaryEdge | undefined = seed;
    const loop: Polygon3 = [];
    let guard = 0;
    while (current && !current.used) {
      current.used = true;
      loop.push(current.start);
      if (current.endKey === startKey) {
        loops.push(loop);
        current = undefined;
        break;
      }
      current = (byStart.get(current.endKey) ?? []).find((c) => !c.used);
      guard += 1;
      if (guard > edges.length + 1) {
        throw new Error("composeFootprintFromComposition: boundary trace did not converge");
      }
    }
  }
  return loops;
}
