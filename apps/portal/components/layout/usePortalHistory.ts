'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type HistoryState = {
  entries: string[];
  index: number;
  hydrated: boolean;
};

type Action =
  | { type: 'hydrate'; state: { entries: string[]; index: number } }
  | { type: 'location'; url: string }
  | { type: 'trim'; maxEntries: number };

const SESSION_KEY = 'sp_portal_history_v1';

function isValidSnapshot(value: unknown): value is { entries: unknown; index: unknown } {
  return Boolean(value && typeof value === 'object' && 'entries' in (value as any) && 'index' in (value as any));
}

function nearestMatchingIndex(entries: string[], currentIndex: number, url: string): number | null {
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i] !== url) continue;
    const dist = Math.abs(i - currentIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function clampIndex(index: number, len: number): number {
  if (len <= 0) return 0;
  return Math.max(0, Math.min(len - 1, index));
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'hydrate': {
      const entries = action.state.entries.length ? action.state.entries.slice() : [];
      const index = clampIndex(action.state.index, entries.length);
      return { entries, index, hydrated: true };
    }
    case 'location': {
      const url = action.url;
      if (!url) return state;

      if (!state.entries.length) {
        return { entries: [url], index: 0, hydrated: state.hydrated };
      }

      if (state.entries[state.index] === url) return state;
      if (state.index > 0 && state.entries[state.index - 1] === url) return { ...state, index: state.index - 1 };
      if (state.index < state.entries.length - 1 && state.entries[state.index + 1] === url) return { ...state, index: state.index + 1 };

      const found = nearestMatchingIndex(state.entries, state.index, url);
      if (typeof found === 'number') return { ...state, index: found };

      const next = state.entries.slice(0, state.index + 1);
      next.push(url);
      return { ...state, entries: next, index: next.length - 1 };
    }
    case 'trim': {
      const max = Math.max(1, action.maxEntries);
      if (state.entries.length <= max) return state;
      const overflow = state.entries.length - max;
      const entries = state.entries.slice(overflow);
      const index = clampIndex(state.index - overflow, entries.length);
      return { ...state, entries, index };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function buildUrl(pathname: string | null, searchParams: { toString(): string } | null): string {
  const base = pathname ?? '';
  const query = searchParams?.toString() ?? '';
  return query ? `${base}?${query}` : base;
}

export function usePortalHistory(opts?: { maxEntries?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useMemo(() => buildUrl(pathname, searchParams), [pathname, searchParams]);

  const [state, dispatch] = useReducer(reducer, { entries: [], index: 0, hydrated: false });
  const [nativeCanBack, setNativeCanBack] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSnapshot(parsed)) return;
      const entriesRaw = (parsed as any).entries;
      const indexRaw = (parsed as any).index;
      const entries = Array.isArray(entriesRaw) ? entriesRaw.filter((x) => typeof x === 'string') : [];
      const index = typeof indexRaw === 'number' && Number.isFinite(indexRaw) ? indexRaw : 0;
      dispatch({ type: 'hydrate', state: { entries, index } });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const compute = () => setNativeCanBack(window.history.length > 1);
    compute();

    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
  }, []);

  useEffect(() => {
    if (!url) return;
    dispatch({ type: 'location', url });
  }, [url]);

  useEffect(() => {
    dispatch({ type: 'trim', maxEntries: opts?.maxEntries ?? 50 });
  }, [opts?.maxEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.hydrated) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ entries: state.entries, index: state.index }));
    } catch {
      // ignore
    }
  }, [state.entries, state.hydrated, state.index]);

  const canGoBack = state.index > 0 || nativeCanBack;
  const canGoForward = state.index < state.entries.length - 1;
  const backUrl = state.index > 0 ? state.entries[state.index - 1] ?? null : null;
  const forwardUrl = state.index < state.entries.length - 1 ? state.entries[state.index + 1] ?? null : null;

  return {
    canGoBack,
    canGoForward,
    backUrl,
    forwardUrl,
    back: () => {
      if (!canGoBack) return;
      if (backUrl) {
        router.push(backUrl);
        return;
      }
      router.back();
    },
    forward: () => {
      if (!canGoForward) return;
      if (forwardUrl) router.push(forwardUrl);
    },
  };
}
