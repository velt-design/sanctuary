'use client';
import type { ComponentProps } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Surface from './ProjectTabNavigationSurface';
import { preloadProjectTab, preloadProjectTabModule } from './projectTabModules';
export default function ProjectTabNavigation({ privateContentReady = true, ...props }: ComponentProps<typeof Surface> & { privateContentReady?: boolean }) {
  const queryClient = useQueryClient();
  return <Surface {...props} onIntent={tab => {
    void (privateContentReady ? preloadProjectTab(tab, { host: props.host, projectId: props.projectId, queryClient }) : preloadProjectTabModule(tab));
  }} />;
}
