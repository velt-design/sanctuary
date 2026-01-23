'use client';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

export type SaveState = {
  status: SaveStatus;
  pending: number;
  lastSavedAt?: string;
  lastError?: string;
};

type Listener = () => void;

let state: SaveState = { status: 'saved', pending: 0 };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: SaveState) {
  state = next;
  emit();
}

export const saveTracker = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): SaveState {
    return state;
  },
  async track<T>(fn: () => Promise<T>): Promise<T> {
    const pending = state.pending + 1;
    setState({ status: 'saving', pending, lastSavedAt: state.lastSavedAt, lastError: undefined });
    try {
      const res = await fn();
      const nextPending = Math.max(0, state.pending - 1);
      setState({ status: nextPending === 0 ? 'saved' : 'saving', pending: nextPending, lastSavedAt: new Date().toISOString() });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false;
      setState({ status: offline ? 'offline' : 'error', pending: 0, lastSavedAt: state.lastSavedAt, lastError: msg });
      throw err;
    }
  },
};

