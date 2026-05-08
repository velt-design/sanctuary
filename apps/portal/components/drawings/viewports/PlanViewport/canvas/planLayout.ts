import type { GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';

const PLAN_SVG_PADDING = 6;
const PLAN_SVG_UNITS_PER_METRE = 100;

/**
 * Maximum extent (in metres) used for layout sizing. Geometry outside this
 * region is still solved and renders correctly relative to its own world
 * coords, but the SVG viewBox is capped at this size so the cursor-to-world
 * conversion (which divides physical pixels by `viewBox/element` ratio)
 * does not compound.
 *
 * What this prevents: SVG `preserveAspectRatio="xMidYMid meet"` shrinks the
 * rendered viewBox to fit the element, so a larger viewBox means every
 * physical pixel of cursor movement covers more world distance. If a shape
 * ever drifted far past the project bounds, each subsequent drag's world
 * delta would be amplified by the larger viewBox -- a compounding scale
 * runaway. The cap bounds the cursor-to-world ratio at all times.
 *
 * Status: defense-in-depth, NOT load-bearing for the deck-drift bug we
 * paid for in production. That bug's root cause was a `pointerCancel`
 * event being treated as `pointerUp` at the React event boundary (footgun
 * #5). With that fix in place, shapes don't drift in normal use. But: any
 * future bug that lets `extents` grow unbounded would re-create the scale
 * runaway here; the cap keeps that class of failure mode bounded.
 *
 * 50m comfortably encloses any realistic project (pergola + house + decks)
 * while preventing the feedback loop. Shapes that drift further than this
 * still render at their correct world coords; the user pans (via
 * `viewportTransform`) to see them and can undo the bad move via Ctrl-Z.
 *
 * Removing this cap is safe ONLY if you're confident no commit path can
 * grow the extents unbounded. Since extents are derived from solved
 * geometry, that's a global invariant -- prefer to keep the cap.
 *
 * See `docs/maintainability-principles.md` -- coordinate-system footguns.
 */
const PLAN_LAYOUT_MAX_DIMENSION_M = 50;

const FALLBACK_EXTENTS = {
  minX: 0,
  minY: 0,
  maxX: 1000,
  maxY: 1000,
  widthMm: 1000,
  heightMm: 1000,
} as const;

export type PlanLayout = {
  baseX: number;
  baseY: number;
  scale: number;
  viewBox: string;
  width: number;
  height: number;
  worldBoxValue: string;
};

export function resolvePlanLayout(projection: GeometryTopProjectionViewModel): PlanLayout {
  const extents = projection.extents ?? FALLBACK_EXTENTS;
  // Clamp the layout dimensions to prevent runaway viewBox growth. See the
  // doc on `PLAN_LAYOUT_MAX_DIMENSION_M` -- without this clamp, every
  // shape that drifts outside the project area amplifies the cursor scale
  // and the drift compounds. The clamp keeps the cursor-to-world ratio
  // stable; off-bounds shapes are still rendered (their svg coords are
  // computed normally) but fall outside the viewBox.
  const safeWidthM = Math.min(
    PLAN_LAYOUT_MAX_DIMENSION_M,
    Math.max(0.1, extents.widthMm / 1000),
  );
  const safeHeightM = Math.min(
    PLAN_LAYOUT_MAX_DIMENSION_M,
    Math.max(0.1, extents.heightMm / 1000),
  );
  const scale = PLAN_SVG_UNITS_PER_METRE;
  const width = safeWidthM * scale + PLAN_SVG_PADDING * 2;
  const height = safeHeightM * scale + PLAN_SVG_PADDING * 2;

  return {
    baseX: PLAN_SVG_PADDING - (extents.minX / 1000) * scale,
    baseY: PLAN_SVG_PADDING - (extents.minY / 1000) * scale,
    scale,
    viewBox: `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`,
    width,
    height,
    worldBoxValue: `${extents.minX} ${extents.minY} ${extents.widthMm} ${extents.heightMm}`,
  };
}

export type PlanBoundsMm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type PlanSvgRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function planBoundsToSvgRect(input: {
  bounds: PlanBoundsMm;
  adapter: PlanCoordinateAdapter;
}): PlanSvgRect {
  const { bounds, adapter } = input;
  const corners: Point2[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  const projected = corners.map((corner) => adapter.projectionToSvg(corner));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
  };
}

export function planBoundsFromPolygon(points: Point2[]): PlanBoundsMm | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return { minX, minY, maxX, maxY };
}
