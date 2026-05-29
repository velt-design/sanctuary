import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { createCommandBus } from '@/lib/drawings/commands/commandBus';
import {
  createMoveCommand,
  createMoveTool,
  moveTargetFromShape,
  type MoveRequest,
  type MoveTargetFamily,
  type MoveToolPreview,
} from './MoveTool';
import type { ToolPointerEvent } from './Tool';

function deckShape(id: string): GeometryTopProjectionShape {
  return {
    id: `${id}-shape`,
    sourceObjectId: id,
    sourceId: id,
    sourceType: 'house_surface_solid',
    family: 'house',
    kind: 'deck',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
  };
}

function openingShape(id: string): GeometryTopProjectionShape {
  return {
    id: `${id}-shape`,
    sourceObjectId: id,
    sourceId: id,
    sourceType: 'house_surface',
    family: 'house',
    kind: 'opening_marker',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
  };
}

function pergolaShape(id: string): GeometryTopProjectionShape {
  return {
    id: `${id}-shape`,
    sourceObjectId: id,
    sourceId: id,
    sourceType: 'roof_plane',
    family: 'pergola',
    kind: 'roof_plane',
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

describe('moveTargetFromShape', () => {
  it('classifies a deck shape as deck family', () => {
    expect(moveTargetFromShape(deckShape('deck-1'))).toEqual({ family: 'deck', targetId: 'deck-1' });
  });

  it('classifies an opening_marker as opening family', () => {
    expect(moveTargetFromShape(openingShape('opening-2'))).toEqual({
      family: 'opening',
      targetId: 'opening-2',
    });
  });

  it('classifies a pergola roof_plane as pergola family', () => {
    expect(moveTargetFromShape(pergolaShape('pergola-A'))).toEqual({
      family: 'pergola',
      targetId: 'pergola-A',
    });
  });

  it('classifies a house footprint as house_form family (PR11)', () => {
    // PR8c-iii emits `house_reference` shapes with `family: 'house',
    // kind: 'footprint'` for every form. PR11 makes the footprint a
    // movable target so the user can drag-to-reposition any house form.
    // The classifier doesn't decide which form is active -- that's the
    // host's `canMoveTarget` predicate.
    expect(
      moveTargetFromShape({
        id: 'house_reference:house-form-2',
        sourceObjectId: 'house-form-2',
        sourceId: 'house-form-2',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
        polygon: [],
        zOrder: 0,
        zMin: 0,
        zMax: 0,
      }),
    ).toEqual({ family: 'house_form', targetId: 'house-form-2' });
  });

  it('returns null for unhandled families (e.g. reference)', () => {
    expect(
      moveTargetFromShape({
        id: 'ref',
        sourceObjectId: 'ref',
        sourceId: 'ref',
        sourceType: 'reference_line',
        family: 'reference',
        kind: 'roof_outline',
        polygon: [],
        zOrder: 0,
        zMin: null,
        zMax: null,
      }),
    ).toBeNull();
  });
});

describe('createMoveCommand', () => {
  it('applies the request and inverts the delta on undo', () => {
    const log: MoveRequest[] = [];
    const command = createMoveCommand({
      request: { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: 100, y: 50 }, snap: null },
      commitMove: (request) => log.push(request),
    });
    command.apply();
    command.invert().apply();
    expect(log).toEqual([
      { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: 100, y: 50 }, snap: null },
      { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: -100, y: -50 }, snap: null },
    ]);
  });

  it('builds a label including the family and target id', () => {
    expect(
      createMoveCommand({
        request: { target: { family: 'opening', targetId: 'opening-3' }, delta: { x: 0, y: 0 }, snap: null },
        commitMove: () => undefined,
      }).label,
    ).toBe('Move opening opening-3');
  });

  it('routes inverse application through invertMove when provided', () => {
    const apply: string[] = [];
    const invert: string[] = [];
    const cmd = createMoveCommand({
      request: { target: { family: 'pergola', targetId: 'pergola-A' }, delta: { x: 5, y: 5 }, snap: null },
      commitMove: ({ delta }) => apply.push(`${delta.x},${delta.y}`),
      invertMove: ({ delta }) => invert.push(`${delta.x},${delta.y}`),
    });
    cmd.apply();
    cmd.invert().apply();
    expect(apply).toEqual(['5,5']);
    expect(invert).toEqual(['-5,-5']);
  });
});

