'use client';

import { useEffect, useMemo, useState } from 'react';
import { PipelineModal, PIPELINE_MODAL_ACTION_CLASSES } from '@/components/ui/PipelineModal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createDesignRequest, fetchDesignRequestPreview } from '@/lib/repo/designPackagesRepo';
import type { DesignRequestPreview, DesignRequestPriorityTier, DesignRequestSource } from '@/lib/designPackages/types';
import styles from './RequestDesignModal.module.css';

const PRIORITY_TIERS: readonly DesignRequestPriorityTier[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'];

function formatMoneyCents(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unpriced';
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTierLabel(value: string): string {
  if (value === 'UNPRICED') return 'Unpriced';
  const suffix = value.split('_').at(-1) ?? '';
  return `Tier ${suffix}`;
}

type RequestDesignModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  estimateId: string;
  estimateLabel: string;
  requestSource: Exclude<DesignRequestSource, 'legacy_backfill'>;
  onCreated?: () => void | Promise<void>;
};

export default function RequestDesignModal({
  open,
  onOpenChange,
  projectId,
  estimateId,
  estimateLabel,
  requestSource,
  onCreated,
}: RequestDesignModalProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<DesignRequestPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [selectedPriorityTier, setSelectedPriorityTier] = useState<DesignRequestPriorityTier>('UNPRICED');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setLoading(false);
      setSubmitting(false);
      setRequestNote('');
      setSelectedPriorityTier('UNPRICED');
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);

    void (async () => {
      try {
        const next = await fetchDesignRequestPreview(projectId, estimateId);
        if (cancelled) return;
        setPreview(next);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load design preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [estimateId, open, projectId]);

  useEffect(() => {
    if (!preview) return;
    setSelectedPriorityTier(preview.priorityTier);
  }, [preview]);

  const title = useMemo(() => {
    if (!preview) return 'Request design';
    return preview.mode === 'revision' ? `Request Design v${preview.nextVersion}` : 'Request Design';
  }, [preview]);

  const submitLabel = useMemo(() => {
    if (!preview) return 'Request design';
    return preview.mode === 'revision' ? `Request design v${preview.nextVersion}` : 'Request design';
  }, [preview]);

  return (
    <PipelineModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`Create a design request from estimate ${estimateLabel}.`}
      size="md"
      actions={
        <>
          <button
            type="button"
            className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Close
          </button>
          <button
            type="button"
            className={PIPELINE_MODAL_ACTION_CLASSES.primary}
            disabled={loading || submitting || !preview?.canSubmit}
            onClick={() => {
              if (!preview || submitting) return;
              setSubmitting(true);
              setError(null);
              void (async () => {
                try {
                  await createDesignRequest({
                    projectId,
                    estimateId,
                    requestSource,
                    requestNote: requestNote.trim() || null,
                    priorityTier: selectedPriorityTier,
                  });
                  await onCreated?.();
                  toast.success(preview.mode === 'revision' ? `Design request v${preview.nextVersion} created.` : 'Design request created.');
                  onOpenChange(false);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Failed to create design request';
                  setError(message);
                  toast.error(message);
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            {submitting ? 'Creating…' : submitLabel}
          </button>
        </>
      }
      hint={preview?.canSubmit ? 'The request will be linked to this exact estimate snapshot.' : undefined}
    >
      <div className={styles.body}>
        {loading ? <p className={styles.muted}>Loading request preview…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {preview ? (
          <div className={styles.grid}>
            <div className={styles.summaryGrid}>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Estimate</div>
                <div className={styles.tileValue}>{estimateLabel}</div>
              </div>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Request version</div>
                <div className={styles.tileValue}>{`v${preview.nextVersion}`}</div>
              </div>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Suggested priority</div>
                <div className={styles.tileValue}>{formatTierLabel(preview.priorityTier)}</div>
              </div>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Estimate total</div>
                <div className={styles.tileValue}>{formatMoneyCents(preview.priceTotalIncGstCents)}</div>
              </div>
            </div>

            {preview.activeRequest ? (
              <div className={styles.warning}>
                {`Active design request v${preview.activeRequest.requestVersion} is still ${preview.activeRequest.status.toLowerCase()}. `}
                Finish or cancel it before creating another revision.
              </div>
            ) : null}

            <div className={styles.field}>
              <label htmlFor="designRequestPriorityTier">Priority tier</label>
              <select
                id="designRequestPriorityTier"
                value={selectedPriorityTier}
                onChange={(event) => setSelectedPriorityTier(event.target.value as DesignRequestPriorityTier)}
                disabled={submitting || !preview.canSubmit}
              >
                {PRIORITY_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {formatTierLabel(tier)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="designRequestNote">Request note</label>
              <textarea
                id="designRequestNote"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Optional note for the design team"
                disabled={submitting}
              />
            </div>
          </div>
        ) : null}
      </div>
    </PipelineModal>
  );
}
