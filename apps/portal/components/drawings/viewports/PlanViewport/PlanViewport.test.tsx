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

    it('emits hit-targets for non-active project pergola context outlines', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          projectContextShapes={[
            makeShape({
              id: 'pergola_reference:pergola-B',
              sourceObjectId: 'pergola-B',
              sourceType: 'pergola_reference',
              family: 'pergola',
              kind: 'outline',
              metadata: { isCanonicalOutline: true },
            }),
          ]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-context-source-id="pergola-B"');
      expect(markup).toContain('data-plan-hit-shape-id="pergola_reference:pergola-B"');
      expect(markup).toContain('data-plan-shape-target-kind="pergola"');
    });

    it('does not emit context hit-targets for non-pergola project references', () => {
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifactWithDeckPergolaAndContext()}
          projectContextShapes={[
            makeShape({
              id: 'house_reference:house-main',
              sourceObjectId: 'house-main',
              sourceType: 'house_reference',
              family: 'house',
              kind: 'footprint',
            }),
          ]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).not.toContain('data-plan-hit-shape-id="house_reference:house-main"');
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

    it('selects only the matching project-level house reference', () => {
      const houseMain = makeShape({
        id: 'house_reference:house-main',
        sourceObjectId: 'house-main',
        sourceId: 'house-main',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
      });
      const houseTwo = makeShape({
        id: 'house_reference:house-form-2',
        sourceObjectId: 'house-form-2',
        sourceId: 'house-form-2',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
        polygon: [
          { x: 2000, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 1000 },
          { x: 2000, y: 1000 },
        ],
      });
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifact([])}
          activeObjectRef={{ family: 'house_forms', objectId: 'house-main' }}
          houseCommittedShapes={[houseMain, houseTwo]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(markup).toContain('data-plan-selection-shape-id="house_reference:house-main"');
      expect(markup).not.toContain('data-plan-selection-shape-id="house_reference:house-form-2"');
    });

    it('keeps a selected second house reference visible when the active module renders the primary roof', () => {
      const primaryRoof = makeShape({
        id: 'house_surface_solid:house-main-roof',
        sourceObjectId: 'house-main-roof',
        sourceId: 'house-main-roof',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'roof',
        metadata: { houseFormId: 'house-main' },
      });
      const houseMain = makeShape({
        id: 'house_reference:house-main',
        sourceObjectId: 'house-main',
        sourceId: 'house-main',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
      });
      const houseTwo = makeShape({
        id: 'house_reference:house-form-2',
        sourceObjectId: 'house-form-2',
        sourceId: 'house-form-2',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
        polygon: [
          { x: 2000, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 1000 },
          { x: 2000, y: 1000 },
        ],
      });

      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifact([primaryRoof])}
          activeObjectRef={{ family: 'house_forms', objectId: 'house-form-2' }}
          houseCommittedShapes={[houseMain, houseTwo]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-shape-id="house_surface_solid:house-main-roof"');
      expect(markup).toContain('data-plan-shape-id="house_reference:house-form-2"');
      expect(markup).toContain('data-plan-selection-shape-id="house_reference:house-form-2"');
      expect(markup).not.toContain('data-plan-selection-shape-id="house_surface_solid:house-main-roof"');
    });

    it('dedupes project house references against projection house references before rendering', () => {
      const houseMain = makeShape({
        id: 'house_reference:house-main',
        sourceObjectId: 'house-main',
        sourceId: 'house-main',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
      });
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={makeArtifact([houseMain])}
          houseCommittedShapes={[houseMain]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );
      expect(
        rendered.container.querySelectorAll(
          '[data-plan-hit-shape-id="house_reference:house-main"]',
        ),
      ).toHaveLength(1);
      rendered.unmount();
    });

    it('renders project-wide pergola plan bodies and replaces the active unprefixed body', () => {
      const activePergola = makeShape({
        id: 'rendered-pergola-A',
        sourceObjectId: 'rendered-pergola-A',
        sourceType: 'roof_plane',
        family: 'pergola',
        kind: 'roof_plane',
        metadata: { pergolaId: 'pergola-A' },
      });
      const projectPergolaA = makeShape({
        id: 'project_pergola:pergola-A:rendered-pergola-A',
        sourceObjectId: 'rendered-pergola-A',
        sourceType: 'roof_plane',
        family: 'pergola',
        kind: 'roof_plane',
        metadata: { pergolaId: 'pergola-A' },
      });
      const projectPergolaB = makeShape({
        id: 'project_pergola:pergola-B:rendered-pergola-B',
        sourceObjectId: 'rendered-pergola-B',
        sourceType: 'roof_plane',
        family: 'pergola',
        kind: 'roof_plane',
        polygon: [
          { x: 8000, y: 0 },
          { x: 9000, y: 0 },
          { x: 9000, y: 1000 },
          { x: 8000, y: 1000 },
        ],
        metadata: { pergolaId: 'pergola-B' },
      });
      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifact([activePergola])}
          activeObjectRef={{ family: 'pergolas', objectId: 'pergola-B' }}
          projectPergolaPlanShapes={[projectPergolaA, projectPergolaB]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-shape-id="project_pergola:pergola-A:rendered-pergola-A"');
      expect(markup).toContain('data-plan-shape-id="project_pergola:pergola-B:rendered-pergola-B"');
      expect(markup).not.toContain('data-plan-shape-id="rendered-pergola-A"');
      expect(markup).toContain('data-plan-selection-shape-id="project_pergola:pergola-B:rendered-pergola-B"');
    });

    it('uses projectionOverride instead of active artifact house bodies', () => {
      const activeModuleHouseRoof = makeShape({
        id: 'house_surface_solid:active-module-house-roof',
        sourceObjectId: 'active-module-house-roof',
        sourceId: 'active-module-house-roof',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'roof',
        metadata: { houseFormId: 'house-main' },
      });
      const projectHouseTwoRoof = makeShape({
        id: 'house_surface_solid:house-form-2:project-roof',
        sourceObjectId: 'house-form-2:project-roof',
        sourceId: 'project-roof',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'roof',
        polygon: [
          { x: 2000, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 1000 },
          { x: 2000, y: 1000 },
        ],
        metadata: { houseFormId: 'house-form-2' },
      });
      const projectHouseTwoRoofMaterial = makeShape({
        id: 'house_roof_material:house-form-2:project-roof-material',
        sourceObjectId: 'house-form-2:project-roof-material',
        sourceId: 'project-roof-material',
        sourceType: 'house_roof_material',
        family: 'house',
        kind: 'house_roof_material',
        polygon: [
          { x: 2100, y: 100 },
          { x: 2900, y: 100 },
          { x: 2900, y: 900 },
          { x: 2100, y: 900 },
        ],
        metadata: { houseFormId: 'house-form-2' },
      });

      const markup = renderToStaticMarkup(
        <PlanViewport
          artifact={makeArtifact([activeModuleHouseRoof])}
          projectionOverride={makeProjection([projectHouseTwoRoof, projectHouseTwoRoofMaterial])}
          activeObjectRef={{ family: 'house_forms', objectId: 'house-form-2' }}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
        />,
      );

      expect(markup).toContain('data-plan-shape-id="house_surface_solid:house-form-2:project-roof"');
      expect(markup).toContain('data-plan-shape-id="house_roof_material:house-form-2:project-roof-material"');
      expect(markup).toContain('data-plan-selection-shape-id="house_surface_solid:house-form-2:project-roof"');
      expect(markup).not.toContain('data-plan-hit-shape-id="house_roof_material:house-form-2:project-roof-material"');
      expect(markup).not.toContain('data-plan-shape-id="house_surface_solid:active-module-house-roof"');
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

    it('dispatches onSelectPergolaTarget on left-click of a context pergola reference', () => {
      const onSelectPergolaTarget = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          projectContextShapes={[
            makeShape({
              id: 'pergola_reference:pergola-context',
              sourceObjectId: 'pergola-context',
              sourceType: 'pergola_reference',
              family: 'pergola',
              kind: 'outline',
              metadata: { isCanonicalOutline: true },
            }),
          ]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onSelectPergolaTarget={onSelectPergolaTarget}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="pergola_reference:pergola-context"]',
      );
      expect(hitTarget).not.toBeNull();
      dispatchPointer(hitTarget!, 'pointerdown', { button: 0 });

      expect(onSelectPergolaTarget).toHaveBeenCalledWith('pergola-context');
      rendered.unmount();
    });

    it('dispatches onSelectPergolaTarget from a non-active full project pergola body', () => {
      const onSelectPergolaTarget = vi.fn();
      const rendered = renderIntoDocument(
        <PlanViewport
          artifact={deckArtifact()}
          projectPergolaPlanShapes={[
            makeShape({
              id: 'project_pergola:pergola-body:roof',
              sourceObjectId: 'rendered-pergola-body',
              sourceType: 'roof_plane',
              family: 'pergola',
              kind: 'roof_plane',
              metadata: { pergolaId: 'pergola-body' },
            }),
          ]}
          viewportTransform={IDENTITY_TRANSFORM}
          onViewportTransformChange={() => undefined}
          onSelectPergolaTarget={onSelectPergolaTarget}
        />,
      );
      const hitTarget = rendered.container.querySelector(
        '[data-plan-hit-shape-id="project_pergola:pergola-body:roof"]',
      );
      expect(hitTarget).not.toBeNull();
      dispatchPointer(hitTarget!, 'pointerdown', { button: 0 });

      expect(onSelectPergolaTarget).toHaveBeenCalledWith('pergola-body');
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
