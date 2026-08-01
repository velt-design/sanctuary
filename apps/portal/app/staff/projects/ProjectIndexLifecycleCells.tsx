import type { Project } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { resolveProjectJourney } from '@/lib/projects/projectJourney';
import {
  Badge,
  Button,
  ProjectStageBadge,
  TableCell,
} from '@/components/ui/foundation';
import styles from './ProjectIndexLifecycleCells.module.css';

export default function ProjectIndexLifecycleCells({
  project,
  stageBusy,
  onCorrectStage,
}: {
  project: Project;
  stageBusy: boolean;
  onCorrectStage: (project: Project) => void;
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
          <Button
            type="button"
            variant="quiet"
            size="small"
            aria-label={`Correct stage for ${project.projectName || project.name || 'project'}`}
            disabled={stageBusy}
            onClick={(event) => {
              event.stopPropagation();
              onCorrectStage(project);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {stageBusy ? 'Saving...' : 'Correct'}
          </Button>
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
