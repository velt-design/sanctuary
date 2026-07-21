'use client';

import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab } from '@/lib/projects/projectTabs';
import layout from './ProjectPage.module.css';
import {
  CommercialTab,
  ProjectCalculatorTab,
  OverviewTab,
  JobPacksTab,
} from './projectTabModules';

export default function ProjectMainTabs({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  onProjectAccessEnding?: (status: number) => void;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') ?? tab;
  const activeTab = coerceProjectTab(requestedTab, Boolean(snapshot.project.hasJobPacks));

  return (
    <section
      id="project-tab-content"
      className={`${layout.projectTabSurface} ${activeTab === 'estimates' ? layout.tabSectionWorkspace : ''}`}
      aria-label="Project tab content"
      role="tabpanel"
      data-project-active-tab={activeTab}
    >
      <div
        className={`${layout.projectTabBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {activeTab === 'activity' ? (
          <OverviewTab
            snapshot={snapshot}
            snapshotContentReady={snapshotContentReady}
            snapshotState={snapshotState}
            host={host}
            onAccessEnding={onProjectAccessEnding}
          />
        ) : null}
        {activeTab === 'estimates' ? (
          <ProjectCalculatorTab host={host} projectId={snapshot.project.id} />
        ) : null}
        {activeTab === 'quotes' || activeTab === 'invoices' ? (
          <CommercialTab host={host} projectId={snapshot.project.id} view={activeTab} />
        ) : null}
        {activeTab === 'job-packs' ? <JobPacksTab projectId={snapshot.project.id} /> : null}
      </div>
    </section>
  );
}
