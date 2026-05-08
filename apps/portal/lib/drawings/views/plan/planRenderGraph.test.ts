import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  buildProjectionPlanRenderGraph,
  topProjectionPlanLayer,
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
    expect(graph.hitTargets).toEqual([]);
    expect(graph.selectionOutlines).toEqual([]);
    expect(graph.dimensions).toEqual([]);
    expect(graph.dragPreview).toEqual([]);
    expect(graph.debug).toEqual([]);
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

  it('routes house_terminal_end click-target shapes onto the committed-bodies layer', () => {
    // Milestone 13: terminal-end markers (the inward-pointing hip
    // triangles in plan view) need to render visibly so users can
    // click them, AND need to be hit-testable -- the hit-target layer
    // builds from committed bodies, so this routing is what makes the
    // markers clickable end-to-end.
    const closedMarker = shape({
      id: 'house_terminal_end:house-1:house-gable-end-x-2',
      sourceObjectId: 'house-1',
      sourceId: 'house-gable-end-x-2',
      family: 'house',
      kind: 'house_terminal_end',
      sourceType: 'house_reference',
      metadata: {
        topProjectionRole: 'top_visible',
        openGableEndId: 'house-gable-end-x-2',
        isOpen: false,
      },
    });
    const openMarker = shape({
      ...closedMarker,
      id: 'house_terminal_end:house-1:house-gable-end-x-4',
      sourceId: 'house-gable-end-x-4',
      metadata: {
        topProjectionRole: 'top_visible',
        openGableEndId: 'house-gable-end-x-4',
        isOpen: true,
      },
    });
    expect(topProjectionPlanLayer(closedMarker)).toBe('committedBodies');
    expect(topProjectionPlanLayer(openMarker)).toBe('committedBodies');
    // Visibility tracks the house family toggle -- hiding the house
    // also hides its terminal-end click targets.
    expect(
      topProjectionShapeVisible(closedMarker, {
        house: false,
        decks: true,
        pergolas: true,
        openings: true,
      }),
    ).toBe(false);
    expect(
      topProjectionShapeVisible(closedMarker, {
        house: true,
        decks: true,
        pergolas: true,
        openings: true,
      }),
    ).toBe(true);
  });
});
