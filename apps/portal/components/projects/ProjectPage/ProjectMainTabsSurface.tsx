'use client';

import type { ReactNode } from 'react';
import ProjectReadFeedback from './ProjectReadFeedback';
import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab, type ProjectTabKey } from '@/lib/projects/projectTabs';
import layout from './ProjectPage.module.css';
export default function ProjectMainTabsSurface({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  calculatorWorkspace = false,
  optimisticTab,
  statusPanel,
  privateContentReady = true,
  body,
  publicBody,
}: {
  snapshot: ProjectPageSnapshot | null;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  optimisticTab?: ProjectTabKey | null;
  statusPanel?: ReactNode;
  privateContentReady?: boolean;
  body?: ReactNode;
  publicBody?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const requestedTab = optimisticTab ?? searchParams.get('tab') ?? tab;
  // Summary metadata cannot prove a specialist is absent. Match route/navigation
  // intent until the full snapshot resolves availability, including on failure.
  const activeTab = coerceProjectTab(requestedTab, !snapshotContentReady || Boolean(snapshot?.project.hasJobPacks));

  return (
    <section
      id="project-tab-content"
      className={layout.projectTabSurface}
      aria-label="Project tab content"
      role="tabpanel"
      data-project-active-tab={activeTab}
    >
      <div
        className={layout.projectTabBody}
        data-project-tab-body={activeTab}
      >
        {calculatorWorkspace ? statusPanel ?? (snapshotState !== 'unavailable' ? <ProjectReadFeedback title={!privateContentReady ? 'Reading project…' : 'Project current'} /> : null) : null}
        {publicBody ?? (privateContentReady ? body : null)}
      </div>
    </section>
  );
}
