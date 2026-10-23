'use client';

import type { EstimatesListBinding } from './tabs/EstimatesListSurface';
import { useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab, type ProjectTabKey } from '@/lib/projects/projectTabs';
import { ProjectEmailReadingProvider } from './tabs/overview/ProjectEmailReadingState';
import {
  CommercialTab,
  OverviewTab,
  FilesTab,
  JobPacksTab,
} from './projectTabModules';

export default function ProjectTabBody({
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
  estimatesList,
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
  statusPanel?: import("react").ReactNode;
  privateContentReady?: boolean;
  estimatesList?: EstimatesListBinding;
}) {
  const searchParams = useSearchParams();
  const requestedTab = optimisticTab ?? searchParams.get('tab') ?? tab;
  // Summary metadata cannot prove a specialist is absent. Match route/navigation
  // intent until the full snapshot resolves availability, including on failure.
  const activeTab = coerceProjectTab(requestedTab, !snapshotContentReady || Boolean(snapshot?.project.hasJobPacks));
  const commercial = activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices';

  return <ProjectEmailReadingProvider scope={JSON.stringify([projectId, snapshot?.project.contactId, snapshot?.project.contactEmail])}>
        {privateContentReady && activeTab === 'activity' ? (
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
        {privateContentReady && activeTab === 'files' ? <FilesTab key={projectId} projectId={projectId} host={host} /> : null}
        {privateContentReady && (activeTab === 'estimates' || activeTab === 'quotes' || activeTab === 'invoices') ? (
          <CommercialTab
            estimatesList={estimatesList}
            readOnly={readOnly}
            host={host}
            projectReady={Boolean(snapshot)}
            projectState={snapshotState}
            projectId={projectId}
            projectName={snapshot?.project.name}
            view={activeTab}
            optimisticView={optimisticTab === "estimates" || optimisticTab === "quotes" || optimisticTab === "invoices" ? optimisticTab : null}
            onViewSelect={onTabSelect}
            calculatorWorkspace={calculatorWorkspace}
            statusPanel={statusPanel}
          />
        ) : null}
        {privateContentReady && activeTab === 'job-packs' ? <JobPacksTab key={projectId} projectId={projectId} readOnly={readOnly} /> : null}
  </ProjectEmailReadingProvider>;
}
