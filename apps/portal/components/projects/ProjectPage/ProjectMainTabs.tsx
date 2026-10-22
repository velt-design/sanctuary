'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab, type ProjectNavigationTabKey } from '@/lib/projects/projectTabs';
import layout from './ProjectPage.module.css';
import loadingStyles from './projectTabModules.module.css';
import { ProjectEmailReadingProvider } from './tabs/overview/ProjectEmailReadingState';
import {
  CommercialTab,
  OverviewTab,
  FilesTab,
  JobPacksTab,
} from './projectTabModules';

export default function ProjectMainTabs({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  calculatorWorkspace = false,
  optimisticTab,
  onProjectAccessEnding,
  statusPanel,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  optimisticTab?: ProjectNavigationTabKey | null;
  onProjectAccessEnding?: (status: number) => void;
  statusPanel?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const requestedTab = optimisticTab ?? searchParams.get('tab') ?? tab;
  // Summary metadata cannot prove a specialist is absent. Match route/navigation
  // intent until the full snapshot resolves availability, including on failure.
  const activeTab = coerceProjectTab(requestedTab, !snapshotContentReady || Boolean(snapshot.project.hasJobPacks));
  const commercial = activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices';

  return (
    <section
      id="project-tab-content"
      className={`${layout.projectTabSurface} ${activeTab === 'estimates' ? layout.tabSectionWorkspace : ''}`}
      aria-label="Project tab content"
      role="tabpanel"
      data-project-active-tab={activeTab}
    >
      <ProjectEmailReadingProvider scope={JSON.stringify([snapshot.project.id, snapshot.project.contactId, snapshot.project.contactEmail])}>
      <div
        className={`${layout.projectTabBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {!commercial ? statusPanel : null}
        {activeTab === 'activity' ? (
          <OverviewTab
            snapshot={snapshot}
            snapshotContentReady={snapshotContentReady}
            snapshotState={snapshotState}
            host={host}
            onAccessEnding={onProjectAccessEnding}
          />
        ) : null}
        {activeTab === 'files' ? <FilesTab projectId={snapshot.project.id} host={host} /> : null}
        {activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices' ? (
          <CommercialTab
            host={host}
            projectId={snapshot.project.id}
            projectName={snapshot.project.name}
            view={activeTab}
            calculatorWorkspace={calculatorWorkspace}
            statusPanel={statusPanel}
          />
        ) : null}
        {activeTab === 'job-packs' ? snapshotContentReady ? <JobPacksTab projectId={snapshot.project.id} /> : (
          <div
            className={loadingStyles.tabLoadingState}
            data-project-job-packs-availability={snapshotState === 'refresh-failed' ? 'unavailable' : 'pending'}
            role="status"
          >
            {snapshotState === 'refresh-failed'
              ? 'Job Packs availability could not be loaded. Retry the project refresh above.'
              : 'Checking Job Packs availability…'}
          </div>
        ) : null}
      </div>
      </ProjectEmailReadingProvider>
    </section>
  );
}
