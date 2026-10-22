'use client';
import { useLayoutEffect, useRef, type RefObject, type UIEvent } from 'react';

// A saved offset is an intention, not the browser's temporary first-page clamp.
export function useProjectFilesListPosition({ listRef, scope, savedTop, ready, hasMore, save }: {
  listRef: RefObject<HTMLDivElement | null>; scope: string; savedTop: number;
  ready: boolean; hasMore: boolean; save: (top: number) => void;
}) {
  const position = useRef<{ scope: string; node: HTMLDivElement; target: number; pending: boolean; applied?: number } | null>(null);
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    if (position.current?.scope !== scope || position.current.node !== node) {
      position.current = { scope, node, target: savedTop, pending: true };
    }
    const state = position.current;
    if (!state.pending || !ready) return;
    const maximum = Math.max(0, node.scrollHeight - node.clientHeight);
    // Beyond the automatic page budget, keep the intention until continuation
    // supplies enough rows or the user deliberately takes over scrolling.
    if (state.target > maximum + 1 && hasMore) return;
    node.scrollTop = Math.min(state.target, maximum);
    state.applied = node.scrollTop;
    state.pending = false;
    // A completed, now shorter folder may legitimately no longer reach it.
    if (state.target > maximum + 1) save(node.scrollTop);
  });
  return {
    onScroll: (event: UIEvent<HTMLDivElement>) => {
      const state = position.current;
      const node = event.currentTarget;
      if (!state || state.node !== node || state.scope !== scope || state.pending) return;
      if (state.applied !== undefined && Math.abs(node.scrollTop - state.applied) < 1) {
        state.applied = undefined;
        return;
      }
      state.applied = undefined;
      save(node.scrollTop);
    },
    takeControl: () => {
      const state = position.current;
      if (state?.node === listRef.current && state.scope === scope) {
        state.pending = false;
        state.applied = undefined;
      }
    },
  };
}