describe('createMoveTool', () => {
  function setup(acceptedFamilies: ReadonlyArray<MoveTargetFamily> = ['deck']) {
    const accepted = new Set<MoveTargetFamily>(acceptedFamilies);
    const bus = createCommandBus();
    const commits: MoveRequest[] = [];
    const previews: Array<MoveToolPreview | null> = [];
    const tool = createMoveTool({
      // The unified `canMoveTarget` predicate. The setup helper still takes
      // `acceptedFamilies` for ergonomic test wiring; internally that's
      // expressed as the single predicate the tool actually consumes.
      canMoveTarget: (target) => accepted.has(target.family),
      commandBus: bus,
      dragThresholdMm: 4,
      commitMove: (request) => commits.push(request),
      onPreviewChange: (preview) => previews.push(preview),
    });
    return { tool, bus, commits, previews };
  }

  it('emits an initial preview when a deck pointer-down begins a drag', () => {
    const { tool, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-1'), point: { x: 10, y: 20 } }));
    expect(previews.at(-1)).toEqual({
      target: { family: 'deck', targetId: 'deck-1' },
      delta: { x: 0, y: 0 },
      snap: null,
    });
  });

  it('updates the preview as the pointer moves', () => {
    const { tool, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-2'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 30, y: -10 } }));
    expect(previews.at(-1)).toEqual({
      target: { family: 'deck', targetId: 'deck-2' },
      delta: { x: 30, y: -10 },
      snap: null,
    });
  });

  it('commits a Move command when the threshold is exceeded', () => {
    const { tool, bus, commits } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-3'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 50, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 50, y: 0 } }));
    expect(commits).toEqual([
      { target: { family: 'deck', targetId: 'deck-3' }, delta: { x: 50, y: 0 }, snap: null },
    ]);
    expect(bus.snapshot()).toMatchObject({ canUndo: true, lastApplied: 'Move deck deck-3' });
  });

  it('does not commit when below the drag threshold', () => {
    const { tool, bus, commits, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-4'), point: { x: 0, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 2, y: 2 } }));
    expect(commits).toEqual([]);
    expect(bus.snapshot().canUndo).toBe(false);
    expect(previews.at(-1)).toBeNull();
  });

  it('ignores shape families that are not accepted by this tool instance', () => {
    const { tool, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: openingShape('opening-1'), point: { x: 0, y: 0 } }));
    tool.onPointerDown?.(event({ shape: pergolaShape('pergola-A'), point: { x: 0, y: 0 } }));
    expect(previews).toEqual([]);
  });

  it('accepts opening and pergola targets when configured', () => {
    const { tool, bus, commits } = setup(['deck', 'opening', 'pergola']);
    tool.onPointerDown?.(event({ shape: openingShape('opening-2'), point: { x: 0, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 100, y: 0 } }));
    tool.onPointerDown?.(event({ shape: pergolaShape('pergola-A'), point: { x: 0, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 0, y: 25 } }));
    expect(commits).toEqual([
      { target: { family: 'opening', targetId: 'opening-2' }, delta: { x: 100, y: 0 }, snap: null },
      { target: { family: 'pergola', targetId: 'pergola-A' }, delta: { x: 0, y: 25 }, snap: null },
    ]);
    expect(bus.snapshot().canUndo).toBe(true);
  });

  it('falls through to onPointerDownFallthrough when the click misses any movable shape', () => {
    // Tool chain (EdgeDrag -> Move -> Select): MoveTool must hand off the
    // click to the next tool when there's no shape under the cursor or
    // canMoveTarget returns false. Mirrors EdgeDragTool's fallthrough pattern.
    const fallthroughs: Array<{ shape: unknown; point: { x: number; y: number } }> = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) => target.family === 'deck',
      commandBus: bus,
      dragThresholdMm: 4,
      commitMove: () => undefined,
      onPointerDownFallthrough: (event) => {
        fallthroughs.push({ shape: event.shape, point: event.point });
      },
    });
    // No shape under cursor -> fallthrough fires.
    tool.onPointerDown?.(event({ shape: null, point: { x: 100, y: 200 } }));
    // Wrong family (pergola, when only deck is accepted) -> fallthrough fires.
    tool.onPointerDown?.(event({ shape: pergolaShape('pergola-fall'), point: { x: 50, y: 50 } }));
    expect(fallthroughs).toHaveLength(2);
    expect(fallthroughs[0]?.point).toEqual({ x: 100, y: 200 });
    expect(fallthroughs[1]?.point).toEqual({ x: 50, y: 50 });
  });

  it('falls through when canMoveTarget returns false for the click target (different object selected)', () => {
    // Standard CAD UX: first click selects, subsequent click + drag moves.
    // A click on a non-active object must fall through to SelectTool (so
    // the user can select that object) rather than start a move on it.
    // The host expresses this by returning false from canMoveTarget when
    // the click target is not the active object.
    const fallthroughs: Array<unknown> = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) =>
        target.family === 'deck' && target.targetId === 'deck-active',
      commandBus: bus,
      dragThresholdMm: 4,
      commitMove: () => undefined,
      onPointerDownFallthrough: (event) => fallthroughs.push(event),
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-other'), point: { x: 0, y: 0 } }));
    expect(fallthroughs).toHaveLength(1);
  });

  it('starts a drag when canMoveTarget returns true for the click target', () => {
    const previews: Array<MoveToolPreview | null> = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) =>
        target.family === 'deck' && target.targetId === 'deck-active',
      commandBus: bus,
      dragThresholdMm: 4,
      commitMove: () => undefined,
      onPreviewChange: (preview) => previews.push(preview),
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-active'), point: { x: 0, y: 0 } }));
    expect(previews.at(-1)).toEqual({
      target: { family: 'deck', targetId: 'deck-active' },
      delta: { x: 0, y: 0 },
      snap: null,
    });
  });

  it('does NOT call onPointerDownFallthrough for non-primary buttons (let them bubble for pan)', () => {
    const fallthroughs: unknown[] = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: () => true,
      commandBus: bus,
      dragThresholdMm: 4,
      commitMove: () => undefined,
      onPointerDownFallthrough: (event) => fallthroughs.push(event),
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-r'), point: { x: 0, y: 0 }, button: 2 }));
    expect(fallthroughs).toEqual([]);
  });

  it('cancel clears any active session and the preview', () => {
    const { tool, commits, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-5'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 100, y: 0 } }));
    tool.onCancel?.();
    expect(commits).toEqual([]);
    expect(previews.at(-1)).toBeNull();
  });

  it('round-trip apply -> undo flips the committed delta', () => {
    const apply: MoveRequest[] = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) => target.family === 'deck',
      commandBus: bus,
      dragThresholdMm: 1,
      commitMove: (request) => apply.push(request),
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-6'), point: { x: 0, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 20, y: 30 } }));
    expect(bus.undo()).toBe(true);
    expect(apply).toEqual([
      { target: { family: 'deck', targetId: 'deck-6' }, delta: { x: 20, y: 30 }, snap: null },
      { target: { family: 'deck', targetId: 'deck-6' }, delta: { x: -20, y: -30 }, snap: null },
    ]);
  });

  it('snaps a moving deck to a parallel wall and surfaces the snap on commit', () => {
    // 4m x 2m deck rect at the origin. Wall sits 50mm to the right of the
    // natural drag end position (the right edge would land at x=4200; wall
    // is at x=4150, correction = 50mm, well within the 250mm tolerance).
    // The committed delta should be the snap-corrected one (x=150, not 200);
    // the same numbers should appear on the live preview for indicator rendering.
    const deckPolygon = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    const wall = {
      id: 'wall-right',
      sourceObjectId: 'house-1',
      edgeKind: 'wall' as const,
      start: { x: 4150, y: -1000 },
      end: { x: 4150, y: 3000 },
    };
    const commits: MoveRequest[] = [];
    const previews: Array<MoveToolPreview | null> = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) => target.family === 'deck',
      commandBus: bus,
      dragThresholdMm: 1,
      commitMove: (request) => commits.push(request),
      onPreviewChange: (preview) => previews.push(preview),
      getSnapLineTargets: () => [wall],
      getActiveMovePolygon: () => deckPolygon,
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-snap'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 200, y: 0 } }));
    // Live preview should already show the snapped delta + snap result.
    const livePreview = previews.at(-1);
    expect(livePreview?.delta).toEqual({ x: 150, y: 0 });
    expect(livePreview?.snap?.edgeIndex).toBe(1); // right edge
    expect(livePreview?.snap?.edgeSnap.target.id).toBe('wall-right');

    tool.onPointerUp?.(event({ point: { x: 200, y: 0 } }));
    expect(commits).toHaveLength(1);
    expect(commits[0]?.delta).toEqual({ x: 150, y: 0 });
    expect(commits[0]?.snap?.edgeSnap.target.id).toBe('wall-right');
    // Preview cleared after commit.
    expect(previews.at(-1)).toBeNull();
  });

  it('falls back to the natural delta when no snap targets are within tolerance', () => {
    const deckPolygon = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    const farWall = {
      id: 'wall-far',
      sourceObjectId: 'house-1',
      edgeKind: 'wall' as const,
      start: { x: 5000, y: -1000 },
      end: { x: 5000, y: 3000 },
    };
    const commits: MoveRequest[] = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) => target.family === 'deck',
      commandBus: bus,
      dragThresholdMm: 1,
      commitMove: (request) => commits.push(request),
      getSnapLineTargets: () => [farWall],
      getActiveMovePolygon: () => deckPolygon,
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-no-snap'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 200, y: 0 } })); // right edge at 4200; wall at 5000; 800mm > 250mm tolerance
    tool.onPointerUp?.(event({ point: { x: 200, y: 0 } }));
    expect(commits[0]?.delta).toEqual({ x: 200, y: 0 });
    expect(commits[0]?.snap).toBeNull();
  });

  it('host pre-filters snap targets by family rules (deck rejects roof_eave; pergola accepts it)', () => {
    // The MoveTool itself doesn't filter by edge kind -- the host's
    // `getSnapLineTargets` decides which kinds reach the tool. This test
    // documents the contract: when the host passes only "wall" targets,
    // a roof_eave-shaped target never enters the snap pool, so a deck
    // dragged near a roof eave does NOT snap to it.
    const deckPolygon = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    type Target = {
      id: string;
      sourceObjectId: string;
      edgeKind: 'wall' | 'roof_eave' | 'pergola_outline';
      start: { x: number; y: number };
      end: { x: number; y: number };
    };
    const eaveAllTargets: Target[] = [
      {
        id: 'eave-1',
        sourceObjectId: 'house-1',
        edgeKind: 'roof_eave',
        start: { x: 4150, y: -1000 },
        end: { x: 4150, y: 3000 },
      },
    ];
    // Host filters out roof_eave for decks (matches PlanViewport's
    // `kinds: 'walls'` for non-pergola active families).
    const deckSnapTargets = eaveAllTargets.filter((t) => t.edgeKind === 'wall');

    const commits: MoveRequest[] = [];
    const bus = createCommandBus();
    const tool = createMoveTool({
      canMoveTarget: (target) => target.family === 'deck',
      commandBus: bus,
      dragThresholdMm: 1,
      commitMove: (request) => commits.push(request),
      getSnapLineTargets: () => deckSnapTargets,
      getActiveMovePolygon: () => deckPolygon,
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-eave'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 200, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 200, y: 0 } }));
    // No snap (the only candidate was a roof_eave, filtered out at the host).
    expect(commits[0]?.snap).toBeNull();
    expect(commits[0]?.delta).toEqual({ x: 200, y: 0 });
  });
});
