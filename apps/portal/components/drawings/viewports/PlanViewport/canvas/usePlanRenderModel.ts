'use client';

import { useMemo, useRef } from 'react';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildTopProjectionPlanCoordinateAdapter,
  type PlanCoordinateAdapter,
  type PlanSvgPoint,
} from '@/lib/drawings/views/plan/planCoordinateAdapter';
import {
  buildProjectionPlanRenderGraph,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import type { PlanRenderDiagnostics } from '@/lib/drawings/views/plan/planRenderDiagnostics';
import { resolvePlanLayout, type PlanLayout } from './planLayout';
import { pickPrimaryEditCandidate, type ActiveObjectFamily } from './planDimension';
import type { PlanRenderItem } from './planRenderItem';
import { activeObjectMatchesPlanShape } from './selectionMatch';

type RawPlanItem = {
  shape: GeometryTopProjectionShape;
  points: PlanSvgPoint[];
};

export type PlanRenderModel = {
  layout: PlanLayout;
  adapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  hitTargetItems: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  /**
   * Cross-viewport hover halo. Populated when an external surface (e.g. 3D
   * viewport) reports a hovered object that maps to a shape in this plan
   * projection. Empty for "no external hover" or when the hovered object is
   * the active selection (the selection halo already highlights it; rendering
   * both would double-paint). See `docs/design-workbench-architecture.md`
   * milestone 16 for the hover-sync contract.
   */
  hoverHaloItems: PlanRenderItem[];
  diagnostics: PlanRenderDiagnostics;
};

export type UsePlanRenderModelInput = {
  projection: GeometryTopProjectionViewModel | null;
  visibility: DrawingWorkbenchVisibilityState;
  activeObjectRef: WorkbenchObjectRef | null | undefined;
  /** External hover state (e.g. driven by 3D viewport pointer-over). */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  /**
   * Project-level house references that should flow into the active
   * module's render graph alongside the per-module projection.
   * Used to add every house form `house_reference` footprint to the
   * explicit hit-target layer so they're selectable and movable.
   * Without this, house references would not enter the render graph's explicit
   * hit-target layer; clicks would fall through and the move tool could never
   * start.
   *
   * Caller derives these from `WorkbenchSolvedModel.projectReferenceShapes`
   * filtered to canonical house references.
   */
  houseReferenceShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Project-wide full pergola plan bodies, already prefixed per pergola id. */
  projectPergolaPlanShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Context/reference shapes that should influence layout even when drawn by a separate layer. */
  projectContextShapes?: ReadonlyArray<GeometryTopProjectionShape>;
};

const EMPTY_HOUSE_REFERENCE_SHAPES: ReadonlyArray<GeometryTopProjectionShape> = [];
const EMPTY_PROJECT_PERGOLA_PLAN_SHAPES: ReadonlyArray<GeometryTopProjectionShape> = [];
const EMPTY_PROJECT_CONTEXT_SHAPES: ReadonlyArray<GeometryTopProjectionShape> = [];
// Stable empty array so the halo memos return a referentially-stable value
// when there's no selection/hover (memoized layers then skip re-rendering).
const EMPTY_RENDER_ITEMS: PlanRenderItem[] = [];

function projectionShapeIdentity(shape: GeometryTopProjectionShape): string {
  return shape.sourceObjectId
    ? `${shape.sourceType}:${shape.sourceObjectId}`
    : shape.id;
}

function mergeProjectionShapesWithHouseReferences(input: {
  projectionShapes: ReadonlyArray<GeometryTopProjectionShape>;
  houseReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionShape[] {
  if (!input.houseReferenceShapes.length) {
    return input.projectionShapes as GeometryTopProjectionShape[];
  }
  const houseReferenceKeys = new Set(
    input.houseReferenceShapes.map(projectionShapeIdentity),
  );
  const shapes = input.projectionShapes.filter((shape) => {
    if (shape.sourceType !== 'house_reference') return true;
    return !houseReferenceKeys.has(projectionShapeIdentity(shape));
  });
  const seen = new Set(shapes.map(projectionShapeIdentity));
  for (const shape of input.houseReferenceShapes) {
    const key = projectionShapeIdentity(shape);
    if (seen.has(key)) continue;
    seen.add(key);
    shapes.push(shape);
  }
  return shapes;
}

function pergolaShapeIdentity(shape: GeometryTopProjectionShape): string | null {
  const taggedPergolaId =
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null;
  return taggedPergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? null;
}

function mergeProjectionShapesWithProjectPergolas(input: {
  projectionShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionShape[] {
  if (!input.projectPergolaPlanShapes.length) {
    return input.projectionShapes as GeometryTopProjectionShape[];
  }
  const projectPergolaIds = new Set(
    input.projectPergolaPlanShapes
      .map(pergolaShapeIdentity)
      .filter((value): value is string => Boolean(value)),
  );
  const shapes = input.projectionShapes.filter((shape) => {
    if (shape.family !== 'pergola') return true;
    const pergolaId = pergolaShapeIdentity(shape);
    return !pergolaId || !projectPergolaIds.has(pergolaId);
  });
  const seen = new Set(shapes.map((shape) => shape.id));
  for (const shape of input.projectPergolaPlanShapes) {
    if (seen.has(shape.id)) continue;
    seen.add(shape.id);
    shapes.push(shape);
  }
  return shapes;
}

function mergeProjectionShapesWithProjectContext(input: {
  projectionShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectContextShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionShape[] {
  if (!input.projectContextShapes.length) {
    return input.projectionShapes as GeometryTopProjectionShape[];
  }
  const shapes = [...input.projectionShapes];
  const seen = new Set(shapes.map((shape) => shape.id));
  for (const shape of input.projectContextShapes) {
    if (shape.sourceType !== 'pergola_reference') continue;
    if (seen.has(shape.id)) continue;
    seen.add(shape.id);
    shapes.push(shape);
  }
  return shapes;
}

function projectionWithExtentsFromShapes(input: {
  projection: GeometryTopProjectionViewModel;
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionViewModel {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const shape of input.shapes) {
    for (const point of shape.polygon) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return input.projection;
  }
  return {
    ...input.projection,
    extents: {
      minX,
      minY,
      maxX,
      maxY,
      widthMm: Math.max(0, maxX - minX),
      heightMm: Math.max(0, maxY - minY),
    },
  };
}

export function usePlanRenderModel({
  projection,
  visibility,
  activeObjectRef,
  hoveredObjectRef,
  houseReferenceShapes = EMPTY_HOUSE_REFERENCE_SHAPES,
  projectPergolaPlanShapes = EMPTY_PROJECT_PERGOLA_PLAN_SHAPES,
  projectContextShapes = EMPTY_PROJECT_CONTEXT_SHAPES,
}: UsePlanRenderModelInput): PlanRenderModel | null {
  // PR-WB-LAYOUT-FREEZE (2026-06-19): cache the layout's projection
  // (with extents baked in) across renders. The first non-trivial
  // projection establishes the world-to-SVG mapping; subsequent
  // renders reuse it even when shapes move or resize, so the
  // viewport doesn't visibly jump on every edit. The cache lives
  // for the lifetime of the mount — navigating to a different
  // estimate (which unmounts/remounts PlanViewport) naturally
  // refreshes the layout from the new project's shapes.
  const cachedLayoutProjectionRef = useRef<GeometryTopProjectionViewModel | null>(null);

  // PR-WB-PERF-2 (2026-06-22): the HEAVY projection memo — re-projects every
  // polygon + rebuilds the render graph. Its deps are geometry/visibility
  // ONLY. Selection + hover (high-frequency, cursor-driven) are split into
  // cheap filter memos below so hovering no longer rebuilds this.
  const base = useMemo(() => {
    if (!projection) return null;
    const allShapes = mergeProjectionShapesWithProjectContext({
      projectionShapes: mergeProjectionShapesWithProjectPergolas({
        projectionShapes: mergeProjectionShapesWithHouseReferences({
          projectionShapes: projection.shapes,
          houseReferenceShapes,
        }),
        projectPergolaPlanShapes,
      }),
      projectContextShapes,
    });
    let layoutProjection: GeometryTopProjectionViewModel;
    if (cachedLayoutProjectionRef.current) {
      // Reuse the frozen layout projection from this mount's first
      // non-trivial projection — adapter stays stable, viewport
      // doesn't jump on edits.
      layoutProjection = cachedLayoutProjectionRef.current;
    } else {
      const freshLayoutProjection = projectionWithExtentsFromShapes({
        projection,
        shapes: allShapes,
      });
      const freshExtents = freshLayoutProjection.extents;
      const hasNonTrivialExtents = !!(
        freshExtents &&
        Number.isFinite(freshExtents.widthMm) &&
        freshExtents.widthMm > 0 &&
        Number.isFinite(freshExtents.heightMm) &&
        freshExtents.heightMm > 0
      );
      if (hasNonTrivialExtents) {
        cachedLayoutProjectionRef.current = freshLayoutProjection;
      }
      layoutProjection = freshLayoutProjection;
    }
    const layout = resolvePlanLayout(layoutProjection);
    const adapter = buildTopProjectionPlanCoordinateAdapter({
      projection: layoutProjection,
      baseX: layout.baseX,
      baseY: layout.baseY,
      scale: layout.scale,
    });
    const visibleItems: RawPlanItem[] = allShapes
      .filter((shape) => topProjectionShapeVisible(shape, visibility))
      .map((shape) => ({
        shape,
        points: adapter.projectionPolygonToSvg(shape.polygon),
      }));
    const renderGraph = buildProjectionPlanRenderGraph(visibleItems);
    const committedBodies = renderGraph.committedBodies as PlanRenderItem[];
    const diagnosticFallbackItems = renderGraph.diagnosticFallbacks as PlanRenderItem[];
    const contextLines = renderGraph.contextLines as PlanRenderItem[];
    const detailLines = renderGraph.detailLines as PlanRenderItem[];
    const hitTargetItems = renderGraph.hitTargets as PlanRenderItem[];
    return {
      layout,
      adapter,
      committedBodies,
      diagnosticFallbackItems,
      contextLines,
      detailLines,
      hitTargetItems,
      diagnostics: renderGraph.diagnostics,
    };
  }, [
    houseReferenceShapes,
    projectContextShapes,
    projectPergolaPlanShapes,
    projection,
    visibility,
  ]);

  // Selection halo: a cheap filter over the (stable) hit-target items.
  // Recomputes only when the active selection changes — NOT on every
  // hover or geometry-stable re-render.
  const selectionHaloItems = useMemo<PlanRenderItem[]>(() => {
    if (!base) return EMPTY_RENDER_ITEMS;
    const matchedItems = base.hitTargetItems.filter(({ shape }) =>
      activeObjectMatchesPlanShape(activeObjectRef, shape),
    );
    const activeFamily = (activeObjectRef?.family ?? null) as ActiveObjectFamily | null;
    const primary = activeFamily
      ? pickPrimaryEditCandidate(
          matchedItems.map((item) => ({
            ...item,
            polygon: item.shape.polygon,
            kind: item.shape.kind,
            isCanonicalOutline: item.shape.metadata?.isCanonicalOutline === true,
          })),
          activeFamily,
        )
      : null;
    return primary
      ? [{ shape: primary.shape, points: primary.points, layer: primary.layer }]
      : matchedItems;
  }, [base, activeObjectRef]);

  // Hover halo: same cheap filter, driven by the external hover ref. Skip
  // when the hovered object IS the active selection (the selection halo
  // already covers it; double-painting just muddies the visual). Splitting
  // this out is the core Tier-2 win: hovering no longer re-projects geometry.
  const hoverHaloItems = useMemo<PlanRenderItem[]>(() => {
    if (!base) return EMPTY_RENDER_ITEMS;
    const hoverIsActive =
      hoveredObjectRef &&
      activeObjectRef &&
      hoveredObjectRef.family === activeObjectRef.family &&
      hoveredObjectRef.objectId === activeObjectRef.objectId;
    return hoveredObjectRef && !hoverIsActive
      ? base.hitTargetItems.filter(({ shape }) =>
          activeObjectMatchesPlanShape(hoveredObjectRef, shape),
        )
      : EMPTY_RENDER_ITEMS;
  }, [base, hoveredObjectRef, activeObjectRef]);

  return useMemo(
    () => (base ? { ...base, selectionHaloItems, hoverHaloItems } : null),
    [base, selectionHaloItems, hoverHaloItems],
  );
}
