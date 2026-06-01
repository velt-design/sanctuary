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

    expect(graph.committedBodies.map((item) => item.marker)).toEqual(['deck', 'roof']);
    expect(graph.contextLines.map((item) => item.marker)).toEqual(['wall']);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['deck']);
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
      metadata: { houseFormId: 'house-main' },
    }))).toBe('house:house-main');
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

  it('keeps the canonical house_reference footprint as a hit target, not a visible body, when a roof body exists', () => {
    const roof = shape({
      id: 'roof-main',
      family: 'house',
      kind: 'roof',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-main' },
    });
    const referenceFootprint = shape({
      id: 'house_reference:house-footprint',
      sourceObjectId: 'house-main',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_reference',
      metadata: { topProjectionRole: 'top_visible', isCanonicalOutline: true },
    });
    const redundantSurfaceFootprint = shape({
      id: 'house_surface_solid:footprint',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-main' },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: roof, marker: 'roof' },
      { shape: referenceFootprint, marker: 'reference-footprint' },
      { shape: redundantSurfaceFootprint, marker: 'surface-footprint' },
    ]);

    expect(graph.committedBodies.map((item) => item.marker)).toEqual(['roof']);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['reference-footprint']);
    expect(graph.suppressed.map((item) => item.marker)).toEqual(['surface-footprint']);
    expect(graph.diagnostics.visibleReferenceFallbackIds).toEqual([]);
    expect(graph.diagnostics.houses).toEqual([
      expect.objectContaining({
        houseFormId: 'house-main',
        referenceIds: ['house_reference:house-footprint'],
        roofBodyIds: ['roof-main'],
        visibleReferenceFallbackIds: [],
        hitTargetIds: ['house_reference:house-footprint'],
      }),
    ]);
  });

  it('routes house roof-material projection shapes to committedBodies and the canonical reference footprint to hitTargets', () => {
    const roofSolid = shape({
      id: 'house_surface_solid:house-form-2:roof',
      family: 'house',
      kind: 'roof',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-form-2' },
    });
    const roofMaterial = shape({
      id: 'house_roof_material:house-form-2:roof-material',
      family: 'house',
      kind: 'house_roof_material',
      sourceType: 'house_roof_material',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-form-2' },
    });
    const referenceFootprint = shape({
      id: 'house_reference:house-form-2',
      sourceObjectId: 'house-form-2',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_reference',
      metadata: { topProjectionRole: 'top_visible', isCanonicalOutline: true },
    });
    const redundantSurfaceFootprint = shape({
      id: 'house_surface_solid:house-form-2-footprint',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-form-2' },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: roofSolid, marker: 'roof-solid' },
      { shape: roofMaterial, marker: 'roof-material' },
      { shape: referenceFootprint, marker: 'reference-footprint' },
      { shape: redundantSurfaceFootprint, marker: 'surface-footprint' },
    ]);

    expect(graph.committedBodies.map((item) => item.marker)).toEqual(['roof-material']);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['reference-footprint']);
    expect(graph.suppressed.map((item) => item.marker)).toEqual(['roof-solid', 'surface-footprint']);
    expect(graph.diagnostics.houses).toEqual([
      expect.objectContaining({
        houseFormId: 'house-form-2',
        roofBodyIds: ['house_roof_material:house-form-2:roof-material'],
        roofMaterialBodyIds: ['house_roof_material:house-form-2:roof-material'],
        visibleReferenceFallbackIds: [],
      }),
    ]);
  });

  it('suppresses redundant house footprints per house form instead of globally', () => {
    const roof = shape({
      id: 'roof-main',
      family: 'house',
      kind: 'roof',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-main' },
    });
    const primaryFootprint = shape({
      id: 'house_surface_solid:house-main-footprint',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_surface_solid',
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-main' },
    });
    const secondReferenceFootprint = shape({
      id: 'house_reference:house-form-2',
      sourceObjectId: 'house-form-2',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_reference',
      metadata: { topProjectionRole: 'top_visible', isCanonicalOutline: true },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: roof, marker: 'roof' },
      { shape: primaryFootprint, marker: 'primary-footprint' },
      { shape: secondReferenceFootprint, marker: 'second-reference-footprint' },
    ]);

    expect(graph.committedBodies.map((item) => item.marker)).toEqual([
      'roof',
      'second-reference-footprint',
    ]);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['second-reference-footprint']);
    expect(graph.suppressed.map((item) => item.marker)).toEqual(['primary-footprint']);
  });

  it('keeps the canonical house_reference footprint as a visible fallback when there is no roof committed body', () => {
    const referenceFootprint = shape({
      id: 'house_reference:house-footprint',
      sourceObjectId: 'house-footprint',
      family: 'house',
      kind: 'footprint',
      sourceType: 'house_reference',
      metadata: { topProjectionRole: 'top_visible', isCanonicalOutline: true },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: referenceFootprint, marker: 'reference-footprint' },
    ]);

    expect(graph.committedBodies.map((item) => item.marker)).toEqual(['reference-footprint']);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['reference-footprint']);
    expect(graph.diagnostics.visibleReferenceFallbackIds).toEqual(['house_reference:house-footprint']);
    expect(graph.diagnostics.houses).toEqual([
      expect.objectContaining({
        houseFormId: 'house-footprint',
        referenceIds: ['house_reference:house-footprint'],
        roofBodyIds: [],
        roofMaterialBodyIds: [],
        visibleReferenceFallbackIds: ['house_reference:house-footprint'],
        hitTargetIds: ['house_reference:house-footprint'],
      }),
    ]);
    expect(graph.suppressed).toEqual([]);
  });

  it('uses semantic paint order so pergola bodies render below house roof-material bodies even with higher geometry z-order', () => {
    const pergolaRoof = shape({
      id: 'project_pergola:pergola-1:roof_cladding_panel:panel-1',
      family: 'pergola',
      kind: 'roof_cladding',
      sourceType: 'roof_cladding_panel',
      zOrder: 999,
      metadata: { topProjectionRole: 'top_visible', pergolaId: 'pergola-1' },
    });
    const houseRoofMaterial = shape({
      id: 'house_roof_material:house-form-1:roof-material',
      family: 'house',
      kind: 'house_roof_material',
      sourceType: 'house_roof_material',
      zOrder: 1,
      metadata: { topProjectionRole: 'top_visible', houseFormId: 'house-form-1' },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: houseRoofMaterial, marker: 'house-roof-material' },
      { shape: pergolaRoof, marker: 'pergola-roof' },
    ]);

    expect(graph.committedBodies.map((item) => item.marker)).toEqual([
      'pergola-roof',
      'house-roof-material',
    ]);
  });

  it('routes pergola_reference fallbacks to context and hit targets, not committed bodies', () => {
    const fallback = shape({
      id: 'pergola_reference:pergola-2',
      sourceObjectId: 'pergola-2',
      sourceId: 'pergola-2',
      family: 'pergola',
      kind: 'outline',
      sourceType: 'pergola_reference',
      metadata: {
        pergolaId: 'pergola-2',
        renderRole: 'diagnostic_fallback',
        fallbackReason: 'unresolved_host',
        topProjectionRole: 'context',
      },
    });

    const graph = buildProjectionPlanRenderGraph([
      { shape: fallback, marker: 'fallback' },
    ]);

    expect(graph.committedBodies).toEqual([]);
    expect(graph.contextLines.map((item) => item.marker)).toEqual(['fallback']);
    expect(graph.hitTargets.map((item) => item.marker)).toEqual(['fallback']);
    expect(graph.suppressed).toEqual([]);
  });

});
