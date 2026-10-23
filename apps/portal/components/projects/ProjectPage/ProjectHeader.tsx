'use client';
import type { ComponentProps } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Surface from './ProjectHeaderSurface';
import OwnerControl from './ProjectHeaderOwnerControl';
import Actions from './ProjectHeaderActions';
import GlobalPortalSearch from '@/components/layout/GlobalPortalSearch.client';
import GlobalPortalSearchSurface from '@/components/layout/GlobalPortalSearchSurface';
import { preloadProjectTab, preloadProjectTabModule } from './projectTabModules';
export default function ProjectHeader(props: ComponentProps<typeof Surface>) {
  const queryClient = useQueryClient();
  const privateReady = props.privateContentReady !== false;
  const metadataPending = (props.snapshotState ?? 'fresh') === 'pending' || props.snapshotState === 'summary';
  return <Surface {...props}
    search={props.searchReader !== undefined ? <GlobalPortalSearchSurface registration={props.searchReader} /> : privateReady ? <GlobalPortalSearch /> : <GlobalPortalSearchSurface registration={null} />}
    ownerControl={privateReady ? <OwnerControl project={props.project} projectId={props.projectId} pending={metadataPending}
      host={props.host} active={props.tab === 'activity'} expectedWorkModel={props.workModel} externallyPaused={props.readOnly || props.ownerControlsPaused} /> : null}
    actions={<Actions project={props.project} projectId={props.projectId} disabled={props.readOnly} privateContentReady={privateReady} />}
    onTabIntent={tab => { void (privateReady ? preloadProjectTab(tab, { host: props.host, projectId: props.projectId ?? props.project?.id ?? '', queryClient }) : preloadProjectTabModule(tab)); }} />;
}
