'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import {
  buildGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  areDrawingWorkbenchObjectSelectionStatesEqual,
  areDrawingWorkbenchVisibilityStatesEqual,
  buildDrawingWorkbenchObjectSelectionState,
  createDrawingWorkbenchUiState,
  pickDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import { type DrawOutlineTarget } from './objectWorkbenchClientTypes';
import ObjectWorkbenchRailHost from './ObjectWorkbenchRailHost';
import { useHouseDraftPersistence } from './useHouseDraftPersistence';
import { useObjectWorkbenchActions } from './useObjectWorkbenchActions';
import { useObjectWorkbenchSelection } from './useObjectWorkbenchSelection';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

const DEFAULT_MODEL_VIEWPORT_TRANSFORM = createDrawingWorkbenchUiState().viewportTransform;

function buildInitialWorkbenchUiState(snapshot: Record<string, unknown> | null) {
  const defaultHouseFormId =
    buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState(),
    }).derived.houseForms[0]?.id ?? null;

  return createDrawingWorkbenchUiState({
    viewportMode: 'geometry3d',
    ...buildDrawingWorkbenchObjectSelectionState({
      activeRailTab: 'house_forms',
      activeObjectRef: {
        family: 'house_forms',
        objectId: defaultHouseFormId,
      },
    }),
  });
}

function viewportTransformsEqual(
  a: DrawingWorkbenchViewportTransform,
  b: DrawingWorkbenchViewportTransform,
): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

function geometryViewportStatesEqual(
  a: Geometry3DViewportState,
  b: Geometry3DViewportState,
): boolean {
  return (
    a.cameraState.distanceMm === b.cameraState.distanceMm &&
    a.cameraState.viewPreset === b.cameraState.viewPreset &&
    a.cameraState.focusMode === b.cameraState.focusMode &&
    a.cameraState.position.x === b.cameraState.position.x &&
    a.cameraState.position.y === b.cameraState.position.y &&
    a.cameraState.position.z === b.cameraState.position.z &&
    a.cameraState.target.x === b.cameraState.target.x &&
    a.cameraState.target.y === b.cameraState.target.y &&
    a.cameraState.target.z === b.cameraState.target.z
  );
}

