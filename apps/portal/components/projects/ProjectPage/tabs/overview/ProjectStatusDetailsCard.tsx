'use client';

import { lazy, Suspense } from 'react';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { useProjectDetailsDraft } from '../../useProjectDetailsDraft';
import styles from './ProjectStatusDetailsCard.module.css';

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
              <button type="button" disabled={!canSave} onClick={finishEditing}>Done</button>
              <button type="button" disabled={isSaving} onClick={resetEditing}>Reset</button>
            </>
          ) : (
            <button type="button" onClick={() => setIsEditing(true)}>Edit details</button>
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
        <div className={styles.detailsError} role="status">
          <p>{error}</p>
          {canRetry ? (
            <div className={styles.detailsActions}>
              <button type="button" onClick={() => void retry()}>Retry now</button>
              <button type="button" onClick={reviewLocalDraft}>Review changes</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isEditing ? (
        <div className={styles.detailsForm}>
          <label htmlFor="contactName">Contact<input id="contactName" value={draft.contactName} onChange={(event) => updateDraftField('contactName', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="contactEmail">Email<input id="contactEmail" value={draft.contactEmail} onChange={(event) => updateDraftField('contactEmail', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="contactPhone">Phone<input id="contactPhone" value={draft.contactPhone} onChange={(event) => updateDraftField('contactPhone', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="projectName">Project name<input id="projectName" value={draft.projectName} onChange={(event) => updateDraftField('projectName', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="siteAddress">Site address<input id="siteAddress" value={draft.siteAddress} onChange={(event) => updateDraftField('siteAddress', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="region">Region<input id="region" value={draft.region} onChange={(event) => updateDraftField('region', event.target.value)} onBlur={saveCurrentDraft} /></label>
          <label htmlFor="quoteRef">Project / quote reference<input id="quoteRef" value={draft.quoteRef} onChange={(event) => updateDraftField('quoteRef', event.target.value)} onBlur={saveCurrentDraft} /></label>
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
