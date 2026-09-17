"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { apiJson } from '@/lib/repo/apiClient';

type Reply = { state: string; context?: unknown };
type Take = (projectId: string, signal: AbortSignal) => Promise<Reply> | null;
const WarmRead = createContext<Take>(() => null);

/** A single in-flight read for this mounted page, never a reusable browser cache. */
export function ProjectCorrespondenceWarmRead({ projectId, enabled, children }: {
  projectId: string; enabled: boolean; children: ReactNode;
}) {
  return <MountedWarmRead key={projectId} projectId={projectId} enabled={enabled}>{children}</MountedWarmRead>;
}

function MountedWarmRead({ projectId, enabled, children }: { projectId: string; enabled: boolean; children: ReactNode }) {
  const pending = useRef<{ promise: Promise<Reply>; controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const claimed = useRef(false);
  const take = useCallback<Take>((requestedProject, signal) => {
    if (requestedProject !== projectId || !enabled) return null;
    claimed.current = true;
    const entry = pending.current;
    pending.current = null;
    if (!entry) return null;
    clearTimeout(entry.timer);
    if (signal.aborted || entry.controller.signal.aborted) { entry.controller.abort(); return null; }
    const abort = () => entry.controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    return entry.promise.finally(() => signal.removeEventListener('abort', abort));
  }, [projectId, enabled]);

  useEffect(() => {
    if (!enabled || claimed.current || document.visibilityState === 'hidden') return;
    const controller = new AbortController();
    const discard = () => { controller.abort(); pending.current = null; };
    const promise = apiJson<Reply>(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/correspondence`, {
      method: 'GET', signal: controller.signal, cache: 'no-store', skipSaveTracking: true,
    });
    // The consumer handles the original rejection. An unconsumed early failure
    // must not become an unhandled rejection while the project shell is loading.
    void promise.catch(() => undefined);
    const timer = setTimeout(discard, 15_000);
    const entry = { promise, controller, timer };
    pending.current = entry;
    const forgetCompleted = () => {
      // Authority/customer checks must still be part of the active read at
      // handoff. A response completed before the shell is ready is not reusable.
      if (pending.current === entry) { pending.current = null; clearTimeout(timer); }
    };
    void promise.then(forgetCompleted, forgetCompleted);
    const onVisibility = () => { if (document.visibilityState === 'hidden') discard(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); discard(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [projectId, enabled]);

  return <WarmRead.Provider value={take}>{children}</WarmRead.Provider>;
}

export const useProjectCorrespondenceWarmRead = () => useContext(WarmRead);
