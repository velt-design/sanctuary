'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { isProjectSiteAddress, type ProjectSiteAddress, type SiteAddressSelection, type SiteAddressSuggestion } from '@/lib/projects/siteAddressContract';
import css from './StudioSiteAddressPicker.module.css';
import type {StudioSelectedAddressProof} from '@/lib/designStudio/studioTravelAllowance';
type SavedCallback=(proof:StudioSelectedAddressProof|null)=>void;

/** Local interaction only; authenticated HTTP owns provider validation and the canonical Project write. */
export default function StudioSiteAddressPicker({ actorId, projectId, disabled, canEditNow,onSaved }: {
  actorId: string; projectId: string; disabled: boolean; canEditNow: () => boolean;onSaved?:SavedCallback;
}) {
  const session = usePortalSession();
  const eligible = session.status === 'authenticated' && session.user?.id === actorId
    && (session.role === 'staff' || session.role === 'admin');
  return <CurrentAddress key={`${actorId}:${projectId}:${eligible}`} projectId={projectId} eligible={eligible} disabled={disabled} canEditNow={canEditNow} onSaved={onSaved} />;
}

function CurrentAddress({ projectId, eligible, disabled, canEditNow,onSaved }: {
  projectId: string; eligible: boolean; disabled: boolean; canEditNow: () => boolean;onSaved?:SavedCallback;
}) {
  const queryClient = useQueryClient();
  const inputId = useId(), listId = useId(), statusId = useId();
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const lifetime = useRef({ live: true, allowed: eligible && !disabled });
  lifetime.current.allowed = eligible && !disabled;
  const currentAuthority = useRef(canEditNow);
  currentAuthority.current = canEditNow;
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const sessionToken = useRef<string | null>(null);
  const retrySelection = useRef<SiteAddressSelection | null>(null);
  const selecting = useRef(false);
  const wantsPopup = useRef(false);
  const [saved, setSaved] = useState<ProjectSiteAddress | null>(null);
  const [selectionSaved, setSelectionSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'idle' | 'searching' | 'selecting'>('loading');
  const [suggestions, setSuggestions] = useState<SiteAddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<{ message: string; retry: 'load' | 'search' | 'select' } | null>(null);
  const path = `/api/projects/${encodeURIComponent(projectId)}/site-address`;

  function showPopup() { wantsPopup.current = true; setOpen(true); }
  function dismissPopup() { wantsPopup.current = false; setOpen(false); setActive(-1); }
  function cancel() {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
  }
  function begin() {
    cancel();
    const controller = new AbortController();
    pending.current = controller;
    return { controller, generation: generation.current };
  }
  function current(request: ReturnType<typeof begin>) {
    return lifetime.current.live && lifetime.current.allowed && currentAuthority.current() && !request.controller.signal.aborted
      && request.generation === generation.current;
  }
  function token() {
    return sessionToken.current ?? (sessionToken.current = crypto.randomUUID());
  }
  function accessEnded(failure: unknown) {
    const ended = failure instanceof Error && 'status' in failure && [401, 403, 404].includes(Number(failure.status));
    if (ended) { setSaved(null); setQuery(''); setSearch(false); retrySelection.current = null; sessionToken.current = null; }
    return ended;
  }
  useEffect(() => {
    lifetime.current.live = true;
    return () => { lifetime.current.live = false; cancel(); };
  }, []);
  useEffect(() => {
    if (!eligible || disabled) {
      cancel(); selecting.current = false; dismissPopup(); setSuggestions([]); setSearch(false);
    }
  }, [eligible, disabled]);
  useEffect(() => {
    if (!eligible) return;
    const request = begin();
    setPhase('loading'); setError(null);
    apiJson<{ siteAddress: ProjectSiteAddress }>(path, { signal: request.controller.signal })
      .then(({ siteAddress }) => {
        if (!isProjectSiteAddress(siteAddress, projectId)) throw Error('The saved project address could not be confirmed.');
        if (!lifetime.current.live || request.controller.signal.aborted || request.generation !== generation.current) return;
        setSaved(siteAddress); setQuery(siteAddress.address); setSelectionSaved(false); setPhase('idle');
      }).catch((failure) => {
        if (!lifetime.current.live || request.controller.signal.aborted || request.generation !== generation.current) return;
        accessEnded(failure);
        setPhase('idle'); setOpen(true);
        setError({ message: 'The project address could not be loaded. Retry to keep this project address current.', retry: 'load' });
      });
    return () => request.controller.abort();
  }, [projectId, eligible, disabled, attempt]);

  useEffect(() => {
    if (!search || !saved || !lifetime.current.allowed || query.trim().length < 3) return;
    const request = begin();
    setPhase('searching'); setSuggestions([]); setActive(-1); setError(null);
    const timer = setTimeout(() => {
      if (!current(request)) return;
      apiJson<{ suggestions: SiteAddressSuggestion[] }>(path, {
        method: 'POST', signal: request.controller.signal, skipSaveTracking: true,
        body: JSON.stringify({ action: 'search', query: query.trim(), sessionToken: token() }),
      }).then((response) => {
        if (!Array.isArray(response.suggestions) || response.suggestions.length > 5
          || response.suggestions.some(row => typeof row?.placeId !== 'string' || typeof row.address !== 'string')) throw Error('Invalid address results');
        if (!current(request)) return;
        setSuggestions(response.suggestions); setActive(-1); setPhase('idle'); setOpen(wantsPopup.current);
      }).catch((failure) => {
        if (!current(request)) return;
        setPhase('idle'); setOpen(wantsPopup.current);
        const ended = accessEnded(failure);
        setError({ message: ended ? 'Project address access could not be confirmed. Retry project access.'
          : 'Address search is unavailable. Your saved project address is kept.', retry: ended ? 'load' : 'search' });
      });
    }, 300);
    return () => { clearTimeout(timer); request.controller.abort(); };
  }, [query, search, saved, searchAttempt]);
  useEffect(() => {
    const panel = popup.current, option = panel?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!panel || !option) return;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight;
    }
  }, [active, open]);

  async function selectAddress(selection: SiteAddressSelection) {
    if (!lifetime.current.allowed || !currentAuthority.current() || selecting.current) return;
    selecting.current = true;
    const request = begin();
    retrySelection.current = selection;
    setSearch(false); setPhase('selecting'); setError(null); setSuggestions([]); setOpen(false);
    try {
      if (!current(request)) return;
      const result = await apiJson<{ siteAddress: ProjectSiteAddress;selectedAddressProof?:StudioSelectedAddressProof|null }>(path, {
        method: 'POST', signal: request.controller.signal, body: JSON.stringify(selection),
      });
      if (!isProjectSiteAddress(result.siteAddress, projectId)
        || result.siteAddress.address !== selection.address) throw Error('The selected address save could not be confirmed.');
      if (!current(request)) return;
      selecting.current = false;
      setSaved(result.siteAddress); setQuery(result.siteAddress.address); setSelectionSaved(true); setPhase('idle');
      onSaved?.(result.selectedAddressProof??null);
      retrySelection.current = null; sessionToken.current = null;
      // The HTTP receipt is already authoritative. A cache refresh failure must not turn it into a failed save.
      void invalidateProjectReadCaches(queryClient, supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', projectId).catch(() => {});
    } catch (failure) {
      if (!current(request)) return;
      selecting.current = false;
      setPhase('idle'); setOpen(true);
      const changed = failure instanceof Error && 'status' in failure && failure.status === 409;
      const ended = accessEnded(failure);
      if (changed) retrySelection.current = null;
      setError({ message: changed ? 'This project address changed elsewhere. Reload the project address, then choose again.'
        : ended ? 'Project address access could not be confirmed. Retry project access.'
          : failure instanceof Error ? failure.message : 'The address could not be saved. Retry the same selection.', retry: changed || ended ? 'load' : 'select' });
    }
  }
  function choose(suggestion: SiteAddressSuggestion) {
    if (!saved || !lifetime.current.allowed || !currentAuthority.current()) return;
    setQuery(suggestion.address);
    void selectAddress({ action: 'select', requestId: crypto.randomUUID(), placeId: suggestion.placeId, address: suggestion.address,
      sessionToken: token(), expectedUpdatedAt: saved.updatedAt });
  }
  function retry() {
    if (!lifetime.current.allowed || !currentAuthority.current()) return;
    if (error?.retry === 'select' && retrySelection.current) void selectAddress(retrySelection.current);
    else if (error?.retry === 'search') { setError(null); setSearchAttempt(n => n + 1); }
    else { setError(null); setAttempt(n => n + 1); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { dismissPopup(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); showPopup();
      if (suggestions.length) setActive(index => event.key === 'ArrowDown'
        ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && open && active >= 0 && suggestions[active]) {
      event.preventDefault(); choose(suggestions[active]);
    }
  }
  const confirmed = selectionSaved && query === saved?.address && !search && !error;
  const status = !eligible ? 'Unavailable' : phase === 'loading' ? 'Loading…'
    : phase === 'searching' ? 'Searching…' : phase === 'selecting' ? 'Saving address…'
      : confirmed ? 'Address saved' : saved?.address && query === saved.address ? 'Saved project address' : 'Choose an NZ address';
  const panel = open && (Boolean(error) || search && query.trim().length >= 3);
  return <div ref={root} className={css.picker} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismissPopup();
  }}>
    <div className={css.label}><label htmlFor={inputId}>Site address</label><span id={statusId} role="status" className={css.status}>{status}</span></div>
    <input id={inputId} type="text" role="combobox" autoComplete="off" aria-autocomplete="list"
      aria-expanded={panel && suggestions.length > 0} aria-controls={listId}
      aria-activedescendant={panel && active >= 0 ? `${listId}-${active}` : undefined}
      aria-describedby={statusId} aria-invalid={Boolean(error)}
      value={eligible ? query : ''} disabled={!eligible || disabled || phase === 'loading' || phase === 'selecting' || !saved}
      placeholder="Search a New Zealand street address" onKeyDown={onKeyDown}
      onFocus={showPopup} onChange={event => {
        cancel(); if (retrySelection.current) sessionToken.current = null;
        retrySelection.current = null; setQuery(event.target.value); setSearch(true);
        setSuggestions([]); setActive(-1); setError(null); setPhase('idle'); showPopup();
      }} />
    {panel && <div ref={popup} className={css.panel}>
      {error ? <div className={css.notice} role="alert">{error.message}<div><button type="button" disabled={disabled || !eligible} onClick={retry}>Retry {error.retry === 'load' ? 'project address' : error.retry === 'search' ? 'search' : 'selection'}</button><button type="button" onClick={dismissPopup}>Dismiss</button></div></div>
        : phase === 'searching' ? <p className={css.notice}>Searching New Zealand addresses…</p>
          : suggestions.length ? <ul id={listId} role="listbox" aria-label="New Zealand addresses" className={css.options}>{suggestions.map((row, index) => <li
            key={row.placeId} id={`${listId}-${index}`} role="option" aria-selected={active === index}
            className={css.option} onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)}
            onClick={() => choose(row)}>{row.address}</li>)}</ul>
            : <p className={css.notice}>No matching physical address found. Try the street number, street and town. Rural or new addresses may be missing. This search has not confirmed an address; travel cost remains manual.</p>}
      {!error && <div className={css.attribution} translate="no">Google Maps</div>}
    </div>}
  </div>;
}
