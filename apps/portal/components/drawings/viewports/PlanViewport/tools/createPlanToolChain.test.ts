import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { createCommandBus } from '@/lib/drawings/commands/commandBus';
import { createReversibleCommand } from '@/lib/drawings/commands/createReversibleCommand';
import { createEdgeDragTool, type EdgeDragOutline } from './EdgeDragTool';
import { createMoveTool, type MoveRequest } from './MoveTool';
import { createSelectTool } from './SelectTool';
import { createPlanToolChain } from './createPlanToolChain';
import type { ToolPointerEvent } from './Tool';

// Integration test for the Plan viewport's tool chain. This test bypasses
// React (no JSDOM, no SVG) and wires the four tools directly the same way
// PlanViewport does, then drives pointer events through the composite tool.
// It catches the failure mode that escaped the per-tool unit suites: a
// move drag started via EdgeDragTool's fallthrough never received its
// pointer-move/up updates because the dispatcher routed only to the
// active tool. The composite tool fans those out to both child tools.
//
// See `docs/maintainability-principles.md` -- "integration tests at
// boundaries."

const RECT_OUTLINE: EdgeDragOutline = {
  id: 'pergola-1',
  family: 'pergolas',
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 2000 },
    { x: 0, y: 2000 },
  ],
};

function deckShape(id: string, family: 'house' | 'pergola' = 'house'): GeometryTopProjectionShape {
  return {
    id: `${id}-shape`,
    sourceObjectId: id,
    sourceId: id,
    sourceType: family === 'pergola' ? 'roof_plane' : 'house_surface_solid',
    family,
    kind: family === 'pergola' ? 'roof_plane' : 'deck',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
  };
}

function event(input: Partial<ToolPointerEvent> & Pick<ToolPointerEvent, 'point'>): ToolPointerEvent {
  return {
    shape: input.shape ?? null,
    point: input.point,
    button: input.button ?? 0,
    pointerId: input.pointerId ?? 1,
  };
}

function setup(opts: { activeOutline: EdgeDragOutline | null }) {
  const moveCommits: MoveRequest[] = [];
  const edgeCommits: Array<{ outlineId: string; deltaMm: number }> = [];
  const clearedSelections: number[] = [];

  const bus = createCommandBus();

  const selectTool = createSelectTool({
    onClearWorkbenchSelection: () => clearedSelections.push(Date.now()),
  });

  const moveTool = createMoveTool({
    canMoveTarget: () => true,
    commandBus: bus,
    dragThresholdMm: 5,
    commitMove: (request) => moveCommits.push(request),
    onPointerDownFallthrough: (event) => selectTool.onPointerDown?.(event),
  });

  const edgeDragTool = createEdgeDragTool({
    getActiveOutline: () => opts.activeOutline,
    onCommit: (commit) =>
      edgeCommits.push({ outlineId: commit.outlineId, deltaMm: 0 /* derived from polygon */ }),
    onPointerDownFallthrough: (event) => moveTool.onPointerDown?.(event),
  });

  const chain = createPlanToolChain({ edgeDragTool, moveTool });
  return { chain, bus, moveCommits, edgeCommits, clearedSelections };
}

