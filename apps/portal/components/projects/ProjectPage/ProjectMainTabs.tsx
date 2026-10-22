'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab, type ProjectNavigationTabKey } from '@/lib/projects/projectTabs';
import layout from './ProjectPage.module.css';
import { ProjectEmailReadingProvider } from './tabs/overview/ProjectEmailReadingState';
import {
  CommercialTab,
  OverviewTab,
  FilesTab,
  JobPacksTab,
} from './projectTabModules';

export default function ProjectMainTabs({
  snapshot,
  projectId = snapshot?.project.id ?? "",
  host,
  readOnly = false,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  calculatorWorkspace = false,
  optimisticTab,
  onProjectAccessEnding,
  statusPanel,
}: {
  snapshot: ProjectPageSnapshot | null;
  projectId?: string;
  host: string;
  readOnly?: boolean;
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
  const activeTab = coerceProjectTab(requestedTab, !snapshotContentReady || Boolean(snapshot?.project.hasJobPacks));
  const commercial = activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices';

  return (
    <section
      id="project-tab-content"
      className={`${layout.projectTabSurface} ${activeTab === 'estimates' ? layout.tabSectionWorkspace : ''}`}
      aria-label="Project tab content"
      role="tabpanel"
      data-project-active-tab={activeTab}
    >
      <ProjectEmailReadingProvider scope={JSON.stringify([projectId, snapshot?.project.contactId, snapshot?.project.contactEmail])}>
      <div
        className={`${layout.projectTabBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {!commercial ? statusPanel : null}
        {activeTab === 'activity' ? (
          <OverviewTab
            readOnly={readOnly}
            snapshot={snapshot}
            projectId={projectId}
            snapshotContentReady={snapshotContentReady}
            snapshotState={snapshotState}
            host={host}
            onAccessEnding={onProjectAccessEnding}
          />
        ) : null}
        {activeTab === 'files' ? <FilesTab key={projectId} projectId={projectId} host={host} /> : null}
        {activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices' ? (
          <CommercialTab
            readOnly={readOnly}
            host={host}
            projectReady={Boolean(snapshot)}
            projectState={snapshotState}
            projectId={projectId}
            projectName={snapshot?.project.name}
            view={activeTab}
            calculatorWorkspace={calculatorWorkspace}
            statusPanel={statusPanel}
          />
        ) : null}
        {activeTab === 'job-packs' ? <JobPacksTab key={projectId} projectId={projectId} readOnly={readOnly} /> : null}
      </div>
      </ProjectEmailReadingProvider>
    </section>
  );
}
