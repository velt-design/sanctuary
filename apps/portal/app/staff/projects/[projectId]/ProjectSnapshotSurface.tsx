"use client";

import ProjectOverviewSurface,{type OverviewControls,type ProjectOverviewEvidence} from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import {ProjectFilesWorkspace,ProjectFilesSurface,type FilesControls,type ProjectFilesEvidence} from '@/components/projects/ProjectPage/tabs/ProjectFilesSurface';
import JobPacksListSurface,{type JobPacksListEvidence} from '@/components/projects/ProjectPage/tabs/JobPacksListSurface';
import QuotesListSurface, { type QuotesListEvidence, type useQuotesListControls } from '@/components/projects/ProjectPage/tabs/QuotesListSurface';
import InvoicesListSurface, { type InvoicesListEvidence } from '@/components/projects/ProjectPage/tabs/InvoicesListSurface';
import CommercialTabSurface, { type CommercialTabChrome } from '@/components/projects/ProjectPage/tabs/CommercialTabSurface';
import EstimatesListSurface, { type EstimatesListControls, type EstimatesListEvidence } from '@/components/projects/ProjectPage/tabs/EstimatesListSurface';
import { selectProjectView } from '@/components/projects/ProjectPage/projectViewNavigation';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectPageFrameSurface from '@/components/projects/ProjectPage/ProjectPageFrameSurface';
import ProjectHeaderSurface from '@/components/projects/ProjectPage/ProjectHeaderSurface';
import ProjectPageShellSurface from '@/components/projects/ProjectPage/ProjectPageShellSurface';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { ProjectOverviewReadsProvider, overviewProjectId } from '@/components/projects/ProjectPage/ProjectOverviewReadContext';
import type { useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';
import type { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import type { ProjectWorkInitialRead, ProjectWorkReadLoaders } from '@/lib/projects/projectWorkInitialRead';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import type { SearchReadOwner } from '@/components/layout/GlobalPortalSearchSurface';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';

export type ProjectSnapshotProps = {
  projectId: string; tab: string; estimateId: string | null; calculatorWorkspace?: boolean;
  debugExportEnabled: boolean; initialRead?: ProjectWorkInitialRead; readOnly?: boolean; readLoaders?: ProjectWorkReadLoaders;
};
export type ProjectSnapshotEvidence = {
  snapshot: ProjectPageSnapshot | null; host: string; readOnly: boolean; snapshotContentReady: boolean;
  snapshotState: ProjectSnapshotLoadState; overviewReads: ReturnType<typeof useProjectOverviewReads>;
  calculatorWorkspace: boolean;
  projectWork?: ProjectPageSnapshot['projectWork'];
  overview?:ProjectOverviewEvidence|null;files?:ProjectFilesEvidence|null;jobPacks?:JobPacksListEvidence|null;
  estimatesList?: EstimatesListEvidence | null; quotesList?: QuotesListEvidence | null; invoicesList?: InvoicesListEvidence | null; commercial?: CommercialTabChrome | null;
  headerOwner?: ReactNode; headerActions?: ReactNode; body?: ReactNode;
  onTabIntent?: (tab: import('@/lib/projects/projectTabs').ProjectNavigationTabKey, codeOnly?: boolean) => void;
  searchReader: { component: SearchReadOwner } | null;
  onProjectAccessEnding: (status: number) => void; statusPanel: ReactNode;
};

/** The one real frame exists before and after its guarded reader is adopted. */
export default function ProjectSnapshotSurface({ projectId, tab, evidence, navigation, unavailable = false, initialCalculatorWorkspace = false, onRetry, onTabIntent, deferHistory, estimatesListControls, quotesListControls, invoicesListControls,overviewControls,filesControls }: {
  projectId: string; tab: string; evidence: ProjectSnapshotEvidence | null;
  navigation: ReturnType<typeof useProjectTabSelection>; unavailable?: boolean; initialCalculatorWorkspace?: boolean; onRetry?: () => void;
  overviewControls?:OverviewControls;filesControls?:FilesControls;
  onTabIntent?: ProjectSnapshotEvidence['onTabIntent']; deferHistory?: boolean; estimatesListControls?: EstimatesListControls; quotesListControls?: ReturnType<typeof useQuotesListControls>; invoicesListControls?: EstimatesListControls;
}) {
  const search = useSearchParams();
  const calculatorWorkspace = search.get('tab') === null ? initialCalculatorWorkspace : search.get('tab') === 'estimates' && Boolean(search.get('estimateId') || search.get('fromEstimateId') || search.get('newDesign') === '1');
  const frameProjectId = evidence?.snapshot?.project.id ?? overviewProjectId(projectId);
  const state = evidence?.snapshotState ?? (unavailable ? 'unavailable' : 'pending');
  return <PageLayout width="full" className={`${styles.page} ${calculatorWorkspace ? styles.calculatorPageLayout : ''}`}
    data-ui-foundation-consumer="project-detail" data-project-calculator-workspace={calculatorWorkspace ? 'true' : undefined}
    data-project-background-ready={state === 'fresh' ? 'true' : undefined} data-project-id={projectId}
    data-project-shell-ready="true" data-project-snapshot-state={state}>
    <ProjectOverviewReadsProvider value={evidence?.overviewReads ?? null}>
      <ProjectPageFrameSurface calculatorWorkspace={calculatorWorkspace} header={<ProjectHeaderSurface
        projectId={frameProjectId} project={evidence?.snapshot?.project ?? null} host={evidence?.host ?? 'unknown'}
        readOnly={evidence?.readOnly ?? true} tab={tab} snapshotState={state}
        workModel={evidence?.snapshot?.workModel} projectWork={evidence?.projectWork}
        tabAvailabilityReady={evidence?.snapshotContentReady ?? false} ownerControlsPaused={state !== 'fresh'}
        optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
        privateContentReady={Boolean(evidence) && state !== 'unavailable'} deferHistory={deferHistory}
        searchReader={evidence?.searchReader ?? null} ownerControl={evidence?.headerOwner}
        privateActions={evidence?.headerActions} onTabIntent={onTabIntent} /> }>
        <ProjectPageShellSurface projectId={frameProjectId} snapshot={evidence?.snapshot ?? null} host={evidence?.host ?? 'unknown'}
        readOnly={evidence?.readOnly ?? true} snapshotContentReady={evidence?.snapshotContentReady ?? false}
        snapshotState={state} tab={tab} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
        calculatorWorkspace={calculatorWorkspace} privateContentReady={Boolean(evidence) && state !== 'unavailable'}
          publicBody={['estimates', 'quotes', 'invoices'].includes(navigation.activeTab) ? <CommercialTabSurface
            view={navigation.activeTab as 'estimates' | 'quotes' | 'invoices'} calculatorWorkspace={calculatorWorkspace}
            onSelect={(next) => {
              if (evidence?.commercial) evidence.commercial.onSelect(next);
              else if (deferHistory || selectProjectView(next)) navigation.selectTab(next);
            }} onIntent={(next) => {
              if (evidence?.commercial) evidence.commercial.onIntent(next);
              else onTabIntent?.('estimates');
            }} quoteViews={navigation.activeTab === 'quotes' ? evidence?.commercial?.quoteViews : null}>
            {evidence?.commercial?.notice}
            <div inert={evidence?.commercial?.inert} style={{ display: 'contents' }}>
              {navigation.activeTab === 'estimates' && !calculatorWorkspace && estimatesListControls ? <EstimatesListSurface
                query={estimatesListControls.query} onQueryChange={estimatesListControls.setQuery} onInteraction={estimatesListControls.markInteracted}
                evidence={state === 'unavailable' ? null : evidence?.estimatesList ?? null} unavailable={unavailable || state === 'unavailable'} /> : null}
              {navigation.activeTab === 'quotes' && !search.get('quoteId') && !search.get('createFromEstimateId') && !evidence?.commercial?.quoteDetail && quotesListControls ? <QuotesListSurface
                query={quotesListControls.query} onQueryChange={quotesListControls.setQuery} showHistory={quotesListControls.showHistory}
                onHistoryChange={quotesListControls.setShowHistory} onInteraction={quotesListControls.markInteracted} evidence={state === 'unavailable' ? null : evidence?.quotesList ?? null} unavailable={unavailable || state === 'unavailable'} /> : null}
              {navigation.activeTab === 'invoices' && invoicesListControls ? <InvoicesListSurface
                query={invoicesListControls.query} onQueryChange={invoicesListControls.setQuery} onInteraction={invoicesListControls.markInteracted}
                evidence={state === 'unavailable' ? null : evidence?.invoicesList ?? null} unavailable={unavailable || state === 'unavailable'} /> : null}
              {evidence && state !== 'unavailable' ? evidence.body : null}
            </div>
          </CommercialTabSurface> : navigation.activeTab==='activity'&&overviewControls?<>
          <ProjectOverviewSurface controls={overviewControls} evidence={state==='unavailable'?null:evidence?.overview??null} unavailable={state==='unavailable'} onFiles={()=>{if(deferHistory||selectProjectView('files'))navigation.selectTab('files');}}/>
          {evidence&&state!=='unavailable'?evidence.body:null}</>:navigation.activeTab==='files'&&filesControls?<ProjectFilesWorkspace projectId={projectId}>
          <ProjectFilesSurface controls={filesControls} evidence={state==='unavailable'?null:evidence?.files??null} unavailable={state==='unavailable'} workspace/>
          {evidence&&state!=='unavailable'?evidence.body:null}</ProjectFilesWorkspace>:navigation.activeTab==='job-packs'&&!search.get('estimateId')?<>
          <JobPacksListSurface evidence={state==='unavailable'?null:evidence?.jobPacks??null} unavailable={state==='unavailable'}/>
          {evidence&&state!=='unavailable'?evidence.body:null}</>:undefined}
          onProjectAccessEnding={evidence?.onProjectAccessEnding} body={evidence?.body}
          statusPanel={evidence?.statusPanel ?? (unavailable ? <DataStatePanel state="unavailable" title="Project access unavailable"
          description="The project may have been removed, or your access may have changed." onRetry={onRetry} /> : null)} />
      </ProjectPageFrameSurface>
    </ProjectOverviewReadsProvider>
  </PageLayout>;
}