describe('createPlanToolChain (integration)', () => {
  it('routes a click on an edge to EdgeDragTool and lets it commit a resize', () => {
    const { chain, edgeCommits } = setup({ activeOutline: RECT_OUTLINE });
    // Click within edge tolerance of the right edge (x=4000), then drag
    // outward by 500mm and release. EdgeDragTool should claim the click
    // and commit on pointer-up.
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 4050, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 4500, y: 1000 } }));
    chain.onPointerUp?.(event({ point: { x: 4500, y: 1000 } }));
    expect(edgeCommits).toHaveLength(1);
    expect(edgeCommits[0]?.outlineId).toBe('pergola-1');
  });

  it('routes a click far from any edge to MoveTool via fallthrough, and the chain forwards move/up so the drag commits', () => {
    // The bug this test guards: prior to the composite tool, EdgeDragTool's
    // onPointerDownFallthrough started a MoveTool session, but subsequent
    // pointermove/up events were routed to EdgeDragTool only (no session
    // there) and MoveTool's session never updated. Net effect: clicks on
    // the body started a "drag" that never committed.
    const { chain, moveCommits, bus } = setup({ activeOutline: RECT_OUTLINE });
    // Click inside the pergola body, well away from any edge.
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 2000, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 2300, y: 1000 } }));
    chain.onPointerUp?.(event({ point: { x: 2300, y: 1000 } }));
    expect(moveCommits).toEqual([
      { target: { family: 'pergola', targetId: 'pergola-1' }, delta: { x: 300, y: 0 }, snap: null },
    ]);
    expect(bus.snapshot().canUndo).toBe(true);
  });

  it('routes a click on an unrelated shape far from the active outline through Move when canMoveTarget allows', () => {
    // When canMoveTarget is permissive, a click on a non-edge target
    // becomes a move on that shape. (PlanViewport supplies a stricter
    // predicate that only allows the active object.) Pick a point well
    // outside the active outline's edge tolerance so EdgeDragTool falls
    // through; otherwise it would grab the click and start a resize.
    const { chain, moveCommits } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: deckShape('deck-1', 'house'), point: { x: 10000, y: 10000 } }));
    chain.onPointerMove?.(event({ point: { x: 10100, y: 10050 } }));
    chain.onPointerUp?.(event({ point: { x: 10100, y: 10050 } }));
    expect(moveCommits).toEqual([
      { target: { family: 'deck', targetId: 'deck-1' }, delta: { x: 100, y: 50 }, snap: null },
    ]);
  });

  it('routes a click on truly empty canvas (no shape) all the way to SelectTool via the chain', () => {
    const { chain, clearedSelections } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: null, point: { x: -500, y: -500 } }));
    expect(clearedSelections).toHaveLength(1);
  });

  it('undoes a move when bus.undo() is called after a move commit', () => {
    // Closes the loop: chain → MoveTool → CommandBus.apply → bus.undo()
    // calls the inverse, which runs commitMove with negated delta. This
    // is what Ctrl-Z does in PlanViewport. Use non-zero deltas on both
    // axes so the negation produces clean numbers (negating 0 yields -0
    // which isn't deeply equal to 0 under Object.is).
    const { chain, bus, moveCommits } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 2000, y: 1000 } }));
    chain.onPointerUp?.(event({ point: { x: 2200, y: 1100 } }));
    expect(bus.undo()).toBe(true);
    expect(moveCommits).toEqual([
      { target: { family: 'pergola', targetId: 'pergola-1' }, delta: { x: 200, y: 100 }, snap: null },
      { target: { family: 'pergola', targetId: 'pergola-1' }, delta: { x: -200, y: -100 }, snap: null },
    ]);
  });

  it('routes an edge-drag commit through CommandBus when the onCommit callback returns a ReversibleCommandInput, and undo restores prior state', () => {
    // Closes milestone 14: edge-drag commits land on the same CommandBus as
    // moves, so Ctrl-Z covers resize and translate uniformly. The wiring
    // mirrors `PlanViewport.tsx`: EdgeDragTool's `onCommit` invokes the host
    // (here: a stubbed handler that snapshots pre-edit state), and the
    // returned `ReversibleCommandInput` is pushed through the bus.
    const moveCommits: MoveRequest[] = [];
    const persistedDeck: { polygon: ReadonlyArray<{ x: number; y: number }> } = {
      polygon: RECT_OUTLINE.polygon,
    };
    const bus = createCommandBus();

    const selectTool = createSelectTool({});
    const moveTool = createMoveTool({
      canMoveTarget: () => true,
      commandBus: bus,
      dragThresholdMm: 5,
      commitMove: (request) => moveCommits.push(request),
      onPointerDownFallthrough: (event) => selectTool.onPointerDown?.(event),
    });

    const edgeDragTool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onCommit: (commit) => {
        // Capture the pre-edit polygon and the new polygon. Build a
        // reversible command so undo restores the original.
        const previousPolygon = persistedDeck.polygon;
        const nextPolygon = commit.nextPolygon;
        bus.apply(
          createReversibleCommand({
            label: 'Resize pergola',
            apply: () => {
              persistedDeck.polygon = nextPolygon;
            },
            invert: () => {
              persistedDeck.polygon = previousPolygon;
            },
          }),
        );
      },
      onPointerDownFallthrough: (event) => moveTool.onPointerDown?.(event),
    });

    const chain = createPlanToolChain({ edgeDragTool, moveTool });

    // Drag the right edge outward by 500mm. EdgeDragTool commits.
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 4050, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 4500, y: 1000 } }));
    chain.onPointerUp?.(event({ point: { x: 4500, y: 1000 } }));

    expect(persistedDeck.polygon).not.toBe(RECT_OUTLINE.polygon);
    expect(bus.snapshot().canUndo).toBe(true);
    expect(bus.snapshot().lastApplied).toBe('Resize pergola');

    bus.undo();
    expect(persistedDeck.polygon).toBe(RECT_OUTLINE.polygon);
    expect(bus.snapshot().canUndo).toBe(false);
    expect(bus.snapshot().canRedo).toBe(true);

    bus.redo();
    expect(persistedDeck.polygon).not.toBe(RECT_OUTLINE.polygon);
  });

  it('cancel mid-move discards the drag without firing onCommit (Esc behaviour)', () => {
    // PlanViewport binds Escape -> activeTool.onCancel(). The chain's
    // onCancel propagates to MoveTool, which clears its session. A
    // subsequent pointer-up does NOT commit because the session is gone --
    // so the host never receives a request and no patch is written. This
    // is the contract the Esc keybind relies on.
    const { chain, moveCommits, bus } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 2000, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 2300, y: 1000 } }));
    // User presses Esc mid-drag.
    chain.onCancel?.();
    // Mouse-up arrives after Esc -- no commit, no command on the bus.
    chain.onPointerUp?.(event({ point: { x: 2400, y: 1000 } }));
    expect(moveCommits).toEqual([]);
    expect(bus.snapshot().canUndo).toBe(false);
  });

  it('cancel mid-edge-drag discards the resize without firing onCommit', () => {
    // Same contract for EdgeDragTool. A pointer-down on an edge starts a
    // resize session; cancel clears it; pointer-up afterwards doesn't
    // commit a polygon change.
    const { chain, edgeCommits } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 4050, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 4500, y: 1000 } }));
    chain.onCancel?.();
    chain.onPointerUp?.(event({ point: { x: 4500, y: 1000 } }));
    expect(edgeCommits).toEqual([]);
  });

  it('cancel propagates to both child tools so neither leaves a stale session', () => {
    const { chain, moveCommits } = setup({ activeOutline: RECT_OUTLINE });
    chain.onPointerDown?.(event({ shape: deckShape('pergola-1', 'pergola'), point: { x: 2000, y: 1000 } }));
    chain.onPointerMove?.(event({ point: { x: 2200, y: 1000 } }));
    chain.onCancel?.();
    chain.onPointerUp?.(event({ point: { x: 2400, y: 1000 } }));
    // After cancel, no commit should fire even when pointer-up arrives.
    expect(moveCommits).toEqual([]);
  });
});
