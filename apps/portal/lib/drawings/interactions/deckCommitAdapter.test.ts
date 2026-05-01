import { describe, expect, it } from 'vitest';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanDeckReferenceFrame,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import {
  buildDeckDragSession,
  resolveDeckPreviewState,
} from './deckInteractionAdapter';
import {
  buildDeckCommitCoordinateTrace,
  buildDeckCommitPatch,
  resolveDeckCommitTransformDiagnostics,
} from './deckCommitAdapter';

function makeFrame(
  input: Partial<ObjectWorkbenchPlanDeckReferenceFrame> &
    Pick<
      ObjectWorkbenchPlanDeckReferenceFrame,
      | 'hostEdgeId'
      | 'sourceEdgeId'
      | 'axis'
      | 'hostEdgeStart'
      | 'hostEdgeEnd'
      | 'alongUnitX'
      | 'alongUnitY'
      | 'outwardUnitX'
      | 'outwardUnitY'
      | 'spanStartM'
      | 'spanEndM'
      | 'edgeCoordinateM'
      | 'outwardDirection'
    >,
): ObjectWorkbenchPlanDeckReferenceFrame {
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
  commitFrames?: ObjectWorkbenchPlanDeckReferenceFrame[];
  dragSource?: ObjectWorkbenchPlanDeckInteraction['dragSource'];
  dragCoordinateSpace?: ObjectWorkbenchPlanDeckInteraction['dragCoordinateSpace'];
}): ObjectWorkbenchPlanDeckInteraction {
  const primaryFrame = input.frames[0]!;
  const placement = input.placement ?? 'floating';
  return {
    kind: 'preset_rect',
    placement,
    attachmentMode: input.attachmentMode ?? (placement === 'snapped' ? 'single_edge' : 'floating'),
    houseAttachmentSide: 'rear',
    semanticPlacementSide: placement === 'snapped' ? 'rear' : null,
    semanticWitnessSide: 'rear',
    placementEdgeId: placement === 'snapped' ? primaryFrame.sourceEdgeId : null,
    primaryHostEdgeId: placement === 'snapped' ? primaryFrame.sourceEdgeId : null,
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
    dragPolygon: input.polygon,
    dragCenter: input.renderedCenter,
    dragCoordinateSpace: input.dragCoordinateSpace ?? 'top_projection_world_m',
    dragSource: input.dragSource ?? 'top_projection_committed',
    commitStartPolygon: null,
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
    }),
    openingInteraction: null,
    deckDragEligibility: { eligible: true, reason: 'Drag deck' },
    openingDragEligibility: null,
    source: 'top_projection_committed',
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
    throw new Error('Expected deck drag session.');
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

