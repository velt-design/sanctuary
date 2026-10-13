'use client';

import type { ComponentProps } from 'react';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import { ProjectOverviewReadsProvider, useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';

export default function ProjectPageFixtureFrame(props: Omit<ComponentProps<typeof ProjectPageFrame>, 'optimisticTab' | 'onTabSelect'>) {
  const navigation = useProjectTabSelection(props.snapshot.project.id, props.tab, props.snapshot.project.hasJobPacks);
  const reads = useProjectOverviewReads(props.host, props.snapshot.project.id, navigation.activeTab === 'activity');
  return <ProjectOverviewReadsProvider value={reads}>
    <ProjectPageFrame {...props} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab} />
  </ProjectOverviewReadsProvider>;
}
