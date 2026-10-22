'use client';

import { LoaderCircle, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type RefObject } from 'react';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { normalizePortalSearchQuery, PORTAL_SEARCH_MAX_LENGTH } from '@/lib/search/portalSearchContract';
import { useOptionalPortalQueryClient } from '@/lib/react-query/PortalQueryClientContext';
import { useOptionalGlobalPortalSearchState } from './GlobalPortalSearchState';
import styles from './GlobalPortalSearch.module.css';

type SearchInputController = {
  rootRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  listboxId: string;
  query: string;
  setQuery: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  interactionActive: boolean;
  setInteractionActive: (value: boolean) => void;
};
export type SearchInputEvidence = {
  state: 'idle' | 'loading' | 'results' | 'empty' | 'error';
  responseQuery: string;
  refreshing: boolean;
  navigating: boolean;
  showPanel: boolean;
  activeOptionId?: string;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChange: () => void;
};
export type SearchReadProps = { controller: SearchInputController; publish: (value: SearchInputEvidence | null) => void };
export type SearchReadOwner = ComponentType<SearchReadProps>;

function hidden(element: Element) { return Boolean(element.closest('[hidden], [inert], [aria-hidden="true"]')); }

/** One input/controller. Private evidence is supplied only by the current guarded reader. */
export default function GlobalPortalSearchSurface({ shortcutEnabled = true, reader }: {
  shortcutEnabled?: boolean; reader?: SearchReadOwner;
}) {
  const transition = usePortalRouteTransition();
  const shared = useOptionalGlobalPortalSearchState();
  const queryClient = useOptionalPortalQueryClient();
  const rootRef = useRef<HTMLDivElement | null>(null), inputRef = useRef<HTMLInputElement | null>(null), panelRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const [localQuery, setLocalQuery] = useState(''), [localInteraction, setLocalInteraction] = useState(false), [open, setOpen] = useState(false);
  const query = shared?.query ?? localQuery, setQuery = shared?.setQuery ?? setLocalQuery;
  const interactionActive = shared?.interactionActive ?? localInteraction, setInteractionActive = shared?.setInteractionActive ?? setLocalInteraction;
  const activeInstanceId = shared?.activeInstanceId, setActiveInstanceId = shared?.setActiveInstanceId;
  const Reader = queryClient ? shared?.guarded ? shared.reader?.component : reader : undefined;
  const binding = shared?.guarded ? shared.reader : Reader;
  const currentBinding = useRef(binding); currentBinding.current = binding;
  const currentQuery = useRef(query); currentQuery.current = query;
  const [published, setPublished] = useState<{ binding: typeof binding; query: string; value: SearchInputEvidence } | null>(null);
  const publish = useCallback((value: SearchInputEvidence | null) => {
    if (currentBinding.current !== binding || currentQuery.current !== query) return;
    setPublished(current => value ? { binding, query, value } : current && current.binding === binding && current.query === query ? null : current);
  }, [binding, query]);
  const evidence = binding && published?.binding === binding && published.query === query ? published.value : null;
  const controller = useMemo(() => ({ rootRef, inputRef, panelRef, listboxId, query, setQuery, open, setOpen, interactionActive, setInteractionActive }),
    [interactionActive, listboxId, open, query, setInteractionActive, setQuery]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!interactionActive || !input || hidden(input)) return;
    const focused = document.activeElement;
    if (focused !== input) {
      if (!shortcutEnabled || (focused && focused !== document.body && !hidden(focused))) return;
      input.focus({ preventScroll: true });
    }
    if (document.activeElement === input) { setActiveInstanceId?.(listboxId); setOpen(true); }
  }, [interactionActive, listboxId, setActiveInstanceId, shortcutEnabled, transition.instantRoute]);
  useEffect(() => {
    if (!shortcutEnabled) return;
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      const input = inputRef.current;
      if (event.defaultPrevented || !input || hidden(input)) return;
      const command = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      const editable = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]');
      if (!command && (!slash || editable)) return;
      event.preventDefault(); input.focus({ preventScroll: true }); setActiveInstanceId?.(listboxId); setInteractionActive(true); setOpen(true);
    };
    window.addEventListener('keydown', onShortcut); return () => window.removeEventListener('keydown', onShortcut);
  }, [listboxId, setActiveInstanceId, setInteractionActive, shortcutEnabled]);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (activeInstanceId !== undefined && activeInstanceId !== listboxId) return;
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) { setOpen(false); setInteractionActive(false); }
    };
    document.addEventListener('pointerdown', onPointerDown); return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [activeInstanceId, listboxId, setInteractionActive]);
  return <div className={styles.root} ref={rootRef} data-global-portal-search="true"
    data-global-portal-search-pathname={transition.pathname ?? undefined}
    data-global-search-state={evidence?.state ?? 'idle'} data-global-search-query={normalizePortalSearchQuery(query)}
    data-global-search-response-query={evidence?.responseQuery || undefined} data-global-search-refreshing={evidence?.refreshing ? 'true' : 'false'}>
    <div className={styles.inputShell}><Search aria-hidden="true"/><input ref={inputRef} type="search" value={query}
      maxLength={PORTAL_SEARCH_MAX_LENGTH} placeholder="Jump to a project or contact…" aria-label="Jump to a project or contact"
      aria-autocomplete="list" aria-controls={evidence?.showPanel ? listboxId : undefined}
      aria-activedescendant={evidence?.showPanel ? evidence.activeOptionId : undefined} aria-expanded={Boolean(evidence?.showPanel)}
      aria-haspopup="listbox" role="combobox" readOnly={!queryClient}
      onFocus={() => { setActiveInstanceId?.(listboxId); setInteractionActive(true); setOpen(true); }}
      onChange={event => { setQuery(event.target.value); setInteractionActive(true); setOpen(true); shared?.setNavigationRouteKey(null); evidence?.onChange(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setInteractionActive(false); } evidence?.onKeyDown(event); }}/>
      {evidence?.state === 'loading' || evidence?.refreshing || evidence?.navigating ? <LoaderCircle className={styles.spinner} aria-hidden="true"/> : <kbd>Ctrl K</kbd>}
    </div>
    {Reader ? <Reader controller={controller} publish={publish}/> : null}
  </div>;
}
