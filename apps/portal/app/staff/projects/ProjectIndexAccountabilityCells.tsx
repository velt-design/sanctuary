import { projectOwnerOption, PROJECT_OWNER_REQUIRED_STAGES } from '@/lib/projects/commandCentre/projectOwners';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectsIndexProject } from '@/lib/projects/projectsIndexContract';
import {
  projectClosedOutcomeLabel,
  projectWorkDueLabel,
} from '@/lib/projects/workItems/presentation';
import { Badge, TableCell } from '@/components/ui/foundation';
import styles from './ProjectIndexAccountabilityCells.module.css';

const DATE_FORMAT = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function waitingLabel(project: ProjectsIndexProject): string {
  if (!project.waitingUntil) return 'Waiting - no review date';
  const parsed = new Date(project.waitingUntil);
  return Number.isFinite(parsed.valueOf())
    ? `Waiting until ${DATE_FORMAT.format(parsed)}`
    : 'Waiting - review date unavailable';
}

export default function ProjectIndexAccountabilityCells({
  project,
}: {
  project: ProjectsIndexProject;
}) {
  const stage = normalizePipelineStageKey(project.status ?? 'NEW');
  const owner = projectOwnerOption(project.projectOwnerKey);
  const ownerRequired = Boolean(stage && PROJECT_OWNER_REQUIRED_STAGES.has(stage));
  const action = project.nextAction;

  let title: string;
  let reason: string | null;
  let due: string | null = null;
  if (action) {
    title = action.title;
    reason = action.reason;
    due = projectWorkDueLabel(action);
  } else if (project.effectiveState === 'WAITING') {
    title = waitingLabel(project);
    reason = project.waitingReason ?? 'No waiting reason recorded.';
  } else if (project.effectiveState === 'CLOSED') {
    title = `Closed: ${projectClosedOutcomeLabel(project.closedOutcome)}`;
    reason = 'Reopen the project before creating or acting on Project Work.';
  } else if (project.effectiveState === 'ARCHIVED') {
    title = 'Archived';
    reason = 'No active Project Work.';
  } else {
    title = 'No action due in the current queue';
    reason = 'Open the project to review future work or add a clear next action.';
  }

  return (
    <>
      <TableCell data-column="Owner">
        <Badge tone={!owner && ownerRequired ? 'warning' : 'neutral'}>
          {owner?.displayName ?? 'Unassigned'}
        </Badge>
      </TableCell>
      <TableCell data-column="Next attention">
        <div className={styles.action}>
          <strong>{title}</strong>
          {reason ? <span>{reason}</span> : null}
          {due ? <small>When: {due}</small> : null}
        </div>
      </TableCell>
    </>
  );
}
