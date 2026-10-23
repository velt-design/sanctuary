'use client';
import type {ReactNode} from 'react';
import type {useProjectsIndexData} from './useProjectsIndexData';
import type {ProjectIndexView} from './projectIndexView';
import ProjectIndexToolbar from './ProjectIndexToolbar';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import HeaderActions from '@/components/layout/HeaderActions';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { Card, PageLayout, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import styles from './ProjectsIndexClient.module.css';
export type ProjectsIndexFrameRead=Pick<ReturnType<typeof useProjectsIndexData>,'state'|'backgroundReady'>&{
  data?:ReturnType<typeof useProjectsIndexData>['data'];retry:()=>unknown;
};
export default function ProjectsIndexFrame({read,view,updateView,resetView,rows,overlays,countNotice,pagination,canCreate=false}:{
  read:ProjectsIndexFrameRead;view:ProjectIndexView;updateView:(patch:Partial<ProjectIndexView>,resetPage?:boolean)=>void;
  resetView:()=>void;rows?:ReactNode;overlays?:ReactNode;countNotice?:ReactNode;pagination?:ReactNode;canCreate?:boolean;
}){
  const {query,journeyFilter,stageFilter,stateFilter,ownerFilter,page,pageSize}=view;
  const rowCount=read.data?.projects.rows.length??0;
  const totalCount=read.data?.projects.totalCount??0;
  const rangeStart=totalCount?(page-1)*pageSize+1:0;
  const rangeEnd=Math.min(page*pageSize,totalCount);
  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-projects-index-state={read.state}
      data-projects-index-background-ready={read.backgroundReady ? 'true' : 'false'}
    >
      <StaffPageHeader
        title="Projects"
        variant="index"
        count={read.data ? `${read.data.projects.totalCount} projects` : read.state === 'unavailable' || read.state === 'refresh-failed' ? 'Projects unavailable' : 'Loading projects'}
        primaryAction={canCreate?{ label: 'New project', href: '/staff/projects/new' }:undefined}
        right={
          <HeaderActions>
            <ButtonLink variant="tertiary" href="/staff/projects/design-packages">Drafting Queue</ButtonLink>
            <ButtonLink variant="secondary" href="/staff/projects/running-jobs">Running Jobs</ButtonLink>
          </HeaderActions>
        }
      />

      {countNotice}
      <div className={styles.stack}>
        <ProjectIndexToolbar view={view} onChange={updateView} onReset={resetView} />

        <Card
          title="Projects"
          padding="none"
          aria-label="Projects list"
          action={(
            <div className={styles.muted} suppressHydrationWarning>
              {read.state === 'pending' || read.state === 'cached' ? 'Updating…' : null}
              {read.state === 'fresh' ? `${rangeStart}–${rangeEnd} of ${totalCount}` : null}
              {read.state === 'unavailable' ? 'Access unavailable' : null}
              {read.state === 'refresh-failed' ? 'Refresh failed' : null}
            </div>
          )}
        >
            {read.state === 'refresh-failed' ? (
              <DataStatePanel
                state={rowCount ? 'stale' : 'error'}
                onRetry={() => void read.retry()}
              />
            ) : null}
                <Table aria-label="Projects">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Time in stage</TableHead>
                      <TableHead>Next action</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{rows}{!rowCount&&<TableRow><TableCell colSpan={6}>{read.state === 'pending' || read.state === 'cached' ? (
              <p role="status">Reading projects…</p>
            ) : read.state === 'unavailable' ? (
              <DataStatePanel state="unavailable" />
            ) : read.state === 'refresh-failed' ? (
              null
            ) : (
              <DataStatePanel
                state={
                  view.query
                  || journeyFilter !== 'all'
                  || stageFilter !== 'all'
                  || stateFilter !== 'all'
                  || ownerFilter !== 'all'
                    ? 'filtered-empty'
                    : 'empty'
                }
                onClear={
                  view.query
                  || journeyFilter !== 'all'
                  || stageFilter !== 'all'
                  || stateFilter !== 'all'
                  || ownerFilter !== 'all'
                    ? resetView
                    : undefined
                }
              />
            )}</TableCell></TableRow>}
                  </TableBody>
                </Table>
                {pagination}
        </Card>
      </div>

{overlays}
    </PageLayout>
  );
}
