import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { makeObjectFirstWorkbenchProjectFixture } from '@/lib/drawings/state/objectFirstWorkbenchFixtures';
import {
  buildDeckCommitPatch,
  buildDeckDragSession,
  buildDeckObjectPatchCommit,
  resolveDeckPreviewState,
} from './deckInteractionAdapter';

function makeFrame(input: Partial<ObjectWorkbenchPlanDeckReferenceFrame> & Pick<ObjectWorkbenchPlanDeckReferenceFrame, 'hostEdgeId' | 'sourceEdgeId' | 'axis' | 'hostEdgeStart' | 'hostEdgeEnd' | 'alongUnitX' | 'alongUnitY' | 'outwardUnitX' | 'outwardUnitY' | 'spanStartM' | 'spanEndM' | 'edgeCoordinateM' | 'outwardDirection'>): ObjectWorkbenchPlanDeckReferenceFrame {
  return input;
}

function makeInteraction(input: {
  polygon: PlanPoint[];
  frames: ObjectWorkbenchPlanDeckReferenceFrame[];
  deckWidthM: number;
  deckDepthM: number;
  renderedCenter: PlanPoint;
  placement?: 'snapped' | 'floating';
  attachmentMode?: 'floating' | 'single_edge' | 'corner_dual_edge';
  primaryHostEdgeId?: string | null;
  commitFrames?: ObjectWorkbenchPlanDeckReferenceFrame[];
  commitStartPolygon?: PlanPoint[] | null;
}): ObjectWorkbenchPlanDeckInteraction {
  const primaryFrame = input.frames[0]!;
  return {
    kind: 'preset_rect',
    placement: input.placement ?? 'snapped',
    attachmentMode: input.attachmentMode ?? 'single_edge',
    houseAttachmentSide: 'rear',
    semanticPlacementSide: (input.placement ?? 'snapped') === 'snapped' ? 'rear' : null,
    semanticWitnessSide: 'rear',
    placementEdgeId: (input.placement ?? 'snapped') === 'snapped' ? primaryFrame.sourceEdgeId : null,
    primaryHostEdgeId:
      (input.placement ?? 'snapped') === 'snapped'
        ? input.primaryHostEdgeId ?? primaryFrame.sourceEdgeId
        : null,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    witnessEdgeId: primaryFrame.sourceEdgeId,
    hostEdgeStart: primaryFrame.hostEdgeStart,
    hostEdgeEnd: primaryFrame.hostEdgeEnd,
    hostSpanM: primaryFrame.spanEndM - primaryFrame.spanStartM,
    deckWidthM: input.deckWidthM,
    deckDepthM: input.deckDepthM,
    centerOffsetM: 0,
    referenceEdgeGapM: 0,
    minCenterOffsetM: -20,
    maxCenterOffsetM: 20,
    renderedCenter: input.renderedCenter,
    commitStartPolygon: input.commitStartPolygon ?? null,
    referenceFrames: input.frames,
    commitReferenceFrames: input.commitFrames ?? input.frames,
    crossEdgeReference: null,
  };
}

function makeSession(input: {
  polygon: PlanPoint[];
  startDragPlanPoint: PlanPoint;
  frames: ObjectWorkbenchPlanDeckReferenceFrame[];
  renderedCenter: PlanPoint;
  deckWidthM: number;
  deckDepthM: number;
  placement?: 'snapped' | 'floating';
  attachmentMode?: 'floating' | 'single_edge' | 'corner_dual_edge';
  commitFrames?: ObjectWorkbenchPlanDeckReferenceFrame[];
  commitStartPolygon?: PlanPoint[] | null;
}) {
  const overlayShape = {
    ownerKind: 'deck',
    ownerId: 'deck-1',
    polygon: input.polygon,
    detailSegments: [],
    selected: true,
    custom: false,
    muted: false,
    invalid: false,
    invalidMessage: null,
    deckInteraction: makeInteraction({
      polygon: input.polygon,
      frames: input.frames,
      deckWidthM: input.deckWidthM,
      deckDepthM: input.deckDepthM,
      renderedCenter: input.renderedCenter,
      placement: input.placement,
      attachmentMode: input.attachmentMode,
      commitFrames: input.commitFrames,
      commitStartPolygon: input.commitStartPolygon,
    }),
    openingInteraction: null,
    deckDragEligibility: { eligible: true, reason: 'Drag deck' },
    openingDragEligibility: null,
    source: 'geometry',
    geometrySourceId: 'deck-1',
    renderStatus: 'geometry_ready',
  } satisfies ObjectWorkbenchPlanShapeOverlay;

  const session = buildDeckDragSession({
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    startSvgX: input.startDragPlanPoint.x,
    startSvgY: input.startDragPlanPoint.y,
    startDragPlanPoint: input.startDragPlanPoint,
    deckId: 'deck-1',
    overlayShape,
    svgInteraction: {
      hostEdgeStart: input.frames[0]!.hostEdgeStart,
      hostEdgeEnd: input.frames[0]!.hostEdgeEnd,
    },
  });
  if (!session) {
    throw new Error('Expected drag session.');
  }
  return session;
}

