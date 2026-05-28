'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Assembly3D } from '@sp/geometry';
import { type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import { buildResolvedMemberSizeMap } from '@/lib/drawings/state/resolvedMemberSizes';
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
  /**
   * Retained for back-compat with `WorkbenchInspectorHost` even though
   * PR-W12 dropped the "Open House Forms" button from the rendered output.
   * Removing the prop here would require coordinated changes in the host
   * and that's not the cull's job.
   */
  onOpenHouseForms?: () => void;
  onSelectPergolaByModule: (pergolaId: string | null) => void;
  /**
   * PR-T6 (2026-05-26): solved assembly for the active pergola. When
   * present, MEMBER SIZES dropdowns display the system-resolved size
   * (e.g. "100x50") in place of "Auto" with muted text. Optional so
   * call sites that don't have an assembly yet still render cleanly
   * with the "Auto" fallback.
   */
  activeAssembly?: Assembly3D | null;
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
  onOpenHouseForms: _onOpenHouseForms,
  onSelectPergolaByModule,
  onStartDrawOutline,
  onCommitGeometryEdit,
  onCommitAttachment,
  activeAssembly,
}: PergolaInspectorProps) {
  const resolvedMemberSizes = useMemo(
    () => buildResolvedMemberSizeMap(activeAssembly),
    [activeAssembly],
  );
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

  // PR-W12 (2026-05-26) — visual cull to match the CAD mockup.
  // Dropped from the previous render:
  //   • "Pergola Inspector" intro paragraph + "Open House Forms" button
  //     (the flat OBJECTS TREE already lets the user navigate to House Forms).
  //   • Standalone "Module" picker (the rail tree provides this).
  //   • "Selection" diagnostics block (the inspector header already shows
  //     the selected object name).
  //   • Trust + Resolution rows inside Host Attachment (header chip shows
  //     trust state; the resolution row was duplicate noise).
  // What stays:
  //   • Host Attachment: snap-derived summary + writable method dropdown
  //     when applicable. Pushed below the SanctuaryWorkbenchRail's main
  //     four sections — it's drag-driven, not primary input.
  //   • SanctuaryWorkbenchRail, restructured to PRIMARY / CONNECTIONS /
  //     MEMBER SIZES / ADVANCED via the new `mockupGrouping` flag.
  const hostAttachmentSection =
    activePergolaModel && displayAttachment ? (
      <section className={styles.moduleSection}>
        <p className={styles.moduleSectionTitle}>Host attachment</p>
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
      {supportsSanctuaryEditing && activeModuleInput && activePergolaModel ? (
        <>
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
            mockupGrouping
            advancedExtras={hostAttachmentSection}
            resolvedMemberSizes={resolvedMemberSizes}
          />
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
        </>
      ) : activePergolaModel ? (
        <section className={styles.notice}>
          <p className={styles.noticeTitle}>Editing deferred</p>
          <p className={styles.noticeText}>
            This pergola family is not supported for native editing yet.
          </p>
        </section>
      ) : null}
    </>
  );
}
