'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  AlertBanner,
  Button,
  Textarea,
} from '@/components/ui/foundation';
import { reconcileProjectConfirmationCorrection } from '@/lib/projects/workItems/legacyTriage/client';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { qk } from '@/lib/queries/keys';
import styles from './ProjectWorkQueue.module.css';

export default function ConfirmationReviewResolution({
  projectId,
  repairSignalId,
  expectedSignalRowVersion,
  host,
}: {
  projectId: string;
  repairSignalId: string;
  expectedSignalRowVersion: number;
  host: string;
}) {
  const { isAdmin } = usePortalSession();
  const queryClient = useQueryClient();
  const attempts = useRef(new StableCommandAttempt()).current;
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const submit = async () => {
    const reviewReason = reason.trim();
    if (!reviewReason || pending) return;
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
    setPending(true);
    setError(null);
    try {
      await reconcileProjectConfirmationCorrection({
        ...payload,
        commandId: attempts.commandIdFor(intent),
      });
      attempts.committed(intent);
      setCompleted(true);
      setConfirming(false);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: qk.projectWork.queue(host) }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'data'] }),
        queryClient.invalidateQueries({
          queryKey: qk.projects.commandCentre(host, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.projects.snapshot(host, projectId),
        }),
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The correction review could not be completed.',
      );
      setConfirming(false);
    } finally {
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
          disabled={pending}
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
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  loading={pending}
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
            disabled={!reason.trim()}
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