function pointOnFrame(
  frame: ObjectWorkbenchPlanDeckReferenceFrame,
  alongM: number,
  outwardM: number,
): PlanPoint {
  return {
    x: frame.hostEdgeStart.x + frame.alongUnitX * (alongM - frame.spanStartM) + frame.outwardUnitX * outwardM,
    y: frame.hostEdgeStart.y + frame.alongUnitY * (alongM - frame.spanStartM) + frame.outwardUnitY * outwardM,
  };
}

function rectOnFrame(input: {
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
  deckWidthM: number;
  deckDepthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
}): PlanPoint[] {
  const edgeMidpointM = (input.frame.spanStartM + input.frame.spanEndM) / 2;
  const centerAlongM = edgeMidpointM + input.centerOffsetM;
  const nearAlongM = centerAlongM - input.deckWidthM / 2;
  const farAlongM = centerAlongM + input.deckWidthM / 2;
  const nearOutM = input.referenceEdgeGapM;
  const farOutM = nearOutM + input.deckDepthM;
  if (input.frame.outwardDirection < 0) {
    return [
      pointOnFrame(input.frame, nearAlongM, farOutM),
      pointOnFrame(input.frame, farAlongM, farOutM),
      pointOnFrame(input.frame, farAlongM, nearOutM),
      pointOnFrame(input.frame, nearAlongM, nearOutM),
    ];
  }
  return [
    pointOnFrame(input.frame, nearAlongM, nearOutM),
    pointOnFrame(input.frame, farAlongM, nearOutM),
    pointOnFrame(input.frame, farAlongM, farOutM),
    pointOnFrame(input.frame, nearAlongM, farOutM),
  ];
}

