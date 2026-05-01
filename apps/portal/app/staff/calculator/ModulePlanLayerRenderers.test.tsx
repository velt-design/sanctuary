import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  ObjectWorkbenchDimensionLayerRenderer,
  ObjectWorkbenchOverlayLayerRenderer,
  ObjectWorkbenchPreviewLayerRenderer,
  TopProjectionLayerRenderer,
  type ObjectWorkbenchOverlayShape,
  type ObjectWorkbenchPresetDimensionAnnotation,
  type ObjectWorkbenchPreviewShape,
} from './ModulePlanLayerRenderers';

const projection: GeometryTopProjectionViewModel = {
  coordinateSpace: 'world_xy_mm',
  screenAxis: {
    x: 'world_x_left',
    y: 'world_y_down',
  },
  shapes: [],
  extents: {
    minX: 0,
    minY: 0,
    maxX: 5000,
    maxY: 3000,
    widthMm: 5000,
    heightMm: 3000,
  },
};

function makeProjectionShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'object-1',
    sourceId: 'source-1',
    sourceType: 'roof_plane',
    family: 'pergola',
    kind: 'roof_plane',
    polygon: [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    zOrder: 10,
    zMin: 0,
    zMax: 2500,
    metadata: {
      topProjectionRole: 'top_visible',
    },
    ...overrides,
  };
}

function makeOverlayShape(overrides: Partial<ObjectWorkbenchOverlayShape> = {}): ObjectWorkbenchOverlayShape {
  return {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 2 },
      { x: 0, y: 2 },
    ],
    points: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 2 },
      { x: 0, y: 2 },
    ],
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: null,
    openingInteraction: null,
    deckDragEligibility: null,
    openingDragEligibility: null,
    source: 'top_projection_committed',
    geometrySourceId: 'deck-1',
    renderStatus: 'geometry_ready',
    ...overrides,
  };
}

function makeDimensionAnnotation(
  overrides: Partial<ObjectWorkbenchPresetDimensionAnnotation> = {},
): ObjectWorkbenchPresetDimensionAnnotation {
  return {
    id: 'dimension-1',
    targetKind: 'deck_preset_param',
    emphasis: 'driving',
    ownerKind: 'deck',
    ownerId: 'deck-1',
    fieldKey: 'widthM',
    rawValue: '5',
    displayValue: '5.00m',
    witnessStart: { x: 0, y: 2 },
    witnessEnd: { x: 5, y: 2 },
    lineStart: { x: 0, y: 3 },
    lineEnd: { x: 5, y: 3 },
    deckInteraction: null,
    ...overrides,
  };
}

describe('ModulePlanLayerRenderers', () => {
  it('renders committed top projection bodies and context lines with layer ownership attributes', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <TopProjectionLayerRenderer
          projection={projection}
          shapes={[
            {
              shape: makeProjectionShape({
                id: 'committed-roof',
                family: 'house',
                kind: 'roof',
                sourceType: 'house_surface_solid',
              }),
              points: [
                { x: 1, y: 1 },
                { x: 5, y: 1 },
                { x: 5, y: 3 },
              ],
              layer: 'committedBodies',
            },
            {
              shape: makeProjectionShape({
                id: 'wall-edge',
                sourceObjectId: 'wall-edge-object',
                sourceType: 'house_line',
                family: 'house',
                kind: 'wall_segment',
                metadata: {
                  topProjectionRole: 'context',
                  planDetailRole: 'wall_edge',
                  snapRole: 'deck_host_edge',
                  sourceEdgeId: 'edge-front',
                },
              }),
              points: [
                { x: 1, y: 4 },
                { x: 5, y: 4 },
                { x: 5, y: 4.2 },
              ],
              layer: 'contextLines',
            },
          ]}
        />
      </svg>,
    );

    expect(markup).toContain('data-plan-layer="committedBodies"');
    expect(markup).toContain('data-plan-render-source="top_projection_committed"');
    expect(markup).toContain('data-plan-layer="contextLines"');
    expect(markup).toContain('data-plan-render-source="top_projection_context"');
    expect(markup).toContain('data-plan-detail-role="wall_edge"');
    expect(markup).toContain('data-plan-snap-role="deck_host_edge"');
  });

  it('renders selected object-workbench outlines and hit targets without duplicate visible bodies', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <ObjectWorkbenchOverlayLayerRenderer
          shapes={[makeOverlayShape()]}
          renderCommittedBodies={false}
          previewShape={null}
        />
      </svg>,
    );

    expect(markup).toContain('data-plan-layer="selectionOutlines"');
    expect(markup).toContain('data-plan-layer="hitTargets"');
    expect(markup).toContain('data-plan-render-source="top_projection_committed"');
    expect(markup).not.toContain('data-object-workbench-shape-visual="true"');
  });

  it('renders drag preview geometry on the dragPreview layer', () => {
    const previewShape: ObjectWorkbenchPreviewShape = {
      ownerKind: 'deck',
      ownerId: 'deck-1',
      points: [
        { x: 2, y: 2 },
        { x: 7, y: 2 },
        { x: 7, y: 4 },
        { x: 2, y: 4 },
      ],
      bodyState: 'floating',
      anchorPoint: { x: 4.5, y: 3 },
      referenceGuide: null,
      targetHighlights: [],
      lockedCornerPoint: null,
      endCatchPoint: null,
    };

    const markup = renderToStaticMarkup(
      <svg>
        <ObjectWorkbenchPreviewLayerRenderer previewShape={previewShape} />
      </svg>,
    );

    expect(markup).toContain('data-plan-layer="dragPreview"');
    expect(markup).toContain('data-object-workbench-preview-shape="deck-1"');
    expect(markup).toContain('data-object-workbench-preview-body-state="floating"');
  });

  it('preserves dimension activation attributes on dimension layer text', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <ObjectWorkbenchDimensionLayerRenderer
          presetAnnotations={[makeDimensionAnnotation()]}
          customEdgeCandidates={[]}
          activeCustomEdgeId={null}
          previewShape={null}
          onDimensionActivate={() => undefined}
        />
      </svg>,
    );

    expect(markup).toContain('data-plan-layer="dimensions"');
    expect(markup).toContain('data-object-workbench-plan-dimension="dimension-1"');
    expect(markup).toContain('data-editable-field-id="dimension-1"');
  });
});
