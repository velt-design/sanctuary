import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import ProjectionTopViewport from './ProjectionTopViewport';

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
      minX: -2000,
      minY: -1000,
      maxX: 7000,
      maxY: 4000,
      widthMm: 9000,
      heightMm: 5000,
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

const viewportTransform = { zoom: 1, panX: 0, panY: 0 };

describe('ProjectionTopViewport', () => {
  it('renders normal visible bodies only from committed top-projection graph bodies', () => {
    const markup = renderToStaticMarkup(
      <ProjectionTopViewport
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
        viewportTransform={viewportTransform}
      />,
    );

    expect(markup).toContain('data-projection-top-viewport="true"');
    expect(markup).toContain('data-model-space-render-contract="top_projection_only"');
    expect(markup).toContain('data-top-projection-screen-axis="world_x_left_world_y_down"');
    expect(markup).toContain('data-model-space-world-box="-2000 -1000 9000 5000"');
    expect(markup).toContain('data-model-space-focus-box="-2000 -1000 9000 5000"');
    expect(markup.match(/data-plan-layer="committedBodies"/g)).toHaveLength(2);
    expect(markup.match(/data-plan-layer="contextLines"/g)).toHaveLength(1);
    expect(markup).toContain('data-plan-committed-top-projection-body-count="2"');
    expect(markup).toContain('data-plan-object-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-legacy-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-geometry-fallback-overlay-body-count="0"');
    expect(markup).toContain('data-plan-visible-top-projection-context-overlay-body-count="0"');
    expect(markup).toContain('data-plan-duplicate-visual-body-count="0"');
    expect(markup).not.toContain('data-top-projection-family="reference" data-plan-layer="committedBodies"');
    expect(markup).not.toContain('data-top-projection-role="hidden_from_top" data-plan-layer="committedBodies"');
  });

  it('renders selected objects as outlines and hit targets without adding duplicate filled geometry', () => {
    const markup = renderToStaticMarkup(
      <ProjectionTopViewport
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
        activeObjectRef={{ family: 'decks', objectId: 'deck-1' }}
        viewportTransform={viewportTransform}
      />,
    );

    expect(markup.match(/data-plan-layer="committedBodies"/g)).toHaveLength(1);
    expect(markup).toContain('data-plan-layer="selectionOutlines"');
    expect(markup).toContain('data-plan-layer="hitTargets"');
    expect(markup).toContain('data-object-workbench-shape-visual="false"');
    expect(markup).toContain('data-plan-visible-top-projection-committed-overlay-body-count="0"');
    expect(markup).toContain('data-plan-duplicate-semantic-owner-count="0"');
  });
});
