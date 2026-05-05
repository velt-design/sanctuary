import { describe, expect, it, vi } from 'vitest';
import type { Command } from './command';
import { createCommandBus } from './commandBus';

function makeRecordingCommand(label: string, log: string[]): Command {
  const command: Command = {
    label,
    apply() {
      log.push(`apply:${label}`);
    },
    invert() {
      return {
        label: `inverse:${label}`,
        apply() {
          log.push(`apply:inverse:${label}`);
        },
        invert() {
          return command;
        },
      };
    },
  };
  return command;
}

describe('createCommandBus', () => {
  it('records labels and toggles canUndo/canRedo correctly across apply/undo/redo', () => {
    const log: string[] = [];
    const bus = createCommandBus();
    expect(bus.snapshot()).toEqual({ canUndo: false, canRedo: false, lastApplied: null });

    bus.apply(makeRecordingCommand('move-deck-1', log));
    expect(bus.snapshot()).toEqual({ canUndo: true, canRedo: false, lastApplied: 'move-deck-1' });
    expect(log).toEqual(['apply:move-deck-1']);

    expect(bus.undo()).toBe(true);
    expect(log).toEqual(['apply:move-deck-1', 'apply:inverse:move-deck-1']);
    expect(bus.snapshot()).toEqual({ canUndo: false, canRedo: true, lastApplied: null });

    expect(bus.redo()).toBe(true);
    expect(log).toEqual(['apply:move-deck-1', 'apply:inverse:move-deck-1', 'apply:move-deck-1']);
    expect(bus.snapshot()).toEqual({ canUndo: true, canRedo: false, lastApplied: 'move-deck-1' });
  });

  it('clears the redo stack when a new command is applied after an undo', () => {
    const log: string[] = [];
    const bus = createCommandBus();
    bus.apply(makeRecordingCommand('a', log));
    bus.apply(makeRecordingCommand('b', log));
    bus.undo();
    expect(bus.snapshot().canRedo).toBe(true);
    bus.apply(makeRecordingCommand('c', log));
    expect(bus.snapshot().canRedo).toBe(false);
    expect(bus.snapshot().lastApplied).toBe('c');
  });

  it('returns false from undo/redo when stacks are empty', () => {
    const bus = createCommandBus();
    expect(bus.undo()).toBe(false);
    expect(bus.redo()).toBe(false);
  });

  it('notifies subscribers on apply, undo, redo, and reset', () => {
    const bus = createCommandBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);

    bus.apply(makeRecordingCommand('a', []));
    bus.undo();
    bus.redo();
    bus.reset();
    unsubscribe();
    bus.apply(makeRecordingCommand('after-unsubscribe', []));

    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('reset clears both stacks', () => {
    const bus = createCommandBus();
    bus.apply(makeRecordingCommand('a', []));
    bus.apply(makeRecordingCommand('b', []));
    bus.undo();
    bus.reset();
    expect(bus.snapshot()).toEqual({ canUndo: false, canRedo: false, lastApplied: null });
  });
});
