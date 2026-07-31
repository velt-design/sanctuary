import type { Project, ProjectStatus } from '@/lib/types/project';
import { PROJECT_STATUS_ORDER, projectStatusLabel } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { resolveProjectJourney } from '@/lib/projects/projectJourney';
import {
  Badge,
  ProjectStageBadge,
  Select,
  TableCell,
} from '@/components/ui/foundation';
import styles from './ProjectIndexLifecycleCells.module.css';

export default function ProjectIndexLifecycleCells({
  project,
  projectName,
  stageBusy,
  onStageChange,
}: {
  project: Project;
  projectName: string;
  stageBusy: boolean;
  onStageChange: (project: Project, nextStage: string) => void;
}) {
  const stage = normalizePipelineStageKey(project.status ?? 'NEW');
  const journey = resolveProjectJourney(stage);
  const effectiveStateLabel = project.effectiveState
    ? project.effectiveState.charAt(0) + project.effectiveState.slice(1).toLowerCase()
    : 'Unavailable';

  return (
    <>
      <TableCell data-column="Journey">
        <span className={styles.journeyLabel}>{journey.phaseLabel}</span>
      </TableCell>
      <TableCell data-column="Stage">
        <div className={styles.statusCell}>
          <ProjectStageBadge stage={stage ?? 'new'} compact />
          <Select
            fieldClassName={styles.inlineSelectField}
            className={styles.inlineSelect}
            aria-label={`Stage for ${projectName || 'project'}`}
            value={(project.status ?? 'NEW') as ProjectStatus}
            disabled={stageBusy}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              onStageChange(project, event.target.value);
            }}
          >
            {PROJECT_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {projectStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
      </TableCell>
      <TableCell data-column="State">
        <Badge tone={project.effectiveState === 'WAITING' ? 'warning' : 'neutral'}>
          {effectiveStateLabel}
        </Badge>
      </TableCell>
    </>
  );
}
