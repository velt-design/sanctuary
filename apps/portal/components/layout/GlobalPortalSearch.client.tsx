'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, type QueryClient } from '@tanstack/react-query';
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
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
import { qk } from '@/lib/queries/keys';
import {
  normalizePortalSearchQuery,
  portalSearchQueryOptions,
  PORTAL_SEARCH_DEBOUNCE_MS,
} from '@/lib/queries/portalSearch';
import { useOptionalPortalQueryClient } from '@/lib/react-query/PortalQueryClientContext';
import { useOptionalGlobalPortalSearchState } from './GlobalPortalSearchState';
import styles from './GlobalPortalSearch.module.css';

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';
type SearchResult = PortalProjectSearchResult | PortalContactSearchResult;
type SearchPanelPlacement = Pick<CSSProperties, 'left' | 'maxHeight' | 'top' | 'width'>;
const SEARCH_NAVIGATION_TIMEOUT_MS = 8000;
const SEARCH_PANEL_GAP_PX = 4;
const SEARCH_PANEL_GUTTER_PX = 16;
const SEARCH_PANEL_MIN_HEIGHT_PX = 120;
const SEARCH_PANEL_DESKTOP_MAX_HEIGHT_PX = 620;
const SEARCH_PANEL_MOBILE_MAX_HEIGHT_PX = 520;
const SEARCH_PANEL_DESKTOP_WIDTH_PX = 560;
const SEARCH_PANEL_MOBILE_MIN_WIDTH_PX = 280;
const SEARCH_PANEL_MOBILE_BREAKPOINT_PX = 767;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function resolveSearchPanelPlacement(anchor: HTMLElement): SearchPanelPlacement {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const availableWidth = Math.max(0, viewportWidth - (SEARCH_PANEL_GUTTER_PX * 2));
  const mobile = viewportWidth <= SEARCH_PANEL_MOBILE_BREAKPOINT_PX;
  const width = Math.min(
    mobile
      ? Math.max(rect.width, SEARCH_PANEL_MOBILE_MIN_WIDTH_PX)
      : SEARCH_PANEL_DESKTOP_WIDTH_PX,
    availableWidth,
  );
  const left = clamp(
    rect.right - width,
    SEARCH_PANEL_GUTTER_PX,
    Math.max(SEARCH_PANEL_GUTTER_PX, viewportWidth - SEARCH_PANEL_GUTTER_PX - width),
  );
  const maximumHeight = mobile
    ? SEARCH_PANEL_MOBILE_MAX_HEIGHT_PX
    : SEARCH_PANEL_DESKTOP_MAX_HEIGHT_PX;
  const spaceBelow = viewportHeight - rect.bottom - SEARCH_PANEL_GAP_PX - SEARCH_PANEL_GUTTER_PX;
  const availableHeight = Math.max(SEARCH_PANEL_MIN_HEIGHT_PX, spaceBelow);
  const maxHeight = Math.min(maximumHeight, availableHeight);
  const top = rect.bottom + SEARCH_PANEL_GAP_PX;

  return { left, maxHeight, top, width };
}

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

