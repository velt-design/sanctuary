'use client';
import type {ReactNode} from 'react';
import type {useProjectsIndexData} from './useProjectsIndexData';
import type {ProjectIndexView} from './projectIndexView';
import ProjectIndexToolbar from './ProjectIndexToolbar';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import HeaderActions from '@/components/layout/HeaderActions';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import ReadStatus from '@/components/page-state/ReadStatus';
import {Pagination} from '@/components/ui/foundation/FoundationPagination';
import { Card, PageLayout, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import styles from './ProjectsIndexClient.module.css';
export type ProjectsIndexFrameRead=Pick<ReturnType<typeof useProjectsIndexData>,'state'|'backgroundReady'>&{
  data?:ReturnType<typeof useProjectsIndexData>['data'];retry:()=>unknown;
};
export default function ProjectsIndexFrame({read,view,updateView,resetView,rows,overlays,countNotice,onPageChange,canCreate=false}:{
  read:ProjectsIndexFrameRead;view:ProjectIndexView;updateView:(patch:Partial<ProjectIndexView>,resetPage?:boolean)=>void;
  resetView:()=>void;rows?:ReactNode;overlays?:ReactNode;countNotice?:ReactNode;onPageChange?:(page:number)=>void;canCreate?:boolean;
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
        reservePrimaryAction
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

      <div className={styles.stack}>
        <ProjectIndexToolbar view={view} onChange={updateView} onReset={resetView} />

        <Card
          className={styles.listCard}
          title="Projects"
          padding="none"
          aria-label="Projects list"
          action={(
            <ReadStatus title={read.state === 'unavailable' ? 'Access unavailable' : read.state === 'refresh-failed' ? 'Refresh failed' : read.state === 'cached' ? 'Updating…' : !read.data ? 'Reading…' : ''}
              tone={read.state === 'refresh-failed' ? 'warning' : read.state === 'unavailable' ? 'error' : 'neutral'}
              action={<><Pagination compact currentPage={page} totalPages={read.data?.projects.totalPages ?? null} disabled={!onPageChange} onPageChange={onPageChange} itemSummary={read.data ? `${rangeStart}–${rangeEnd} of ${totalCount}` : undefined}/>{countNotice}</>}
              onRetry={read.state === 'refresh-failed' ? read.retry : undefined}
              details={read.state === 'refresh-failed' ? <DataStatePanel state={rowCount ? 'stale' : 'error'} /> : undefined} />
          )}
        >
                <Table aria-label="Projects" className={styles.indexTable} viewportClassName={styles.listViewport}>

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
        </Card>
      </div>

{overlays}
    </PageLayout>
  );
}
