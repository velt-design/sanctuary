import { describe, expect, it } from 'vitest';
import {
  buildOpeningDragSession,
  buildOpeningInteractionTelemetry,
  buildOpeningInteractionViewState,
  buildOpeningObjectPatchCommit,
  resolveOpeningPreviewState,
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
        objectRef: { family: 'openings', objectId: 'opening-1' },
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

  it('carries object refs through opening drag commits', () => {
    const session = buildOpeningDragSession({
      pointerId: 1,
      startSvgX: 10,
      startSvgY: 20,
      openingId: 'opening-1',
      overlayShape: {
        ownerKind: 'opening',
        ownerId: 'opening-1',
        polygon: [
          { x: 0.6, y: 0 },
          { x: 2.4, y: 0 },
          { x: 2.4, y: -0.12 },
          { x: 0.6, y: -0.12 },
        ],
        detailSegments: [],
        selected: true,
        custom: false,
        muted: false,
        invalid: false,
        invalidMessage: null,
        deckInteraction: null,
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
        deckDragEligibility: null,
        openingDragEligibility: {
          eligible: true,
          reason: 'Drag opening',
        },
        source: 'geometry_derived',
        geometrySourceId: 'rear',
        renderStatus: 'geometry_ready',
      },
      svgInteraction: {
        hostEdgeStart: { x: 0, y: 0 },
        hostEdgeEnd: { x: 100, y: 0 },
      },
    });
    if (!session) throw new Error('Expected opening session.');

    const preview = resolveOpeningPreviewState({
      session,
      nextSvgX: 30,
      nextSvgY: 20,
    });
    const commit = buildOpeningObjectPatchCommit({ session, preview });

    expect(session.objectRef).toEqual({ family: 'openings', objectId: 'opening-1' });
    expect(commit).toEqual({
      target: { family: 'openings', objectId: 'opening-1' },
      patch: {
        offsetAlongWallM: '1.8',
      },
    });
  });
});