function ActiveGlobalPortalSearch({
  queryClient,
  shortcutEnabled = true,
}: {
  queryClient: QueryClient;
  shortcutEnabled?: boolean;
}) {
  const router = useRouter();
  const routeTransition = usePortalRouteTransition();
  const pathname = routeTransition.pathname
    ?? (typeof window === 'undefined' ? null : window.location.pathname);
  const routeKey = routeTransition.routeKey
    || (typeof window === 'undefined' ? '' : `${window.location.pathname}?${window.location.search.slice(1)}`);
  const { beginRouteTransition } = routeTransition;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigationStartRouteKeyRef = useRef<string | null>(null);
  const prefetchedHrefRef = useRef(new Set<string>());
  const listboxId = useId();
  const sharedState = useOptionalGlobalPortalSearchState();
  const [localQuery, setLocalQuery] = useState('');
  const [localInteractionActive, setLocalInteractionActive] = useState(false);
  const query = sharedState?.query ?? localQuery;
  const setQuery = sharedState?.setQuery ?? setLocalQuery;
  const interactionActive = sharedState?.interactionActive ?? localInteractionActive;
  const setInteractionActive = sharedState?.setInteractionActive ?? setLocalInteractionActive;
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  const [panelPlacement, setPanelPlacement] = useState<SearchPanelPlacement | null>(null);
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizePortalSearchQuery(trimmedQuery);
  const searchEnabled = normalizedQuery.length >= PORTAL_SEARCH_MIN_LENGTH;
  const exactCachedResponse = searchEnabled
    ? queryClient.getQueryData<PortalSearchResponse>(qk.search.portal(normalizedQuery))
    : undefined;
  const requestQuery = exactCachedResponse ? normalizedQuery : debouncedQuery;
  const searchQuery = useQuery({
    ...portalSearchQueryOptions(requestQuery),
    enabled: searchEnabled && requestQuery.length >= PORTAL_SEARCH_MIN_LENGTH,
    placeholderData: (previousData) => previousData,
  });
  const response = searchEnabled ? searchQuery.data : undefined;
  const projects = useMemo(
    () => Array.isArray(response?.projects) ? response.projects : [],
    [response],
  );
  const contacts = useMemo(
    () => Array.isArray(response?.contacts) ? response.contacts : [],
    [response],
  );
  const results = useMemo<SearchResult[]>(() => [...projects, ...contacts], [contacts, projects]);
  const responseQuery = response ? normalizePortalSearchQuery(response.query) : '';
  const showingPreviousResults = Boolean(response && responseQuery !== normalizedQuery);
  const waitingForDebounce = searchEnabled && requestQuery !== normalizedQuery;
  const refreshing = searchEnabled && (waitingForDebounce || searchQuery.isFetching);
  const refreshFailed = Boolean(searchQuery.isError && response && !showingPreviousResults);
  const hasResults = results.length > 0;
  const state: SearchState = !searchEnabled
    ? 'idle'
    : searchQuery.isError && (!response || showingPreviousResults)
      ? 'error'
      : response
        ? hasResults ? 'results' : 'empty'
        : 'loading';

  const resetSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    setInteractionActive(false);
    setActiveIndex(-1);
    setNavigatingHref(null);
    navigationStartRouteKeyRef.current = null;
  }, [setInteractionActive, setQuery]);

  useLayoutEffect(() => {
    if (!interactionActive) return;
    inputRef.current?.focus({ preventScroll: true });
    setOpen(true);
  }, [interactionActive]);

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
      setInteractionActive(true);
      setOpen(true);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [setInteractionActive, shortcutEnabled]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target)
        && !panelRef.current?.contains(target)
      ) {
        setOpen(false);
        setInteractionActive(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [setInteractionActive]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelPlacement(null);
      return;
    }

    const anchor = rootRef.current;
    const updatePlacement = () => setPanelPlacement(resolveSearchPanelPlacement(anchor));
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePlacement);
    resizeObserver?.observe(anchor);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
      resizeObserver?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(-1);
    if (!searchEnabled) {
      setDebouncedQuery('');
      return;
    }

    const timeout = window.setTimeout(
      () => setDebouncedQuery(normalizedQuery),
      PORTAL_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery, searchEnabled]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setInteractionActive(false);
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
      setInteractionActive(false);
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

  const preloadSearchDestination = useCallback(
    (href: string) => {
      if (prefetchedHrefRef.current.has(href)) return;
      prefetchedHrefRef.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

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
        prefetch={false}
        role="option"
        aria-selected={activeIndex === index}
        aria-current={current ? 'page' : undefined}
        className={styles.result}
        data-active={activeIndex === index ? 'true' : undefined}
        data-current={current ? 'true' : undefined}
        onMouseEnter={() => {
          setActiveIndex(index);
          preloadSearchDestination(result.href);
        }}
        onFocus={() => preloadSearchDestination(result.href)}
        onPointerDown={() => preloadSearchDestination(result.href)}
        onTouchStart={() => preloadSearchDestination(result.href)}
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
      data-global-search-state={state}
      data-global-search-query={normalizedQuery}
      data-global-search-response-query={responseQuery || undefined}
      data-global-search-refreshing={refreshing ? 'true' : 'false'}
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
          onFocus={() => {
            setInteractionActive(true);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setInteractionActive(true);
            setOpen(true);
            setNavigatingHref(null);
          }}
          onKeyDown={onInputKeyDown}
        />
        {state === 'loading' || refreshing || navigatingHref ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <kbd>Ctrl K</kbd>}
      </div>

      {showPanel && panelPlacement ? createPortal((
        <div
          ref={panelRef}
          className={styles.panel}
          data-global-search-panel="true"
          style={{ ...panelPlacement, position: 'fixed' }}
        >
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
          {state === 'results' && refreshing ? (
            <div className={styles.refreshStatus} role="status">Updating results…</div>
          ) : null}
          {state === 'results' && refreshFailed ? (
            <div className={`${styles.refreshStatus} ${styles.refreshError}`} role="alert">Could not refresh. Showing recent results.</div>
          ) : null}
          <div
            id={listboxId}
            role="listbox"
            aria-label="Portal search results"
            aria-busy={state === 'loading' || refreshing || Boolean(navigatingHref)}
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
                  prefetch={false}
                  onMouseEnter={() => preloadSearchDestination(`/staff/projects?q=${encodeURIComponent(trimmedQuery)}`)}
                  onFocus={() => preloadSearchDestination(`/staff/projects?q=${encodeURIComponent(trimmedQuery)}`)}
                  onPointerDown={() => preloadSearchDestination(`/staff/projects?q=${encodeURIComponent(trimmedQuery)}`)}
                  onTouchStart={() => preloadSearchDestination(`/staff/projects?q=${encodeURIComponent(trimmedQuery)}`)}
                  onClick={(event) => handleNavigationClick(event, `/staff/projects?q=${encodeURIComponent(trimmedQuery)}`, 'matching projects')}
                >
                  {navigatingHref === `/staff/projects?q=${encodeURIComponent(trimmedQuery)}` ? 'Opening projects' : 'View all matching projects'} <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
              {contacts.length ? (
                <Link
                  className={styles.viewAll}
                  href={`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`}
                  prefetch={false}
                  onMouseEnter={() => preloadSearchDestination(`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`)}
                  onFocus={() => preloadSearchDestination(`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`)}
                  onPointerDown={() => preloadSearchDestination(`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`)}
                  onTouchStart={() => preloadSearchDestination(`/staff/contacts?q=${encodeURIComponent(trimmedQuery)}`)}
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
      ), document.body) : null}
    </div>
  );
}

function StaticGlobalPortalSearch() {
  return (
    <div
      className={styles.root}
      data-global-portal-search="true"
      data-global-search-state="idle"
      data-global-search-query=""
      data-global-search-refreshing="false"
    >
      <div className={styles.inputShell}>
        <Search aria-hidden="true" />
        <input
          type="search"
          maxLength={PORTAL_SEARCH_MAX_LENGTH}
          placeholder="Search projects and contacts…"
          aria-label="Search projects and contacts"
          aria-expanded="false"
          aria-haspopup="listbox"
          role="combobox"
          readOnly
        />
        <kbd>Ctrl K</kbd>
      </div>
    </div>
  );
}

export default function GlobalPortalSearch({ shortcutEnabled = true }: { shortcutEnabled?: boolean }) {
  const queryClient = useOptionalPortalQueryClient();
  if (!queryClient) return <StaticGlobalPortalSearch />;
  return <ActiveGlobalPortalSearch queryClient={queryClient} shortcutEnabled={shortcutEnabled} />;
}
