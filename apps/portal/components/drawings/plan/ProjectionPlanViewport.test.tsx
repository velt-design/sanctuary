import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import ProjectionPlanViewport from './ProjectionPlanViewport';

function shape(
  input: Partial<GeometryTopProjectionShape> & Pick<GeometryTopProjectionShape, 'id' | 'family' | 'kind' | 'sourceType'>,
): GeometryTopProjectionShape {
  return {
    sourceObjectId: input.sourceObjectId ?? input.id,
    sourceId: input.sourceId ?? input.id,
    polygon: input.polygon ?? [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    zOrder: input.zOrder ?? 0,
    zMin: input.zMin ?? null,
    zMax: input.zMax ?? null,
    metadata: input.metadata,
    ...input,
  };
}

function artifactWithProjection(shapes: GeometryTopProjectionShape[]): WorkbenchSolvedGeometryArtifact {
  const topProjection: GeometryTopProjectionViewModel = {
    shapes,
    extents: {
      minX: 0,
      minY: 0,
      maxX: 7000,
      maxY: 4000,
      widthMm: 7000,
      heightMm: 4000,
    },
    screenAxis: { x: 'world_x_left', y: 'world_y_down' },
  };
  return {
    source: 'solved_geometry',
    fallback: null,
    previewMode: 'snapshot_validated',
    resultSource: 'snapshot',
    topProjection,
  } as WorkbenchSolvedGeometryArtifact;
}

describe('ProjectionPlanViewport', () => {
  it('renders geometry-ready model space as top-projection committed bodies only', () => {
    const markup = renderToStaticMarkup(
      <ProjectionPlanViewport
        artifact={artifactWithProjection([
          shape({
            id: 'pergola-roof-main',
            family: 'pergola',
            kind: 'roof_plane',
            sourceType: 'roof_plane',
            metadata: { topProjectionRole: 'top_visible' },
          }),
          shape({
            id: 'deck-main',
            family: 'house',
            kind: 'deck',
            sourceType: 'house_surface_solid',
            sourceId: 'deck-1',
            metadata: { topProjectionRole: 'top_visible' },
          }),
          shape({
            id: 'wall-edge-main',
            family: 'house',
            kind: 'wall_segment',
            sourceType: 'house_line',
            metadata: { topProjectionRole: 'context', planDetailRole: 'wall_edge' },
          }),
          shape({
            id: 'reference-footprint',
            family: 'reference',
            kind: 'house-footprint',
            sourceType: 'house_reference',
            metadata: { topProjectionRole: 'context' },
          }),
          shape({
            id: 'hidden-wall',
            family: 'house',
            kind: 'wall_segment',
            sourceType: 'house_surface',
            metadata: { topProjectionRole: 'hidden_from_top' },
          }),
        ])}
      />,
    );

    expect(markup).toContain('data-model-space-render-contract="top_projection_only"');
    expect(markup).toContain('data-plan-projection-native-surface="true"');
    expect(markup.match(/data-plan-layer="committedBodies"/g)).toHaveLength(2);
    expect(markup.match(/data-plan-render-source="top_projection_committed"/g)).toHaveLength(2);
    expect(markup.match(/data-plan-render-source="top_projection_context"/g)).toHaveLength(1);
    expect(markup).toContain('data-plan-object-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-legacy-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-geometry-fallback-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-top-projection-context-overlay-body-count="0"');
    expect(markup).not.toContain('data-plan-layer="committedBodies" data-plan-coordinate-space="top_projection_screen" data-plan-render-source="top_projection_context"');
    expect(markup).not.toContain('data-top-projection-family="reference" data-plan-layer="committedBodies"');
    expect(markup).not.toContain('data-top-projection-role="hidden_from_top" data-plan-layer="committedBodies"');
  });

  it('renders selected projection overlay as outline and hit target without adding another filled body', () => {
    const markup = renderToStaticMarkup(
      <ProjectionPlanViewport
        artifact={artifactWithProjection([
          shape({
            id: 'deck-main',
            family: 'house',
            kind: 'deck',
            sourceType: 'house_surface_solid',
            sourceId: 'deck-1',
            metadata: { topProjectionRole: 'top_visible' },
          }),
        ])}
        objectWorkbenchPlanOverlay={{
          shapes: [
            {
              ownerKind: 'deck',
              ownerId: 'deck-1',
              polygon: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
              ],
              source: 'top_projection_committed',
              selected: true,
              muted: false,
              invalid: false,
              invalidMessage: null,
              deckInteraction: null,
              openingInteraction: null,
              deckDragEligibility: null,
              openingDragEligibility: null,
            },
          ],
          presetAnnotations: [],
          customEdgeCandidates: [],
        } as never}
      />,
    );

    expect(markup.match(/data-plan-layer="committedBodies"/g)).toHaveLength(1);
    expect(markup).toContain('data-plan-layer="selectionOutlines"');
    expect(markup).toContain('data-plan-layer="hitTargets"');
    expect(markup).toContain('data-object-workbench-shape-visual="false"');
    expect(markup).toContain('data-plan-visible-top-projection-committed-overlay-body-count="1"');
    expect(markup).not.toContain('data-plan-visible-legacy-overlay-body-count="1"');
  });
});
