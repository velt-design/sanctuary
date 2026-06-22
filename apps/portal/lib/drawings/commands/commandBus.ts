import type { Command } from './command';

type CommandBusSnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  lastApplied: string | null;
};

export type CommandBus = {
  apply: (command: Command) => void;
  undo: () => boolean;
  redo: () => boolean;
  snapshot: () => CommandBusSnapshot;
  subscribe: (listener: () => void) => () => void;
  reset: () => void;
};

export function createCommandBus(): CommandBus {
  const undoStack: Command[] = [];
  const redoStack: Command[] = [];
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    apply(command) {
      command.apply();
      undoStack.push(command);
      redoStack.length = 0;
      notify();
    },
    undo() {
      const last = undoStack.pop();
      if (!last) return false;
      const inverse = last.invert();
      inverse.apply();
      redoStack.push(last);
      notify();
      return true;
    },
    redo() {
      const next = redoStack.pop();
      if (!next) return false;
      next.apply();
      undoStack.push(next);
      notify();
      return true;
    },
    snapshot() {
      const last = undoStack[undoStack.length - 1];
      return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        lastApplied: last?.label ?? null,
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },
  };
}
