'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab, type ProjectTabKey } from '@/lib/projects/projectTabs';
import layout from './ProjectPage.module.css';
export default function ProjectMainTabsSurface({
  snapshot,
  projectId = snapshot?.project.id ?? "",
  host,
  readOnly = false,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  calculatorWorkspace = false,
  optimisticTab,
  onTabSelect,
  onProjectAccessEnding,
  statusPanel,
  privateContentReady = true,
  body,
  publicEstimatesList,
}: {
  snapshot: ProjectPageSnapshot | null;
  projectId?: string;
  host: string;
  readOnly?: boolean;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  optimisticTab?: ProjectTabKey | null;
  onTabSelect?: (tab: ProjectTabKey) => void;
  onProjectAccessEnding?: (status: number) => void;
  statusPanel?: ReactNode;
  privateContentReady?: boolean;
  body?: ReactNode;
  publicEstimatesList?: ReactNode;
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
      <div
        className={`${layout.projectTabBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {!privateContentReady || !commercial ? statusPanel : null}
        {publicEstimatesList}
        {privateContentReady ? body : null}
      </div>
    </section>
  );
}
