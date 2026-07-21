import Link from 'next/link';
import type { ProjectCommandExceptionsResponse } from '@/lib/projects/commandCentre/types';
import dash from '../dashboard.module.css';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';

const LABELS = {
  selection_conflict: 'Action conflict',
  no_action: 'No next action',
  missing_owner: 'No Project Owner',
} as const;

export default function ProjectExceptionsCard({
  data,
  pending,
  failed,
  onRetry,
}: {
  data?: ProjectCommandExceptionsResponse;
  pending: boolean;
  failed: boolean;
  onRetry?: () => void;
}) {
  if (!data && !pending && !failed) return null;
  const visibleProjects = data?.projects.slice(0, 6) ?? [];
  const remainingProjects = Math.max(0, (data?.totalProjects ?? visibleProjects.length) - visibleProjects.length);
  return (
    <section className={dash.exceptionsCard} data-dashboard-project-exceptions="true" aria-labelledby="project-exceptions-title">
      <div className={dash.exceptionsHeader}>
        <div><p>Command centre</p><h2 id="project-exceptions-title">Project exceptions</h2></div>
        <strong>{data?.totalProjects ?? '—'}</strong>
      </div>
      {failed && !data ? (
        <div className={dash.exceptionsEmpty} role="alert">
          <span>Project exceptions could not be loaded.</span>
          {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
        </div>
      ) : pending && !data ? (
        <p className={dash.exceptionsEmpty} role="status">Loading project exceptions…</p>
      ) : visibleProjects.length ? (
        <ul className={dash.exceptionsList}>
          {visibleProjects.map((project) => (
            <li key={project.projectId}>
              <Link href={project.href}>{project.projectName}</Link>
              <div>{project.reasons.map((reason) => <Badge key={reason} tone="warning" edge>{LABELS[reason]}</Badge>)}</div>
            </li>
          ))}
          {remainingProjects > 0 ? <li className={dash.exceptionsMore}>+{remainingProjects} more projects</li> : null}
        </ul>
      ) : <p className={dash.exceptionsEmpty}>No ownership or next-action exceptions.</p>}
    </section>
  );
}
