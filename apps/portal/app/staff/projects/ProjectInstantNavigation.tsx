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

type ProjectInstantNavigationValue = {
  showProject: (href: string, view: ReactNode) => void;
};

const ProjectInstantNavigationContext = createContext<ProjectInstantNavigationValue | null>(null);

export default function ProjectInstantNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pendingHref } = usePortalRouteTransition();
  const [instantView, setInstantView] = useState<ReactNode | null>(null);
  const [instantPathname, setInstantPathname] = useState<string | null>(null);
  const observedInstantPathRef = useRef(false);

  const clearInstantView = useCallback(() => {
    observedInstantPathRef.current = false;
    setInstantPathname(null);
    setInstantView(null);
  }, []);

  const showProject = useCallback((href: string, view: ReactNode) => {
    const nextPathname = new URL(href, window.location.href).pathname;
    observedInstantPathRef.current = false;
    setInstantPathname(nextPathname);
    setInstantView(view);
    window.history.pushState(null, '', `${href}?tab=activity`);
    router.replace(href, { scroll: false });
  }, [router]);

  useEffect(() => {
    clearInstantView();
  }, [children, clearInstantView]);

  useEffect(() => {
    if (!instantPathname) return;
    if (pathname === instantPathname) {
      observedInstantPathRef.current = true;
      return;
    }
    if (observedInstantPathRef.current) clearInstantView();
  }, [clearInstantView, instantPathname, pathname]);

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

  const value = useMemo(() => ({ showProject }), [showProject]);

  return (
    <ProjectInstantNavigationContext.Provider value={value}>
      {instantView ?? children}
    </ProjectInstantNavigationContext.Provider>
  );
}

export function useProjectInstantNavigation(): ProjectInstantNavigationValue {
  const value = useContext(ProjectInstantNavigationContext);
  if (!value) throw new Error('useProjectInstantNavigation must be used inside the Projects layout.');
  return value;
}
