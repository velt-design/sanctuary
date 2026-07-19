'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

type ProjectInstantNavigationValue = {
  showProject: (href: string, view: ReactNode) => void;
};

const ProjectInstantNavigationContext = createContext<ProjectInstantNavigationValue | null>(null);

export default function ProjectInstantNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [instantView, setInstantView] = useState<ReactNode | null>(null);

  const showProject = useCallback((href: string, view: ReactNode) => {
    setInstantView(view);
    window.history.pushState(null, '', `${href}?tab=activity`);
    router.replace(href, { scroll: false });
  }, [router]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/staff/projects') {
        setInstantView(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
