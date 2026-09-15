'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cleanProjectIndexHref, readProjectIndexPosition, rememberProjectIndexPosition } from '@/lib/projects/projectIndexSession';
import { parseProjectIndexView, projectIndexViewHref, type ProjectIndexView } from './projectIndexView';
import type { ProjectsIndexFilters } from './projectIndexFilters';

export function useProjectIndexView(initialFilters?: ProjectsIndexFilters, sessionKey?: string | null) {
  const params = useSearchParams();
  const [view, setView] = useState<ProjectIndexView>(() => ({
    ...parseProjectIndexView(new URLSearchParams(params.toString())), ...initialFilters,
  }));
  const current = useRef(view);
  const parsedUrl = parseProjectIndexView(new URLSearchParams(params.toString()));
  const signature = JSON.stringify(parsedUrl);
  const observed = useRef(signature);
  const pendingPosition = useRef(readProjectIndexPosition(sessionKey));
  const observedSession = useRef(sessionKey);

  useEffect(() => {
    if (observedSession.current !== sessionKey) {
      observedSession.current = sessionKey;
      pendingPosition.current = readProjectIndexPosition(sessionKey);
    }
    if (observed.current === signature) return;
    observed.current = signature;
    const next = JSON.parse(signature) as ProjectIndexView;
    if (JSON.stringify(current.current) === signature) return;
    current.current = next;
    pendingPosition.current = readProjectIndexPosition(sessionKey);
    setView(next);
  }, [signature, sessionKey]);

  function update(patch: Partial<ProjectIndexView>, resetPage = true) {
    const next = { ...current.current, ...(resetPage ? { page: 1 } : {}), ...patch };
    current.current = next;
    pendingPosition.current = null;
    setView(next);
    const href = projectIndexViewHref(next, new URLSearchParams(window.location.search));
    observed.current = JSON.stringify(parseProjectIndexView(new URL(href, window.location.origin).searchParams));
    // Next's native history integration updates searchParams without a server navigation per keystroke.
    window.history.replaceState(window.history.state, '', href);
    rememberProjectIndexPosition(href, 0, sessionKey, false);
  }

  function restoreScroll(ready: boolean) {
    if (!ready) return;
    const position = pendingPosition.current;
    pendingPosition.current = null;
    const href = cleanProjectIndexHref(window.location.href);
    let restoredTop = window.scrollY;
    if (position?.href === href) {
      const row = position.anchor ? Array.from(document.querySelectorAll<HTMLElement>('[data-project-index-anchor]'))
        .find((row) => row.dataset.projectIndexAnchor === position.anchor?.id) : null;
      const top = row && position.anchor ? window.scrollY + row.getBoundingClientRect().top - position.anchor.offsetY : position.scrollY;
      restoredTop = Math.max(0, top);
      window.scrollTo({ top: restoredTop, behavior: 'instant' });
    }
    rememberProjectIndexPosition(window.location.href, restoredTop, sessionKey);
  }

  useEffect(() => {
    const save = () => {
      if (pendingPosition.current) return;
      rememberProjectIndexPosition(window.location.href, window.scrollY, sessionKey);
    };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      // The router may already have changed location on unmount; scroll events save the index while it owns the URL.
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
    };
  }, [sessionKey]);

  return { view, update, restoreScroll, reset: () => update(parseProjectIndexView(new URLSearchParams())) };
}
