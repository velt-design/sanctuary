"use client";

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { ProjectOverviewReadsProvider, type useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';
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
  calculatorWorkspace: boolean; searchReader: { component: SearchReadOwner } | null;
  onProjectAccessEnding: (status: number) => void; statusPanel: ReactNode;
};

/** The one real frame exists before and after its guarded reader is adopted. */
export default function ProjectSnapshotSurface({ projectId, tab, evidence, navigation, unavailable = false, initialCalculatorWorkspace = false, onRetry }: {
  projectId: string; tab: string; evidence: ProjectSnapshotEvidence | null;
  navigation: ReturnType<typeof useProjectTabSelection>; unavailable?: boolean; initialCalculatorWorkspace?: boolean; onRetry?: () => void;
}) {
  const search = useSearchParams();
  const calculatorWorkspace = search.get('tab') === null ? initialCalculatorWorkspace : search.get('tab') === 'estimates' && Boolean(search.get('estimateId') || search.get('fromEstimateId') || search.get('newDesign') === '1');
  const state = evidence?.snapshotState ?? (unavailable ? 'unavailable' : 'pending');
  return <PageLayout width="full" className={`${styles.page} ${calculatorWorkspace ? styles.calculatorPageLayout : ''}`}
    data-ui-foundation-consumer="project-detail" data-project-calculator-workspace={calculatorWorkspace ? 'true' : undefined}
    data-project-background-ready={state === 'fresh' ? 'true' : undefined} data-project-id={projectId}
    data-project-shell-ready="true" data-project-snapshot-state={state}>
    <ProjectOverviewReadsProvider value={evidence?.overviewReads ?? null}>
      <ProjectPageFrame projectId={projectId} snapshot={evidence?.snapshot ?? null} host={evidence?.host ?? 'unknown'}
        readOnly={evidence?.readOnly ?? true} snapshotContentReady={evidence?.snapshotContentReady ?? false}
        snapshotState={state} tab={tab} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
        calculatorWorkspace={calculatorWorkspace} privateContentReady={Boolean(evidence) && state !== 'unavailable'}
        searchReader={evidence?.searchReader ?? null} onProjectAccessEnding={evidence?.onProjectAccessEnding}
        statusPanel={evidence?.statusPanel ?? (unavailable ? <DataStatePanel state="unavailable" title="Project access unavailable"
          description="The project may have been removed, or your access may have changed." onRetry={onRetry} /> : null)} />
    </ProjectOverviewReadsProvider>
  </PageLayout>;
}
