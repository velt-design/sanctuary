import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanOpeningInteraction,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { buildOpeningObjectPatchCommit } from './openingInteractionAdapter';
import {
  moveOpeningMoveTool,
  releaseOpeningMoveTool,
  startOpeningMoveTool,
} from './openingMoveToolController';
import type { InteractionToolPointer } from './interactionToolController';

function makePointer(point: PlanPoint): InteractionToolPointer {
  return {
    pointerId: 1,
    clientX: point.x,
    clientY: point.y,
    svgPoint: point,
    planPoint: null,
  };
}

function makeOpeningInteraction(): ObjectWorkbenchPlanOpeningInteraction {
  return {
    kind: 'opening',
    hostEdgeId: 'wall-front',
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 10, y: 0 },
    hostSpanM: 10,
    openingWidthM: 1,
    offsetAlongWallM: 2,
    minOffsetAlongWallM: 0,
    maxOffsetAlongWallM: 9,
  };
}

function makeOpeningOverlay(): ObjectWorkbenchPlanShapeOverlay {
  return {
    ownerKind: 'opening',
    ownerId: 'opening-1',
    polygon: [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 0.2 },
      { x: 2, y: 0.2 },
    ],
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: null,
    openingInteraction: makeOpeningInteraction(),
    deckDragEligibility: null,
    openingDragEligibility: { eligible: true, reason: 'Drag opening' },
    source: 'geometry',
    geometrySourceId: 'opening-1',
    renderStatus: 'geometry_ready',
  };
}

describe('openingMoveToolController', () => {
  it('matches opening adapter behavior for start, move, and release', () => {
    const start = startOpeningMoveTool(
      {
        openingId: 'opening-1',
        overlayShape: makeOpeningOverlay(),
        svgInteraction: {
          hostEdgeStart: { x: 0, y: 0 },
          hostEdgeEnd: { x: 10, y: 0 },
        },
      },
      makePointer({ x: 2, y: 0 }),
    );

    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const preview = moveOpeningMoveTool({
      session: start.session,
      pointer: makePointer({ x: 5, y: 0 }),
    });
    const release = releaseOpeningMoveTool({ session: start.session, preview });
    const adapterCommit = buildOpeningObjectPatchCommit({ session: start.session, preview });

    expect(preview.offsetAlongWallM).toBe(5);
    expect(preview.polygon).toEqual([
      { x: 5, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 0.2 },
      { x: 5, y: 0.2 },
    ]);
    expect(release.target).toEqual(adapterCommit.target);
    expect(release.patch).toEqual(adapterCommit.patch);
    expect(release.commitCoordinateSpace).toBe('legacy_plan_m');
  });
});