export default function DesignWorkbenchEstimateClient({
  estimate,
  projectName,
  siteAddress,
  backHref,
}: DesignWorkbenchEstimateClientProps) {
  const [ui, setUi] = useState(() => buildInitialWorkbenchUiState(estimate.calculatorSnapshot));
  const [modelViewportTransformsByKey, setModelViewportTransformsByKey] = useState<
    Record<string, DrawingWorkbenchViewportTransform>
  >({});
  const [geometryViewportStatesByKey, setGeometryViewportStatesByKey] = useState<
    Record<string, Geometry3DViewportState>
  >({});
  const [drawOutlineRequestId, setDrawOutlineRequestId] = useState(0);
  const [drawOutlineTarget, setDrawOutlineTarget] = useState<DrawOutlineTarget>({
    kind: 'footprint',
    deckId: null,
  });
  const { drawingDraft, persistDrawingDraftLocally } = useHouseDraftPersistence({
    estimateId: estimate.id,
    snapshot: estimate.calculatorSnapshot,
  });

  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: estimate.calculatorSnapshot,
        draft: drawingDraft,
        ui,
      }),
    [drawingDraft, estimate.calculatorSnapshot, ui],
  );

  useEffect(() => {
    const defaultHouseFormId =
      buildDrawingWorkbenchStore({
        snapshot: estimate.calculatorSnapshot,
        ui: createDrawingWorkbenchUiState(),
      }).derived.houseForms[0]?.id ?? null;

    setUi((current) => ({
      ...current,
      activeModuleIndex: 0,
      ...buildDrawingWorkbenchObjectSelectionState({
        activeRailTab: 'house_forms',
        activeObjectRef: { family: 'house_forms', objectId: defaultHouseFormId },
      }),
    }));
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
  }, [estimate.calculatorSnapshot]);

  useEffect(() => {
    const storeSelection = pickDrawingWorkbenchObjectSelectionState(store.ui);
    const uiSelection = pickDrawingWorkbenchObjectSelectionState(ui);
    if (
      store.ui.activeModuleIndex === ui.activeModuleIndex &&
      areDrawingWorkbenchObjectSelectionStatesEqual(storeSelection, uiSelection) &&
      areDrawingWorkbenchVisibilityStatesEqual(store.ui.visibility, ui.visibility)
    ) {
      return;
    }
    setUi((current) => ({
      ...current,
      activeModuleIndex: store.ui.activeModuleIndex,
      ...storeSelection,
      visibility: store.ui.visibility,
    }));
  }, [
    store.ui,
    ui,
  ]);

  const activeModule = store.derived.activeModule;
  const activeModuleInput = activeModule?.drawingModule.input ?? null;
  const activeDeck =
    store.derived.objectWorkbench.decks.find((deck) => deck.id === drawOutlineTarget.deckId) ??
    store.derived.objectWorkbench.activeDeck ??
    null;
  const drawOutlineMode = drawOutlineTarget.kind;
  const drawOutlineSeedPolygon =
    drawOutlineTarget.kind === 'deck'
      ? (activeDeck?.outline ?? null)
      : null;
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
  const activeSelectionFamily =
    store.ui.activeRailTab === 'diagnostics' ? store.ui.activeObjectFamily : store.ui.activeRailTab;
  const objectWorkbenchDisplayFamily = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house_forms';
  const isPergolaTabActive = store.ui.activeRailTab === 'pergolas';
  const drawingEditableFields = useMemo(
    () =>
      !drawingDraft || isLocked || !supportsSanctuaryEditing || !isPergolaTabActive
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
      isPergolaTabActive,
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
  const modelViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${store.derived.activeModuleIndex}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${store.derived.activeModuleIndex}`;
  const viewportPergolaId =
    store.derived.objectWorkbench.activePergola?.id ??
    activeModuleInput?.pergolaId ??
    store.derived.objectWorkbench.pergolas[0]?.id ??
    null;
  const viewportActiveObjectRef =
    store.ui.activeObjectRef.family === 'pergolas'
      ? store.ui.activeObjectRef
      : { family: 'pergolas' as const, objectId: viewportPergolaId };
  const activeModelViewportTransform =
    modelViewportTransformsByKey[modelViewportSurfaceKey] ?? DEFAULT_MODEL_VIEWPORT_TRANSFORM;
  const activeGeometryViewportState =
    geometryViewportStatesByKey[geometryViewportSurfaceKey] ?? null;
  const shouldAutoFitModelViewport = !Object.prototype.hasOwnProperty.call(
    modelViewportTransformsByKey,
    modelViewportSurfaceKey,
  );
  const handleModelViewportTransformChange = useCallback(
    (viewportTransform: DrawingWorkbenchViewportTransform) => {
      setModelViewportTransformsByKey((current) => {
        const existing = current[modelViewportSurfaceKey];
        if (existing && viewportTransformsEqual(existing, viewportTransform)) return current;
        return {
          ...current,
          [modelViewportSurfaceKey]: viewportTransform,
        };
      });
      setUi((current) =>
        viewportTransformsEqual(current.viewportTransform, viewportTransform)
          ? current
          : {
              ...current,
              viewportTransform,
            },
      );
    },
    [modelViewportSurfaceKey],
  );
  const handleGeometryViewportStateChange = useCallback(
    (viewportState: Geometry3DViewportState) => {
      setGeometryViewportStatesByKey((current) => {
        const existing = current[geometryViewportSurfaceKey];
        if (existing && geometryViewportStatesEqual(existing, viewportState)) return current;
        return {
          ...current,
          [geometryViewportSurfaceKey]: viewportState,
        };
      });
    },
    [geometryViewportSurfaceKey],
  );
  const objectSelectionActions = useObjectWorkbenchSelection({
    setUi,
    setDrawOutlineTarget,
    setDrawOutlineRequestId,
    availableObjectIdsByFamily: {
      house_forms: store.derived.railModel.objectLists.house_forms.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      decks: store.derived.railModel.objectLists.decks.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      openings: store.derived.railModel.objectLists.openings.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      pergolas: store.derived.railModel.objectLists.pergolas.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
    },
  });
  const objectWorkbenchActions = useObjectWorkbenchActions({
    activeModuleInput,
    drawingDraft,
    drawOutlineTarget,
    persistDrawingDraftLocally,
    setDrawOutlineTarget,
    setUi,
    snapshot: estimate.calculatorSnapshot,
    startDeckOutlineEditor: objectSelectionActions.startDeckOutlineEditor,
    store,
    ui,
  });

  const workbenchFieldCommit =
    !isLocked && supportsSanctuaryEditing && isPergolaTabActive
      ? objectWorkbenchActions.commitDrawingField
      : undefined;
  const workbenchFootprintCommit =
    !isLocked && objectWorkbenchDisplayFamily === 'house_forms' && store.ui.viewportMode === 'model'
      ? objectWorkbenchActions.commitSharedHouseFootprintEdit
      : undefined;

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
        <ObjectWorkbenchRailHost
          activeModuleInput={activeModuleInput}
          geometryEditState={geometryEditState}
          geometryPreview={geometryPreview}
          isLocked={isLocked}
          objectSelectionActions={objectSelectionActions}
          objectWorkbenchActions={objectWorkbenchActions}
          setUi={setUi}
          store={store}
          supportsSanctuaryEditing={supportsSanctuaryEditing}
        />

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
              ...(current.activeObjectFamily === 'pergolas'
                ? buildDrawingWorkbenchObjectSelectionState({
                    activeRailTab: current.activeRailTab,
                    activeObjectFamily: current.activeObjectFamily,
                    activeObjectRef: {
                      family: 'pergolas',
                      objectId:
                        store.persisted.modules[index]?.drawingModule.input.pergolaId ??
                        (current.activeObjectRef.family === 'pergolas' ? current.activeObjectRef.objectId : null),
                    },
                  })
                : {}),
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
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={store.ui.visibility}
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
          activeObjectRef={viewportActiveObjectRef}
          modelViewportKey={modelViewportSurfaceKey}
          modelViewportTransform={activeModelViewportTransform}
          modelViewportAutoFitOnReady={shouldAutoFitModelViewport}
          geometryViewportKey={geometryViewportSurfaceKey}
          geometryViewportState={activeGeometryViewportState}
          drawOutlineRequestId={drawOutlineRequestId}
          drawOutlineMode={drawOutlineMode}
          drawOutlineSeedPolygon={drawOutlineSeedPolygon ?? undefined}
          onDrawOutlineRequestConsumed={(requestId) =>
            setDrawOutlineRequestId((current) => (current === requestId ? 0 : current))
          }
          onModelViewportTransformChange={handleModelViewportTransformChange}
          onGeometryViewportStateChange={handleGeometryViewportStateChange}
          meta={meta}
          backHref={backHref}
          modelEditableFields={isPergolaTabActive ? drawingEditableFields : []}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
          onCommitCustomPolygon={!isLocked ? objectWorkbenchActions.commitSharedDeckCustomPolygon : undefined}
          onSelectObjectWorkbenchTarget={!isLocked ? objectSelectionActions.selectObjectWorkbenchTarget : undefined}
          onSelectPergolaTarget={!isLocked ? objectSelectionActions.selectPergolaObject : undefined}
          onClearWorkbenchSelection={!isLocked ? objectSelectionActions.clearActiveWorkbenchSelection : undefined}
          onCommitHouseFormFootprintDimension={!isLocked ? objectWorkbenchActions.commitHouseFormFootprintDimension : undefined}
          onCommitDeckDimension={!isLocked ? objectWorkbenchActions.commitDeckDimension : undefined}
          onCommitOpeningDimension={!isLocked ? objectWorkbenchActions.commitOpeningDimension : undefined}
        />
        </div>
      </div>
    </div>
  );
}
