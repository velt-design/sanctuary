'use client';

import { useCallback, useState } from 'react';
import { type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import { labelForAttachmentSideList } from '@/components/drawings/rail/objectRailShared';
import type {
  ObjectWorkbenchGeometryEditIntent,
  ObjectWorkbenchGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import type {
  HouseAssemblyModel,
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
import { pergolaAttachmentFromLegacyFields } from '@/lib/drawings/state/pergolaAttachment';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { CommitResult } from './objectWorkbenchClientTypes';
import styles from './DesignWorkbenchEstimateClient.module.css';

type PergolaInspectorModule = {
  id: string;
  label: string;
  pergolaId: string | null;
};

type PergolaInspectorProps = {
  activePergolaModel: ObjectWorkbenchPergolaInspectorModel | null;
  activeModuleInput: CalculatorModuleInputs | null;
  activeModuleIndex: number;
  activeModuleLabel: string;
  disabled?: boolean;
  geometryState: ObjectWorkbenchGeometryEditState | null;
  houseAssembly: HouseAssemblyModel | null;
  modules: PergolaInspectorModule[];
  supportsSanctuaryEditing: boolean;
  view: ModuleViewsTab;
  onOpenHouseForms: () => void;
  onSelectPergolaByModule: (pergolaId: string | null) => void;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitGeometryEdit?: (intent: ObjectWorkbenchGeometryEditIntent) => Promise<CommitResult> | CommitResult;
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
 * `pergola.attachment`; falls back to a legacy-field projection when the
 * pergola hasn't been migrated yet (Step 8 follow-up #2 lazy migration
 * normally fires on first edit, so this fallback is mostly defensive — a
 * legacy-only pergola the user hasn't touched still gets the right read).
 */
function resolveDisplayAttachment(
  pergola: ObjectWorkbenchPergolaInspectorModel,
): PergolaAttachment {
  return (
    pergola.attachment ??
    pergolaAttachmentFromLegacyFields({
      connectionKind: pergola.connectionKind,
      strategy: pergola.strategy,
    })
  );
}

export default function PergolaInspector({
  activePergolaModel,
  activeModuleInput,
  activeModuleIndex,
  activeModuleLabel,
  disabled = false,
  geometryState,
  houseAssembly: _houseAssembly,
  modules,
  supportsSanctuaryEditing,
  view,
  onOpenHouseForms,
  onSelectPergolaByModule,
  onStartDrawOutline,
  onCommitGeometryEdit,
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

  return (
    <>
      <section className={styles.moduleSection}>
        <p className={styles.moduleSectionTitle}>Pergola Inspector</p>
        <p className={styles.noticeText}>
          Geometry, roof, supports, and overrides live here. Footprint and drawing rotation still live in House Forms.
        </p>
        <button type="button" className={styles.modeButton} onClick={onOpenHouseForms}>
          Open House Forms
        </button>
      </section>

      {activePergolaModel && displayAttachment ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Host Attachment</p>
          <p className={styles.noticeText}>
            Drag the pergola onto a wall or roof eave to change the host. Re-hosting is no longer
            done via dropdown.
          </p>

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
              <span className={styles.diagnosticLabel}>Attachment side</span>
              <span className={styles.diagnosticValue}>
                {labelForAttachmentSideList([activePergolaModel.side])}
              </span>
            </div>
          </div>

          {methodIsWritable ? (
            <>
              <label className={styles.moduleSectionTitle} htmlFor="pergola-attachment-method">
                Attachment method
              </label>
              <select
                id="pergola-attachment-method"
                className={styles.moduleSelect}
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
            </>
          ) : (
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Method</span>
              <span className={styles.diagnosticValue}>
                {labelForPergolaAttachmentMethod(displayAttachment.method)}
              </span>
            </div>
          )}

          <div className={styles.diagnosticsList}>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Trust</span>
              <span className={styles.diagnosticValue}>{activePergolaModel.trustLabel}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Resolution</span>
              <span className={styles.diagnosticValue}>{activePergolaModel.resolution.status}</span>
            </div>
          </div>

          {activePergolaModel.resolution.message ? (
            <p className={styles.noticeText}>{activePergolaModel.resolution.message}</p>
          ) : null}
          {fieldErrors['pergola-attachment-method'] ? (
            <p className={styles.noticeText}>{fieldErrors['pergola-attachment-method']}</p>
          ) : null}
        </section>
      ) : null}

      {modules.length > 1 ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Module</p>
          <select
            className={styles.moduleSelect}
            aria-label="Drawing module"
            value={String(activeModuleIndex)}
            onChange={(event) =>
              onSelectPergolaByModule(modules[Number(event.target.value)]?.pergolaId ?? null)
            }
          >
            {modules.map((module, index) => (
              <option key={module.id} value={String(index)}>
                {module.label}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {supportsSanctuaryEditing && activeModuleInput && activePergolaModel ? (
        <>
          <section className={styles.moduleSection}>
            <p className={styles.moduleSectionTitle}>Selection</p>
            <div className={styles.diagnosticsList}>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Active pergola</span>
                <span className={styles.diagnosticValue}>{activePergolaModel.label || activePergolaModel.id}</span>
              </div>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Module</span>
                <span className={styles.diagnosticValue}>{activeModuleLabel}</span>
              </div>
            </div>
          </section>
          <SanctuaryWorkbenchRail
            moduleLabel={activeModuleLabel}
            geometryState={geometryState}
            view={view}
            disabled={disabled}
            canStartDrawOutline={!disabled}
            onStartDrawOutline={onStartDrawOutline}
            onCommitGeometryEdit={onCommitGeometryEdit}
            chrome="embedded"
            renderSummary={false}
            sections={{
              geometry: true,
              roof: true,
              gable: true,
              houseContext: 'none',
              supports: true,
              overrides: true,
            }}
          />
        </>
      ) : activePergolaModel ? (
        <section className={styles.notice}>
          <p className={styles.noticeTitle}>Editing Deferred</p>
          <p className={styles.noticeText}>
            This pergola family is not supported for native editing yet, but it can still be reviewed in the canonical workbench.
          </p>
        </section>
      ) : null}
    </>
  );
}
