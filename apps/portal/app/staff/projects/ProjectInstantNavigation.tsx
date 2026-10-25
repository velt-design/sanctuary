'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { projectDetailPath, useOwnedPortalPublication, usePortalPageSource } from '@/components/page-state/PortalPageSource';

import { selectProjectView } from '@/components/projects/ProjectPage/projectViewNavigation';
import type { ProjectNavigationTabKey, ProjectTabKey } from '@/lib/projects/projectTabs';
import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import ProjectSnapshotSurface, { type ProjectSnapshotProps, type ProjectSnapshotEvidence } from './[projectId]/ProjectSnapshotSurface';
import { useQuotesListControls, type QuotesListEvidence } from '@/components/projects/ProjectPage/tabs/QuotesListSurface';
import type { InvoicesListEvidence } from '@/components/projects/ProjectPage/tabs/InvoicesListSurface';
import type { CommercialTabChrome } from '@/components/projects/ProjectPage/tabs/CommercialTabSurface';
import { useEstimatesListControls, type EstimatesListEvidence } from '@/components/projects/ProjectPage/tabs/EstimatesListSurface';

function detailId(pathname: string | null | undefined): string | null {
  const path = pathname ? projectDetailPath(pathname, 'http://portal.invalid') : null;
  return path ? decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) : null;
}

import {useOverviewControls,type ProjectOverviewEvidence} from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import {useFilesControls,type ProjectFilesEvidence} from '@/components/projects/ProjectPage/tabs/ProjectFilesSurface';
import type {JobPacksListEvidence} from '@/components/projects/ProjectPage/tabs/JobPacksListSurface';
import { ProjectInstantNavigationContext } from './ProjectInstantNavigationContext';
export { useProjectInstantNavigation, useOptionalProjectWorkspace } from './ProjectInstantNavigationContext';

