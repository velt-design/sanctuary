'use client';

import { useEffect, useMemo, useState } from 'react';
import { PipelineModal, PIPELINE_MODAL_ACTION_CLASSES } from '@/components/ui/PipelineModal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createDesignRequest, fetchDesignRequestPreview } from '@/lib/repo/designPackagesRepo';
import type { DesignRequestPreview, DesignRequestPriorityTier, DesignRequestSource } from '@/lib/designPackages/types';
import { useEnqueueLocalFirstMutation } from '@/lib/localFirst/useEnqueueLocalFirstMutation';
import { AlertBanner, KeyValueGrid, Select, Textarea } from '@/components/ui/foundation';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildDesignRequestEntityKey,
  isLocalEstimateId,
  type PortalDesignRequestCreateMutationPayload,
} from '@/lib/localFirst/portalEntities';
import styles from './RequestDesignModal.module.css';

const PRIORITY_TIERS: readonly DesignRequestPriorityTier[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'];

function formatMoneyCents(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unpriced';
  return `$${(value / 100).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  deferUntilSync?: boolean;
  estimateTotalCents?: number | null;
  onCreated?: () => void | Promise<void>;
};

export default function RequestDesignModal({
  open,
  onOpenChange,
  projectId,
  estimateId,
  estimateLabel,
  requestSource,
  deferUntilSync = false,
  estimateTotalCents = null,
  onCreated,
}: RequestDesignModalProps) {
  const toast = useToast();
  const enqueueLocalFirstMutation = useEnqueueLocalFirstMutation<PortalDesignRequestCreateMutationPayload>();
  const [preview, setPreview] = useState<DesignRequestPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [selectedPriorityTier, setSelectedPriorityTier] = useState<DesignRequestPriorityTier>('UNPRICED');
  const [error, setError] = useState<string | null>(null);
  const useDeferredCreate = deferUntilSync || isLocalEstimateId(estimateId);

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
    setError(null);
    setPreview(null);

    if (useDeferredCreate) {
      setLoading(false);
      setPreview({
        projectId,
        estimateId,
        canSubmit: true,
        mode: 'initial',
        nextVersion: 1,
        priorityTier: 'UNPRICED',
        priceTotalIncGstCents: estimateTotalCents,
        activeRequest: null,
      });
      return;
    }

    setLoading(true);

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
  }, [estimateId, estimateTotalCents, open, projectId, useDeferredCreate]);

  useEffect(() => {
    if (!preview) return;
    setSelectedPriorityTier(preview.priorityTier);
  }, [preview]);

  const title = useMemo(() => {
    if (!preview) return 'Request drafting';
    return preview.mode === 'revision' ? `Request Drafting v${preview.nextVersion}` : 'Request Drafting';
  }, [preview]);

  const submitLabel = useMemo(() => {
    if (!preview) return 'Request drafting';
    return preview.mode === 'revision' ? `Request drafting v${preview.nextVersion}` : 'Request drafting';
  }, [preview]);

  return (
    <PipelineModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`Create a drafting request from design ${estimateLabel}.`}
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
                  if (useDeferredCreate) {
                    await enqueueLocalFirstMutation({
                      entityKey: buildDesignRequestEntityKey(projectId, estimateId),
                      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.designRequestCreate,
                      payload: {
                        projectId,
                        estimateId,
                        requestSource,
                        requestNote: requestNote.trim() || null,
                        priorityTier: selectedPriorityTier,
                      },
                    });
                    toast.success('Drafting request queued locally. It will sync after the design finishes syncing.');
                  } else {
                    await createDesignRequest({
                      projectId,
                      estimateId,
                      requestSource,
                      requestNote: requestNote.trim() || null,
                      priorityTier: selectedPriorityTier,
                    });
                    await onCreated?.();
                    toast.success(preview.mode === 'revision' ? `Drafting request v${preview.nextVersion} created.` : 'Drafting request created.');
                  }
                  onOpenChange(false);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Failed to create drafting request';
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
      hint={
        preview?.canSubmit
          ? useDeferredCreate
            ? 'The request will queue now and attach once the design sync finishes.'
            : 'The request will be linked to this exact design snapshot.'
          : undefined
      }
    >
      <div className={styles.body}>
        {loading ? <p className={styles.muted}>Loading request preview…</p> : null}
        {error ? <AlertBanner tone="error" title="Drafting request unavailable">{error}</AlertBanner> : null}

        {preview ? (
          <div className={styles.grid}>
            {useDeferredCreate ? (
              <AlertBanner tone="warning" title="Local design changes">
                This design still has local changes. The drafting request will queue now and the server will validate it after sync completes.
              </AlertBanner>
            ) : null}
            <KeyValueGrid
              columns={4}
              ariaLabel="Drafting request summary"
              items={[
                { label: 'Design', value: estimateLabel },
                { label: 'Request version', value: `v${preview.nextVersion}` },
                { label: 'Suggested priority', value: formatTierLabel(preview.priorityTier) },
                { label: 'Design total', value: formatMoneyCents(preview.priceTotalIncGstCents) },
              ]}
            />

            {preview.activeRequest ? (
              <AlertBanner tone="warning" title="Active drafting request">
                {`Active drafting request v${preview.activeRequest.requestVersion} is still ${preview.activeRequest.status.toLowerCase()}. `}
                Finish or cancel it before creating another revision.
              </AlertBanner>
            ) : null}

            <Select
              id="designRequestPriorityTier"
              label="Priority tier"
              value={selectedPriorityTier}
              onChange={(event) => setSelectedPriorityTier(event.target.value as DesignRequestPriorityTier)}
              disabled={submitting || !preview.canSubmit}
            >
              {PRIORITY_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {formatTierLabel(tier)}
                </option>
              ))}
            </Select>

            <Textarea
              id="designRequestNote"
              label="Request note"
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Optional note for the drafting team"
              disabled={submitting}
            />
          </div>
        ) : null}
      </div>
    </PipelineModal>
  );
}
