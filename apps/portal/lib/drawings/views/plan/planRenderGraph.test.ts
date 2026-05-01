import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  buildProjectionPlanRenderGraph,
  topProjectionShapeVisible,
  topProjectionShapeVisualOwner,
} from './planRenderGraph';

function shape(input: Partial<GeometryTopProjectionShape> & Pick<GeometryTopProjectionShape, 'id' | 'family' | 'kind' | 'sourceType'>): GeometryTopProjectionShape {
  return {
    sourceObjectId: input.id,
    sourceId: input.sourceId ?? input.id,
    polygon: input.polygon ?? [],
    zOrder: input.zOrder ?? 0,
    zMin: input.zMin ?? null,
    zMax: input.zMax ?? null,
    metadata: input.metadata,
    ...input,
  };
}

describe('planRenderGraph', () => {
  it('keeps projection-only model-space bodies to committed top-visible owners and wall context lines', () => {
    const roof = shape({
      id: 'roof-main',
      family: 'house',
      kind: 'roof',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible' },
    });
    const footprint = shape({
      id: 'footprint-main',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_surface',
      metadata: { topProjectionRole: 'top_visible' },
    });
    const deck = shape({
      id: 'deck-main',
      family: 'house',
      kind: 'deck',
      sourceType: 'house_surface_solid',
      sourceId: 'deck-1',
      metadata: { topProjectionRole: 'top_visible' },
    });
    const wallLine = shape({
      id: 'wall-edge-1',
      family: 'house',
      kind: 'wall_segment',
      sourceType: 'house_line',
      metadata: { topProjectionRole: 'context', planDetailRole: 'wall_edge' },
    });
    const referenceBody = shape({
      id: 'reference-footprint',
      family: 'reference',
      kind: 'house-footprint',
      sourceType: 'house_reference',
      metadata: { topProjectionRole: 'context' },
    });

    const graph = buildProjectionPlanRenderGraph(
      [
        { shape: roof, marker: 'roof' },
        { shape: footprint, marker: 'footprint' },
        { shape: deck, marker: 'deck' },
        { shape: wallLine, marker: 'wall' },
        { shape: referenceBody, marker: 'reference' },
      ],
      { projectionOnlyModelSpace: true },
    );

    expect(graph.committedBodies.map((item) => item.marker)).toEqual(['roof', 'deck']);
    expect(graph.contextLines.map((item) => item.marker)).toEqual(['wall']);
    expect(graph.suppressed.map((item) => item.marker)).toEqual(['reference', 'footprint']);
  });

  it('uses semantic owners for duplicate body detection', () => {
    expect(topProjectionShapeVisualOwner(shape({
      id: 'deck-shape',
      family: 'house',
      kind: 'deck',
      sourceType: 'house_surface_solid',
      sourceId: 'deck-1',
    }))).toBe('deck:deck-1');
    expect(topProjectionShapeVisualOwner(shape({
      id: 'roof-shape',
      family: 'house',
      kind: 'roof',
      sourceType: 'house_surface_solid',
    }))).toBe('house');
  });

  it('applies family visibility before graph construction', () => {
    expect(topProjectionShapeVisible(shape({
      id: 'deck-shape',
      family: 'house',
      kind: 'deck',
      sourceType: 'house_surface_solid',
    }), {
      house: true,
      decks: false,
      pergolas: true,
      openings: true,
    })).toBe(false);
  });
});