export default function ProjectInstantNavigationProvider({ children, standaloneProject }: {
  children: ReactNode; standaloneProject?: ProjectSnapshotProps;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { pendingHref } = usePortalRouteTransition();
  const source = usePortalPageSource();
  const [instantPathname, setInstantPathname] = useState<string | null>(null);
  const observedInstantPathRef = useRef(false);
  const openingAttemptRef = useRef<object | string | null>(null);

  const clearInstantView = useCallback(() => {
    observedInstantPathRef.current = false;
    openingAttemptRef.current = null;
    setInstantPathname(null);
  }, []);

  const showProject = useCallback((href: string) => {
    const nextPathname = projectDetailPath(href, window.location.href);
    if (!nextPathname || (source && !source.begin(href))) return;
    observedInstantPathRef.current = false;
    openingAttemptRef.current = source?.attempt?.identity ?? null;
    setInstantPathname(nextPathname);
    const url = new URL(href, window.location.href);
    if (!url.searchParams.has('tab')) url.searchParams.set('tab', 'activity');
    window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    router.replace(href, { scroll: false });
  }, [router, source?.attempt?.identity, source?.begin]);

  const selectedPath = source?.selectedPath;
  const selectedAttempt = source?.attempt?.identity;
  useEffect(() => {
    if (!instantPathname) return;
    // Accepted departure wins even while Next still reports the old detail.
    if (selectedAttempt && selectedAttempt !== openingAttemptRef.current && selectedPath !== instantPathname) {
      clearInstantView();
      return;
    }
    if (pathname === instantPathname || selectedPath === instantPathname) observedInstantPathRef.current = true;
    else if (observedInstantPathRef.current) clearInstantView();
  }, [clearInstantView, instantPathname, pathname, selectedAttempt, selectedPath]);

  useEffect(() => {
    if (!instantPathname || !pendingHref) return;
    try {
      const nextUrl = new URL(pendingHref, window.location.href);
      if (nextUrl.pathname !== instantPathname) clearInstantView();
    } catch {
      // Ignore malformed route intents; the navigation owner will reject them too.
    }
  }, [clearInstantView, instantPathname, pendingHref]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/staff/projects') {
        clearInstantView();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearInstantView]);

  const departed = Boolean(instantPathname && (
    selectedAttempt && selectedAttempt !== openingAttemptRef.current && selectedPath !== instantPathname
    || observedInstantPathRef.current && pathname !== instantPathname && selectedPath !== instantPathname));
  const pendingPath = useMemo(() => {
    try { return pendingHref ? new URL(pendingHref, 'http://portal.invalid').pathname : null; } catch { return null; }
  }, [pendingHref]);
  const activePath = standaloneProject ? `/staff/projects/${encodeURIComponent(standaloneProject.projectId)}`
    : pendingPath && pendingPath !== instantPathname ? pendingPath
    : instantPathname && !departed ? instantPathname : selectedPath ?? pathname;
  const projectId = standaloneProject?.projectId ?? detailId(activePath) ?? '';
  const estimatesListControls = useEstimatesListControls(projectId);
  const quotesListControls = useQuotesListControls(projectId);
  const invoicesListControls = useEstimatesListControls(projectId);
  const overviewControls=useOverviewControls(projectId);
  const filesControls=useFilesControls(projectId);
  const localOwner = useMemo(() => ({}), [projectId]);
  const owner = projectId ? standaloneProject || !source ? localOwner
    : source.selectedPath === activePath && source.canonicalPath === activePath ? source.owner : null : null;
  const publication = useOwnedPortalPublication<ProjectSnapshotEvidence>(owner);
  const listPublication = useOwnedPortalPublication<EstimatesListEvidence>(owner);
  const estimatesList = useMemo(() => ({ controls: estimatesListControls, publish: listPublication.publish }),
    [estimatesListControls, listPublication.publish]);
  const quotesPublication = useOwnedPortalPublication<QuotesListEvidence>(owner);
  const invoicesPublication = useOwnedPortalPublication<InvoicesListEvidence>(owner);
  const commercialPublication = useOwnedPortalPublication<CommercialTabChrome>(owner);
  const quotesList = useMemo(() => ({ controls: quotesListControls, publish: quotesPublication.publish }), [quotesListControls, quotesPublication.publish]);
  const invoicesList = useMemo(() => ({ controls: invoicesListControls, publish: invoicesPublication.publish }), [invoicesListControls, invoicesPublication.publish]);
  const overviewPublication=useOwnedPortalPublication<ProjectOverviewEvidence>(owner);
  const filesPublication=useOwnedPortalPublication<ProjectFilesEvidence>(owner);
  const jobPacksPublication=useOwnedPortalPublication<JobPacksListEvidence>(owner);
  const overview=useMemo(()=>({controls:overviewControls,publish:overviewPublication.publish}),[overviewControls,overviewPublication.publish]);
  const files=useMemo(()=>({controls:filesControls,publish:filesPublication.publish}),[filesControls,filesPublication.publish]);
  const evidence = useMemo(() => publication.value ? ({ ...publication.value, estimatesList: listPublication.value, quotesList: quotesPublication.value, invoicesList: invoicesPublication.value, commercial: commercialPublication.value,overview:overviewPublication.value,files:filesPublication.value,jobPacks:jobPacksPublication.value }) : null,
    [publication.value, listPublication.value, quotesPublication.value, invoicesPublication.value, commercialPublication.value,overviewPublication.value,filesPublication.value,jobPacksPublication.value]);
  const privateReady = Boolean(evidence);
  const onTabIntent = evidence?.onTabIntent;
  const tab = standaloneProject?.tab ?? 'activity';
  const currentNavigation = useProjectTabSelection(projectId, tab,
    evidence?.snapshotContentReady ? Boolean(evidence.snapshot?.project.hasJobPacks) : undefined);
  const navigationRef = useRef(currentNavigation); navigationRef.current = currentNavigation;
  const queuedTab = useRef<{ projectId: string; attempt: typeof selectedAttempt; tab: ProjectTabKey } | null>(null);
  const queuedPreparation = useRef<{ projectId: string; attempt: typeof selectedAttempt; tab: ProjectNavigationTabKey } | null>(null);
  const selectTab = useCallback((next: ProjectTabKey) => {
    if (!owner || !privateReady) queuedTab.current = { projectId, attempt: selectedAttempt, tab: next };
    navigationRef.current.selectTab(next);
  }, [owner, privateReady, projectId, selectedAttempt]);
  const currentPreparation = useRef({ projectId, owner, selectedAttempt, onTabIntent });
  currentPreparation.current = { projectId, owner, selectedAttempt, onTabIntent };
  const prepareTab = useCallback((next: ProjectNavigationTabKey) => {
    const current = currentPreparation.current;
    if (current.projectId !== projectId || current.owner !== owner || current.selectedAttempt !== selectedAttempt || current.onTabIntent !== onTabIntent) return;
    if (owner && onTabIntent) onTabIntent(next);
    else queuedPreparation.current = { projectId, attempt: selectedAttempt, tab: next };
  }, [owner, onTabIntent, projectId, selectedAttempt]);
  useLayoutEffect(() => {
    const queued = queuedTab.current;
    if (!queued) return;
    if (queued.projectId !== projectId || queued.attempt !== selectedAttempt && !(selectedAttempt === undefined && owner)) { queuedTab.current = null; return; }
    if (!owner || !privateReady) return;
    // Updating Next's native history bridge before its pending Flight commits
    // can cancel that delivery. Apply the already accepted safe view once adopted.
    queuedTab.current = null;
    selectProjectView(queued.tab, 'replace');
  }, [owner, privateReady, projectId, selectedAttempt]);
  useEffect(() => {
    const queued = queuedPreparation.current;
    if (!queued) return;
    if (queued.projectId !== projectId || queued.attempt !== selectedAttempt && !(selectedAttempt === undefined && owner)) { queuedPreparation.current = null; return; }
    if (!owner || !onTabIntent) return;
    queuedPreparation.current = null;
    onTabIntent(queued.tab, true);
  }, [owner, onTabIntent, projectId, selectedAttempt]);
  const navigation = useMemo(() => ({ activeTab: currentNavigation.activeTab, optimisticTab: currentNavigation.optimisticTab, selectTab }),
    [currentNavigation.activeTab, currentNavigation.optimisticTab, selectTab]);
  const warmCorrespondence = !standaloneProject && Boolean(source);
  const value = useMemo(() => ({ showProject, projectId, owner, navigation, publish: publication.publish, warmCorrespondence, estimatesList, quotesList, invoicesList, publishCommercial: commercialPublication.publish,overview,files,publishJobPacks:jobPacksPublication.publish }),
    [showProject, projectId, owner, navigation, publication.publish, warmCorrespondence, estimatesList, quotesList, invoicesList, commercialPublication.publish,overview,files,jobPacksPublication.publish]);

  return (
    <ProjectInstantNavigationContext.Provider value={value}>
      {children}
      {projectId ? <>
        <ProjectSnapshotSurface overviewControls={overviewControls} filesControls={filesControls} estimatesListControls={estimatesListControls} quotesListControls={quotesListControls} invoicesListControls={invoicesListControls} projectId={projectId} tab={tab} navigation={navigation} evidence={evidence} onTabIntent={prepareTab} deferHistory={!owner || !privateReady} initialCalculatorWorkspace={standaloneProject?.calculatorWorkspace} onRetry={source?.retry}
          unavailable={Boolean(source?.attempt?.unavailable && source.selectedPath === activePath)} />
      </> : null}
    </ProjectInstantNavigationContext.Provider>
  );
}
