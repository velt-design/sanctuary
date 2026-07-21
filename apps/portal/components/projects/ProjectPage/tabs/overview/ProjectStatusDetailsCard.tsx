'use client';

import { lazy, Suspense } from 'react';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { useProjectDetailsDraft } from '../../useProjectDetailsDraft';
import styles from './ProjectStatusDetailsCard.module.css';
import { AlertBanner, Button, Input, useUnsavedChangesGuard } from '@/components/ui/foundation';

const ProjectStageControl = lazy(() => import('./ProjectStageControl'));

export default function ProjectStatusDetailsCard({
  project,
  host,
}: {
  project: ProjectPageSnapshot['project'];
  host: string;
}) {
  const {
    canRetry,
    canSave,
    displayed,
    draft,
    error,
    finishEditing,
    isEditing,
    isSaving,
    resetEditing,
    retry,
    reviewLocalDraft,
    saveCurrentDraft,
    setIsEditing,
    statusText,
    updateDraftField,
  } = useProjectDetailsDraft(project);
  useUnsavedChangesGuard(isEditing && canSave);

  return (
    <section className={styles.detailsCard} aria-labelledby="project-status-details-title" data-project-status-details="true">
      <div className={styles.detailsHeader}>
        <div>
          <p className={styles.eyebrow}>Project overview</p>
          <h2 id="project-status-details-title">Status &amp; details</h2>
        </div>
        <div className={styles.detailsActions}>
          {statusText ? <span role="status">{statusText}</span> : null}
          {isEditing ? (
            <>
              <Button size="small" disabled={!canSave} onClick={finishEditing}>Done</Button>
              <Button size="small" variant="tertiary" disabled={isSaving} onClick={resetEditing}>Reset</Button>
            </>
          ) : (
            <Button size="small" variant="secondary" onClick={() => setIsEditing(true)}>Edit details</Button>
          )}
        </div>
      </div>

      <Suspense
        fallback={(
          <div className={styles.stageControl} role="status">
            <div><span>Pipeline stage</span><strong>{project.stage.replaceAll('_', ' ')}</strong></div>
          </div>
        )}
      >
        <ProjectStageControl projectId={project.id} host={host} stage={project.stage} />
      </Suspense>

      {error ? (
        <AlertBanner tone="error" title="Project details could not be saved">
          <p>{error}</p>
          {canRetry ? (
            <div className={styles.detailsActions}>
              <Button size="small" variant="secondary" onClick={() => void retry()}>Retry now</Button>
              <Button size="small" variant="tertiary" onClick={reviewLocalDraft}>Review changes</Button>
            </div>
          ) : null}
        </AlertBanner>
      ) : null}

      {isEditing ? (
        <div className={styles.detailsForm}>
          <Input id="contactName" label="Contact" value={draft.contactName} onChange={(event) => updateDraftField('contactName', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="contactEmail" label="Email" type="email" value={draft.contactEmail} onChange={(event) => updateDraftField('contactEmail', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="contactPhone" label="Phone" type="tel" value={draft.contactPhone} onChange={(event) => updateDraftField('contactPhone', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="projectName" label="Project name" value={draft.projectName} onChange={(event) => updateDraftField('projectName', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="siteAddress" label="Site address" value={draft.siteAddress} onChange={(event) => updateDraftField('siteAddress', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="region" label="Region" value={draft.region} onChange={(event) => updateDraftField('region', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="quoteRef" label="Project / quote reference" value={draft.quoteRef} onChange={(event) => updateDraftField('quoteRef', event.target.value)} onBlur={saveCurrentDraft} />
        </div>
      ) : (
        <dl className={styles.detailsGrid}>
          <div><dt>Contact</dt><dd>{displayed.contactName || '—'}</dd></div>
          <div><dt>Email</dt><dd>{displayed.contactEmail || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{displayed.contactPhone || '—'}</dd></div>
          <div><dt>Project name</dt><dd>{displayed.projectName || '—'}</dd></div>
          <div><dt>Site address</dt><dd>{displayed.siteAddress || '—'}</dd></div>
          <div><dt>Region</dt><dd>{displayed.region || '—'}</dd></div>
          <div><dt>Project / quote reference</dt><dd>{displayed.quoteRef || 'Not allocated'}</dd></div>
        </dl>
      )}
    </section>
  );
}
