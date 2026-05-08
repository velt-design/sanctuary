import { describe, expect, it } from 'vitest';
import { createCommandBus } from './commandBus';
import { createReversibleCommand } from './createReversibleCommand';

describe('createReversibleCommand', () => {
  it('apply runs the forward callback', () => {
    let state = 'before';
    const command = createReversibleCommand({
      label: 'set after',
      apply: () => {
        state = 'after';
      },
      invert: () => {
        state = 'before';
      },
    });
    command.apply();
    expect(state).toBe('after');
  });

  it('invert returns a command whose apply runs the inverse callback', () => {
    let state = 'before';
    const command = createReversibleCommand({
      label: 'set after',
      apply: () => {
        state = 'after';
      },
      invert: () => {
        state = 'before';
      },
    });
    command.apply();
    expect(state).toBe('after');
    const inverse = command.invert();
    inverse.apply();
    expect(state).toBe('before');
  });

  it('apply -> invert -> invert returns to applied state (round-trip)', () => {
    let state = 0;
    const command = createReversibleCommand({
      label: 'increment',
      apply: () => {
        state = 1;
      },
      invert: () => {
        state = 0;
      },
    });
    command.apply();
    expect(state).toBe(1);
    const inverse = command.invert();
    inverse.apply();
    expect(state).toBe(0);
    const reapply = inverse.invert();
    reapply.apply();
    expect(state).toBe(1);
  });

  it('integrates with CommandBus undo/redo', () => {
    let state = 'before';
    const bus = createCommandBus();
    const command = createReversibleCommand({
      label: 'edit',
      apply: () => {
        state = 'after';
      },
      invert: () => {
        state = 'before';
      },
    });
    bus.apply(command);
    expect(state).toBe('after');
    expect(bus.snapshot().canUndo).toBe(true);
    bus.undo();
    expect(state).toBe('before');
    expect(bus.snapshot().canRedo).toBe(true);
    bus.redo();
    expect(state).toBe('after');
  });

  it('label propagates; inverse label prefixes "Undo"', () => {
    const command = createReversibleCommand({
      label: 'Resize pergola',
      apply: () => {},
      invert: () => {},
    });
    expect(command.label).toBe('Resize pergola');
    expect(command.invert().label).toBe('Undo Resize pergola');
  });

  it('captured state survives multiple invert cycles (deck-resize-style scenario)', () => {
    // Simulates an edge-drag: the host snapshots the pre-edit deck patch,
    // builds a forward + inverse command, and pushes through CommandBus.
    // After 3 undo/redo cycles, the underlying deck record must be back
    // at the post-edit state.
    type DeckRecord = { outline: ReadonlyArray<number>; position: { x: number; y: number } };
    let deck: DeckRecord = { outline: [1, 2, 3, 4], position: { x: 100, y: 200 } };

    const previousDeck = { outline: [...deck.outline], position: { ...deck.position } };
    const nextDeck = { outline: [5, 6, 7, 8], position: { x: 500, y: 600 } };

    const bus = createCommandBus();
    bus.apply(
      createReversibleCommand({
        label: 'Resize deck',
        apply: () => {
          deck = { outline: [...nextDeck.outline], position: { ...nextDeck.position } };
        },
        invert: () => {
          deck = { outline: [...previousDeck.outline], position: { ...previousDeck.position } };
        },
      }),
    );
    expect(deck.outline).toEqual([5, 6, 7, 8]);

    bus.undo();
    expect(deck.outline).toEqual([1, 2, 3, 4]);

    bus.redo();
    expect(deck.outline).toEqual([5, 6, 7, 8]);

    bus.undo();
    bus.undo(); // no-op
    expect(deck.outline).toEqual([1, 2, 3, 4]);
  });
});
