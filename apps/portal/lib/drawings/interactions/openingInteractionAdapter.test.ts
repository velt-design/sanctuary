import { describe, expect, it } from 'vitest';
import {
  buildOpeningInteractionTelemetry,
  buildOpeningInteractionViewState,
} from './openingInteractionAdapter';

describe('openingInteractionAdapter', () => {
  it('builds a shared selected opening interaction state when idle', () => {
    const state = buildOpeningInteractionViewState({
      selectedOpeningShape: {
        ownerId: 'opening-1',
        openingInteraction: {
          kind: 'opening',
          hostEdgeId: 'rear',
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 6, y: 0 },
          hostSpanM: 6,
          openingWidthM: 1.8,
          offsetAlongWallM: 0.6,
          minOffsetAlongWallM: 0,
          maxOffsetAlongWallM: 4.2,
        },
        openingDragEligibility: {
          eligible: true,
          reason: 'Drag opening',
        },
      },
      dragSession: null,
      previewState: null,
    });

    expect(state).toMatchObject({
      phase: 'selected',
      placementState: 'none',
      affordanceState: 'idle',
      referenceGuideState: 'none',
      highlightTargetId: 'rear',
    });
  });

  it('builds floating opening interaction telemetry while dragging', () => {
    const viewState = buildOpeningInteractionViewState({
      selectedOpeningShape: {
        ownerId: 'opening-1',
        openingInteraction: {
          kind: 'opening',
          hostEdgeId: 'rear',
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 6, y: 0 },
          hostSpanM: 6,
          openingWidthM: 1.8,
          offsetAlongWallM: 0.6,
          minOffsetAlongWallM: 0,
          maxOffsetAlongWallM: 4.2,
        },
        openingDragEligibility: {
          eligible: true,
          reason: 'Drag opening',
        },
      },
      dragSession: {
        pointerId: 1,
        openingId: 'opening-1',
        startSvgX: 10,
        startSvgY: 20,
        startPolygon: [],
        startOffsetAlongWallM: 0.6,
        interaction: {
          kind: 'opening',
          hostEdgeId: 'rear',
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 6, y: 0 },
          hostSpanM: 6,
          openingWidthM: 1.8,
          offsetAlongWallM: 0.6,
          minOffsetAlongWallM: 0,
          maxOffsetAlongWallM: 4.2,
        },
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 100, y: 0 },
        },
      },
      previewState: {
        openingId: 'opening-1',
        polygon: [],
        offsetAlongWallM: 1.4,
        clamped: false,
      },
    });

    const telemetry = buildOpeningInteractionTelemetry({
      selectedOpeningId: 'opening-1',
      viewState,
    });

    expect(telemetry).toMatchObject({
      objectKind: 'opening',
      selectedObjectId: 'opening-1',
      phase: 'dragging',
      placementState: 'floating',
      affordanceState: 'floating',
      canCommit: true,
      highlightTargetId: 'rear',
    });
  });
});
