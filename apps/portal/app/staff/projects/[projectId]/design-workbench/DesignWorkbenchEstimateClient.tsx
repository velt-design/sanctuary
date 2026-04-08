'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SanctuaryWorkbenchRail, {
  isSanctuarySupportedModuleInput,
  type SanctuaryPergolaFamily,
} from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  applyEstimateDrawingFieldEdit,
  applyEstimateDrawingFootprintEdit,
  applyEstimateDrawingModuleFieldEdit,
  buildEstimateDrawingDraftFromSnapshot,
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
  estimateDrawingDraftMatchesSnapshot,
  mergeEstimateDrawingDraftIntoSnapshot,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
  type EstimateDrawingModuleFieldEdit,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
};

type CommitResult = { ok: boolean; error?: string };

export default function DesignWorkbenchEstimateClient({
  estimate,
  projectName,
  siteAddress,
}: DesignWorkbenchEstimateClientProps) {
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState());
  const baseDraft = useMemo(() => buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot), [estimate.calculatorSnapshot]);
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    buildEstimateDrawingDraftEntityKey(estimate.id),
    baseDraft,
  );
  const drawingDraft = drawingWorkingCopy.value;

  const drawingSnapshot = useMemo(
    () => mergeEstimateDrawingDraftIntoSnapshot(estimate.calculatorSnapshot, drawingDraft),
    [drawingDraft, estimate.calculatorSnapshot],
  );
  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: drawingSnapshot,
        ui,
      }),
    [drawingSnapshot, ui],
  );

  useEffect(() => {
    setUi((current) => ({ ...current, activeModuleIndex: 0 }));
  }, [estimate.calculatorSnapshot]);

  useEffect(() => {
    if (store.ui.activeModuleIndex === ui.activeModuleIndex) return;
    setUi((current) => ({
      ...current,
      activeModuleIndex: store.ui.activeModuleIndex,
    }));
  }, [store.ui.activeModuleIndex, ui.activeModuleIndex]);

  const activeModule = store.derived.activeModule;
  const activeModuleInput = activeModule?.drawingModule.input ?? null;
  const supportsSanctuaryEditing = isSanctuarySupportedModuleInput(activeModuleInput);
  const isLocked = estimate.editability.isLocked;
  const drawingMetaOverrides = useMemo(
    () =>
      buildEstimateDrawingSheetMetaOverrides({
        moduleLabel: store.derived.activeModuleLabel,
        moduleIndex: store.derived.activeModuleIndex,
        draft: drawingDraft,
      }),
    [drawingDraft, store.derived.activeModuleIndex, store.derived.activeModuleLabel],
  );
  const meta = useMemo(
    () =>
      buildEstimateDrawingSheetMeta({
        moduleLabel: store.derived.activeModuleLabel,
        moduleTitleOverride: drawingMetaOverrides.moduleTitle,
        noteOverride: drawingMetaOverrides.note,
        moduleInfoRows: buildEstimateDrawingModuleInfoRows(activeModule?.drawingModule.input),
        view: store.ui.activeView,
        versionLabel: estimate.versionLabel,
        estimateDate: estimate.createdAt,
        projectName,
        siteAddress: siteAddress ?? null,
        clientName: null,
      }),
    [
      activeModule?.drawingModule.input,
      drawingMetaOverrides.moduleTitle,
      drawingMetaOverrides.note,
      estimate.createdAt,
      estimate.versionLabel,
      projectName,
      siteAddress,
      store.derived.activeModuleLabel,
      store.ui.activeView,
    ],
  );
  const drawingEditableFields = useMemo(
    () =>
      !drawingDraft || isLocked || !supportsSanctuaryEditing
        ? []
        : deriveEstimateDrawingEditableFields({
            draft: drawingDraft,
            moduleIndex: store.derived.activeModuleIndex,
            moduleLabel: store.derived.activeModuleLabel,
            view: store.ui.activeView,
            planModel: store.derived.activePlanModel,
            sectionModel: store.derived.activeSectionModel,
          }),
    [
      drawingDraft,
      isLocked,
      store.derived.activeModuleIndex,
      store.derived.activeModuleLabel,
      store.derived.activePlanModel,
      store.derived.activeSectionModel,
      store.ui.activeView,
      supportsSanctuaryEditing,
    ],
  );
  const geometryPreview = useMemo(
    () =>
      buildWorkbenchGeometryPreview({
        projectId: estimate.projectId,
        estimateId: estimate.id,
        snapshot: estimate.calculatorSnapshot,
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
      }),
    [drawingDraft, estimate.calculatorSnapshot, estimate.id, estimate.projectId, store.derived.activeModuleIndex],
  );

  const persistDrawingDraftLocally = useCallback(
    async (nextDraft: EstimateDrawingDraft) => {
      if (estimateDrawingDraftMatchesSnapshot(nextDraft, estimate.calculatorSnapshot)) {
        await drawingWorkingCopy.clearWorkingCopy();
      } else {
        await drawingWorkingCopy.setWorkingCopy(nextDraft);
      }
    },
    [drawingWorkingCopy, estimate.calculatorSnapshot],
  );

  const commitDrawingFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const result = applyEstimateDrawingFootprintEdit({
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        edit,
      });

      if (!result.ok) return result;
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

  const commitDrawingField = useCallback(
    async (field: EstimateDrawingField, nextValue: string): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const result = applyEstimateDrawingFieldEdit({
        draft: drawingDraft,
        field,
        nextValue,
      });

      if (!result.ok) return result;
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitDrawingModuleField = useCallback(
    async (edit: EstimateDrawingModuleFieldEdit): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const result = applyEstimateDrawingModuleFieldEdit({
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        edit,
      });

      if (!result.ok) return result;
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

  const commitPergolaFamily = useCallback(
    async (family: SanctuaryPergolaFamily): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const edits: EstimateDrawingModuleFieldEdit[] =
        family === 'gable'
          ? [
              { field: 'pergolaStyle', value: 'gable' },
              { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
            ]
          : family === 'box'
            ? [
                { field: 'pergolaStyle', value: 'pitched' },
                { field: 'moduleValue', key: 'boxPerimeterEnabled', value: true },
              ]
            : [
                { field: 'pergolaStyle', value: 'pitched' },
                { field: 'moduleValue', key: 'boxPerimeterEnabled', value: false },
              ];

      let nextDraft = drawingDraft;

      for (const edit of edits) {
        const result = applyEstimateDrawingModuleFieldEdit({
          draft: nextDraft,
          moduleIndex: store.derived.activeModuleIndex,
          edit,
        });

        if (!result.ok) return result;
        nextDraft = result.draft;
      }

      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

  const railFootprintCommit = !isLocked && supportsSanctuaryEditing ? commitDrawingFootprintEdit : undefined;
  const railModuleCommit = !isLocked && supportsSanctuaryEditing ? commitDrawingModuleField : undefined;
  const railFamilyCommit = !isLocked && supportsSanctuaryEditing ? commitPergolaFamily : undefined;
  const workbenchFieldCommit = !isLocked && supportsSanctuaryEditing ? commitDrawingField : undefined;
  const workbenchFootprintCommit =
    !isLocked && supportsSanctuaryEditing && store.ui.viewportMode === 'model' ? commitDrawingFootprintEdit : undefined;

  if (!activeModule) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No Drawing</p>
        <p className={styles.emptyText}>No plan or section drawing is available for this design.</p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.sidebar}>
        {supportsSanctuaryEditing && activeModuleInput ? (
          <SanctuaryWorkbenchRail
            moduleLabel={store.derived.activeModuleLabel}
            moduleInput={activeModuleInput}
            view={store.ui.activeView}
            disabled={isLocked}
            onCommitFamily={railFamilyCommit}
            onCommitFootprintEdit={railFootprintCommit}
            onCommitModuleField={railModuleCommit}
          />
        ) : (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>Editing Deferred</p>
            <p className={styles.noticeText}>
              This module is not supported for Sanctuary editing yet. The hidden route stays open so the design can still be reviewed here.
            </p>
          </section>
        )}

        {isLocked ? (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>Read Only</p>
            <p className={styles.noticeText}>
              {estimate.editability.lockReason ?? 'This design is locked and can only be reviewed from the hidden workbench.'}
            </p>
          </section>
        ) : null}

        {geometryPreview.kind === 'ready' && geometryPreview.previewMode === 'best_effort_draft' ? (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>3D Preview Uses Last Solved Structure</p>
            <p className={styles.noticeText}>
              The 3D view is reflecting current draft inputs with the last solved structural values from this estimate. Use it as a verification preview, not final validated geometry.
            </p>
          </section>
        ) : null}
      </div>

      <div className={styles.main}>
        <DrawingWorkbench
          moduleLabel={store.derived.activeModuleLabel}
          modules={store.persisted.modules.map((module) => ({
            id: module.id,
            label: module.label,
          }))}
          activeModuleIndex={store.derived.activeModuleIndex}
          onActiveModuleIndexChange={(index) =>
            setUi((current) => ({
              ...current,
              activeModuleIndex: index,
            }))
          }
          view={store.ui.activeView}
          onViewChange={(view) =>
            setUi((current) => ({
              ...current,
              activeView: view,
            }))
          }
          viewportMode={store.ui.viewportMode}
          availableViewportModes={['sheet', 'model', 'geometry3d']}
          onViewportModeChange={(viewportMode) =>
            setUi((current) => ({
              ...current,
              viewportMode,
            }))
          }
          status={store.derived.status}
          planModel={store.derived.activePlanModel}
          sectionModel={store.derived.activeSectionModel}
          planViewModel={store.derived.activePlanViewModel}
          geometryPreview={geometryPreview}
          viewportTransform={store.ui.viewportTransform}
          onViewportTransformChange={(viewportTransform) =>
            setUi((current) => ({
              ...current,
              viewportTransform,
            }))
          }
          meta={meta}
          modelEditableFields={drawingEditableFields}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
        />
      </div>
    </div>
  );
}
