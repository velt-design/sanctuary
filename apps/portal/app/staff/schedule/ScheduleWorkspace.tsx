'use client';

import { useRouter } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveScheduleTodayYmd } from '@/lib/scheduling/scheduleClock';
import type { ScheduleView } from './ScheduleViewTabs';
import Frame, { type ScheduleFrameProps } from './ScheduleFrame';
import { ScheduleSurfaceProvider, ScheduleSurfaceIsolation } from './ScheduleSurfaceContext';

export type PublishedScheduleFrame = { owner: object; props?: ScheduleFrameProps; replacement?: ReactNode };

function usePublicScheduleController(owner: object | null, initialView: ScheduleView, entryIdentity: object | string) {
  const [entry, setEntry] = useState(entryIdentity);
  const [today, setToday] = useState(resolveScheduleTodayYmd);
  const [view, setView] = useState<ScheduleView>(initialView);
  const [query, setQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(true);
  const preserveCollapseOnAdoption = useRef(false);
  if (entry !== entryIdentity) {
    setEntry(entryIdentity); setView(initialView); setQuery(''); setShowCompleted(false); setUnscheduledCollapsed(true);
    setToday(resolveScheduleTodayYmd());
    preserveCollapseOnAdoption.current = false;
  }
  useEffect(() => {
    const followHistory = () => setView(new URL(window.location.href).searchParams.get('view') === 'gantt' ? 'gantt' : 'board');
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);
  return useMemo(() => ({ owner, today, view, setView, query, setQuery, showCompleted,
    setShowCompleted, unscheduledCollapsed, setUnscheduledCollapsed, preserveCollapseOnAdoption }),
  [owner, today, view, query, showCompleted, unscheduledCollapsed]);
}
type ScheduleController = Omit<ReturnType<typeof usePublicScheduleController>, 'unscheduledCollapsed'> & {
  setUnscheduledCollapsedFromIntent: ReturnType<typeof usePublicScheduleController>['setUnscheduledCollapsed'];
};
const ScheduleWorkspaceContext = createContext<ScheduleController | null>(null);
const SchedulePublicationContext = createContext<((value: PublishedScheduleFrame | null) => void) | null>(null);

export function ScheduleWorkspace({ owner, visible, children, initialView = 'board', entryIdentity = '/', unavailable = false, onRetry }: {
  owner: object | null; visible: boolean; children: ReactNode; initialView?: ScheduleView; entryIdentity?: object | string;
  unavailable?: boolean; onRetry?: () => void;
}) {
  const controller = usePublicScheduleController(owner, initialView, entryIdentity);
  const collapseEvidencePending = useRef(true);
  const setUnscheduledCollapsedFromIntent = useCallback<ScheduleController['setUnscheduledCollapsed']>(value => {
    if (collapseEvidencePending.current) controller.preserveCollapseOnAdoption.current = true;
    controller.setUnscheduledCollapsed(value);
  }, [controller.preserveCollapseOnAdoption, controller.setUnscheduledCollapsed]);
  // A public panel toggle must not invalidate the private row/query owner.
  // Its stable setter still accepts the guarded source's initial defaults.
  const privateController = useMemo<ScheduleController>(() => ({
    owner: controller.owner, today: controller.today, view: controller.view, setView: controller.setView,
    query: controller.query, setQuery: controller.setQuery, showCompleted: controller.showCompleted,
    setShowCompleted: controller.setShowCompleted, setUnscheduledCollapsed: controller.setUnscheduledCollapsed,
    setUnscheduledCollapsedFromIntent,
    preserveCollapseOnAdoption: controller.preserveCollapseOnAdoption,
  }), [controller.owner, controller.today, controller.view, controller.setView, controller.query,
    controller.setQuery, controller.showCompleted, controller.setShowCompleted,
    controller.setUnscheduledCollapsed, controller.preserveCollapseOnAdoption, setUnscheduledCollapsedFromIntent]);
  const router = useRouter();
  const [published, setPublished] = useState<PublishedScheduleFrame | null>(null);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const publish = useCallback((value: PublishedScheduleFrame | null) => {
    if (owner !== currentOwner.current || (value && value.owner !== owner)) return;
    setPublished(value);
  }, [owner]);
  const props = published?.owner === owner ? published.props : null;
  const replacement = published?.owner === owner ? published.replacement : null;
  collapseEvidencePending.current = !props || Boolean(props.board.dataPending || props.board.dataError);
  const toggleUnscheduled = () => {
    setUnscheduledCollapsedFromIntent(value => !value);
  };
  useLayoutEffect(() => {
    if (!owner || !visible) return;
    const url = new URL(window.location.href);
    const selectedView = controller.view === 'site_visits' ? 'site-visits' : controller.view;
    if ((url.searchParams.get('view') || 'board') === selectedView) return;
    url.searchParams.set('view', selectedView);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [owner, visible, controller.view]);
  const selectPendingView = (next: ScheduleView) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', next === 'site_visits' ? 'site-visits' : next);
    const href = `${url.pathname}${url.search}${url.hash}`;
    if (next === 'site_visits') { router.replace(href); return; }
    window.history.replaceState(window.history.state, '', href);
    controller.setView(next);
  };
  return <ScheduleWorkspaceContext.Provider value={privateController}>
    <SchedulePublicationContext.Provider value={publish}>
    <ScheduleSurfaceProvider owner={owner} today={controller.today} ganttActive={visible && controller.view === 'gantt'}>
      {visible ? replacement ? <ScheduleSurfaceIsolation>{replacement}</ScheduleSurfaceIsolation> : <Suspense fallback={null}>
        {props ? <Frame {...props} board={{ ...props.board,
          unscheduledCollapsed: controller.unscheduledCollapsed,
          onToggleUnscheduledCollapsed: toggleUnscheduled,
        }} /> : <Frame pending={{
          unavailable, onRetry,
          today: controller.today, view: controller.view, query: controller.query,
          showCompleted: controller.showCompleted, unscheduledCollapsed: controller.unscheduledCollapsed,
          setQuery: controller.setQuery, setShowCompleted: controller.setShowCompleted,
          selectView: selectPendingView,
          toggleUnscheduled,
          openUnscheduled: () => { setUnscheduledCollapsedFromIntent(false); selectPendingView('board'); },
        }} />}
      </Suspense> : null}
      {children}
    </ScheduleSurfaceProvider>
    </SchedulePublicationContext.Provider>
  </ScheduleWorkspaceContext.Provider>;
}

export function useScheduleWorkspace() { return useContext(ScheduleWorkspaceContext); }
export function useScheduleFramePublication() { return useContext(SchedulePublicationContext); }
