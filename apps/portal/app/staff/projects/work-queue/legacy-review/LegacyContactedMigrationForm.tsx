'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Select,
  Textarea,
} from '@/components/ui/foundation';
import { migrateLegacyContactedProject } from '@/lib/projects/workItems/legacyTriage/client';
import {
  LEGACY_CONTACTED_CLOSED_OUTCOMES,
  type LegacyContactedProject,
} from '@/lib/projects/workItems/legacyTriage/types';
import { PROJECT_WORK_RESPONSIBILITY_AREAS } from '@/lib/projects/workItems/types';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { parseAucklandDateTimeLocal } from '@/lib/time/aucklandDateTime';
import {
  defaultLegacyMigrationDraft,
  legacyMigrationDraftError,
  type LegacyMigrationDraft,
} from './legacyContactedPresentation';
import styles from './legacyReview.module.css';

const DISPOSITION_OPTIONS = [
  ['ACTIVE_TRIAGE', 'Active — needs triage'],
  ['ACTIVE_WORK', 'Active — create one work item'],
  ['WAITING', 'Waiting — wake later'],
  ['CLOSED', 'Closed — record outcome'],
] as const;

const RESPONSIBILITY_LABELS = {
  CUSTOMER: 'Customer',
  DESIGN: 'Design',
  COMMERCIAL: 'Commercial',
  OPERATIONS: 'Operations',
  ADMIN: 'Admin',
} as const;

const OUTCOME_LABELS = {
  LOST_NO_RESPONSE: 'Lost — no response',
  LOST_BUDGET_PRICE: 'Lost — budget or price',
  LOST_OTHER_SUPPLIER: 'Lost — chose another supplier',
  LOST_TIMING_DEFERRED: 'Lost — timing or deferred',
  LOST_NOT_SUITABLE: 'Lost — not suitable',
  CANCELLED: 'Cancelled',
} as const;

export default function LegacyContactedMigrationForm({
  project,
  onCancel,
  onSaved,
  disabled = false,
}: {
  project: LegacyContactedProject;
  onCancel: () => void;
  onSaved: (message: string) => void;
  disabled?: boolean;
}) {
  const attempts = useRef(new StableCommandAttempt()).current;
  const [draft, setDraft] = useState<LegacyMigrationDraft>(
    () => defaultLegacyMigrationDraft(project),
  );
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultLegacyMigrationDraft(project));
    setReviewConfirmed(false);
    setError(null);
  }, [project]);

  const update = <K extends keyof LegacyMigrationDraft>(
    key: K,
    value: LegacyMigrationDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (disabled || pending) return;
    const invalid = legacyMigrationDraftError(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!reviewConfirmed) {
      setError('Confirm that you reviewed this project before migrating it.');
      return;
    }

    const payload = {
      expectedUpdatedAt: project.updatedAt,
      expectedEvidenceFingerprint: project.evidenceFingerprint,
      disposition: draft.disposition,
      reason: draft.reason.trim(),
      title: draft.disposition === 'ACTIVE_WORK' ? draft.title.trim() : null,
      responsibilityArea:
        draft.disposition === 'ACTIVE_WORK' ? draft.responsibilityArea : null,
      dueAt:
        draft.disposition === 'ACTIVE_WORK'
          ? parseAucklandDateTimeLocal(draft.dueAt)
          : null,
      waitingUntil:
        draft.disposition === 'WAITING'
          ? parseAucklandDateTimeLocal(draft.waitingUntil)
          : null,
      closedOutcome:
        draft.disposition === 'CLOSED' ? draft.closedOutcome : null,
    };
    const intent = projectCommandIntent('LEGACY_CONTACTED_MIGRATION', payload);

    setPending(true);
    setError(null);
    try {
      const response = await migrateLegacyContactedProject(project.projectId, {
        commandId: attempts.commandIdFor(intent),
        ...payload,
      });
      attempts.committed(intent);
      onSaved(
        response.command.replayed
          ? 'This reviewed migration was already saved.'
          : 'Reviewed project moved to the V2 work model.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The reviewed migration could not be saved.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.reviewForm} aria-label={`Review ${project.projectName}`}>
      <div className={styles.formIntro}>
        <strong>Choose the project&apos;s real operational state.</strong>
        <p>This changes only this project. It does not send email, archive it, or create lead cadence.</p>
      </div>

      <div className={styles.formGrid}>
        <Select
          label="Reviewed disposition"
          value={draft.disposition}
          disabled={pending || disabled}
          onChange={(event) => update(
            'disposition',
            event.target.value as LegacyMigrationDraft['disposition'],
          )}
        >
          {DISPOSITION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        {draft.disposition === 'ACTIVE_WORK' ? (
          <>
            <Input
              label="One clear next action"
              value={draft.title}
              maxLength={160}
              disabled={pending || disabled}
              onChange={(event) => update('title', event.target.value)}
            />
            <Select
              label="Responsibility"
              value={draft.responsibilityArea}
              disabled={pending || disabled}
              onChange={(event) => update(
                'responsibilityArea',
                event.target.value as LegacyMigrationDraft['responsibilityArea'],
              )}
            >
              {PROJECT_WORK_RESPONSIBILITY_AREAS.map((area) => (
                <option key={area} value={area}>{RESPONSIBILITY_LABELS[area]}</option>
              ))}
            </Select>
            <Input
              label="Due in Auckland"
              type="datetime-local"
              value={draft.dueAt}
              disabled={pending || disabled}
              onChange={(event) => update('dueAt', event.target.value)}
            />
          </>
        ) : null}

        {draft.disposition === 'WAITING' ? (
          <Input
            label="Wake-up time in Auckland"
            type="datetime-local"
            value={draft.waitingUntil}
            disabled={pending || disabled}
            onChange={(event) => update('waitingUntil', event.target.value)}
          />
        ) : null}

        {draft.disposition === 'CLOSED' ? (
          <Select
            label="Closed outcome"
            value={draft.closedOutcome}
            disabled={pending || disabled}
            onChange={(event) => update(
              'closedOutcome',
              event.target.value as LegacyMigrationDraft['closedOutcome'],
            )}
          >
            {LEGACY_CONTACTED_CLOSED_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>{OUTCOME_LABELS[outcome]}</option>
            ))}
          </Select>
        ) : null}

        <Textarea
          label="Why this is correct"
          value={draft.reason}
          maxLength={1000}
          disabled={pending || disabled}
          onChange={(event) => update('reason', event.target.value)}
        />
      </div>

      <Checkbox
        label="I reviewed the evidence and this one-project decision is correct."
        checked={reviewConfirmed}
        disabled={pending || disabled}
        onChange={(event) => setReviewConfirmed(event.target.checked)}
      />

      {error ? <p className={styles.formError} role="alert">{error}</p> : null}

      <div className={styles.formActions}>
        <Button variant="tertiary" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button
          loading={pending}
          disabled={disabled || !reviewConfirmed}
          onClick={() => void submit()}
        >
          Confirm reviewed migration
        </Button>
      </div>
    </div>
  );
}