function polygonCenter(polygon: PlanPoint[]): PlanPoint {
  return polygon.reduce(
    (center, point) => ({
      x: center.x + point.x / polygon.length,
      y: center.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
}

function nearGapToFrame(polygon: PlanPoint[], frame: ObjectWorkbenchPlanDeckReferenceFrame): number {
  return Math.max(
    0,
    Math.min(
      ...polygon.map(
        (point) =>
          (point.x - frame.hostEdgeStart.x) * frame.outwardUnitX +
          (point.y - frame.hostEdgeStart.y) * frame.outwardUnitY,
      ),
    ),
  );
}

describe('deckInteractionAdapter', () => {
  const rearFrame = makeFrame({
    hostEdgeId: 'rear',
    sourceEdgeId: 'footprint-edge-1',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 4,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 4, y: 0 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: 1,
  });
  const leftFrame = makeFrame({
    hostEdgeId: 'left',
    sourceEdgeId: 'footprint-edge-4',
    axis: 'depth',
    spanStartM: 0,
    spanEndM: 3,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 0, y: 3 },
    alongUnitX: 0,
    alongUnitY: 1,
    outwardUnitX: 1,
    outwardUnitY: 0,
  });
  const realRearFrame = makeFrame({
    hostEdgeId: 'rear',
    sourceEdgeId: 'footprint-edge-1',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 6,
    edgeCoordinateM: 0,
    outwardDirection: -1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 6, y: 0 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: -1,
  });
  const realRightFrame = makeFrame({
    hostEdgeId: 'right',
    sourceEdgeId: 'footprint-edge-2',
    axis: 'depth',
    spanStartM: 0,
    spanEndM: 2.4,
    edgeCoordinateM: 6,
    outwardDirection: 1,
    hostEdgeStart: { x: 6, y: 0 },
    hostEdgeEnd: { x: 6, y: 2.4 },
    alongUnitX: 0,
    alongUnitY: 1,
    outwardUnitX: 1,
    outwardUnitY: 0,
  });
  const realFrontFrame = makeFrame({
    hostEdgeId: 'front',
    sourceEdgeId: 'footprint-edge-3',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 6,
    edgeCoordinateM: 2.4,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 2.4 },
    hostEdgeEnd: { x: 6, y: 2.4 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: 1,
  });
  const realLeftFrame = makeFrame({
    hostEdgeId: 'left',
    sourceEdgeId: 'footprint-edge-4',
    axis: 'depth',
    spanStartM: 0,
    spanEndM: 2.4,
    edgeCoordinateM: 0,
    outwardDirection: -1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 0, y: 2.4 },
    alongUnitX: 0,
    alongUnitY: 1,
    outwardUnitX: -1,
    outwardUnitY: 0,
  });

  it.each([
    ['rear', realRearFrame],
    ['front', realFrontFrame],
    ['left', realLeftFrame],
    ['right', realRightFrame],
  ])('draws snap-available release previews as attached geometry on the %s wall', (_label, frame) => {
    const deckWidthM = 3;
    const deckDepthM = 2;
    const centerOffsetM = 0.4;
    const initialGapM = 0.12;
    const polygon = rectOnFrame({
      frame,
      deckWidthM,
      deckDepthM,
      centerOffsetM,
      referenceEdgeGapM: initialGapM,
    });
    const edgeMidpointM = (frame.spanStartM + frame.spanEndM) / 2;
    const startDragPlanPoint = pointOnFrame(frame, edgeMidpointM + centerOffsetM - 0.6, initialGapM + 0.5);
    const session = makeSession({
      polygon,
      startDragPlanPoint,
      frames: [frame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM,
      deckDepthM,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });
    const commit = buildDeckObjectPatchCommit({ session, preview });

    expect(session.objectRef).toEqual({ family: 'decks', objectId: 'deck-1' });
    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.placement).toBe('floating');
    expect(preview.referenceEdgeGapM).toBe(0);
    expect(nearGapToFrame(preview.polygon, frame)).toBeCloseTo(0, 6);
    expect(preview.previewAnchor.x).toBeCloseTo(startDragPlanPoint.x, 6);
    expect(preview.previewAnchor.y).toBeCloseTo(startDragPlanPoint.y, 6);
    expect(patch.hostEdgeId).toBe(frame.hostEdgeId);
    expect(patch.primaryHostEdgeId).toBe(frame.sourceEdgeId);
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('0.4');
    expect(commit).toEqual({
      target: { family: 'decks', objectId: 'deck-1' },
      patch,
    });
  });

  it('maps floating release previews back into the object commit polygon space', () => {
    const renderedPolygon = [
      { x: 0, y: -4 },
      { x: 8, y: -4 },
      { x: 8, y: 0 },
      { x: 0, y: 0 },
    ];
    const commitStartPolygon = [
      { x: 0, y: -2 },
      { x: 4, y: -2 },
      { x: 4, y: 0 },
      { x: 0, y: 0 },
    ];
    const session = makeSession({
      polygon: renderedPolygon,
      startDragPlanPoint: { x: 4, y: -2 },
      frames: [realRearFrame],
      renderedCenter: { x: 4, y: -2 },
      deckWidthM: 4,
      deckDepthM: 2,
      placement: 'floating',
      attachmentMode: 'floating',
      commitStartPolygon,
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: { x: 6, y: -4 },
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });

    expect(preview.releasePlacement).toBe('floating');
    expect(patch.floatingRect).toEqual({
      centerAlongM: '3',
      centerDepthM: '-2',
      widthM: '4',
      depthM: '2',
    });
  });

  it('commits snapped releases through draft reference frames when render frame ids differ', () => {
    const renderFrame = {
      ...realLeftFrame,
      sourceEdgeId: 'geometry-left-wall',
    };
    const commitFrame = {
      ...realLeftFrame,
      sourceEdgeId: 'footprint-edge-7',
      spanStartM: 4,
      spanEndM: 6.4,
      edgeCoordinateM: 0.4,
      hostEdgeStart: { x: 0.4, y: 0 },
      hostEdgeEnd: { x: 0.4, y: 2.4 },
    };
    const deckWidthM = 1.4;
    const deckDepthM = 2;
    const centerOffsetM = 0.25;
    const initialGapM = 0.12;
    const polygon = rectOnFrame({
      frame: renderFrame,
      deckWidthM,
      deckDepthM,
      centerOffsetM,
      referenceEdgeGapM: initialGapM,
    });
    const edgeMidpointM = (renderFrame.spanStartM + renderFrame.spanEndM) / 2;
    const startDragPlanPoint = pointOnFrame(renderFrame, edgeMidpointM + centerOffsetM, initialGapM + 0.4);
    const session = makeSession({
      polygon,
      startDragPlanPoint,
      frames: [renderFrame],
      commitFrames: [commitFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM,
      deckDepthM,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('geometry-left-wall');
    expect(nearGapToFrame(preview.polygon, renderFrame)).toBeCloseTo(0, 6);
    expect(nearGapToFrame(preview.polygon, commitFrame)).toBeGreaterThan(0.35);
    expect(patch.hostEdgeId).toBe('left');
    expect(patch.primaryHostEdgeId).toBe('footprint-edge-7');
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('0.25');
  });

  it('ignores an opposite-side commit frame even when its source id matches the render frame', () => {
    const renderFrame = {
      ...realLeftFrame,
      sourceEdgeId: 'geometry-left-wall',
    };
    const oppositeExactCommitFrame = {
      ...realRightFrame,
      sourceEdgeId: 'geometry-left-wall',
    };
    const compatibleCommitFrame = {
      ...realLeftFrame,
      sourceEdgeId: 'footprint-edge-7',
      spanStartM: 4,
      spanEndM: 6.4,
      edgeCoordinateM: 0.4,
      hostEdgeStart: { x: 0.4, y: 0 },
      hostEdgeEnd: { x: 0.4, y: 2.4 },
    };
    const deckWidthM = 1.4;
    const deckDepthM = 2;
    const centerOffsetM = 0.25;
    const initialGapM = 0.12;
    const polygon = rectOnFrame({
      frame: renderFrame,
      deckWidthM,
      deckDepthM,
      centerOffsetM,
      referenceEdgeGapM: initialGapM,
    });
    const edgeMidpointM = (renderFrame.spanStartM + renderFrame.spanEndM) / 2;
    const startDragPlanPoint = pointOnFrame(renderFrame, edgeMidpointM + centerOffsetM, initialGapM + 0.4);
    const session = makeSession({
      polygon,
      startDragPlanPoint,
      frames: [renderFrame],
      commitFrames: [oppositeExactCommitFrame, compatibleCommitFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM,
      deckDepthM,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('geometry-left-wall');
    expect(patch.hostEdgeId).toBe('left');
    expect(patch.primaryHostEdgeId).toBe('footprint-edge-7');
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('0.25');
  });

  it('chooses the same-wall commit segment that contains the release preview center', () => {
    const renderFrame = {
      ...realRearFrame,
      sourceEdgeId: 'geometry-rear-wall',
    };
    const firstCommitSegment = {
      ...realRearFrame,
      sourceEdgeId: 'footprint-edge-1',
      spanStartM: 0,
      spanEndM: 3,
      hostEdgeStart: { x: 0, y: 0 },
      hostEdgeEnd: { x: 3, y: 0 },
    };
    const secondCommitSegment = {
      ...realRearFrame,
      sourceEdgeId: 'footprint-edge-2',
      spanStartM: 3,
      spanEndM: 6,
      hostEdgeStart: { x: 3, y: 0 },
      hostEdgeEnd: { x: 6, y: 0 },
    };
    const deckWidthM = 1.2;
    const deckDepthM = 1.8;
    const centerOffsetM = 1.5;
    const initialGapM = 0.12;
    const polygon = rectOnFrame({
      frame: renderFrame,
      deckWidthM,
      deckDepthM,
      centerOffsetM,
      referenceEdgeGapM: initialGapM,
    });
    const edgeMidpointM = (renderFrame.spanStartM + renderFrame.spanEndM) / 2;
    const startDragPlanPoint = pointOnFrame(renderFrame, edgeMidpointM + centerOffsetM, initialGapM + 0.4);
    const session = makeSession({
      polygon,
      startDragPlanPoint,
      frames: [renderFrame],
      commitFrames: [firstCommitSegment, secondCommitSegment],
      renderedCenter: polygonCenter(polygon),
      deckWidthM,
      deckDepthM,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('geometry-rear-wall');
    expect(patch.hostEdgeId).toBe('rear');
    expect(patch.primaryHostEdgeId).toBe('footprint-edge-2');
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('0');
  });

  it('commits snapped offsets by preview world center when render and commit spans differ', () => {
    const renderFrame = {
      ...realRearFrame,
      sourceEdgeId: 'geometry-rear-wall',
      spanStartM: 0,
      spanEndM: 8,
      hostEdgeStart: { x: 0, y: 0 },
      hostEdgeEnd: { x: 8, y: 0 },
    };
    const commitFrame = {
      ...realRearFrame,
      sourceEdgeId: 'footprint-edge-1',
      spanStartM: 2,
      spanEndM: 6,
      hostEdgeStart: { x: 2, y: 0 },
      hostEdgeEnd: { x: 6, y: 0 },
    };
    const deckWidthM = 1.2;
    const deckDepthM = 1.8;
    const centerOffsetM = 1;
    const initialGapM = 0.12;
    const polygon = rectOnFrame({
      frame: renderFrame,
      deckWidthM,
      deckDepthM,
      centerOffsetM,
      referenceEdgeGapM: initialGapM,
    });
    const edgeMidpointM = (renderFrame.spanStartM + renderFrame.spanEndM) / 2;
    const startDragPlanPoint = pointOnFrame(renderFrame, edgeMidpointM + centerOffsetM, initialGapM + 0.4);
    const session = makeSession({
      polygon,
      startDragPlanPoint,
      frames: [renderFrame],
      commitFrames: [commitFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM,
      deckDepthM,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({ session, preview });

    expect(preview.releasePlacement).toBe('snapped');
    expect(patch.primaryHostEdgeId).toBe('footprint-edge-1');
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('1');
  });

  it('does not trigger corner mode just because a wide deck overlaps a second wall span', () => {
    const polygon = [
      { x: -0.45, y: 0 },
      { x: 4.55, y: 0 },
      { x: 4.55, y: 2 },
      { x: -0.45, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 4.5, y: 0.08 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2.05, y: 1 },
      deckWidthM: 5,
      deckDepthM: 2,
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });

    expect(preview.attachmentMode).toBe('single_edge');
    expect(preview.secondaryHostEdgeId).toBeNull();
    expect(preview.lockedCornerPoint).toBeNull();
  });

  it('locks corner mode from the held deck corner and preserves it through small jitter', () => {
    const polygon = [
      { x: -0.08, y: 0 },
      { x: 4.92, y: 0 },
      { x: 4.92, y: 2 },
      { x: -0.08, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: -0.06, y: 0.04 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2.42, y: 1 },
      deckWidthM: 5,
      deckDepthM: 2,
    });

    const firstPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const jitteredPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX + 0.12,
      nextSvgY: session.startSvgY + 0.1,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x + 0.12,
        y: session.startDragPlanPoint!.y + 0.1,
      },
      previousPreviewState: firstPreview,
    });

    expect(firstPreview.attachmentMode).toBe('corner_dual_edge');
    expect(firstPreview.lockedCornerPoint).toEqual({ x: 0, y: 0 });
    expect(firstPreview.secondaryHostEdgeId).toBe('footprint-edge-4');
    expect(jitteredPreview.attachmentMode).toBe('corner_dual_edge');
    expect(jitteredPreview.cornerVertexId).toBe(firstPreview.cornerVertexId);
    expect(jitteredPreview.heldCornerIndex).toBe(firstPreview.heldCornerIndex);
  });

  it('keeps a stable wall-face preview on the same target through small jitter near the corner', () => {
    const polygon = [
      { x: -0.28, y: 0.1 },
      { x: 4.72, y: 0.1 },
      { x: 4.72, y: 2.1 },
      { x: -0.28, y: 2.1 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 4.5, y: 0.24 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2.22, y: 1.1 },
      deckWidthM: 5,
      deckDepthM: 2,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const firstPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const jitteredPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX - 0.04,
      nextSvgY: session.startSvgY + 0.03,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x - 0.04,
        y: session.startDragPlanPoint!.y + 0.03,
      },
      previousPreviewState: firstPreview,
    });

    expect(firstPreview.activeSnapMode).toBe('single_edge');
    expect(firstPreview.snapTargetState).toBe('stable');
    expect(firstPreview.attachmentMode).toBe('single_edge');
    expect(firstPreview.previewWallFrameId).toBe(firstPreview.activePrimaryTargetId);
    expect(firstPreview.wallTargetStability).toBe('stable');
    expect(jitteredPreview.activePrimaryTargetId).toBe(firstPreview.activePrimaryTargetId);
    expect(jitteredPreview.attachmentMode).toBe('single_edge');
    expect(jitteredPreview.snapTargetState).toBe('locked');
    expect(jitteredPreview.previewWallFrameId).toBe(firstPreview.previewWallFrameId);
    expect(jitteredPreview.heldCornerIndex).toBe(firstPreview.heldCornerIndex);
  });

  it('softly aligns oversized single-edge decks to wall ends without clamping them to the span', () => {
    const polygon = [
      { x: 0.06, y: 0 },
      { x: 6.06, y: 0 },
      { x: 6.06, y: 2 },
      { x: 0.06, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 3.2, y: 0.08 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 3.06, y: 1 },
      deckWidthM: 6,
      deckDepthM: 2,
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });

    expect(preview.attachmentMode).toBe('single_edge');
    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.endCatchSide).toBe('start');
    expect(preview.endCatchPoint).toEqual(rearFrame.hostEdgeStart);
    expect(preview.centerOffsetM).toBe(1);
  });

  it('keeps the exact grabbed point under the cursor while dragging along the same attached wall', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 1.3, y: 1.1 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2, y: 1 },
      deckWidthM: 4,
      deckDepthM: 2,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX - 0.9,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x - 0.9,
        y: session.startDragPlanPoint!.y,
      },
      previousPreviewState: null,
    });

    expect(preview.snapTargetState).toBe('locked');
    expect(preview.previewAnchor.x).toBeCloseTo(0.4, 6);
    expect(preview.previewAnchor.y).toBeCloseTo(1.1, 6);
    expect(preview.grabbedPlanPoint.x).toBeCloseTo(preview.previewAnchor.x, 6);
    expect(preview.grabbedPlanPoint.y).toBeCloseTo(preview.previewAnchor.y, 6);
    expect(preview.centerOffsetM).toBeCloseTo(-0.9, 6);
  });

  it('autorotates the preview body onto a stable wall candidate before release', () => {
    const polygon = [
      { x: 1, y: 0.6 },
      { x: 5, y: 0.6 },
      { x: 5, y: 3.6 },
      { x: 1, y: 3.6 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 1.1, y: 0.7 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 3, y: 2.1 },
      deckWidthM: 4,
      deckDepthM: 3,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY - 0.48,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x,
        y: session.startDragPlanPoint!.y - 0.48,
      },
      previousPreviewState: null,
    });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.placement).toBe('floating');
    expect(preview.snapTargetState).toBe('stable');
    expect(preview.wallTargetStability).toBe('stable');
    expect(preview.polygon[0]).toEqual({ x: 1, y: 0 });
    expect(preview.previewAnchor.x).toBeCloseTo(1.1, 6);
    expect(preview.previewAnchor.y).toBeCloseTo(0.22, 6);
    expect(preview.referenceGuide?.state).toBe('snap-lane');
  });

  it('derives attached commit offset from the held-corner preview instead of snapping back to center projection', () => {
    const polygon = [
      { x: 1, y: 0.6 },
      { x: 5, y: 0.6 },
      { x: 5, y: 3.6 },
      { x: 1, y: 3.6 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 1.1, y: 0.7 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 3, y: 2.1 },
      deckWidthM: 4,
      deckDepthM: 3,
      placement: 'floating',
      attachmentMode: 'floating',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY - 0.48,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x,
        y: session.startDragPlanPoint!.y - 0.48,
      },
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({
      session,
      preview,
    });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.anchorDerivedCenterOffsetM).toBe(1);
    expect(patch.hostEdgeId).toBe('rear');
    expect(patch.primaryHostEdgeId).toBe('footprint-edge-1');
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('1');
  });

  it('commits the exact same-wall overhang that was shown at release instead of mirroring to the far end', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 1.3, y: 1.1 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2, y: 1 },
      deckWidthM: 4,
      deckDepthM: 2,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX - 1.6,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x - 1.6,
        y: session.startDragPlanPoint!.y,
      },
      previousPreviewState: null,
    });
    const patch = buildDeckCommitPatch({
      session,
      preview,
    });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('footprint-edge-1');
    expect(preview.centerOffsetM).toBeCloseTo(-1.6, 6);
    expect((patch.presetRect as { centerOffsetM: string }).centerOffsetM).toBe('-1.6');
  });

  it('can hand off live from the current snapped wall to the adjacent wall without detaching first', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 0.1, y: 0.7 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2, y: 1.5 },
      deckWidthM: 4,
      deckDepthM: 3,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY + 0.9,
      nextDragPlanPoint: {
        x: session.startDragPlanPoint!.x,
        y: session.startDragPlanPoint!.y + 0.9,
      },
      previousPreviewState: null,
    });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('footprint-edge-4');
    expect(preview.previewWallFrameId).toBe('footprint-edge-4');
    expect(preview.placement).toBe('floating');
    expect(preview.snapTargetState).toBe('stable');
  });

  it('keeps a snapped deck attached during a very large along-wall drag while it stays flush to the same wall', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 50, y: 50 },
      frames: [rearFrame, leftFrame],
      renderedCenter: { x: 2, y: 1.5 },
      deckWidthM: 4,
      deckDepthM: 3,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: -250,
      nextSvgY: 50,
      nextDragPlanPoint: { x: -250, y: 50 },
      previousPreviewState: null,
    });

    expect(preview.releasePlacement).toBe('snapped');
    expect(preview.placement).toBe('snapped');
    expect(preview.primaryHostEdgeId).toBe('footprint-edge-1');
    expect(preview.snapTargetState).toBe('locked');
  });

  it('keeps deck drag state stable while object-first fixtures preserve authored deck ids', () => {
    const objectFirstProject = makeObjectFirstWorkbenchProjectFixture('touching_merged_forms');
    const polygon = rectOnFrame({
      frame: realRearFrame,
      deckWidthM: 4,
      deckDepthM: 2,
      centerOffsetM: 0,
      referenceEdgeGapM: 0,
    });
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 2, y: -1 },
      frames: [realRearFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM: 4,
      deckDepthM: 2,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const firstPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX + 0.15,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: { x: session.startDragPlanPoint!.x + 0.15, y: session.startDragPlanPoint!.y },
      previousPreviewState: null,
    });
    const secondPreview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX + 0.2,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: { x: session.startDragPlanPoint!.x + 0.2, y: session.startDragPlanPoint!.y },
      previousPreviewState: firstPreview,
    });
    const patch = buildDeckCommitPatch({ session, preview: secondPreview });

    expect(objectFirstProject.decks.map((deck) => deck.id)).toEqual(['deck-a']);
    expect(firstPreview.primaryHostEdgeId).toBe('footprint-edge-1');
    expect(secondPreview.primaryHostEdgeId).toBe(firstPreview.primaryHostEdgeId);
    expect(secondPreview.snapTargetState).toBe('locked');
    expect(patch.hostEdgeId).toBe('rear');
  });
});
