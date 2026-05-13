'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSideLocalPolygonFromWorld } from '@sp/geometry';
import { buildDeckTransformPatch } from '@/lib/drawings/commits/commitDeckTransform';
import { buildPergolaTransformPosition } from '@/lib/drawings/commits/commitPergolaTransform';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type { GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import {
  buildObjectWorkbenchGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { buildProjectContextOverlayShapes } from '@/lib/drawings/state/workbenchSolvedModel';
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
import { pergolaAttachmentFromSnap } from '@/lib/drawings/state/pergolaAttachment';
import type { PergolaAttachment, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
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
  // Cross-viewport hover state (milestone 16). Driven by whichever viewport
  // currently has the user's pointer; consumed by the other(s) to render a
  // matching highlight. Local hover (data-plan-hover-shape-id, hit-target
  // hover styling) stays viewport-internal -- this is purely for the cross-
  // surface "show me where this object lives in the other view" affordance.
  // Local state, not in the persisted UI state, since hover is transient.
  const [hoveredObjectRef, setHoveredObjectRef] = useState<WorkbenchObjectRef | null>(null);
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
  // Step 5d Option A: faded outlines for OTHER pergolas in the project so
  // multi-pergola scenes show every pergola's outline at a glance. The
  // active module's full topProjection still drives detail rendering; the
  // overlay only adds shapes the active artifact doesn't render
  // (non-active pergola outlines), with the house reference filtered out
  // since the active artifact already provides it.
  //
  // Active-pergola filter only applies when a pergola is the active object
  // (avoids self-snap on the active pergola's own outline). When the active
  // object is a deck or house, all pergolas should appear in the overlay
  // and be available as snap targets — a deck attaching to its host pergola
  // is the common case, not an exception.
  const activePergolaSourceId =
    store.ui.activeObjectRef.family === 'pergolas'
      ? store.derived.activeModule?.drawingModule.input.pergolaId ?? null
      : null;
  const projectContextShapes = useMemo(
    () =>
      buildProjectContextOverlayShapes({
        projectReferenceShapes: store.derived.solvedModel.projectReferenceShapes,
        activePergolaSourceId,
      }),
    [store.derived.solvedModel.projectReferenceShapes, activePergolaSourceId],
  );
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
          projectContextShapes={projectContextShapes}
          hoveredObjectRef={hoveredObjectRef}
          onHoverObjectChange={setHoveredObjectRef}
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
          onToggleHouseTerminalEnd={
            // eslint-disable-next-line no-console
            (console.log('[toggle-trace] D-gate prop wiring', { isLocked }), !isLocked)
              ? (endId, currentlyOpen) => {
                  // Plan-view click on a hip-end marker. Mirror the rail's
                  // open-end toggle in HouseFormRoofSections.tsx -- read
                  // the active roof intent, invert membership of `endId`
                  // in `openGableEndIds`, and commit. The rail and the
                  // plan view share the same commit action so undo/redo
                  // and persistence work the same regardless of where
                  // the toggle was triggered.
                  //
                  // Plan-view clicks happen INDEPENDENT of rail selection
                  // -- the user might be on the Pergolas tab when they
                  // click a hip triangle. Fall back to the first house
                  // form so the toggle still targets the right entity.
                  // (commitSharedHouseRoofDraft itself uses the same
                  // fallback at useObjectWorkbenchActions.ts:143.)
                  const houseForm =
                    store.derived.activeHouseForm ?? store.derived.houseForms[0] ?? null;
                  const currentRoof = houseForm?.roofIntent ?? null;
                  const currentOpenIds = currentRoof?.openGableEndIds ?? [];
                  const nextOpenIds = currentlyOpen
                    ? currentOpenIds.filter((id) => id !== endId)
                    : [...currentOpenIds, endId];
                  // eslint-disable-next-line no-console
                  console.log('[toggle-trace] D-call onToggleHouseTerminalEnd', {
                    endId,
                    currentlyOpen,
                    hasHouseForm: !!houseForm,
                    houseFormId: houseForm?.id,
                    roofForm: currentRoof?.form,
                    ridgeAxis: currentRoof?.ridgeAxis,
                    roofIntentAuthored: houseForm?.roofIntentAuthored,
                    currentOpenIds,
                    nextOpenIds,
                  });
                  if (!houseForm || !currentRoof) return;
                  void objectWorkbenchActions.commitSharedHouseRoofDraft({
                    ...currentRoof,
                    openGableEndIds: nextOpenIds,
                  });
                }
              : undefined
          }
          onCommitHouseFormFootprintDimension={!isLocked ? objectWorkbenchActions.commitHouseFormFootprintDimension : undefined}
          onCommitDeckDimension={!isLocked ? objectWorkbenchActions.commitDeckDimension : undefined}
          onCommitOpeningDimension={!isLocked ? objectWorkbenchActions.commitOpeningDimension : undefined}
          onCommitOutlineEdit={
            !isLocked
              ? (commit) => {
                  if (commit.family === 'house_forms') {
                    // House edge-drag commit (stage 3.4 — house first-class spatial
                    // entity). The house owns its own world `position` and its
                    // polygon is stored in side-local (alongM, depthM) coords
                    // decoded against a unit (1m × 1m) frame. With this layout, the
                    // house's world location is invariant to pergola dimensions.
                    //
                    // For un-migrated data (no `houseFootprintPosition` set), this
                    // commit is also the migration trigger. We compute the
                    // attachment-side-aware migration default (the offset that
                    // would make a unit-frame decode match the legacy real-frame
                    // decode for the current pergola dims), persist that as the
                    // house position, and encode the new polygon against the unit
                    // frame. After this commit, the house is fully decoupled.
                    //
                    // For migrated data (position already set), we encode against
                    // the unit frame using the existing position; position stays
                    // unchanged.
                    const houseForm = store.derived.activeHouseForm;
                    const attachmentSide = houseForm?.footprint.attachmentSide ?? 'rear';
                    const persistedPosition = activeModuleInput?.houseFootprintPosition ?? null;
                    let positionXMm: number;
                    let positionYMm: number;
                    let positionRotationDeg: number;
                    if (persistedPosition) {
                      positionXMm = Number(persistedPosition.originXMm);
                      positionYMm = Number(persistedPosition.originYMm);
                      positionRotationDeg = Number(persistedPosition.rotationDeg);
                    } else {
                      // Migration default — see docs/design-workbench-architecture.md
                      // §"House first-class entity" stage 3.3 for the math.
                      const pergolaWidthM = Number(activeModuleInput?.lengthM);
                      const pergolaDepthM = Number(activeModuleInput?.projectionM);
                      const safeWidthM = Number.isFinite(pergolaWidthM) ? pergolaWidthM : 6;
                      const safeDepthM = Number.isFinite(pergolaDepthM) ? pergolaDepthM : 3;
                      switch (attachmentSide) {
                        case 'front':
                          positionXMm = 0;
                          positionYMm = (safeDepthM - 1) * 1000;
                          break;
                        case 'right':
                          positionXMm = (safeWidthM - 1) * 1000;
                          positionYMm = 0;
                          break;
                        case 'rear':
                        case 'left':
                        default:
                          positionXMm = 0;
                          positionYMm = 0;
                          break;
                      }
                      positionRotationDeg = 0;
                    }
                    // Subtract position from each world point, then encode against
                    // the unit frame. Round-trip: unit_decoder(side_local) +
                    // position == worldPolygonMm.
                    const cos = Math.cos((positionRotationDeg * Math.PI) / 180);
                    const sin = Math.sin((positionRotationDeg * Math.PI) / 180);
                    const localWorldPolygon = commit.nextPolygon.map((p) => {
                      const dx = p.x - positionXMm;
                      const dy = p.y - positionYMm;
                      // Inverse rotation (transpose).
                      return {
                        x: cos * dx + sin * dy,
                        y: -sin * dx + cos * dy,
                      };
                    });
                    const sideLocalPoints = buildSideLocalPolygonFromWorld({
                      worldPolygonMm: localWorldPolygon,
                      pergolaWidthMm: 1000,
                      pergolaDepthMm: 1000,
                      attachmentSide,
                      params: null,
                    });
                    if (!persistedPosition) {
                      // First-edit migration — write position before polygon so
                      // both land in the same draft transaction batch.
                      void objectWorkbenchActions.commitSharedHouseFootprintEdit({
                        type: 'position',
                        position: {
                          originXMm: positionXMm.toString(),
                          originYMm: positionYMm.toString(),
                          rotationDeg: positionRotationDeg.toString(),
                        },
                      });
                    }
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
                    // owns its own world position (origin + rotation around +Z), its
                    // own dimensions (lengthM/projectionM), and its own snap-derived
                    // attachment shape. An edge drag computes `bbox(nextPolygon)`:
                    //   - bbox.min becomes the new `position.origin`
                    //   - (max - min) becomes the new (lengthM, projectionM)
                    //   - When the drag ended on a snap, the snap target derives a
                    //     `PergolaAttachment` (host + spatialKind + method).
                    //
                    // ALL THREE are written in a single atomic patch via
                    // `commitSharedPergolaEdgeDragResult`. Earlier this handler fired
                    // up to four fire-and-forget commits in the same React tick;
                    // each cloned the pre-tick draft and the last persist won, which
                    // dropped position/dimension writes when the attachment write
                    // landed last (visible bug: pergola "jumps back to original size"
                    // on snap-release). The atomic action eliminates that race.
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
                    // Build the atomic patch. The snap engine surfaces three host
                    // edge kinds:
                    //   - `wall` / `roof_eave` → host.objectFamily = 'house_forms'
                    //   - `pergola_outline`    → host.objectFamily = 'pergolas'
                    // The legacy `connection.type` enum is preserved as a derived
                    // projection — see `connectionTypeFromAttachment`. No snap →
                    // leave the existing attachment unchanged (caller can clear
                    // via the inspector if needed).
                    let snapAttachment: PergolaAttachment | undefined = undefined;
                    if (commit.snap) {
                      const hostEdgeKind = commit.snap.target.edgeKind;
                      if (
                        hostEdgeKind === 'wall' ||
                        hostEdgeKind === 'roof_eave' ||
                        hostEdgeKind === 'pergola_outline'
                      ) {
                        const hostObjectFamily =
                          hostEdgeKind === 'pergola_outline' ? 'pergolas' : 'house_forms';
                        snapAttachment = pergolaAttachmentFromSnap({
                          hostObjectFamily,
                          hostObjectId: commit.snap.target.sourceObjectId,
                          hostEdgeKind,
                          hostEdgeId: commit.snap.target.id,
                          // The dragged edge index — preserved on the
                          // attachment so re-solves can recover alignment
                          // (which polygon edge of MY pergola sits on the
                          // host edge) without re-querying the snap engine.
                          myEdgeIndex: commit.edgeIndex,
                        });
                      }
                    }
                    if (
                      !positionChanged &&
                      !lengthChanged &&
                      !projectionChanged &&
                      !snapAttachment
                    ) {
                      return;
                    }
                    // Forward fields = the new state the edge-drag commits to.
                    // Inverse fields = the captured pre-edit state. We pass
                    // ALL fields in the inverse (not just changed ones) so the
                    // restore is complete -- e.g. if the edit changed only
                    // lengthMm + attachment, undo still re-applies the
                    // original position to keep the pergola identical to
                    // pre-edit state. The action no-ops when fields don't
                    // differ, so passing extras is cheap.
                    const forwardFields = {
                      ...(positionChanged
                        ? {
                            position: {
                              originXMm: nextOriginXMm,
                              originYMm: nextOriginYMm,
                              rotationDeg: Number.isFinite(currentRotationDeg)
                                ? currentRotationDeg
                                : 0,
                            },
                          }
                        : null),
                      ...(lengthChanged ? { lengthMm: nextLengthMm } : null),
                      ...(projectionChanged ? { projectionMm: nextProjectionMm } : null),
                      ...(snapAttachment ? { attachment: snapAttachment } : null),
                    };
                    const previousAttachment = pergola?.attachment ?? null;
                    const inverseFields = {
                      position: {
                        originXMm: currentOriginXMm,
                        originYMm: currentOriginYMm,
                        rotationDeg: Number.isFinite(currentRotationDeg)
                          ? currentRotationDeg
                          : 0,
                      },
                      ...(Number.isFinite(currentLengthMm) ? { lengthMm: currentLengthMm } : null),
                      ...(Number.isFinite(currentProjectionMm)
                        ? { projectionMm: currentProjectionMm }
                        : null),
                      attachment: previousAttachment,
                    };
                    return {
                      label: `Resize pergola ${pergolaId}`,
                      apply: () => {
                        void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
                          pergolaId,
                          forwardFields,
                        );
                      },
                      invert: () => {
                        void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
                          pergolaId,
                          inverseFields,
                        );
                      },
                    };
                  }
                  if (commit.family === 'decks') {
                    // Deck edge-drag commit (stage 4 — deck first-class spatial
                    // entity). The deck owns its own world `position` and its
                    // outline is stored in side-local `(alongM, depthM)` coords
                    // decoded against a unit (1m × 1m) frame. Position is
                    // applied as a post-decode translation, decoupling the
                    // deck from the host's `attachmentSide` and from pergola
                    // dimensions.
                    //
                    // Bbox approach (parallel to pergola): `bbox.min(nextPolygon)`
                    // becomes the new deck `position.origin`; the polygon is
                    // shifted by `-position` and re-encoded against the unit
                    // frame. Whether this is a first edit (position was null)
                    // or a subsequent edit, the same logic produces the
                    // canonical (position, polygon) pair.
                    //
                    // Resolve deckId from `commit.outlineId` (shape id =
                    // `${type}:${id}` rather than `activeObjectRef`. The
                    // active ref's `objectId` can be null mid-render (when the
                    // ref normalizer can't yet match it against the current
                    // deck list — e.g. right after the snapshot rehydrates) but
                    // the EdgeDragTool always emits the shape it actually
                    // dragged, so the outline is the source of truth.
                    //
                    // Outline id formats (any of these may appear depending on
                    // which canonical-outline shape the picker chose):
                    //   `house_surface:${deck.id}`       — top-projected surface
                    //   `house_surface_solid:house-solid-${deck.id}` — solid prism
                    // Match by checking deck.id as a suffix of outlineId; this
                    // is robust against either prefix without fragile parsing.
                    const projectModelDecks = store.persisted.projectModel.decks;
                    const matchedDeck = projectModelDecks.find((deck) =>
                      commit.outlineId.endsWith(`:${deck.id}`) ||
                      commit.outlineId.endsWith(`-${deck.id}`),
                    );
                    const deckId = matchedDeck?.id ?? null;
                    if (!deckId || commit.nextPolygon.length < 3) return;
                    // House world position is needed so `buildDeckTransformPatch`
                    // can convert the world bbox.min into a house-local
                    // `deck.position` (the geometry decoder applies
                    // `deck.position + house.position`, so the persisted
                    // value must be in house-local coords; otherwise each
                    // commit would re-add house.position and the deck
                    // would drift).
                    //
                    // Read from `activeModuleInput.houseFootprintPosition` —
                    // the SAME field the geometry pipeline reads via
                    // `buildRawGeometryModuleInput.resolveHousePosition` and
                    // hands to `applyAssemblyPosition3D`. Reading from
                    // `houseAssembly.houseForms[0].footprint.position`
                    // (project-model) instead would risk a stale/diverged
                    // value if the two fields ever desynced.
                    const houseModulePosition = activeModuleInput?.houseFootprintPosition;
                    const houseWorldPositionMm = houseModulePosition
                      ? {
                          x: Number(houseModulePosition.originXMm) || 0,
                          y: Number(houseModulePosition.originYMm) || 0,
                        }
                      : null;
                    const patch = buildDeckTransformPatch({
                      worldPolygonMm: commit.nextPolygon,
                      currentRotationDeg: matchedDeck?.position?.rotationDeg,
                      houseWorldPositionMm,
                    });
                    if (!patch) return;
                    // Capture the pre-edit shape-defining fields so undo can
                    // restore them. The forward patch always lands as
                    // `shape: 'custom'` + outline + position; the inverse must
                    // carry whatever the deck had before (preset, floating, or
                    // a different custom outline). Including all candidates
                    // keeps the inverse correct regardless of the prior shape
                    // -- partial patches ignore irrelevant fields.
                    const previousDeckPatch: ObjectWorkbenchDeckPatch = matchedDeck
                      ? {
                          shape: matchedDeck.shape,
                          outline: matchedDeck.outline,
                          position: matchedDeck.position ?? null,
                          presetType: matchedDeck.presetType ?? null,
                          presetRect: matchedDeck.presetRect ?? null,
                          floatingRect: matchedDeck.floatingRect ?? null,
                        }
                      : { shape: 'custom', outline: [], position: null };
                    return {
                      label: `Resize deck ${deckId}`,
                      apply: () => {
                        void objectWorkbenchActions.commitSharedHouseDeckPatch(deckId, patch);
                      },
                      invert: () => {
                        void objectWorkbenchActions.commitSharedHouseDeckPatch(
                          deckId,
                          previousDeckPatch,
                        );
                      },
                    };
                  }
                  // openings deferred (no canonical polygon yet).
                  // eslint-disable-next-line no-console
                  console.warn('[edge-drag] outline edit not yet wired for family:', commit.family, commit);
                }
              : undefined
          }
          onCommitMove={
            !isLocked
              ? (request) => {
                  // Move tool commit (milestone 14). The tool emits
                  // `request.delta` in plan-projection mm; we translate the
                  // target's persisted `position.origin` by that delta and
                  // write an atomic patch via the same action used for
                  // edge-drag commits. Reading the current position from the
                  // store at apply-time means undo (which calls back here
                  // with negative delta) reads the post-apply position,
                  // producing the original. The move command's `invert` is
                  // wired in `MoveTool.createMoveCommand` to flip the delta.
                  if (request.target.family === 'pergola') {
                    const pergola = store.derived.objectWorkbench.pergolas.find(
                      (p) => p.id === request.target.targetId,
                    );
                    if (!pergola) return;
                    void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
                      request.target.targetId,
                      {
                        position: buildPergolaTransformPosition({
                          currentPosition: pergola.position,
                          deltaMm: request.delta,
                        }),
                      },
                    );
                    return;
                  }
                  if (request.target.family === 'deck') {
                    const deck = store.persisted.projectModel.decks.find(
                      (d) => d.id === request.target.targetId,
                    );
                    if (!deck) return;
                    // Read the deck's CURRENT world polygon from the solved
                    // artifact. This is the source of truth regardless of
                    // whether the deck has been migrated to its first-class
                    // `position + side-local outline` form yet — the
                    // geometry pipeline always produces a world boundary.
                    // Translating the world polygon by `request.delta` and
                    // running it through `buildDeckTransformPatch` gives the
                    // exact same atomic patch shape the edge-drag handler
                    // writes; that's the point of the shared helper. Legacy
                    // decks with `position == null` migrate cleanly on first
                    // move instead of jumping to a tiny location because the
                    // unit-frame decoder runs against a pergola-anchored
                    // outline.
                    const artifact = store.derived.activeViewportGeometry?.artifact;
                    const deckSolid = artifact?.assembly?.house?.model?.decks?.find(
                      (entry) => entry.id === request.target.targetId,
                    );
                    const worldBoundary = deckSolid?.boundary ?? null;
                    if (!worldBoundary || worldBoundary.length < 3) return;
                    const nextWorldPolygon = worldBoundary.map((p) => ({
                      x: p.x + request.delta.x,
                      y: p.y + request.delta.y,
                    }));
                    // See edge-drag handler above for why we pass house
                    // world position here. Same fix, same reason: the
                    // decoder adds `deck.position + house.position`, so
                    // we must subtract house.position when going from
                    // world coords to the persisted deck.position. We
                    // read from `activeModuleInput.houseFootprintPosition`
                    // because that's the exact field the geometry
                    // pipeline consumes.
                    const houseModulePosition = activeModuleInput?.houseFootprintPosition;
                    const houseWorldPositionMm = houseModulePosition
                      ? {
                          x: Number(houseModulePosition.originXMm) || 0,
                          y: Number(houseModulePosition.originYMm) || 0,
                        }
                      : null;
                    const patch = buildDeckTransformPatch({
                      worldPolygonMm: nextWorldPolygon,
                      currentRotationDeg: deck.position?.rotationDeg,
                      houseWorldPositionMm,
                    });
                    if (!patch) return;
                    void objectWorkbenchActions.commitSharedHouseDeckPatch(
                      request.target.targetId,
                      patch,
                    );
                    return;
                  }
                  // openings deferred — they're wall-anchored, not freely
                  // positioned, so move-via-translate doesn't apply.
                }
              : undefined
          }
        />
        </div>
      </div>
    </div>
  );
}
