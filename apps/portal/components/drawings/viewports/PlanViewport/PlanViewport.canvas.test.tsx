import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import { dispatchPointer, renderIntoDocument } from '../../../../../../test/reactHarness';
import PlanViewport from './PlanViewport';

/*
 * PR-WB-CANVAS step ⑤ (2026-06-22): component-level wiring for the canvas
 * renderer. The per-shape render-model behaviour now lives in
 * usePlanRenderModel.test + the pure selection/hover/dimension tests; this
 * file covers only what PlanViewport itself assembles: the no-artifact
 * placeholder, mounting the canvas branch (?planRenderer=canvas), and the
 * canvas → tool-dispatcher → callback wiring (clear-on-empty-click).
 *
 * The select-on-shape path needs pixel-accurate coordinate mapping which jsdom
 * (no real layout, no canvas context) can't model reliably; it's covered by
 * SelectTool.test (the tool) + the live Playwright verification recorded in the
 * step ② commit. Clear-on-empty needs no precision — any point outside every
 * hit-target polygon exercises the full canvas→dispatch→callback chain.
 */

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

function makeShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
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

function makeProjection(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: { minX: 0, minY: 0, maxX: 5000, maxY: 3000, widthMm: 5000, heightMm: 3000 },
    shapes,
  };
}

function deckArtifact(): WorkbenchSolvedGeometryArtifact {
  return {
    topProjection: makeProjection([
      makeShape({ id: 'deck-7', sourceObjectId: 'deck-7', family: 'house', kind: 'deck', metadata: { deckId: 'deck-7' } }),
    ]),
  } as unknown as WorkbenchSolvedGeometryArtifact;
}

describe('PlanViewport (canvas renderer)', () => {
  it('renders the no-artifact placeholder regardless of renderer', () => {
    const markup = renderToStaticMarkup(
      <PlanViewport artifact={null} viewportTransform={IDENTITY_TRANSFORM} onViewportTransformChange={() => undefined} />,
    );
    expect(markup).toContain('data-plan-render-status="no_artifact"');
    expect(markup).toContain('Plan view unavailable');
  });

  describe('with ?planRenderer=canvas', () => {
    let originalSearch = '';
    beforeEach(() => {
      originalSearch = window.location.search;
      window.history.replaceState({}, '', '?planRenderer=canvas');
    });
    afterEach(() => {
      window.history.replaceState({}, '', originalSearch || '/');
    });

    it('mounts the canvas renderer (not the SVG root) with model-derived counts', () => {
      const rendered = renderIntoDocument(
        <PlanViewport artifact={deckArtifact()} viewportTransform={IDENTITY_TRANSFORM} onViewportTransformChange={() => undefined} />,
      );
      const canvas = rendered.container.querySelector('canvas[data-plan-viewport="true"]');
      expect(canvas).not.toBeNull();
      expect(rendered.container.querySelector('svg[data-plan-viewport="true"]')).toBeNull();
      expect(canvas!.getAttribute('data-plan-render-source')).toBe('geometry-canvas');
      expect(Number(canvas!.getAttribute('data-plan-hit-target-count'))).toBeGreaterThan(0);
      rendered.unmount();
    });

    it('clears the workbench selection on an empty-canvas left-click', () => {
      const onClearWorkbenchSelection = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
        />,
      );
      const canvas = rendered.container.querySelector('canvas[data-plan-viewport="true"]');
      expect(canvas).not.toBeNull();
      // Far corner of the 1500×900 mocked viewport → maps far from deck-7
      // (world 0..1000) → no hit-target → SelectTool clears.
      dispatchPointer(canvas!, 'pointerdown', { button: 0, clientX: 1490, clientY: 890 });
      expect(onClearWorkbenchSelection).toHaveBeenCalledTimes(1);
      rendered.unmount();
    });
  });
});
