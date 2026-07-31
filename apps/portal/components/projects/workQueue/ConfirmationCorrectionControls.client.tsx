'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  AlertBanner,
  Button,
  Checkbox,
  Select,
  Textarea,
} from '@/components/ui/foundation';
import { correctProjectConfirmation } from '@/lib/projects/workItems/confirmationCorrections/client';
import type { ProjectWorkConfirmationFact } from '@/lib/projects/workItems/types';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { invalidateProjectWorkReads } from '@/lib/queries/projectWorkCache';
import styles from './ConfirmationCorrectionControls.module.css';

const CONFIRMATION_LABELS: Record<
  ProjectWorkConfirmationFact['type'],
  string
> = {
  FIRST_ENQUIRY_EMAIL_SENT: 'First enquiry email sent',
  ENQUIRY_FOLLOW_UP_EMAIL_SENT: 'Enquiry follow-up email sent',
  ENQUIRY_CUSTOMER_REPLY_RECEIVED: 'Enquiry customer reply received',
  QUOTE_FOLLOW_UP_EMAIL_SENT: 'Quote follow-up email sent',
  QUOTE_CUSTOMER_REPLY_RECEIVED: 'Quote customer reply received',
  SITE_VISIT_COMPLETED: 'Site visit completed',
};

export function confirmationFactLabel(
  fact: Pick<ProjectWorkConfirmationFact, 'type' | 'occurredAt'>,
): string {
  const parsed = new Date(fact.occurredAt);
  const occurred = Number.isFinite(parsed.valueOf())
    ? new Intl.DateTimeFormat('en-NZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Pacific/Auckland',
      }).format(parsed)
    : 'time unavailable';
  return `${CONFIRMATION_LABELS[fact.type]} - ${occurred}`;
}

export default function ConfirmationCorrectionControls({
  projectId,
  host,
  facts,
  disabled = false,
  onRefresh,
}: {
  projectId: string;
  host: string;
  facts: ProjectWorkConfirmationFact[];
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const { isAdmin } = usePortalSession();
  const queryClient = useQueryClient();
  const attempts = useRef(new StableCommandAttempt()).current;
  const [eventId, setEventId] = useState('');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || facts.length === 0) return null;

  const submit = async () => {
    const correctionReason = reason.trim();
    if (!eventId || !correctionReason || !acknowledged || pending || disabled) return;
    const payload = {
      projectId,
      confirmationEventId: eventId,
      reason: correctionReason,
    };
    const intent = projectCommandIntent('CONFIRMATION_RETRACTION', payload);
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await correctProjectConfirmation({
        ...payload,
        commandId: attempts.commandIdFor(intent),
      });
      attempts.committed(intent);
      setEventId('');
      setReason('');
      setAcknowledged(false);
      setMessage(
        response.command.replayed
          ? 'This correction was already recorded.'
          : 'Correction recorded. The project now requires an explicit work review.',
      );
      await invalidateProjectWorkReads(queryClient, host, projectId);
      onRefresh?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The confirmation correction could not be recorded.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <details className={styles.disclosure}>
      <summary>Correct a recorded confirmation</summary>
      <div className={styles.content}>
        <p>
          Admin only. The original record stays in the audit history and the project
          is returned to review.
        </p>
        <Select
          label="Confirmation to correct"
          value={eventId}
          disabled={pending || disabled}
          onChange={(event) => setEventId(event.target.value)}
        >
          <option value="">Choose a confirmation</option>
          {facts.map((fact) => (
            <option key={fact.id} value={fact.id}>{confirmationFactLabel(fact)}</option>
          ))}
        </Select>
        <Textarea
          label="Why the recorded fact is wrong"
          value={reason}
          maxLength={1000}
          disabled={pending || disabled}
          onChange={(event) => setReason(event.target.value)}
        />
        <Checkbox
          label="I understand this appends a correction and requires a project work review."
          checked={acknowledged}
          disabled={pending || disabled}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <Button
          variant="secondary"
          loading={pending}
          disabled={
            disabled
            || !eventId
            || !reason.trim()
            || !acknowledged
          }
          onClick={() => void submit()}
        >
          Record correction
        </Button>
        {message ? (
          <AlertBanner tone="info" title="Confirmation corrected">{message}</AlertBanner>
        ) : null}
        {error ? (
          <AlertBanner tone="error" title="Correction not saved">{error}</AlertBanner>
        ) : null}
      </div>
    </details>
  );
}
