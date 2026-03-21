'use client';

import { createContext, useContext, type ReactNode } from 'react';

type ProjectPageDesignRailContextValue = {
  renderInShell: boolean;
  rightRailNode: HTMLDivElement | null;
};

const ProjectPageDesignRailContext = createContext<ProjectPageDesignRailContextValue>({
  renderInShell: false,
  rightRailNode: null,
});

export function ProjectPageDesignRailProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ProjectPageDesignRailContextValue;
}) {
  return <ProjectPageDesignRailContext.Provider value={value}>{children}</ProjectPageDesignRailContext.Provider>;
}

export function useProjectPageDesignRail() {
  return useContext(ProjectPageDesignRailContext);
}
