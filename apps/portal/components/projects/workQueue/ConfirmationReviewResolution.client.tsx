'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  AlertBanner,
  Button,
  Textarea,
} from '@/components/ui/foundation';
import { reconcileProjectConfirmationCorrection } from '@/lib/projects/workItems/confirmationCorrections/client';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { invalidateProjectWorkReads } from '@/lib/queries/projectWorkCache';
import styles from './ProjectWorkQueue.module.css';

export default function ConfirmationReviewResolution({
  projectId,
  repairSignalId,
  expectedSignalRowVersion,
  host,
  disabled = false,
}: {
  projectId: string;
  repairSignalId: string;
  expectedSignalRowVersion: number;
  host: string;
  disabled?: boolean;
}) {
  const { isAdmin } = usePortalSession();
  const queryClient = useQueryClient();
  const attempts = useRef(new StableCommandAttempt()).current;
  const inFlight = useRef(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const submit = async () => {
    const reviewReason = reason.trim();
    if (!reviewReason || inFlight.current || disabled) return;
    const payload = {
      projectId,
      repairSignalId,
      expectedSignalRowVersion,
      reason: reviewReason,
    };
    const intent = projectCommandIntent(
      'CONFIRMATION_RETRACTION_REVIEW',
      payload,
    );
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await reconcileProjectConfirmationCorrection({
        ...payload,
        commandId: attempts.commandIdFor(intent),
      });
      if (!response.command.committed) {
        throw new Error('The server did not confirm this correction review.');
      }
      attempts.committed(intent);
      setCompleted(true);
      setConfirming(false);
      await invalidateProjectWorkReads(queryClient, host, projectId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The correction review could not be completed.',
      );
      setConfirming(false);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  if (completed) {
    return (
      <AlertBanner tone="info" title="Correction review saved">
        The exact recovery signal was cleared on the server. The queue is refreshing.
      </AlertBanner>
    );
  }

  return (
    <details className={styles.manage}>
      <summary>Finish correction review</summary>
      <div className={styles.reviewResolution}>
        <p>
          First check the project&apos;s current work and lifecycle state. This
          clears only the review signal; it does not send email or change stage.
        </p>
        <Textarea
          label="What was checked"
          value={reason}
          maxLength={1000}
          disabled={pending || disabled}
          onChange={(event) => {
            setReason(event.target.value);
            setConfirming(false);
          }}
        />
        {confirming ? (
          <AlertBanner tone="warning" title="Clear this recovery signal?">
            <div className={styles.reviewConfirmation}>
              <span>The audit history remains, but this project leaves the correction-review queue.</span>
              <div>
                <Button
                  size="small"
                  variant="tertiary"
                  disabled={pending || disabled}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  loading={pending}
                  disabled={disabled}
                  onClick={() => void submit()}
                >
                  Confirm review complete
                </Button>
              </div>
            </div>
          </AlertBanner>
        ) : (
          <Button
            size="small"
            variant="secondary"
            disabled={disabled || !reason.trim()}
            onClick={() => setConfirming(true)}
          >
            Mark review complete
          </Button>
        )}
        {error ? (
          <AlertBanner tone="error" title="Review not completed">{error}</AlertBanner>
        ) : null}
      </div>
    </details>
  );
}
