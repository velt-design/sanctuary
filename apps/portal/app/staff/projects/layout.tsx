import type { ReactNode } from 'react';
import ProjectInstantNavigationProvider from './ProjectInstantNavigation';

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <ProjectInstantNavigationProvider>{children}</ProjectInstantNavigationProvider>;
}
