'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

type CacheEnvelopeV1<T> = {
  v: 1;
  cachedAt: number;
  data: T;
};

type CacheFirstOptions = {
  ttlMs?: number;
};

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readCache<T>(key: string): { data: T; cachedAt: number } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const env = parsed as any;
  if (env.v !== 1) return null;
  return { data: env.data as T, cachedAt: typeof env.cachedAt === 'number' ? env.cachedAt : 0 };
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const env: CacheEnvelopeV1<T> = { v: 1, cachedAt: Date.now(), data };
    window.localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // ignore quota/serialization failures
  }
}

export function useCacheFirstResource<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  opts?: CacheFirstOptions,
): {
  data: T | null;
  cachedAt: number | null;
  isRefreshing: boolean;
  error: string | null;
  isStale: boolean;
  setData: (next: T) => void;
  refresh: () => Promise<void>;
} {
  const ttlMs = typeof opts?.ttlMs === 'number' && Number.isFinite(opts.ttlMs) ? opts.ttlMs : null;

  const [data, setDataState] = useState<T | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useLayoutEffect(() => {
    const cached = readCache<T>(cacheKey);
    if (!cached) return;
    setDataState(cached.data);
    setCachedAt(cached.cachedAt || null);
  }, [cacheKey]);

  const setData = useCallback(
    (next: T) => {
      setDataState(next);
      setCachedAt(Date.now());
      writeCache(cacheKey, next);
    },
    [cacheKey],
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const next = await fetcherRef.current();
      setDataState(next);
      setCachedAt(Date.now());
      writeCache(cacheKey, next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh.';
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, [cacheKey]);

  useLayoutEffect(() => {
    void refresh();
  }, [refresh]);

  const isStale = (() => {
    if (!ttlMs) return false;
    if (!cachedAt) return false;
    return Date.now() - cachedAt > ttlMs;
  })();

  return { data, cachedAt, isRefreshing, error, isStale, setData, refresh };
}

