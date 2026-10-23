'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { projectDetailPath, useOwnedPortalPublication, usePortalPageSource } from '@/components/page-state/PortalPageSource';

import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import ProjectSnapshotSurface, { type ProjectSnapshotProps, type ProjectSnapshotEvidence } from './[projectId]/ProjectSnapshotSurface';
import { ProjectCorrespondenceWarmRead } from '@/components/projects/ProjectPage/tabs/overview/ProjectCorrespondenceWarmRead';

type ProjectInstantNavigationValue = {
  showProject: (href: string) => void;
  projectId: string;
  owner: object | null;
  navigation: ReturnType<typeof useProjectTabSelection>;
  publish: (value: ProjectSnapshotEvidence | null) => void;
};

function detailId(pathname: string | null | undefined): string | null {
  const path = pathname ? projectDetailPath(pathname, 'http://portal.invalid') : null;
  return path ? decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) : null;
}

const ProjectInstantNavigationContext = createContext<ProjectInstantNavigationValue | null>(null);

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
  const localOwner = useMemo(() => ({}), [projectId]);
  const owner = projectId ? standaloneProject || !source ? localOwner
    : source.selectedPath === activePath && source.canonicalPath === activePath ? source.owner : null : null;
  const publication = useOwnedPortalPublication<ProjectSnapshotEvidence>(owner);
  const evidence = publication.value;
  const tab = standaloneProject?.tab ?? 'activity';
  const currentNavigation = useProjectTabSelection(projectId, tab,
    evidence?.snapshotContentReady ? Boolean(evidence.snapshot?.project.hasJobPacks) : undefined);
  const navigationRef = useRef(currentNavigation); navigationRef.current = currentNavigation;
  const selectTab = useCallback((next: Parameters<typeof currentNavigation.selectTab>[0]) => navigationRef.current.selectTab(next), []);
  const navigation = useMemo(() => ({ activeTab: currentNavigation.activeTab, optimisticTab: currentNavigation.optimisticTab, selectTab }),
    [currentNavigation.activeTab, currentNavigation.optimisticTab, selectTab]);
  const value = useMemo(() => ({ showProject, projectId, owner, navigation, publish: publication.publish }),
    [showProject, projectId, owner, navigation, publication.publish]);

  return (
    <ProjectInstantNavigationContext.Provider value={value}>
      {children}
      {projectId ? <ProjectCorrespondenceWarmRead projectId={projectId} enabled={!standaloneProject && Boolean(source) && Boolean(owner) && evidence?.snapshotState !== 'unavailable' && navigation.activeTab === 'activity'}>
        <ProjectSnapshotSurface projectId={projectId} tab={tab} navigation={navigation} evidence={evidence} initialCalculatorWorkspace={standaloneProject?.calculatorWorkspace} onRetry={source?.retry}
          unavailable={Boolean(source?.attempt?.unavailable && source.selectedPath === activePath)} />
      </ProjectCorrespondenceWarmRead> : null}
    </ProjectInstantNavigationContext.Provider>
  );
}

export function useProjectInstantNavigation(): ProjectInstantNavigationValue {
  const value = useContext(ProjectInstantNavigationContext);
  if (!value) throw new Error('useProjectInstantNavigation must be used inside the Projects layout.');
  return value;
}

export function useOptionalProjectWorkspace() { return useContext(ProjectInstantNavigationContext); }
