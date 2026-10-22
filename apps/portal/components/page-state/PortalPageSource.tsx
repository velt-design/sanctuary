'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/** Correlation emitted by a leaf after its existing fresh access guard. It grants nothing. */
export type PortalPageCompletion = Record<string, never>;
type SelectedSource = { pathname: string; completion: PortalPageCompletion; publicFrame?: false };
type FrameAttempt = {
  href: string;
  pathname: string;
  identity: object | string;
  blockedCompletion: PortalPageCompletion | null;
  adoptedCompletion: PortalPageCompletion | null;
  fromCanonicalPath: string;
  unavailable?: boolean;
};

export function publicFramePath(href: string, base: string): string | null {
  try {
    const current = new URL(base);
    const next = new URL(href, current);
    if (next.origin !== current.origin) return null;
    if (['/dashboard','/staff/projects','/staff/contacts','/staff/projects/work-queue',
      '/staff/projects/design-packages','/staff/projects/running-jobs'].includes(next.pathname)) return next.pathname;
    if (next.pathname === '/staff/schedule' && next.searchParams.get('view')?.trim().toLowerCase() !== 'site-visits') return next.pathname;
  } catch { /* A malformed selection does not start a frame. */ }
  return null;
}

export function usePortalPageSourceController(pathname: string | null, canonicalPath: string, search: string) {
  const router = useRouter();
  const [source, setSource] = useState<SelectedSource | null>(null);
  const [attempt, setAttempt] = useState<FrameAttempt | null>(null);
  const sourceRef = useRef(source);
  const attemptRef = useRef(attempt);
  const canonicalRef = useRef(canonicalPath);
  canonicalRef.current = canonicalPath;
  const begin = useCallback((href: string) => {
    const target = publicFramePath(href, window.location.href);
    if (!target) return false;
    // Accepted reversion to the still-retained genuine page is the existing
    // Back/local-first case. Context updates alone never invoke this branch.
    const pending = attemptRef.current;
    if (pending && !pending.unavailable && !pending.adoptedCompletion
      && canonicalRef.current === target && sourceRef.current?.pathname === target) {
      attemptRef.current = null;
      setAttempt(null);
      return true;
    }
    const next: FrameAttempt = {
      href, pathname: target, identity: {},
      fromCanonicalPath: canonicalRef.current,
      blockedCompletion: sourceRef.current?.completion ?? null, adoptedCompletion: null,
    };
    attemptRef.current = next;
    setAttempt(next);
    return true;
  }, []);
  const cancel = useCallback(() => {
    attemptRef.current = null;
    setAttempt(null);
  }, []);
  const deny = useCallback((selectedPath: string) => {
    const pending = attemptRef.current;
    if (pending?.pathname !== selectedPath && sourceRef.current?.pathname !== selectedPath) return;
    // A source failure must not restore the entry query over safe view changes
    // already made on the selected actual frame. This URL is correlation only.
    const unavailable: FrameAttempt = { href: `${selectedPath}${window.location.search}${window.location.hash}`,
      pathname: selectedPath, identity: pending?.identity ?? canonicalRef.current,
      fromCanonicalPath: pending?.fromCanonicalPath ?? canonicalRef.current,
      blockedCompletion: pending?.adoptedCompletion ?? sourceRef.current?.completion ?? pending?.blockedCompletion ?? null,
      adoptedCompletion: null, unavailable: true };
    attemptRef.current = unavailable;
    setAttempt(unavailable);
  }, []);
  const retry = useCallback(() => router.refresh(), [router]);
  useLayoutEffect(() => {
    // Next publishes pushState/replace through a transition. The accepted
    // attempt must survive the urgent render that still sees its old route.
    // Popstate and explicit reversion own returning to that original route;
    // adoption of a different destination retires a superseded attempt.
    if (attempt && canonicalPath === pathname && canonicalPath !== attempt.pathname
      && canonicalPath !== attempt.fromCanonicalPath) cancel();
  }, [attempt, canonicalPath, pathname, cancel]);
  const register = useCallback((selected: SelectedSource) => {
    if (canonicalRef.current !== selected.pathname) return;
    const pending = attemptRef.current;
    if (pending) {
      if (pending.pathname !== selected.pathname || pending.blockedCompletion === selected.completion) return;
      if (selected.publicFrame === false) {
        attemptRef.current = null;
        setAttempt(null);
      } else if (pending.adoptedCompletion !== selected.completion) {
        const adopted = { ...pending, adoptedCompletion: selected.completion, unavailable: false };
        attemptRef.current = adopted;
        setAttempt(adopted);
      }
    }
    if (sourceRef.current?.pathname === selected.pathname && sourceRef.current.completion === selected.completion) return;
    sourceRef.current = selected;
    setSource(selected);
  }, []);
  const allowed = (selected: SelectedSource) => {
    if (canonicalPath !== selected.pathname) return false;
    if (attempt) return attempt.pathname === selected.pathname && attempt.adoptedCompletion === selected.completion;
    return pathname === selected.pathname;
  };
  const selectedPath = attempt?.pathname ?? pathname;
  const owner = source && source.pathname === selectedPath && allowed(source) ? source.completion : null;
  return { begin, cancel, register, deny, retry, allowed, canonicalPath, selectedPath, owner, attempt,
    frameSuppressed: Boolean(owner && source?.publicFrame === false),
    href: attempt && !attempt.adoptedCompletion ? attempt.href : `${pathname ?? '/'}${search ? `?${search}` : ''}` };
}

type SourceController = ReturnType<typeof usePortalPageSourceController>;
const PageSourceContext = createContext<SourceController | null>(null);
export const PortalPageSourceProvider = PageSourceContext.Provider;
export function usePortalPageSource() { return useContext(PageSourceContext); }

/** Source-owned UI evidence; this is not a query cache or an access grant. */
export function useOwnedPortalPublication<T>(owner: object | null) {
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [published, setPublished] = useState<{ owner: object | null; value: T } | null>(null);
  const publish = useCallback((value: T | null) => {
    if (currentOwner.current !== owner) return;
    setPublished(current => value === null ? current?.owner === owner ? null : current
      : current?.owner === owner && current.value === value ? current : { owner, value });
  }, [owner]);
  return { value: owner && published?.owner === owner ? published.value : null, publish };
}

/** Keeps Next's outlet alive while old private client hooks are unmounted. */
export function PortalGuardedPage({ pathname, completion, publicFrame, unavailable = false, children }: {
  pathname: string; completion: PortalPageCompletion; publicFrame?: false; unavailable?: boolean; children: ReactNode;
}) {
  const source = usePortalPageSource();
  const register = source?.register;
  const deny = source?.deny;
  const canonicalPath = source?.canonicalPath;
  useLayoutEffect(() => {
    if (unavailable) deny?.(pathname);
    else register?.({ pathname, completion, publicFrame });
    // Public intent/context changes must not re-register an old mounted page.
  }, [register, deny, pathname, completion, publicFrame, unavailable, canonicalPath]);
  return !unavailable && (!source || source.allowed({ pathname, completion })) ? children : null;
}
