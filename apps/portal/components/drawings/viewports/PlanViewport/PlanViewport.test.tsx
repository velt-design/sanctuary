import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import { dispatchPointer, renderIntoDocument } from '../../../../../../test/reactHarness';
import PlanViewport from './PlanViewport';

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

function makeProjection(
  shapes: GeometryTopProjectionShape[],
): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 3000,
      widthMm: 5000,
      heightMm: 3000,
    },
    shapes,
  };
}

function makeArtifact(
  shapes: GeometryTopProjectionShape[],
): WorkbenchSolvedGeometryArtifact {
  return { topProjection: makeProjection(shapes) } as unknown as WorkbenchSolvedGeometryArtifact;
}

describe('PlanViewport', () => {
  describe('placeholder', () => {
    it('renders the no-artifact placeholder when artifact is null', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={null}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(markup).toContain('data-plan-render-status="no_artifact"');
      expect(markup).toContain('Plan view unavailable');
    });
  });

  describe('with a populated artifact', () => {
    function makeArtifactWithDeckPergolaAndContext(): WorkbenchSolvedGeometryArtifact {
      return makeArtifact([
        makeShape({
          id: 'deck-1',
          sourceObjectId: 'deck-1',
          sourceType: 'house_surface_solid',
          family: 'house',
          kind: 'deck',
          metadata: { deckId: 'deck-1' },
        }),
        makeShape({
          id: 'rendered-pergola-1',
          sourceObjectId: 'rendered-pergola-1',
          sourceType: 'roof_plane',
          family: 'pergola',
          kind: 'roof_plane',
          metadata: { pergolaId: 'pergola-A' },
        }),
        makeShape({
          id: 'house-wall-1',
          sourceObjectId: 'house-wall-1',
          sourceType: 'house_line',
          family: 'house',
          kind: 'wall_segment',
          metadata: { topProjectionRole: 'context' },
        }),
      ]);
    }

    it('renders the canvas with diagnostic counts and screen axis', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-render-status="ready"');
      expect(markup).toContain('data-plan-screen-axis="world_x_right_world_y_down"');
      expect(markup).toContain('data-plan-render-source="geometry"');
      expect(markup).toContain('data-plan-committed-body-count="2"');
      expect(markup).toContain('data-plan-context-line-count="1"');
    });

    it('emits per-shape hit-target attributes including the typed selection target kind', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-hit-shape-id="deck-1"');
      expect(markup).toContain('data-plan-shape-target-kind="workbench"');
      expect(markup).toContain('data-plan-hit-shape-id="rendered-pergola-1"');
      expect(markup).toContain('data-plan-shape-target-kind="pergola"');
    });

    it('renders a selection halo polygon for the active deck', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          activeObjectRef={{ family: 'decks', objectId: 'deck-1' }}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(markup).toContain('data-plan-selection-shape-id="deck-1"');
      expect(markup).not.toContain('data-plan-selection-shape-id="rendered-pergola-1"');
    });

    it('hides pergola shapes when pergola visibility is off', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          visibility={{ house: true, pergolas: false, decks: true, openings: true }}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(markup).not.toContain('data-plan-hit-shape-id="rendered-pergola-1"');
      expect(markup).toContain('data-plan-hit-shape-id="deck-1"');
    });
  });

  describe('selection dispatch', () => {
    function deckArtifact(): WorkbenchSolvedGeometryArtifact {
      return makeArtifact([
        makeShape({
          id: 'deck-7',
          sourceObjectId: 'deck-7',
          sourceType: 'house_surface_solid',
          family: 'house',
          kind: 'deck',
        }),
      ]);
    }

    it('dispatches onSelectObjectWorkbenchTarget on left-click of a deck hit-target', () => {
      const onSelectObjectWorkbenchTarget = vi.fn();
      const onSelectPergolaTarget = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
          onSelectPergolaTarget={onSelectPergolaTarget}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="deck-7"]',
      );
      expect(hitTarget).not.toBeNull();
      dispatchPointer(hitTarget!, 'pointerdown', { button: 0 });

      expect(onSelectObjectWorkbenchTarget).toHaveBeenCalledWith({
        kind: 'deck',
        targetId: 'deck-7',
      });
      expect(onSelectPergolaTarget).not.toHaveBeenCalled();
      rendered.unmount();
    });

    it('clears selection when an empty-canvas pointerdown lands on the SVG root', () => {
      const onClearWorkbenchSelection = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
        />,
      );
      const svg = rendered.container.querySelector('svg[data-plan-viewport="true"]');
      expect(svg).not.toBeNull();
      dispatchPointer(svg!, 'pointerdown', { button: 0 });
      expect(onClearWorkbenchSelection).toHaveBeenCalledTimes(1);
      rendered.unmount();
    });

    it('does not clear selection when a hit-target swallows the pointerdown', () => {
      const onClearWorkbenchSelection = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="deck-7"]',
      );
      dispatchPointer(hitTarget!, 'pointerdown', { button: 0 });
      expect(onClearWorkbenchSelection).not.toHaveBeenCalled();
      rendered.unmount();
    });
  });

  describe('cross-viewport hover (milestone 16, phase 1)', () => {
    function deckArtifact(): WorkbenchSolvedGeometryArtifact {
      return makeArtifact([
        makeShape({
          id: 'deck-9',
          sourceObjectId: 'deck-9',
          sourceType: 'house_surface_solid',
          family: 'house',
          kind: 'deck',
        }),
      ]);
    }

    it('emits onHoverObjectChange with a typed deck ref when the local pointer enters a deck hit-target', () => {
      // The classifier (`topProjectionShapeClassifier`) maps a deck shape to
      // `{ kind: 'workbench', targetKind: 'deck', targetId }`; PlanViewport
      // adapts that to the ref envelope (`{ family: 'decks', objectId }`)
      // the rest of the workbench uses. This is the emit half of the
      // hover-sync contract documented in milestone 16.
      const onHoverObjectChange = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onHoverObjectChange={onHoverObjectChange}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="deck-9"]',
      );
      expect(hitTarget).not.toBeNull();
      dispatchPointer(hitTarget!, 'pointerover');
      expect(onHoverObjectChange).toHaveBeenCalledWith({
        family: 'decks',
        objectId: 'deck-9',
      });
      rendered.unmount();
    });

    it('emits onHoverObjectChange(null) when the pointer leaves the hit-target', () => {
      const onHoverObjectChange = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onHoverObjectChange={onHoverObjectChange}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="deck-9"]',
      );
      dispatchPointer(hitTarget!, 'pointerover');
      onHoverObjectChange.mockClear();
      dispatchPointer(hitTarget!, 'pointerout');
      expect(onHoverObjectChange).toHaveBeenCalledWith(null);
      rendered.unmount();
    });

    it('renders a hover halo for the matching shape when hoveredObjectRef is set externally', () => {
      // External hover (e.g. driven by 3D pointer-over once the follow-up
      // slice lands) -- PlanViewport reads the prop and surfaces a
      // lower-intensity halo on the matching shape. Distinct from the
      // selection halo so the active object still reads as primary.
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={deckArtifact()}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          hoveredObjectRef={{ family: 'decks', objectId: 'deck-9' }}
        />,
      );
      expect(markup).toContain('data-plan-hover-halo-shape-id="deck-9"');
    });

    it('suppresses the hover halo when the hovered ref equals the active selection (avoid double-paint)', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={deckArtifact()}
          activeObjectRef={{ family: 'decks', objectId: 'deck-9' }}
          hoveredObjectRef={{ family: 'decks', objectId: 'deck-9' }}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(markup).toContain('data-plan-selection-shape-id="deck-9"');
      expect(markup).not.toContain('data-plan-hover-halo-shape-id="deck-9"');
    });

    it('emits a pergola hover ref when the local pointer enters a pergola shape', () => {
      const onHoverObjectChange = vi.fn();
      const artifact = makeArtifact([
        makeShape({
          id: 'rendered-pergola-1',
          sourceObjectId: 'rendered-pergola-1',
          sourceType: 'roof_plane',
          family: 'pergola',
          kind: 'roof_plane',
          metadata: { pergolaId: 'pergola-7' },
        }),
      ]);
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={artifact}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onHoverObjectChange={onHoverObjectChange}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="rendered-pergola-1"]',
      );
      expect(hitTarget).not.toBeNull();
      dispatchPointer(hitTarget!, 'pointerover');
      // Classifier prefers `metadata.pergolaId` over `sourceObjectId`, so
      // the emitted ref carries the workbench-level pergola id even though
      // the shape itself was a roof_plane child object.
      expect(onHoverObjectChange).toHaveBeenCalledWith({
        family: 'pergolas',
        objectId: 'pergola-7',
      });
      rendered.unmount();
    });
  });
});
