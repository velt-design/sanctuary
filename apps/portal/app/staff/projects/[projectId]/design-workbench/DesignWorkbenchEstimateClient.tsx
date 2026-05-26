'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { PergolaAttachment, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { pergolaAttachmentFromSnap } from '@/lib/drawings/state/pergolaAttachment';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import { buildOutlineEditCommitHandler } from './commitOutlineEdit';
import { type DrawOutlineTarget } from './objectWorkbenchClientTypes';
import RightInspectorPanel from '@/components/drawings/inspector/RightInspectorPanel';
import ObjectWorkbenchRailHost from './ObjectWorkbenchRailHost';
import WorkbenchInspectorHost from './WorkbenchInspectorHost';
import { resolveHouseTerminalEndToggleRoofDraft } from './resolveHouseTerminalEndToggleRoofDraft';
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
  // PR-Bug2 (2026-05-25): non-host house form `house_reference` footprints
  // promoted into the active module's committedBodies so they're hit-target-
  // able and movable. The active pergola's host house already arrives via
  // the module projection (from `buildReferenceShapes` inside the geometry
  // package), so we exclude it here to avoid double rendering. All OTHER
  // house forms (additional sleepouts, granny flats, second houses) flow in.
  const additionalCommittedShapes = useMemo(() => {
    const hostHouseSourceId =
      store.derived.solvedModel.projectModel.houseAssembly?.houseForms[0]?.id ?? null;
    return store.derived.solvedModel.projectReferenceShapes.filter(
      (shape) =>
        shape.sourceType === 'house_reference' &&
        (hostHouseSourceId === null || shape.sourceObjectId !== hostHouseSourceId),
    );
  }, [
    store.derived.solvedModel.projectReferenceShapes,
    store.derived.solvedModel.projectModel.houseAssembly,
  ]);
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
  const outlineEditCommitHandler = useMemo(
    () =>
      isLocked
        ? undefined
        : buildOutlineEditCommitHandler({ store, activeModuleInput, objectWorkbenchActions }),
    [isLocked, store, activeModuleInput, objectWorkbenchActions],
  );

  if (!activeModule) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No Drawing</p>
        <p className={styles.emptyText}>No plan or section drawing is available for this design.</p>
      </div>
    );
  }

  return (
    <div className={styles.shell} data-workbench-density="compact">
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
        <ObjectWorkbenchRailHost
          activeModuleInput={activeModuleInput}
          geometryEditState={geometryEditState}
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

        {/*
          PR-T4 (2026-05-26): the "3D Preview Resolved Locally" notice
          was killed — the same state is already conveyed by the
          "Approximate" trust chip in the right-inspector header, and
          the chunky bottom-of-rail card was wasting vertical real
          estate in compact mode. If a more prominent surface for
          draft-resolution state is needed later, the bottom status
          bar (PR-W10) is the right home for it.
        */}
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
          additionalCommittedShapes={additionalCommittedShapes}
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
          projectLabel={projectName}
          modelEditableFields={isPergolaTabActive ? drawingEditableFields : []}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
          onCommitCustomPolygon={!isLocked ? objectWorkbenchActions.commitSharedDeckCustomPolygon : undefined}
          onSelectObjectWorkbenchTarget={!isLocked ? objectSelectionActions.selectObjectWorkbenchTarget : undefined}
          onSelectPergolaTarget={!isLocked ? objectSelectionActions.selectPergolaObject : undefined}
          onClearWorkbenchSelection={!isLocked ? objectSelectionActions.clearActiveWorkbenchSelection : undefined}
          onToggleHouseTerminalEnd={
            !isLocked
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
                  if (!houseForm || !currentRoof) return;
                  const nextRoof = resolveHouseTerminalEndToggleRoofDraft({
                    currentRoof,
                    endId,
                    currentlyOpen,
                    allTerminalEndIds:
                      store.derived.objectWorkbench.houseForm.roof.terminalEnds.map(
                        (end) => end.id,
                      ),
                  });
                  void objectWorkbenchActions.commitSharedHouseRoofDraft(nextRoof);
                }
              : undefined
          }
          onCommitHouseFormFootprintDimension={!isLocked ? objectWorkbenchActions.commitHouseFormFootprintDimension : undefined}
          onCommitDeckDimension={!isLocked ? objectWorkbenchActions.commitDeckDimension : undefined}
          onCommitOpeningDimension={!isLocked ? objectWorkbenchActions.commitOpeningDimension : undefined}
          onCommitOutlineEdit={outlineEditCommitHandler}
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
                    // PR-G1 (2026-05-22): when the move ended on a snap, derive
                    // a `PergolaAttachment` (host + spatialKind + method) from
                    // the snap target and write it alongside the position. Same
                    // edgeKind→family routing as the edge-drag handler in
                    // `commitOutlineEdit.ts`. Without this, the move tool wrote
                    // position but left `attachment.host.myEdgeIndex` stale
                    // (the PR-F follow-up). Undo intentionally leaves the new
                    // attachment in place — MoveCommand's inverse delivers
                    // `snap: null`, so the action's `attachment === undefined`
                    // no-op runs. Acceptable per Phase 1 permission.
                    let snapAttachment: PergolaAttachment | undefined = undefined;
                    if (request.snap) {
                      const hostEdgeKind = request.snap.edgeSnap.target.edgeKind;
                      if (
                        hostEdgeKind === 'wall' ||
                        hostEdgeKind === 'roof_eave' ||
                        hostEdgeKind === 'pergola_outline'
                      ) {
                        snapAttachment = pergolaAttachmentFromSnap({
                          hostObjectFamily:
                            hostEdgeKind === 'pergola_outline' ? 'pergolas' : 'house_forms',
                          hostObjectId: request.snap.edgeSnap.target.sourceObjectId,
                          hostEdgeKind,
                          hostEdgeId: request.snap.edgeSnap.target.id,
                          myEdgeIndex: request.snap.edgeIndex,
                        });
                      }
                    }
                    void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
                      request.target.targetId,
                      {
                        position: buildPergolaTransformPosition({
                          currentPosition: pergola.position,
                          deltaMm: request.delta,
                        }),
                        ...(snapAttachment ? { attachment: snapAttachment } : null),
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
                  if (request.target.family === 'house_form') {
                    // PR11 → PR-C (2026-05-22): drag-to-reposition for any
                    // house form. The previous primary-skip guard is gone;
                    // dragging the primary now commits a transform delta
                    // like any other form. The transform write may be
                    // overwritten on next read while `buildSharedHouse`
                    // still hardcodes the synthesized primary's transform
                    // to origin (retires in Phase 2 with cost engine input
                    // migration). Workbench-can-break permission accepts
                    // this temporary inconsistency.
                    void objectWorkbenchActions.commitHouseFormTransformDelta({
                      houseFormId: request.target.targetId,
                      deltaXMm: request.delta.x,
                      deltaYMm: request.delta.y,
                    });
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

      <aside className={styles.inspectorColumn}>
        <div className={styles.inspectorScroll}>
          <RightInspectorPanel
            selectionLabel={store.derived.railModel.selectedInspector.selectedObjectLabel}
            trustStatusLabel={store.derived.railModel.selectedInspector.selectedObjectTrustLabel}
          >
            <WorkbenchInspectorHost
              activeModuleInput={activeModuleInput}
              geometryEditState={geometryEditState}
              isLocked={isLocked}
              objectSelectionActions={objectSelectionActions}
              objectWorkbenchActions={objectWorkbenchActions}
              setUi={setUi}
              store={store}
              supportsSanctuaryEditing={supportsSanctuaryEditing}
            />
          </RightInspectorPanel>
        </div>
      </aside>
    </div>
  );
}
