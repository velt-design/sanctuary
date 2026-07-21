'use client';

import { lazy, Suspense } from 'react';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { useProjectDetailsDraft } from '../../useProjectDetailsDraft';
import styles from './ProjectStatusDetailsCard.module.css';
import { AlertBanner, Badge, Button, Card, Input, KeyValueGrid, useUnsavedChangesGuard } from '@/components/ui/foundation';

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
    <Card
      title="Status & details"
      eyebrow="Project overview"
      padding="none"
      className={styles.detailsCard}
      aria-label="Project status and details"
      data-project-status-details="true"
      action={(
        <div className={styles.detailsActions}>
          {statusText ? <Badge tone={isSaving ? 'info' : 'neutral'}>{statusText}</Badge> : null}
          {isEditing ? (
            <>
              <Button size="small" disabled={!canSave} onClick={finishEditing}>Done</Button>
              <Button size="small" variant="tertiary" disabled={isSaving} onClick={resetEditing}>Reset</Button>
            </>
          ) : (
            <Button size="small" variant="secondary" onClick={() => setIsEditing(true)}>Edit details</Button>
          )}
        </div>
      )}
    >

      <Suspense
        fallback={(
          <KeyValueGrid items={[{ label: 'Pipeline stage', value: project.stage.replaceAll('_', ' ') }]} ariaLabel="Pipeline stage" />
        )}
      >
        <ProjectStageControl projectId={project.id} host={host} stage={project.stage} />
      </Suspense>

      {error ? (
        <div className={styles.detailsNotice}>
          <AlertBanner tone="error" title="Project details could not be saved">
          {error}
          {canRetry ? (
            <div className={styles.detailsActions}>
              <Button size="small" variant="secondary" onClick={() => void retry()}>Retry now</Button>
              <Button size="small" variant="tertiary" onClick={reviewLocalDraft}>Review changes</Button>
            </div>
          ) : null}
          </AlertBanner>
        </div>
      ) : null}

      {isEditing ? (
        <div className={styles.detailsForm} aria-label="Edit project details">
          <Input id="contactName" label="Contact" value={draft.contactName} onChange={(event) => updateDraftField('contactName', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="contactEmail" label="Email" type="email" value={draft.contactEmail} onChange={(event) => updateDraftField('contactEmail', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="contactPhone" label="Phone" type="tel" value={draft.contactPhone} onChange={(event) => updateDraftField('contactPhone', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="projectName" label="Project name" value={draft.projectName} onChange={(event) => updateDraftField('projectName', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="siteAddress" label="Site address" value={draft.siteAddress} onChange={(event) => updateDraftField('siteAddress', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="region" label="Region" value={draft.region} onChange={(event) => updateDraftField('region', event.target.value)} onBlur={saveCurrentDraft} />
          <Input id="quoteRef" label="Project / quote reference" value={draft.quoteRef} onChange={(event) => updateDraftField('quoteRef', event.target.value)} onBlur={saveCurrentDraft} />
        </div>
      ) : (
        <KeyValueGrid
          ariaLabel="Project details"
          items={[
            { label: 'Contact', value: displayed.contactName || '—' },
            { label: 'Email', value: displayed.contactEmail || '—' },
            { label: 'Phone', value: displayed.contactPhone || '—' },
            { label: 'Project name', value: displayed.projectName || '—' },
            { label: 'Site address', value: displayed.siteAddress || '—', wide: true },
            { label: 'Region', value: displayed.region || '—' },
            { label: 'Project / quote reference', value: displayed.quoteRef || 'Not allocated' },
          ]}
        />
      )}
    </Card>
  );
}
