import type { PortalActionGrantRequest } from '@/lib/integrations/portalActions/contract';
import { PIPELINE_STAGE_LABELS, normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import { dateLabel, type Review } from './review';
import styles from './portalActions.module.css';

export default function GrantReview({ grant, review }: { grant: PortalActionGrantRequest; review: Review }) {
  return <>
    <div className={styles.summary}>
      <div><strong>{grant.label}</strong><p>{grant.taskReference}</p></div>
      <Badge tone={review.environment === 'production' ? 'warning' : 'neutral'}>{review.environment || 'Not configured'}</Badge>
      <div><strong>{grant.projectIds.length} projects · {grant.actions.length} approved actions</strong><p>Connection expires {dateLabel(grant.expiresAt)}</p></div>
    </div>
    {!review.enabled && <p role="alert">Portal action connections are disabled. This request cannot be authorised.</p>}
    {review.environment !== grant.environment && <p role="alert">The request is for a different environment. Import the correct request.</p>}
    <div className={styles.reviewList} role="region" aria-label="Project and action review" tabIndex={0}>
      {review.projects.map((project) => {
        const action = grant.actions.find((a) => a.projectId === project.projectId);
        const check = review.actions.find((a) => a.projectId === project.projectId);
        const stage = normalizePipelineStageKey(project.stage);
        const changed = action && project.rowVersion !== action.expectedRowVersion;
        return <article className={styles.project} key={project.projectId}>
          <div className={styles.row}><strong>{project.name}</strong><Badge>{action ? action.command === 'CLOSE' ? 'Close project' : 'Reopen project' : 'Read only'}</Badge></div>
          <p>{stage ? PIPELINE_STAGE_LABELS[stage] : project.stage || 'Stage unavailable'} · {project.state || 'State unavailable'}{project.archivedAt ? ' · Archived' : ''}</p>
          {action && <>
            <p><strong>Reason:</strong> {action.command === 'CLOSE' ? action.note : action.reason}</p>
            {action.command === 'CLOSE' && <p><strong>Outcome:</strong> {action.outcome.replaceAll('_', ' ').toLowerCase()}<br /><strong>Open work:</strong> cancelled with “{action.cancellationReason}”</p>}
            <p className={styles.muted}>Expected version {action.expectedRowVersion} · Current version {project.rowVersion ?? 'unavailable'} · Action expires {dateLabel(action.expiresAt)}</p>
            {(changed || !check?.eligible) && <p className={styles.conflict} role="alert">Needs review: {changed ? 'The project has changed since this action was approved.' : check?.reason || 'This action is not currently eligible.'}</p>}
          </>}
        </article>;
      })}
    </div>
    <details className={styles.manifest}><summary>View exact approval request</summary><pre>{JSON.stringify(grant, null, 2)}</pre></details>
  </>;
}
