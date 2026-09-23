import type { Project } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { Badge, ProjectStageBadge, TableCell } from '@/components/ui/foundation';
import { projectStageAge } from './projectStageAge';
import styles from './ProjectIndexLifecycleCells.module.css';

export default function ProjectIndexLifecycleCells({ project }: { project: Project }) {
  const stage = normalizePipelineStageKey(project.status ?? 'NEW');
  const state = project.effectiveState;
  const age = projectStageAge(project.stageChangedAt);
  return <>
    <TableCell data-column="Stage"><div className={styles.statusCell}>
      {state !== 'CLOSED' ? <ProjectStageBadge stage={stage ?? 'new'} compact /> : null}
      {state !== 'ACTIVE' ? <Badge tone={state === 'WAITING' ? 'warning' : 'neutral'}>
        {state ? state.charAt(0) + state.slice(1).toLowerCase() : 'State unavailable'}
      </Badge> : null}
    </div></TableCell>
    <TableCell data-column="Time in stage"><div className={styles.age}>
      {state === 'CLOSED' ? <span aria-label="Time in stage not applicable for closed projects">—</span> : <>
        <strong>{age?.label ?? 'Unknown'}</strong>
        {age ? <time dateTime={project.stageChangedAt!}>{age.date}</time> : <small>No recorded date</small>}
      </>}
    </div></TableCell>
  </>;
}
