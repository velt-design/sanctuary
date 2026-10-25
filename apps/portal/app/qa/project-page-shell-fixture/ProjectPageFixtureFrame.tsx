'use client';

import type { ComponentProps } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import ProjectSnapshotNotice from '@/components/projects/ProjectPage/ProjectSnapshotNotice';
import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import { ProjectOverviewReadsProvider, useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';

export default function ProjectPageFixtureFrame(props: Omit<ComponentProps<typeof ProjectPageFrame>, 'optimisticTab' | 'onTabSelect'>) {
  const stateParam = useSearchParams().get('snapshotState');
  const stateOverride = stateParam === 'summary' || stateParam === 'refresh-failed' || stateParam === 'fresh' ? stateParam : undefined;
  const snapshotState = stateOverride ?? props.snapshotState;
  const navigation = useProjectTabSelection(props.projectId ?? props.snapshot?.project.id ?? "", props.tab, props.snapshot?.project.hasJobPacks);
  const reads = useProjectOverviewReads(props.host, props.projectId ?? props.snapshot?.project.id ?? "", navigation.activeTab === 'activity');
  const retry = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('snapshotState', 'summary');
    window.history.replaceState(null, '', url);
  };
  return <ProjectOverviewReadsProvider value={reads}>
    <ProjectPageFrame {...props} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
      snapshotState={snapshotState} snapshotContentReady={stateOverride ? stateOverride === 'fresh' : props.snapshotContentReady}
      statusPanel={stateOverride ? <ProjectSnapshotNotice state={stateOverride} onRetry={retry} /> : props.statusPanel} />
  </ProjectOverviewReadsProvider>;
}
