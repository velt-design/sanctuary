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
import { usePathname } from 'next/navigation';

type ProjectInstantNavigationValue = {
  showProject: (href: string, view: ReactNode) => void;
};

const ProjectInstantNavigationContext = createContext<ProjectInstantNavigationValue | null>(null);

export default function ProjectInstantNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [instantView, setInstantView] = useState<ReactNode | null>(null);
  const [restoreList, setRestoreList] = useState(false);
  const listViewRef = useRef<ReactNode | null>(null);

  if (pathname === '/staff/projects' && !instantView && !restoreList) {
    listViewRef.current = children;
  }

  const showProject = useCallback((href: string, view: ReactNode) => {
    setRestoreList(false);
    setInstantView(view);
    window.history.pushState(null, '', href);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/staff/projects') {
        setInstantView(null);
        setRestoreList(true);
      } else {
        setRestoreList(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = useMemo(() => ({ showProject }), [showProject]);

  return (
    <ProjectInstantNavigationContext.Provider value={value}>
      {instantView ?? (restoreList && listViewRef.current ? listViewRef.current : children)}
    </ProjectInstantNavigationContext.Provider>
  );
}

export function useProjectInstantNavigation(): ProjectInstantNavigationValue {
  const value = useContext(ProjectInstantNavigationContext);
  if (!value) throw new Error('useProjectInstantNavigation must be used inside the Projects layout.');
  return value;
}
