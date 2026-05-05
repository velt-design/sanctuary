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
      request: { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: 100, y: 50 } },
      commitMove: (request) => log.push(request),
    });
    command.apply();
    command.invert().apply();
    expect(log).toEqual([
      { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: 100, y: 50 } },
      { target: { family: 'deck', targetId: 'deck-7' }, delta: { x: -100, y: -50 } },
    ]);
  });

  it('builds a label including the family and target id', () => {
    expect(
      createMoveCommand({
        request: { target: { family: 'opening', targetId: 'opening-3' }, delta: { x: 0, y: 0 } },
        commitMove: () => undefined,
      }).label,
    ).toBe('Move opening opening-3');
  });

  it('routes inverse application through invertMove when provided', () => {
    const apply: string[] = [];
    const invert: string[] = [];
    const cmd = createMoveCommand({
      request: { target: { family: 'pergola', targetId: 'pergola-A' }, delta: { x: 5, y: 5 } },
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
    const bus = createCommandBus();
    const commits: MoveRequest[] = [];
    const previews: Array<MoveToolPreview | null> = [];
    const tool = createMoveTool({
      acceptedFamilies,
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
    });
  });

  it('updates the preview as the pointer moves', () => {
    const { tool, previews } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-2'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 30, y: -10 } }));
    expect(previews.at(-1)).toEqual({
      target: { family: 'deck', targetId: 'deck-2' },
      delta: { x: 30, y: -10 },
    });
  });

  it('commits a Move command when the threshold is exceeded', () => {
    const { tool, bus, commits } = setup(['deck']);
    tool.onPointerDown?.(event({ shape: deckShape('deck-3'), point: { x: 0, y: 0 } }));
    tool.onPointerMove?.(event({ point: { x: 50, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 50, y: 0 } }));
    expect(commits).toEqual([
      { target: { family: 'deck', targetId: 'deck-3' }, delta: { x: 50, y: 0 } },
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
      { target: { family: 'opening', targetId: 'opening-2' }, delta: { x: 100, y: 0 } },
      { target: { family: 'pergola', targetId: 'pergola-A' }, delta: { x: 0, y: 25 } },
    ]);
    expect(bus.snapshot().canUndo).toBe(true);
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
      acceptedFamilies: ['deck'],
      commandBus: bus,
      dragThresholdMm: 1,
      commitMove: (request) => apply.push(request),
    });
    tool.onPointerDown?.(event({ shape: deckShape('deck-6'), point: { x: 0, y: 0 } }));
    tool.onPointerUp?.(event({ point: { x: 20, y: 30 } }));
    expect(bus.undo()).toBe(true);
    expect(apply).toEqual([
      { target: { family: 'deck', targetId: 'deck-6' }, delta: { x: 20, y: 30 } },
      { target: { family: 'deck', targetId: 'deck-6' }, delta: { x: -20, y: -30 } },
    ]);
  });
});
