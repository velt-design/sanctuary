'use client';

import { useCallback, useState } from 'react';
import { labelForAttachmentSideList } from '@/components/drawings/rail/objectRailShared';
import type {
  PergolaAttachment,
  PergolaAttachmentMethod,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchPergolaInspectorModel,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import {
  PERGOLA_ATTACHMENT_METHOD_OPTIONS,
  labelForPergolaAttachmentHostEdge,
  labelForPergolaAttachmentHostZone,
  labelForPergolaAttachmentMethod,
  labelForPergolaAttachmentSpatialKind,
  pergolaAttachmentMethodIsWritable,
} from '@/lib/drawings/state/pergolaAttachmentLabels';
import { pergolaAttachmentFromStoredConnectionFields } from '@/lib/drawings/state/pergolaAttachment';
import type { CommitResult } from './objectWorkbenchClientTypes';
import styles from './DesignWorkbenchEstimateClient.module.css';

type PergolaInspectorOption = {
  id: string;
  label: string;
};

type PergolaInspectorProps = {
  activePergolaModel: ObjectWorkbenchPergolaInspectorModel | null;
  activePergolaId: string | null;
  disabled?: boolean;
  pergolaOptions: PergolaInspectorOption[];
  /** Host-owned action retained for the current inspector contract. */
  onOpenHouseForms?: () => void;
  onSelectPergola: (pergolaId: string | null) => void;
  /**
   * Step 9 of the first-class spatial-entities migration. Method-only writes
   * land here. Re-hosting (changing the host edge) is via drag-snap; the
   * inspector no longer exposes a host-edge dropdown.
   */
  onCommitAttachment?: (
    pergolaId: string,
    attachment: PergolaAttachment,
  ) => Promise<CommitResult> | CommitResult;
};

/**
 * Resolve the attachment to render. Prefers the snap-derived
 * `pergola.attachment`; falls back to stored connection fields when a
 * persisted pergola has not yet written the canonical attachment shape.
 */
function resolveDisplayAttachment(
  pergola: ObjectWorkbenchPergolaInspectorModel,
): PergolaAttachment {
  return (
    pergola.attachment ??
    pergolaAttachmentFromStoredConnectionFields({
      connectionKind: pergola.connectionKind,
      strategy: pergola.strategy,
    })
  );
}

export default function PergolaInspector({
  activePergolaModel,
  activePergolaId,
  disabled = false,
  pergolaOptions,
  onOpenHouseForms: _onOpenHouseForms,
  onSelectPergola,
  onCommitAttachment,
}: PergolaInspectorProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const runAttachmentAction = useCallback(
    async (
      fieldId: string,
      action: Promise<CommitResult> | CommitResult | undefined,
      fallbackMessage: string,
    ) => {
      setPendingFieldId(fieldId);
      const result = await Promise.resolve(action ?? { ok: false, error: fallbackMessage });
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
      setPendingFieldId((current) => (current === fieldId ? null : current));
    },
    [],
  );

  const handleMethodChange = useCallback(
    (newMethod: PergolaAttachmentMethod) => {
      if (!activePergolaModel) return;
      const current = resolveDisplayAttachment(activePergolaModel);
      const next: PergolaAttachment = { ...current, method: newMethod };
      void runAttachmentAction(
        'pergola-attachment-method',
        onCommitAttachment?.(activePergolaModel.id, next),
        'Unable to update the pergola attachment method.',
      );
    },
    [activePergolaModel, onCommitAttachment, runAttachmentAction],
  );

  const displayAttachment = activePergolaModel
    ? resolveDisplayAttachment(activePergolaModel)
    : null;
  const methodIsWritable = displayAttachment
    ? pergolaAttachmentMethodIsWritable(displayAttachment)
    : false;

  const hostAttachmentSection =
    activePergolaModel && displayAttachment ? (
      <section className={styles.inspectorSection}>
        <p className={styles.inspectorSectionTitle}>Host attachment</p>
        <div className={styles.diagnosticsList}>
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Connection</span>
            <span className={styles.diagnosticValue}>
              {labelForPergolaAttachmentSpatialKind(displayAttachment.spatialKind)}
            </span>
          </div>
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Host edge</span>
            <span className={styles.diagnosticValue}>
              {labelForPergolaAttachmentHostEdge(displayAttachment)}
            </span>
          </div>
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Host zone</span>
            <span className={styles.diagnosticValue}>
              {labelForPergolaAttachmentHostZone(displayAttachment)}
            </span>
          </div>
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Side</span>
            <span className={styles.diagnosticValue}>
              {labelForAttachmentSideList([activePergolaModel.side])}
            </span>
          </div>
        </div>
        {methodIsWritable ? (
          <select
            id="pergola-attachment-method"
            className={styles.inspectorSelect}
            aria-label="Pergola attachment method"
            value={displayAttachment.method}
            disabled={disabled || pendingFieldId === 'pergola-attachment-method'}
            onChange={(event) => handleMethodChange(event.target.value as PergolaAttachmentMethod)}
          >
            {PERGOLA_ATTACHMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <div className={styles.diagnosticRow}>
            <span className={styles.diagnosticLabel}>Method</span>
            <span className={styles.diagnosticValue}>
              {labelForPergolaAttachmentMethod(displayAttachment.method)}
            </span>
          </div>
        )}
        {fieldErrors['pergola-attachment-method'] ? (
          <p className={styles.noticeText}>{fieldErrors['pergola-attachment-method']}</p>
        ) : null}
      </section>
    ) : null;

  return (
    <>
      {activePergolaModel ? (
        <>
          {hostAttachmentSection}
          {pergolaOptions.length > 1 ? (
            <section className={styles.inspectorSection}>
              <p className={styles.inspectorSectionTitle}>Pergola</p>
              <select
                className={styles.inspectorSelect}
                aria-label="Pergola"
                value={activePergolaId ?? ''}
                onChange={(event) =>
                  onSelectPergola(event.target.value || null)
                }
              >
                {pergolaOptions.map((pergola) => (
                  <option key={pergola.id} value={pergola.id}>
                    {pergola.label}
                  </option>
                ))}
              </select>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