describe('deckCommitAdapter', () => {
  const objectRearFrame = makeFrame({
    hostEdgeId: 'rear',
    sourceEdgeId: 'footprint-edge-1',
    axis: 'along',
    spanStartM: 0,
    spanEndM: 6,
    edgeCoordinateM: 0,
    outwardDirection: 1,
    hostEdgeStart: { x: 0, y: 0 },
    hostEdgeEnd: { x: 6, y: 0 },
    alongUnitX: 1,
    alongUnitY: 0,
    outwardUnitX: 0,
    outwardUnitY: -1,
  });

  const projectedRearFrame = makeFrame({
    ...objectRearFrame,
    spanStartM: 10,
    spanEndM: 16,
    edgeCoordinateM: 20,
    hostEdgeStart: { x: 10, y: 20 },
    hostEdgeEnd: { x: 16, y: 20 },
  });

  it('maps a projection floating preview into object commit space before persisting a floating rect', () => {
    const polygon = rectOnFrame({
      frame: projectedRearFrame,
      deckWidthM: 2,
      deckDepthM: 1,
      centerOffsetM: 1,
      referenceEdgeGapM: 1.5,
    });
    const session = makeSession({
      polygon,
      startDragPlanPoint: pointOnFrame(projectedRearFrame, 14, 2),
      frames: [projectedRearFrame],
      commitFrames: [objectRearFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM: 2,
      deckDepthM: 1,
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
    const trace = buildDeckCommitCoordinateTrace({ session, preview });

    expect(preview.releasePlacement).toBe('floating');
    expect(trace.transform).toMatchObject({
      renderFrameId: 'footprint-edge-1',
      commitFrameId: 'footprint-edge-1',
      renderCoordinateSpace: 'top_projection_world_m',
      commitCoordinateSpace: 'object_frame_m',
      transformSource: 'top_projection_to_object_frame',
    });
    expect(trace.patch.floatingRect).toEqual({
      centerAlongM: '4',
      centerDepthM: '-2',
      widthM: '2',
      depthM: '1',
    });
    expect(trace.patch.floatingRect).not.toEqual({
      centerAlongM: '14',
      centerDepthM: '18',
      widthM: '2',
      depthM: '1',
    });
    expect(trace.commitSpacePolygon).not.toEqual(trace.releasePolygon);
    expect(trace.centroidDeltaM.previewToCommit).toEqual({ x: -10, y: -20 });
  });

  it('blocks projection-backed commits when no compatible object commit frame exists', () => {
    const incompatibleFrame = makeFrame({
      ...objectRearFrame,
      sourceEdgeId: 'object-left-edge',
      hostEdgeId: 'left',
      axis: 'depth',
      hostEdgeStart: { x: 0, y: 0 },
      hostEdgeEnd: { x: 0, y: 6 },
      alongUnitX: 0,
      alongUnitY: 1,
      outwardUnitX: 1,
      outwardUnitY: 0,
      outwardDirection: 1,
    });
    const polygon = rectOnFrame({
      frame: { ...projectedRearFrame, sourceEdgeId: 'projected-edge' },
      deckWidthM: 2,
      deckDepthM: 1,
      centerOffsetM: 1,
      referenceEdgeGapM: 1.5,
    });
    const session = makeSession({
      polygon,
      startDragPlanPoint: { x: 14, y: 18 },
      frames: [{ ...projectedRearFrame, sourceEdgeId: 'projected-edge' }],
      commitFrames: [incompatibleFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM: 2,
      deckDepthM: 1,
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

    expect(resolveDeckCommitTransformDiagnostics({ session, preview })).toMatchObject({
      renderFrameId: 'projected-edge',
      commitFrameId: null,
      transformSource: 'missing_frame',
    });
    expect(() => buildDeckCommitPatch({ session, preview })).toThrow('Deck projection commit frame is unavailable.');
    expect(() => buildDeckCommitCoordinateTrace({ session, preview })).toThrow(
      'Deck projection commit frame is unavailable.',
    );
  });

  it('commits snapped releases through the matched object host edge frame', () => {
    const polygon = rectOnFrame({
      frame: projectedRearFrame,
      deckWidthM: 2,
      deckDepthM: 1,
      centerOffsetM: 1,
      referenceEdgeGapM: 0,
    });
    const session = makeSession({
      polygon,
      startDragPlanPoint: pointOnFrame(projectedRearFrame, 14, 0.25),
      frames: [projectedRearFrame],
      commitFrames: [objectRearFrame],
      renderedCenter: polygonCenter(polygon),
      deckWidthM: 2,
      deckDepthM: 1,
      placement: 'snapped',
      attachmentMode: 'single_edge',
    });

    const preview = resolveDeckPreviewState({
      session,
      nextSvgX: session.startSvgX,
      nextSvgY: session.startSvgY,
      nextDragPlanPoint: session.startDragPlanPoint,
      previousPreviewState: null,
    });
    const trace = buildDeckCommitCoordinateTrace({ session, preview });

    expect(preview.releasePlacement).toBe('snapped');
    expect(trace.patch).toMatchObject({
      hostEdgeId: 'rear',
      primaryHostEdgeId: 'footprint-edge-1',
      isAttached: true,
      floatingRect: null,
    });
    expect(trace.patch.presetRect?.centerOffsetM).toBe('1');
    expect(trace.transform.transformSource).toBe('top_projection_to_object_frame');
  });
});
