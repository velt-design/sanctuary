import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { resolvePlanDimensionEditIntent } from './planDimensionEditController';

function makeFrame(input?: Partial<ObjectWorkbenchPlanDeckReferenceFrame>): ObjectWorkbenchPlanDeckReferenceFrame {
  return {
    hostEdgeId: input?.hostEdgeId ?? 'rear',
    sourceEdgeId: input?.sourceEdgeId ?? 'wall-rear',
    frameSource: input?.frameSource ?? 'top_projection_wall_edge',
    axis: input?.axis ?? 'along',
    spanStartM: input?.spanStartM ?? 0,
    spanEndM: input?.spanEndM ?? 8,
    edgeCoordinateM: input?.edgeCoordinateM ?? 0,
    outwardDirection: input?.outwardDirection ?? 1,
    hostEdgeStart: input?.hostEdgeStart ?? { x: 0, y: 0 },
    hostEdgeEnd: input?.hostEdgeEnd ?? { x: 8, y: 0 },
    alongUnitX: input?.alongUnitX ?? 1,
    alongUnitY: input?.alongUnitY ?? 0,
    outwardUnitX: input?.outwardUnitX ?? 0,
    outwardUnitY: input?.outwardUnitY ?? 1,
  };
}

function polygonCenter(polygon: readonly PlanPoint[]): PlanPoint {
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function makeDeckInteraction(input?: {
  kind?: ObjectWorkbenchPlanDeckInteraction['kind'];
  placement?: ObjectWorkbenchPlanDeckInteraction['placement'];
  frame?: ObjectWorkbenchPlanDeckReferenceFrame;
  crossFrame?: ObjectWorkbenchPlanDeckReferenceFrame;
  renderedCenter?: PlanPoint;
}): ObjectWorkbenchPlanDeckInteraction {
  const frame = input?.frame ?? makeFrame();
  const placement = input?.placement ?? 'snapped';
  const polygon = [
    { x: 2, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 3 },
    { x: 2, y: 3 },
  ];
  return {
    kind: input?.kind ?? 'preset_rect',
    placement,
    attachmentMode: placement === 'floating' ? 'floating' : 'single_edge',
    houseAttachmentSide: 'rear',
    semanticPlacementSide: placement === 'floating' ? null : 'rear',
    semanticWitnessSide: 'rear',
    placementEdgeId: placement === 'floating' ? null : frame.sourceEdgeId,
    primaryHostEdgeId: placement === 'floating' ? null : frame.sourceEdgeId,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: frame.sourceEdgeId,
    hostEdgeStart: frame.hostEdgeStart,
    hostEdgeEnd: frame.hostEdgeEnd,
    hostSpanM: frame.spanEndM - frame.spanStartM,
    deckWidthM: 4,
    deckDepthM: 2,
    centerOffsetM: 0,
    referenceEdgeGapM: 1,
    minCenterOffsetM: -2,
    maxCenterOffsetM: 2,
    renderedCenter: input?.renderedCenter ?? polygonCenter(polygon),
    dragPolygon: polygon,
    dragCenter: input?.renderedCenter ?? polygonCenter(polygon),
    dragCoordinateSpace: 'top_projection_world_m',
    dragSource: 'top_projection_committed',
    commitStartPolygon: polygon,
    referenceFrames: [frame],
    commitReferenceFrames: [frame],
    snapFrameSource: 'top_projection_wall_edge',
    crossEdgeReference: input?.crossFrame
      ? {
          hostEdgeId: input.crossFrame.hostEdgeId,
          gapM: 1,
          frame: input.crossFrame,
        }
      : null,
  };
}

function makePresetAnnotation(
  input: Partial<ObjectWorkbenchPlanPresetDimensionAnnotation> &
    Pick<ObjectWorkbenchPlanPresetDimensionAnnotation, 'targetKind' | 'ownerKind' | 'ownerId' | 'fieldKey'>,
): ObjectWorkbenchPlanPresetDimensionAnnotation {
  return {
    id: input.id ?? 'dimension-1',
    targetKind: input.targetKind,
    emphasis: input.emphasis ?? 'driving',
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    fieldKey: input.fieldKey,
    rawValue: input.rawValue ?? '0',
    displayValue: input.displayValue ?? '0.00m',
    witnessStart: input.witnessStart ?? { x: 0, y: 0 },
    witnessEnd: input.witnessEnd ?? { x: 1, y: 0 },
    lineStart: input.lineStart ?? { x: 0, y: 0 },
    lineEnd: input.lineEnd ?? { x: 1, y: 0 },
    deckInteraction: input.deckInteraction ?? null,
  };
}

describe('planDimensionEditController', () => {
  it('routes house preset params to footprint edits', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'house_preset_param',
        ownerKind: 'footprint',
        ownerId: 'house-1',
        fieldKey: 'recessDepthM',
      }),
      nextValue: ' 1.25 ',
    });

    expect(intent).toMatchObject({
      kind: 'house_footprint_edit',
      edit: {
        type: 'param',
        key: 'recessDepthM',
        value: '1.25',
      },
    });
  });

  it('keeps a floating preset deck centered when width changes', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'deck_preset_param',
        ownerKind: 'deck',
        ownerId: 'deck-1',
        fieldKey: 'widthM',
        deckInteraction: makeDeckInteraction({
          placement: 'floating',
          renderedCenter: { x: 5, y: 7 },
        }),
      }),
      nextValue: '5.5',
    });

    expect(intent).toMatchObject({
      kind: 'deck_patch',
      deckId: 'deck-1',
      patch: {
        floatingRect: {
          centerAlongM: '5',
          centerDepthM: '7',
          widthM: '5.5',
          depthM: '2',
        },
        presetRect: {
          widthM: '5.5',
        },
      },
    });
  });

  it('converts deck host start gap edits to center offsets', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'deck_host_edge_reference',
        ownerKind: 'deck',
        ownerId: 'deck-1',
        fieldKey: 'hostStartGapM',
        deckInteraction: makeDeckInteraction(),
      }),
      nextValue: '1.5',
    });

    expect(intent).toMatchObject({
      kind: 'deck_patch',
      patch: {
        presetRect: {
          centerOffsetM: '-0.5',
        },
      },
    });
  });

  it('moves custom deck outlines when reference gap changes', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'deck_host_edge_reference',
        ownerKind: 'deck',
        ownerId: 'deck-1',
        fieldKey: 'referenceEdgeGapM',
        deckInteraction: makeDeckInteraction({
          kind: 'custom_outline',
          placement: 'floating',
        }),
      }),
      nextValue: '1.75',
      customDeckLocalPolygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '2', depthM: '0' },
        { alongM: '2', depthM: '1' },
        { alongM: '0', depthM: '1' },
      ],
    });

    expect(intent).toMatchObject({
      kind: 'deck_patch',
      patch: {
        hostEdgeId: 'wall-rear',
        isAttached: false,
        outline: [
          { alongM: '0', depthM: '0.75' },
          { alongM: '2', depthM: '0.75' },
          { alongM: '2', depthM: '1.75' },
          { alongM: '0', depthM: '1.75' },
        ],
      },
    });
  });

  it('routes opening dimensions to opening patches', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'opening_param',
        ownerKind: 'opening',
        ownerId: 'opening-1',
        fieldKey: 'widthM',
      }),
      nextValue: '0.9',
    });

    expect(intent).toMatchObject({
      kind: 'opening_patch',
      openingId: 'opening-1',
      patch: {
        widthM: '0.9',
      },
    });
  });

  it('returns current validation copy for invalid deck relationship values', () => {
    const intent = resolvePlanDimensionEditIntent({
      annotation: makePresetAnnotation({
        targetKind: 'deck_host_edge_reference',
        ownerKind: 'deck',
        ownerId: 'deck-1',
        fieldKey: 'hostStartGapM',
        deckInteraction: makeDeckInteraction(),
      }),
      nextValue: '-1',
    });

    expect(intent).toMatchObject({
      kind: 'invalid',
      error: 'Enter a non-negative offset.',
    });
  });
});
