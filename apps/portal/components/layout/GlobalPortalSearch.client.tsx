'use client';

import Link from 'next/link';
import {
  ArrowRight,
  FolderKanban,
  LoaderCircle,
  Search,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  shouldHandleRouteTransitionClick,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from '@/components/page-state/PortalRouteTransition';
import { ProjectStageBadge } from '@/components/ui/foundation';
import {
  PORTAL_SEARCH_MAX_LENGTH,
  PORTAL_SEARCH_MIN_LENGTH,
  type PortalContactSearchResult,
  type PortalProjectSearchResult,
  type PortalSearchResponse,
} from '@/lib/search/portalSearchContract';
import styles from './GlobalPortalSearch.module.css';

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';
type SearchResult = PortalProjectSearchResult | PortalContactSearchResult;
const SEARCH_NAVIGATION_TIMEOUT_MS = 8000;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function resultDescription(result: SearchResult): string {
  if (result.kind === 'project') {
    return [result.reference, result.contactName, result.siteAddress].filter(Boolean).join(' · ');
  }
  return [result.email, result.phone, result.address].filter(Boolean).join(' · ');
}

function resultIsCurrent(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  try {
    return new URL(href, 'https://portal.local').pathname === pathname;
  } catch {
    return false;
  }
}

export default function GlobalPortalSearch({ shortcutEnabled = true }: { shortcutEnabled?: boolean }) {
  const routeTransition = usePortalRouteTransition();
  const pathname = routeTransition.pathname
    ?? (typeof window === 'undefined' ? null : window.location.pathname);
  const routeKey = routeTransition.routeKey
    || (typeof window === 'undefined' ? '' : `${window.location.pathname}?${window.location.search.slice(1)}`);
  const { beginRouteTransition } = routeTransition;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigationStartRouteKeyRef = useRef<string | null>(null);
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SearchState>('idle');
  const [projects, setProjects] = useState<PortalProjectSearchResult[]>([]);
  const [contacts, setContacts] = useState<PortalContactSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  const trimmedQuery = query.trim();
  const results = useMemo<SearchResult[]>(() => [...projects, ...contacts], [contacts, projects]);

  const resetSearch = useCallback(() => {
    setQuery('');
    setOpen(false);
    setState('idle');
    setProjects([]);
    setContacts([]);
    setActiveIndex(-1);
    setNavigatingHref(null);
    navigationStartRouteKeyRef.current = null;
  }, []);

  useEffect(() => {
    if (!navigatingHref || navigationStartRouteKeyRef.current === null) return;
    if (navigationStartRouteKeyRef.current !== routeKey) resetSearch();
  }, [navigatingHref, resetSearch, routeKey]);

  useEffect(() => {
    if (!navigatingHref) return;
    const timeout = window.setTimeout(() => setNavigatingHref(null), SEARCH_NAVIGATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [navigatingHref]);

  useEffect(() => {
    if (!shortcutEnabled) return;
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      const commandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slashShortcut = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!commandShortcut && (!slashShortcut || isEditableTarget(event.target))) return;
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [shortcutEnabled]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
    if (trimmedQuery.length < PORTAL_SEARCH_MIN_LENGTH) {
      setState('idle');
      setProjects([]);
      setContacts([]);
      return;
    }

    const controller = new AbortController();
    setState('loading');
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/staff/v1/search?q=${encodeURIComponent(trimmedQuery)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const payload = await response.json() as Partial<PortalSearchResponse> & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Search failed');
        const nextProjects = Array.isArray(payload.projects) ? payload.projects : [];
        const nextContacts = Array.isArray(payload.contacts) ? payload.contacts : [];
        setProjects(nextProjects);
        setContacts(nextContacts);
        setState(nextProjects.length || nextContacts.length ? 'results' : 'empty');
      } catch (error) {
        if (controller.signal.aborted) return;
        setProjects([]);
        setContacts([]);
        setState('error');
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => current < results.length - 1 ? current + 1 : 0);
      return;
    }
    if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => current > 0 ? current - 1 : results.length - 1);
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.click();
    }
  };

  const handleNavigationClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    label: string,
  ) => {
    if (!shouldHandleRouteTransitionClick(event, event.currentTarget)) {
      setOpen(false);
      return;
    }
    if (!shouldStartRouteTransitionForHref(href)) {
      event.preventDefault();
      resetSearch();
      return;
    }

    navigationStartRouteKeyRef.current = routeKey;
    setNavigatingHref(href);
    setOpen(true);
    beginRouteTransition({
      href,
      label,
      source: 'global-portal-search',
      control: event.currentTarget,
    });
  };

  const renderResult = (result: SearchResult, index: number) => {
    const description = resultDescription(result);
    const optionId = `${listboxId}-option-${index}`;
    const current = resultIsCurrent(result.href, pathname);
    const pending = navigatingHref === result.href;
    return (
      <Link
        id={optionId}
        key={`${result.kind}-${result.id}`}
        href={result.href}
        role="option"
        aria-selected={activeIndex === index}
        aria-current={current ? 'page' : undefined}
        className={styles.result}
        data-active={activeIndex === index ? 'true' : undefined}
        data-current={current ? 'true' : undefined}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={(event) => {
          if (current) {
            event.preventDefault();
            resetSearch();
            return;
          }
          handleNavigationClick(event, result.href, result.name);
        }}
      >
        <span className={styles.resultIcon} aria-hidden="true">
          {result.kind === 'project' ? <FolderKanban /> : <UserRound />}
        </span>
        <span className={styles.resultCopy}>
          <strong>{result.name}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {result.kind === 'project' || current || pending ? (
          <span className={styles.resultMeta}>
            {result.kind === 'project' ? (
              result.archived ? <span className={styles.archived}>Archived</span> : <ProjectStageBadge stage={result.stage} compact />
            ) : null}
            {current ? <span className={styles.current}>Current</span> : null}
            {pending ? <span className={styles.pending} role="status"><LoaderCircle aria-hidden="true" /> Opening</span> : null}
          </span>
        ) : null}
      </Link>
    );
  };

  const showPanel = open;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div
      className={styles.root}
      ref={rootRef}
      data-global-portal-search="true"
      data-global-portal-search-pathname={pathname ?? undefined}
    >
      <div className={styles.inputShell}>
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          maxLength={PORTAL_SEARCH_MAX_LENGTH}
          placeholder="Search projects and contacts…"
          aria-label="Search projects and contacts"
          aria-autocomplete="list"
          aria-controls={showPanel ? listboxId : undefined}
          aria-activedescendant={showPanel ? activeOptionId : undefined}
          aria-expanded={showPanel}
          aria-haspopup="listbox"
          role="combobox"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setNavigatingHref(null);
          }}
          onKeyDown={onInputKeyDown}
        />
        {state === 'loading' || navigatingHref ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <kbd>Ctrl K</kbd>}
      </div>

      {showPanel ? (
        <div className={styles.panel} data-global-search-panel="true">
          {state === 'idle' ? (
            <div className={styles.message}>Type at least {PORTAL_SEARCH_MIN_LENGTH} characters to search projects and contacts.</div>
          ) : null}
          {state === 'loading' ? (
            <div className={styles.message} role="status">Searching the portal…</div>
          ) : null}
          {state === 'empty' ? (
            <div className={styles.message} role="status">No projects or contacts match “{trimmedQuery}”.</div>
          ) : null}
          {state === 'error' ? (
            <div className={`${styles.message} ${styles.error}`} role="alert">Search is unavailable. Try again.</div>
          ) : null}
          <div
            id={listboxId}
            role="listbox"
            aria-label="Portal search results"
            aria-busy={state === 'loading' || Boolean(navigatingHref)}
            className={styles.resultsList}
          >
            {state === 'results' ? (
              <>
                {projects.length ? (
                  <section className={styles.group} role="group" aria-labelledby={`${listboxId}-projects`}>
                    <div className={styles.groupHeader} id={`${listboxId}-projects`}>
                      <strong>Projects</strong><span>{projects.length}</span>
                    </div>
                    {projects.map((result, index) => renderResult(result, index))}
                  </section>
                ) : null}
                {contacts.length ? (
                  <section className={styles.group} role="group" aria-labelledby={`${listboxId}-contacts`}>
                    <div className={styles.groupHeader} id={`${listboxId}-contacts`}>
                      <strong>Contacts</strong><span>{contacts.length}</span>
                    </div>
                    {contacts.map((result, index) => renderResult(result, projects.length + index))}
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
          {state === 'results' ? (
            <div className={styles.viewAllLinks}>
              {projects.length ? (
                <Link
                  className={styles.viewAll}
                  href={`/staff/projects?q=${encodeURIComponent(trimmedQuery)}`}
                  onClick={(event) => handleNavigationClick(event, `/staff/projects?q=${encodeURIComponent(trimmedQuery)}`, 'matching projects')}
                >
                  {navigatingHref === `/staff/projects?q=${encodeURIComponent(trimmedQuery)}` ? 'Opening projects' : 'View all matching projects'} <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
              {contacts.length ? (
                <Link
                  className={styles.viewAll}
                  href={`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`}
                  onClick={(event) => handleNavigationClick(event, `/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`, 'matching contacts')}
                >
                  {navigatingHref === `/staff/contacts?q=${encodeURIComponent(trimmedQuery)}` ? 'Opening contacts' : 'View all matching contacts'} <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className={styles.keyboardHint} aria-hidden="true">
            <span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
