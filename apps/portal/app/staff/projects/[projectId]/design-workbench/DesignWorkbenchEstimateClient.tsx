'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSideLocalPolygonFromWorld } from '@sp/geometry';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type { GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import {
  buildObjectWorkbenchGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
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
  buildEstimateDrawingDraftFromSnapshot,
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import { type DrawOutlineTarget } from './objectWorkbenchClientTypes';
import ObjectWorkbenchRailHost from './ObjectWorkbenchRailHost';
import { useObjectWorkbenchDraftPersistence } from './useObjectWorkbenchDraftPersistence';
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
  const { drawingDraft, persistDrawingDraftLocally } = useObjectWorkbenchDraftPersistence({
    estimateId: estimate.id,
    snapshot: estimate.calculatorSnapshot,
  });
  const snapshotDrawingDraft = useMemo(
    () => buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot),
    [estimate.calculatorSnapshot],
  );
  const effectiveDrawingDraft = drawingDraft ?? snapshotDrawingDraft;

  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: estimate.calculatorSnapshot,
        draft: effectiveDrawingDraft,
        ui,
        geometryIdentity: {
          projectId: estimate.projectId,
          estimateId: estimate.id,
        },
      }),
    [effectiveDrawingDraft, estimate.calculatorSnapshot, estimate.id, estimate.projectId, ui],
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
    const result = buildObjectWorkbenchGeometryEditState({
      snapshot: estimate.calculatorSnapshot,
      draft: effectiveDrawingDraft,
      moduleIndex: store.derived.activeModuleIndex,
    });
    return result.ok ? result.value : null;
  }, [effectiveDrawingDraft, estimate.calculatorSnapshot, store.derived.activeModuleIndex]);
  const supportsSanctuaryEditing = Boolean(geometryEditState);
  const drawingMetaOverrides = useMemo(
    () =>
      buildEstimateDrawingSheetMetaOverrides({
        moduleLabel: store.derived.activeModuleLabel,
        moduleIndex: store.derived.activeModuleIndex,
        draft: effectiveDrawingDraft,
      }),
    [effectiveDrawingDraft, store.derived.activeModuleIndex, store.derived.activeModuleLabel],
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
      !effectiveDrawingDraft || isLocked || !supportsSanctuaryEditing || !isPergolaTabActive
        ? []
        : deriveEstimateDrawingEditableFields({
            draft: effectiveDrawingDraft,
            moduleIndex: store.derived.activeModuleIndex,
            moduleLabel: store.derived.activeModuleLabel,
            view: store.ui.activeView,
            planModel: store.derived.activeLegacyPlanModel,
            sectionModel: store.derived.activeLegacySectionModel,
          }),
    [
      effectiveDrawingDraft,
      isLocked,
      store.derived.activeModuleIndex,
      store.derived.activeModuleLabel,
      store.derived.activeLegacyPlanModel,
      store.derived.activeLegacySectionModel,
      store.ui.activeView,
      supportsSanctuaryEditing,
      isPergolaTabActive,
    ],
  );
  const geometryPreview: GeometryPreviewState =
    store.derived.activeViewportGeometry?.preview ?? {
      kind: 'error',
      message: 'No active 3D geometry preview is available.',
    };
  const modelViewportSurfaceKey = `${store.derived.activeModuleIndex}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${store.derived.activeModuleIndex}`;
  const viewportPergolaId =
    store.derived.objectWorkbench.activePergola?.id ??
    activeModuleInput?.pergolaId ??
    store.derived.objectWorkbench.pergolas[0]?.id ??
    null;
  const viewportDefaultHouseFormId =
    store.derived.activeHouseForm?.id ?? store.derived.houseForms[0]?.id ?? null;
  const viewportActiveObjectRef =
    store.ui.activeObjectRef.family === 'pergolas'
      ? { family: 'pergolas' as const, objectId: store.ui.activeObjectRef.objectId ?? viewportPergolaId }
      : store.ui.activeObjectRef.family === 'house_forms'
        ? { family: 'house_forms' as const, objectId: store.ui.activeObjectRef.objectId ?? viewportDefaultHouseFormId }
        : store.ui.activeObjectRef;
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
    drawingDraft: effectiveDrawingDraft,
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
          trustGate={store.derived.activeTrustGate}
          viewportGeometry={store.derived.activeViewportGeometry}
          drawingSurfaceGeometry={store.derived.activeDrawingSurfaceGeometry}
          planViewModel={store.derived.activePlanViewModel}
          activeObjectRef={viewportActiveObjectRef}
          pergolaTargetId={viewportPergolaId}
          enableProjectionOnlyModelInteractions
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
          onCommitOutlineEdit={
            !isLocked
              ? (commit) => {
                  if (commit.family === 'house_forms') {
                    // The custom polygon is stored in side-local (alongM, depthM)
                    // coords whose interpretation depends on the active pergola
                    // dims + attachmentSide. Encoding raw world coords here would
                    // sign-flip depth for the default 'rear' attachment and produce
                    // a visible "house flips across the pergola axis" each commit.
                    const houseForm = store.derived.activeHouseForm;
                    const pergola = store.derived.activeObjectFirstPergola;
                    const lengthM = Number(pergola?.geometry?.dimensions?.lengthM);
                    const projectionM = Number(pergola?.geometry?.dimensions?.projectionM);
                    const sideLocalPoints = buildSideLocalPolygonFromWorld({
                      worldPolygonMm: commit.nextPolygon,
                      pergolaWidthMm: Number.isFinite(lengthM) ? lengthM * 1000 : 6000,
                      pergolaDepthMm: Number.isFinite(projectionM) ? projectionM * 1000 : 3000,
                      attachmentSide: houseForm?.footprint.attachmentSide ?? null,
                      params: houseForm?.footprint.params ?? null,
                    });
                    void objectWorkbenchActions.commitSharedHouseFootprintEdit({
                      type: 'custom_polygon',
                      polygon: sideLocalPoints.map((p) => ({
                        alongM: p.alongM.toString(),
                        depthM: p.depthM.toString(),
                      })),
                    });
                    return;
                  }
                  if (commit.family === 'pergolas') {
                    // Pergola edge-drag (first-class spatial entity write). The pergola
                    // owns its own world position (origin + rotation around +Z) and its
                    // own dimensions (lengthM/projectionM). An edge drag axis-aligned to
                    // the pergola's local frame may shift either:
                    //   - position (when the user grabs a -along or -depth wall and pulls
                    //     it outward, the pergola's anchor moves), or
                    //   - dimensions (when the user grabs a +along or +depth wall, the
                    //     pergola grows in that direction).
                    // Or both, depending on the bounding box of `nextPolygon`.
                    //
                    // We compute the new pergola box as `bbox(nextPolygon)`; its `(min)`
                    // becomes the new `position.origin` and its `(max - min)` becomes the
                    // new `(lengthM, projectionM)`. Position writes go through
                    // `commitSharedPergolaPosition`; dimensions go through
                    // `commitGeometryIntent` (which updates the module fields the solver
                    // reads). Two transactions, one render — no flicker.
                    //
                    // Rotation: not handled yet. Pergolas with non-zero rotation need
                    // bbox-aware drag math that operates in the local frame; deferred
                    // until a rotate gizmo lands.
                    const pergolaId =
                      store.ui.activeObjectRef.family === 'pergolas'
                        ? store.ui.activeObjectRef.objectId
                        : null;
                    if (!pergolaId || commit.nextPolygon.length < 3) return;
                    const pergola = store.derived.activeObjectFirstPergola;
                    const currentOriginXMm = Number(pergola?.position?.originXMm ?? '0');
                    const currentOriginYMm = Number(pergola?.position?.originYMm ?? '0');
                    const currentRotationDeg = Number(pergola?.position?.rotationDeg ?? '0');
                    const currentLengthMm = Number(activeModuleInput?.lengthM) * 1000;
                    const currentProjectionMm = Number(activeModuleInput?.projectionM) * 1000;
                    let minX = Infinity;
                    let minY = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;
                    for (const p of commit.nextPolygon) {
                      if (p.x < minX) minX = p.x;
                      if (p.y < minY) minY = p.y;
                      if (p.x > maxX) maxX = p.x;
                      if (p.y > maxY) maxY = p.y;
                    }
                    const nextOriginXMm = minX;
                    const nextOriginYMm = minY;
                    const nextLengthMm = Math.max(500, maxX - minX);
                    const nextProjectionMm = Math.max(500, maxY - minY);
                    const positionChanged =
                      Math.abs(nextOriginXMm - currentOriginXMm) >= 1 ||
                      Math.abs(nextOriginYMm - currentOriginYMm) >= 1;
                    const lengthChanged =
                      !Number.isFinite(currentLengthMm) ||
                      Math.abs(nextLengthMm - currentLengthMm) >= 1;
                    const projectionChanged =
                      !Number.isFinite(currentProjectionMm) ||
                      Math.abs(nextProjectionMm - currentProjectionMm) >= 1;
                    if (!positionChanged && !lengthChanged && !projectionChanged) return;
                    if (positionChanged) {
                      void objectWorkbenchActions.commitSharedPergolaPosition(pergolaId, {
                        originXMm: nextOriginXMm,
                        originYMm: nextOriginYMm,
                        rotationDeg: Number.isFinite(currentRotationDeg) ? currentRotationDeg : 0,
                      });
                    }
                    if (lengthChanged) {
                      void objectWorkbenchActions.commitGeometryIntent({
                        type: 'dimension',
                        field: 'lengthM',
                        value: (nextLengthMm / 1000).toString(),
                      });
                    }
                    if (projectionChanged) {
                      void objectWorkbenchActions.commitGeometryIntent({
                        type: 'dimension',
                        field: 'projectionM',
                        value: (nextProjectionMm / 1000).toString(),
                      });
                    }
                    return;
                  }
                  if (commit.family === 'decks') {
                    // Deck edge-drag commit (Slice D). Decks store their outline in
                    // side-local (alongM, depthM) coords, BUT the geometry decoder for
                    // decks (`normalize.ts` `buildHouseModelConfig`) hardcodes the frame
                    // to a 1m × 1m pergola with 0 offsets — separate from the house's
                    // actual footprint frame. The encoder here must match: pergolaWidth
                    // /Depth = 1000mm and `params: null` so default 0 offsets resolve.
                    // Otherwise the round-trip misaligns and the deck appears not to
                    // resize (the new outline decodes back to roughly the old world
                    // position).
                    const deckId =
                      store.ui.activeObjectRef.family === 'decks'
                        ? store.ui.activeObjectRef.objectId
                        : null;
                    if (!deckId || commit.nextPolygon.length < 3) return;
                    const houseForm = store.derived.activeHouseForm;
                    const sideLocalPoints = buildSideLocalPolygonFromWorld({
                      worldPolygonMm: commit.nextPolygon,
                      pergolaWidthMm: 1000,
                      pergolaDepthMm: 1000,
                      attachmentSide: houseForm?.footprint.attachmentSide ?? null,
                      params: null,
                    });
                    void objectWorkbenchActions.commitSharedHouseDeckPatch(deckId, {
                      shape: 'custom',
                      outline: sideLocalPoints.map((p) => ({
                        alongM: p.alongM.toString(),
                        depthM: p.depthM.toString(),
                      })),
                    });
                    return;
                  }
                  // openings deferred (no canonical polygon yet).
                  // eslint-disable-next-line no-console
                  console.warn('[edge-drag] outline edit not yet wired for family:', commit.family, commit);
                }
              : undefined
          }
        />
        </div>
      </div>
    </div>
  );
}
