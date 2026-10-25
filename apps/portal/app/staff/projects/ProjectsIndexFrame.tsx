'use client';
import type {ReactNode} from 'react';
import type {useProjectsIndexData} from './useProjectsIndexData';
import type {ProjectIndexView} from './projectIndexView';
import ProjectIndexToolbar from './ProjectIndexToolbar';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import HeaderActions from '@/components/layout/HeaderActions';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import ReadStatus from '@/components/page-state/ReadStatus';
import {PaginationSurface, type PaginationEvidence} from '@/components/ui/foundation/PaginationSurface';
import { Card, PageLayout, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import styles from './ProjectsIndexClient.module.css';
export type ProjectsIndexFrameRead=Pick<ReturnType<typeof useProjectsIndexData>,'state'|'backgroundReady'>&{
  data?:ReturnType<typeof useProjectsIndexData>['data'];retry:()=>unknown;
};
export default function ProjectsIndexFrame({read,view,updateView,resetView,rows,overlays,countNotice,pagination,canCreate=false}:{
  read:ProjectsIndexFrameRead;view:ProjectIndexView;updateView:(patch:Partial<ProjectIndexView>,resetPage?:boolean)=>void;
  resetView:()=>void;rows?:ReactNode;overlays?:ReactNode;countNotice?:ReactNode;pagination?:PaginationEvidence;canCreate?:boolean;
}){
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
            <div className={styles.listHeaderActions}><ReadStatus title={read.state === 'unavailable' ? 'Access unavailable' : read.state === 'refresh-failed' ? 'Refresh failed' : read.state === 'cached' ? 'Updating…' : !read.data ? 'Reading…' : ''}
              tone={read.state === 'refresh-failed' ? 'warning' : read.state === 'unavailable' ? 'error' : 'neutral'}
              action={countNotice}
              onRetry={read.state === 'refresh-failed' ? read.retry : undefined}
              details={read.state === 'refresh-failed' ? <DataStatePanel state={read.data?.projects.rows.length ? 'stale' : 'error'} /> : undefined} /><PaginationSurface compact evidence={pagination}/></div>
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
                  <TableBody>{rows}{!read.data && <TableRow><TableCell colSpan={6}>{read.state === 'pending' || read.state === 'cached' ? <p role="status">Reading projects…</p> : read.state === 'unavailable' ? <DataStatePanel state="unavailable" /> : null}</TableCell></TableRow>}
                  </TableBody>
                </Table>
        </Card>
      </div>

{overlays}
    </PageLayout>
  );
}
