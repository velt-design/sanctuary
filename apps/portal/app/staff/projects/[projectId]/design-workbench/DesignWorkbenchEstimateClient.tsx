'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import {
  applyGeometryEditIntent,
  buildGeometryEditState,
  translateEstimateDrawingFieldToGeometryIntent,
  translateFootprintEditToGeometryIntent,
  type GeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildEstimateDrawingDraftFromSnapshot,
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
  estimateDrawingDraftMatchesSnapshot,
  mergeEstimateDrawingDraftIntoSnapshot,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

type CommitResult = { ok: boolean; error?: string };

export default function DesignWorkbenchEstimateClient({
  estimate,
  projectName,
  siteAddress,
  backHref,
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
  const modules = store.persisted.modules.map((module) => ({
    id: module.id,
    label: module.label,
  }));
  const isLocked = estimate.editability.isLocked;
  const geometryEditState = useMemo(() => {
    const result = buildGeometryEditState({
      snapshot: estimate.calculatorSnapshot,
      draft: drawingDraft,
      moduleIndex: store.derived.activeModuleIndex,
    });
    return result.ok ? result.value : null;
  }, [drawingDraft, estimate.calculatorSnapshot, store.derived.activeModuleIndex]);
  const supportsSanctuaryEditing = Boolean(geometryEditState);
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

      const intent = translateFootprintEditToGeometryIntent(edit);
      if (!intent) {
        return { ok: false, error: 'This footprint edit is not supported in the geometry-backed workbench yet.' };
      }

      const result = applyGeometryEditIntent({
        snapshot: estimate.calculatorSnapshot,
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        intent,
      });

      if (!result.ok) return { ok: false, error: result.message };
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, estimate.calculatorSnapshot, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

  const commitDrawingField = useCallback(
    async (field: EstimateDrawingField, nextValue: string): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const intent = translateEstimateDrawingFieldToGeometryIntent(field, nextValue);
      if (!intent) {
        return { ok: false, error: 'This drawing field is not supported in the geometry-backed workbench yet.' };
      }

      const result = applyGeometryEditIntent({
        snapshot: estimate.calculatorSnapshot,
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        intent,
      });

      if (!result.ok) return { ok: false, error: result.message };
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, estimate.calculatorSnapshot, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

  const commitGeometryIntent = useCallback(
    async (intent: GeometryEditIntent): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const result = applyGeometryEditIntent({
        snapshot: estimate.calculatorSnapshot,
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        intent,
      });

      if (!result.ok) {
        return {
          ok: false,
          error: result.message,
        };
      }
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, estimate.calculatorSnapshot, persistDrawingDraftLocally, store.derived.activeModuleIndex],
  );

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
    <div className={styles.shell}>
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
        {modules.length > 1 ? (
          <section className={styles.moduleSection}>
            <p className={styles.moduleSectionTitle}>Module</p>
            <select
              className={styles.moduleSelect}
              aria-label="Drawing module"
              value={String(store.derived.activeModuleIndex)}
              onChange={(event) =>
                setUi((current) => ({
                  ...current,
                  activeModuleIndex: Number(event.target.value),
                }))
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

        {supportsSanctuaryEditing && activeModuleInput ? (
          <SanctuaryWorkbenchRail
            moduleLabel={store.derived.activeModuleLabel}
            geometryState={geometryEditState}
            view={store.ui.activeView}
            disabled={isLocked}
            onCommitGeometryEdit={!isLocked ? commitGeometryIntent : undefined}
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

        {geometryPreview.kind === 'ready' && geometryPreview.previewMode === 'draft_local_resolved' ? (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>3D Preview Resolved Locally</p>
            <p className={styles.noticeText}>
              The 3D view is using the current unsaved draft inputs and a fresh local module solve for geometry verification. It is authoritative for draft geometry, but it still reflects unsaved work.
            </p>
          </section>
        ) : null}
        </div>
      </aside>

      <div className={styles.workspaceColumn}>
        <div className={styles.workspaceSurface}>
        <DrawingWorkbench
          moduleLabel={store.derived.activeModuleLabel}
          modules={modules}
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
          backHref={backHref}
          modelEditableFields={drawingEditableFields}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
        />
        </div>
      </div>
    </div>
  );
}
