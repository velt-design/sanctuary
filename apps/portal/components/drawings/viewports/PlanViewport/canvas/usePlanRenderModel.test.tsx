import { describe, expect, it } from 'vitest';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import {
  usePlanRenderModel,
  type PlanRenderModel,
  type UsePlanRenderModelInput,
} from './usePlanRenderModel';

/*
 * PR-WB-CANVAS step ⑤ (2026-06-22): renderer-agnostic render-model coverage.
 *
 * The old PlanViewport.test asserted these behaviours by rendering the SVG
 * path to markup and string-matching per-shape DOM (data-plan-hit-shape-id,
 * data-plan-selection-shape-id, the diagnostic counts, …). The canvas renderer
 * has no per-shape DOM, so we assert on the render MODEL that BOTH renderers
 * consume instead — the contract that actually matters. Lower-level pieces
 * (layer classification, selection routing, hit-target filtering, dimensions)
 * already have their own pure tests; this file covers the hook's wiring:
 * counts, hit-targets, fallbacks, selection/hover halos, visibility, dedup.
 */

const ALL_VISIBLE: DrawingWorkbenchVisibilityState = {
  house: true,
  pergolas: true,
  decks: true,
  openings: true,
};

function makeShape(
  overrides: Partial<GeometryTopProjectionShape>,
): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface_solid',
    family: 'house',
    kind: 'footprint',
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    ...overrides,
  };
}

function makeProjection(
  shapes: GeometryTopProjectionShape[],
): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: { minX: 0, minY: 0, maxX: 5000, maxY: 3000, widthMm: 5000, heightMm: 3000 },
    shapes,
  };
}

/** Invoke the hook in a throwaway render and capture its result. */
function captureModel(input: UsePlanRenderModelInput): PlanRenderModel | null {
  let captured: PlanRenderModel | null = null;
  function Probe() {
    captured = usePlanRenderModel(input);
    return null;
  }
  const rendered = renderIntoDocument(<Probe />);
  rendered.unmount();
  return captured;
}

const ids = (items: ReadonlyArray<{ shape: GeometryTopProjectionShape }>) =>
  items.map((item) => item.shape.id);

function deckPergolaContextShapes(): GeometryTopProjectionShape[] {
  return [
    makeShape({ id: 'deck-1', sourceObjectId: 'deck-1', family: 'house', kind: 'deck', metadata: { deckId: 'deck-1' } }),
    makeShape({ id: 'rendered-pergola-1', sourceObjectId: 'rendered-pergola-1', sourceType: 'roof_plane', family: 'pergola', kind: 'roof_plane', metadata: { pergolaId: 'pergola-A' } }),
    makeShape({ id: 'house-wall-1', sourceObjectId: 'house-wall-1', sourceType: 'house_line', family: 'house', kind: 'wall_segment', metadata: { topProjectionRole: 'context' } }),
  ];
}

describe('usePlanRenderModel', () => {
  it('returns null when there is no projection', () => {
    expect(captureModel({ projection: null, visibility: ALL_VISIBLE, activeObjectRef: null })).toBeNull();
  });

  it('splits shapes across committed bodies, context lines, and hit-targets', () => {
    const model = captureModel({
      projection: makeProjection(deckPergolaContextShapes()),
      visibility: ALL_VISIBLE,
      activeObjectRef: null,
    })!;
    expect(ids(model.committedBodies)).toEqual(expect.arrayContaining(['deck-1', 'rendered-pergola-1']));
    expect(ids(model.contextLines)).toContain('house-wall-1');
    // Deck + pergola are both selectable hit-targets; the context wall is not.
    expect(ids(model.hitTargetItems)).toEqual(expect.arrayContaining(['deck-1', 'rendered-pergola-1']));
    expect(ids(model.hitTargetItems)).not.toContain('house-wall-1');
  });

  it('reports a canonical house reference as an outline-only diagnostic fallback', () => {
    const model = captureModel({
      projection: makeProjection([
        makeShape({
          id: 'house_reference:house-form-fallback',
          sourceObjectId: 'house-form-fallback',
          sourceId: 'house-form-fallback',
          sourceType: 'house_reference',
          family: 'house',
          kind: 'footprint',
          metadata: { houseFormId: 'house-form-fallback', isCanonicalOutline: true },
        }),
      ]),
      visibility: ALL_VISIBLE,
      activeObjectRef: null,
    })!;
    expect(ids(model.diagnosticFallbackItems)).toContain('house_reference:house-form-fallback');
    expect(model.diagnostics.visibleReferenceFallbackIds).toContain('house_reference:house-form-fallback');
  });

  it('populates the selection halo for the active deck only', () => {
    const model = captureModel({
      projection: makeProjection(deckPergolaContextShapes()),
      visibility: ALL_VISIBLE,
      activeObjectRef: { family: 'decks', objectId: 'deck-1' },
    })!;
    expect(ids(model.selectionHaloItems)).toEqual(['deck-1']);
  });

  it('populates the hover halo for an external hovered ref', () => {
    const model = captureModel({
      projection: makeProjection([makeShape({ id: 'deck-9', sourceObjectId: 'deck-9', family: 'house', kind: 'deck', metadata: { deckId: 'deck-9' } })]),
      visibility: ALL_VISIBLE,
      activeObjectRef: null,
      hoveredObjectRef: { family: 'decks', objectId: 'deck-9' },
    })!;
    expect(ids(model.hoverHaloItems)).toContain('deck-9');
  });

  it('suppresses the hover halo when the hovered ref equals the active selection', () => {
    const model = captureModel({
      projection: makeProjection([makeShape({ id: 'deck-9', sourceObjectId: 'deck-9', family: 'house', kind: 'deck', metadata: { deckId: 'deck-9' } })]),
      visibility: ALL_VISIBLE,
      activeObjectRef: { family: 'decks', objectId: 'deck-9' },
      hoveredObjectRef: { family: 'decks', objectId: 'deck-9' },
    })!;
    expect(ids(model.selectionHaloItems)).toContain('deck-9');
    expect(ids(model.hoverHaloItems)).not.toContain('deck-9');
  });

  it('hides pergola shapes from hit-targets when pergola visibility is off', () => {
    const model = captureModel({
      projection: makeProjection(deckPergolaContextShapes()),
      visibility: { house: true, pergolas: false, decks: true, openings: true },
      activeObjectRef: null,
    })!;
    expect(ids(model.hitTargetItems)).not.toContain('rendered-pergola-1');
    expect(ids(model.hitTargetItems)).toContain('deck-1');
  });

  it('dedupes a project house reference against the same reference in the projection', () => {
    const houseRef = makeShape({
      id: 'house_reference:house-main',
      sourceObjectId: 'house-main',
      sourceId: 'house-main',
      sourceType: 'house_reference',
      family: 'house',
      kind: 'footprint',
      metadata: { houseFormId: 'house-main', isCanonicalOutline: true },
    });
    const model = captureModel({
      projection: makeProjection([houseRef]),
      visibility: ALL_VISIBLE,
      activeObjectRef: null,
      houseReferenceShapes: [houseRef],
    })!;
    const hits = ids(model.hitTargetItems).filter((id) => id === 'house_reference:house-main');
    expect(hits).toHaveLength(1);
  });
});
