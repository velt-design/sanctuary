'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildDeckTransformPatch } from '@/lib/drawings/commits/commitDeckTransform';
import { buildPergolaTransformPosition } from '@/lib/drawings/commits/commitPergolaTransform';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  areDrawingWorkbenchObjectSelectionStatesEqual,
  areDrawingWorkbenchVisibilityStatesEqual,
  buildDrawingWorkbenchObjectSelectionState,
  createDrawingWorkbenchUiState,
  pickDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { houseFormTransformToWorldPositionMm } from '@/lib/drawings/state/houseFormTransform';
import {
  ESTIMATE_DRAWING_OBJECT_FIRST_OUTPUT_KEY,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
  type PergolaAttachment,
  type WorkbenchObjectRef,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { pergolaAttachmentFromSnap } from '@/lib/drawings/state/pergolaAttachment';
import { buildWorkbenchDebugFixtureExport } from '@/lib/drawings/workbenchDebugExport';
import { buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import { buildPortalPageDebugExport, type PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';
import { inferPortalScenarioFromLabel } from '@/lib/debug/portalScenarioDebug';
import { buildOutlineEditCommitHandler } from './commitOutlineEdit';
import { type DrawOutlineTarget } from './objectWorkbenchClientTypes';
import RightInspectorPanel from '@/components/drawings/inspector/RightInspectorPanel';
import ObjectWorkbenchRailHost from './ObjectWorkbenchRailHost';
import WorkbenchInspectorHost from './WorkbenchInspectorHost';
import WorkbenchDebugExportButton from './WorkbenchDebugExportButton';
import { resolveHouseTerminalEndToggleRoofDraft } from './resolveHouseTerminalEndToggleRoofDraft';
import { useObjectWorkbenchDraftPersistence } from './useObjectWorkbenchDraftPersistence';
import { useObjectWorkbenchActions } from './useObjectWorkbenchActions';
import { useObjectWorkbenchSelection } from './useObjectWorkbenchSelection';
import { apiJson } from '@/lib/repo/apiClient';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
  debugExportEnabled?: boolean;
};

const DEFAULT_MODEL_VIEWPORT_TRANSFORM = createDrawingWorkbenchUiState().viewportTransform;

type DraftSaveState =
  | { status: 'idle'; message: string | null }
  | { status: 'saving'; message: string | null }
  | { status: 'saved'; message: string | null }
  | { status: 'error'; message: string };

type EstimateUpdatePayload = {
  status: EstimateDetail['status'];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  derived?: Record<string, unknown>;
  projectSnapshot?: Record<string, unknown>;
  configVersions?: Record<string, unknown>;
};

function buildWorkbenchDraftEstimateUpdatePayload(input: {
  estimate: EstimateDetail;
  draft: EstimateDrawingDraft;
}): EstimateUpdatePayload | null {
  return {
    status: input.estimate.status,
    inputs: {},
    outputs: {
      [ESTIMATE_DRAWING_OBJECT_FIRST_OUTPUT_KEY]:
        normalizeObjectFirstWorkbenchDraftVNext(input.draft.objectFirst),
    },
  };
}

function buildInitialWorkbenchUiState(input: {
  draft?: EstimateDrawingDraft | null;
}) {
  const defaultHouseFormId =
    buildDrawingWorkbenchStore({
      draft: input.draft,
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
  debugExportEnabled = false,
}: DesignWorkbenchEstimateClientProps) {
  const router = useRouter();
  const [ui, setUi] = useState(() =>
    buildInitialWorkbenchUiState({
      draft: null,
    }),
  );
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
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>({
    status: 'idle',
    message: null,
  });
  const [lastSavedDraftSignature, setLastSavedDraftSignature] = useState<string | null>(null);
  // Cross-viewport hover state (milestone 16). Driven by whichever viewport
  // currently has the user's pointer; consumed by the other(s) to render a
  // matching highlight. Local hover (data-plan-hover-shape-id, hit-target
  // hover styling) stays viewport-internal -- this is purely for the cross-
  // surface "show me where this object lives in the other view" affordance.
  // Local state, not in the persisted UI state, since hover is transient.
  const [hoveredObjectRef, setHoveredObjectRef] = useState<WorkbenchObjectRef | null>(null);
  const { drawingDraft, persistDrawingDraftLocally } = useObjectWorkbenchDraftPersistence({
    estimateId: estimate.id,
  });
  const effectiveDrawingDraft = drawingDraft;
  const effectiveDrawingDraftSignature = useMemo(
    () => JSON.stringify(effectiveDrawingDraft ?? null),
    [effectiveDrawingDraft],
  );
  const hasUnsavedWorkbenchDraft = useMemo(
    () =>
      Boolean(effectiveDrawingDraft) &&
      effectiveDrawingDraftSignature !== lastSavedDraftSignature,
    [effectiveDrawingDraft, effectiveDrawingDraftSignature, lastSavedDraftSignature],
  );

  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        draft: effectiveDrawingDraft,
        ui,
        geometryIdentity: {
          projectId: estimate.projectId,
          estimateId: estimate.id,
        },
      }),
    [effectiveDrawingDraft, estimate.id, estimate.projectId, ui],
  );

  useEffect(() => {
    const defaultHouseFormId =
      buildDrawingWorkbenchStore({
        draft: effectiveDrawingDraft,
        ui: createDrawingWorkbenchUiState(),
      }).derived.houseForms[0]?.id ?? null;

    setUi((current) => ({
      ...current,
      activePergolaId: null,
      ...buildDrawingWorkbenchObjectSelectionState({
        activeRailTab: 'house_forms',
        activeObjectRef: { family: 'house_forms', objectId: defaultHouseFormId },
      }),
    }));
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setDraftSaveState({ status: 'idle', message: null });
    setLastSavedDraftSignature(null);
  }, [estimate.id, effectiveDrawingDraft]);

  useEffect(() => {
    if (hasUnsavedWorkbenchDraft && draftSaveState.status === 'saved') {
      setDraftSaveState({ status: 'idle', message: null });
    }
  }, [draftSaveState.status, hasUnsavedWorkbenchDraft]);

  useEffect(() => {
    const storeSelection = pickDrawingWorkbenchObjectSelectionState(store.ui);
    const uiSelection = pickDrawingWorkbenchObjectSelectionState(ui);
    if (
      store.ui.activePergolaId === ui.activePergolaId &&
      areDrawingWorkbenchObjectSelectionStatesEqual(storeSelection, uiSelection) &&
      areDrawingWorkbenchVisibilityStatesEqual(store.ui.visibility, ui.visibility)
    ) {
      return;
    }
    setUi((current) => ({
      ...current,
      activePergolaId: store.ui.activePergolaId,
      ...storeSelection,
      visibility: store.ui.visibility,
    }));
  }, [
    store.ui,
    ui,
  ]);

  const activeDeck =
    store.derived.objectWorkbench.decks.find((deck) => deck.id === drawOutlineTarget.deckId) ??
    store.derived.objectWorkbench.activeDeck ??
    null;
  const drawOutlineMode = drawOutlineTarget.kind;
  const drawOutlineSeedPolygon =
    drawOutlineTarget.kind === 'deck'
      ? (activeDeck?.outline ?? null)
      : null;
  const isLocked = estimate.editability.isLocked;
  const meta = useMemo(
    () =>
      buildEstimateDrawingSheetMeta({
        sheetLabel: 'Design Workbench',
        sheetTitleOverride: null,
        noteOverride: null,
        sheetInfoRows: [],
        view: store.ui.activeView,
        versionLabel: estimate.versionLabel,
        estimateDate: estimate.createdAt,
        projectName,
        siteAddress: siteAddress ?? null,
        clientName: null,
      }),
    [
      estimate.createdAt,
      estimate.versionLabel,
      projectName,
      siteAddress,
      store.ui.activeView,
    ],
  );
  const activeSelectionFamily =
    store.ui.activeRailTab === 'diagnostics' ? store.ui.activeObjectFamily : store.ui.activeRailTab;
  const objectWorkbenchDisplayFamily = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house_forms';
  const activePergolaSurfaceKey =
    store.ui.activePergolaId ??
    store.derived.activePergola?.id ??
    'none';
  const modelViewportSurfaceKey = `${activePergolaSurfaceKey}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${activePergolaSurfaceKey}`;
  const viewportPergolaId =
    store.derived.objectWorkbench.activePergola?.id ??
    store.derived.objectWorkbench.pergolas[0]?.id ??
    null;
  const viewportActiveObjectRef = store.ui.activeObjectRef;
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
    drawingDraft: effectiveDrawingDraft,
    drawOutlineTarget,
    persistDrawingDraftLocally,
    setDrawOutlineTarget,
    setUi,
    startDeckOutlineEditor: objectSelectionActions.startDeckOutlineEditor,
    store,
    ui,
  });

  const workbenchFootprintCommit =
    !isLocked && objectWorkbenchDisplayFamily === 'house_forms' && store.ui.viewportMode === 'model'
      ? objectWorkbenchActions.commitHouseFormFootprintDimension
      : undefined;
  const handleSaveWorkbenchDraft = useCallback(async () => {
    if (!effectiveDrawingDraft || isLocked || draftSaveState.status === 'saving') return;
    const estimatePayload = buildWorkbenchDraftEstimateUpdatePayload({
      estimate,
      draft: effectiveDrawingDraft,
    });
    if (!estimatePayload) {
      setDraftSaveState({ status: 'error', message: 'Nothing to save.' });
      return;
    }

    setDraftSaveState({ status: 'saving', message: 'Saving...' });
    try {
      await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(estimate.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ estimate_update: estimatePayload }),
      });
      setLastSavedDraftSignature(effectiveDrawingDraftSignature);
      setDraftSaveState({ status: 'saved', message: 'Saved' });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save workbench draft.';
      setDraftSaveState({ status: 'error', message });
    }
  }, [
    draftSaveState.status,
    effectiveDrawingDraft,
    effectiveDrawingDraftSignature,
    estimate,
    isLocked,
    router,
  ]);
  const draftSaveAction = useMemo(() => {
    const disabled =
      isLocked ||
      !effectiveDrawingDraft ||
      draftSaveState.status === 'saving' ||
      !hasUnsavedWorkbenchDraft;
    const statusText =
      isLocked
        ? 'Read only'
        : draftSaveState.status === 'error'
          ? draftSaveState.message
          : draftSaveState.status === 'saved'
            ? draftSaveState.message
            : hasUnsavedWorkbenchDraft
              ? 'Unsaved changes'
              : null;
    return {
      label: draftSaveState.status === 'saving' ? 'Saving...' : 'Save workbench draft',
      statusText,
      disabled,
      onSave: () => {
        void handleSaveWorkbenchDraft();
      },
    };
  }, [
    draftSaveState,
    effectiveDrawingDraft,
    handleSaveWorkbenchDraft,
    hasUnsavedWorkbenchDraft,
    isLocked,
  ]);
  const outlineEditCommitHandler = useMemo(
    () =>
      isLocked
        ? undefined
        : buildOutlineEditCommitHandler({ store, objectWorkbenchActions }),
    [isLocked, store, objectWorkbenchActions],
  );
  const debugFixtureExport = useMemo(
    () =>
      debugExportEnabled
        ? buildWorkbenchDebugFixtureExport({
            draft: effectiveDrawingDraft,
            ui: store.ui,
            projectArtifact: store.derived.solvedModel.projectArtifact,
          })
        : null,
    [
      effectiveDrawingDraft,
      store.derived.solvedModel.projectArtifact,
      store.ui,
      debugExportEnabled,
    ],
  );
  const portalDebugExport = useMemo<PortalPageDebugExport | null>(
    () =>
      debugFixtureExport
        ? buildPortalPageDebugExport({
            pageId: 'design-workbench',
            route: `/staff/projects/${encodeURIComponent(estimate.projectId)}/design-workbench`,
            selectedIds: {
              projectId: estimate.projectId,
              estimateId: estimate.id,
              activeObjectId: store.ui.activeObjectRef?.objectId ?? null,
              activePergolaId: store.ui.activePergolaId ?? null,
            },
            serverState: {
              project: {
                id: estimate.projectId,
                name: projectName,
                siteAddress: siteAddress ?? null,
              },
              estimate: {
                id: estimate.id,
                versionLabel: estimate.versionLabel,
                editability: estimate.editability,
              },
            },
            clientState: {
              viewportMode: store.ui.viewportMode,
              activeObjectRef: store.ui.activeObjectRef,
            },
            diagnostics: {
              debugExportStatus: 'ready',
              source: 'design-workbench',
              workbenchDebugFixture: debugFixtureExport,
            },
            scenario: inferPortalScenarioFromLabel(projectName),
          })
        : null,
    [
      debugFixtureExport,
      estimate.editability,
      estimate.id,
      estimate.projectId,
      estimate.versionLabel,
      projectName,
      siteAddress,
      store.ui.activeObjectRef,
      store.ui.activePergolaId,
      store.ui.viewportMode,
    ],
  );

  return (
    <div className={styles.shell} data-workbench-density="compact">
      {debugFixtureExport ? (
        <script
          type="application/json"
          data-workbench-debug-export="true"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(debugFixtureExport).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
        {debugFixtureExport ? (
          <WorkbenchDebugExportButton exportPayload={debugFixtureExport} portalDebugExport={portalDebugExport} />
        ) : null}
        <ObjectWorkbenchRailHost
          isLocked={isLocked}
          objectSelectionActions={objectSelectionActions}
          objectWorkbenchActions={objectWorkbenchActions}
          setUi={setUi}
          store={store}
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
          sheetLabel={store.derived.projectSheetLabel}
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
          projectArtifact={store.derived.solvedModel.projectArtifact}
          viewportGeometry={store.derived.activeViewportGeometry}
          drawingSurfaceGeometry={store.derived.activeDrawingSurfaceGeometry}
          planViewModel={store.derived.activePlanViewModel}
          activeObjectRef={viewportActiveObjectRef}
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
          draftSaveAction={draftSaveAction}
          modelEditableFields={[]}
          onCommitModelField={undefined}
          onCommitFootprintEdit={workbenchFootprintCommit}
          onCommitCustomPolygon={!isLocked ? objectWorkbenchActions.commitSharedDeckCustomPolygon : undefined}
          onSelectObjectWorkbenchTarget={!isLocked ? objectSelectionActions.selectObjectWorkbenchTarget : undefined}
          onSelectPergolaTarget={!isLocked ? objectSelectionActions.selectPergolaObject : undefined}
          onClearWorkbenchSelection={!isLocked ? objectSelectionActions.clearActiveWorkbenchSelection : undefined}
          onToggleHouseTerminalEnd={
            !isLocked
              ? ({ houseFormId, endId, currentlyOpen }) => {
                  // Plan-view clicks happen independent of rail selection,
                  // so the clicked shape must carry its owning house id.
                  // Missing ownership is a no-op; falling back to the first
                  // house would reopen the legacy shared-house bug.
                  const houseForm = houseFormId
                    ? store.derived.houseForms.find((form) => form.id === houseFormId) ?? null
                    : null;
                  const currentRoof = houseForm?.roofIntent ?? null;
                  if (!houseForm || !currentRoof) return;
                  const nextRoof = resolveHouseTerminalEndToggleRoofDraft({
                    currentRoof,
                    endId,
                    currentlyOpen,
                    allTerminalEndIds: [],
                  });
                  void objectWorkbenchActions.commitHouseFormRoofIntent({
                    houseFormId: houseForm.id,
                    roof: nextRoof,
                  });
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
                    // Read the deck's current world polygon from the solved
                    // artifact. This is the object-first source of truth; the
                    // geometry pipeline always produces a world boundary.
                    // Translating the world polygon by `request.delta` and
                    // running it through `buildDeckTransformPatch` gives the
                    // exact same atomic patch shape the edge-drag handler
                    // writes; that's the point of the shared helper. Decks
                    // with `position == null` are normalized on first move
                    // instead of being decoded against the wrong local frame.
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
                    // world coords to the persisted deck.position. Read
                    // the same object-first transform the geometry solve
                    // consumes.
                    const hostHouseForm =
                      store.derived.activeHouseForm ?? store.derived.houseForms[0] ?? null;
                    const houseWorldPositionMm = hostHouseForm
                      ? houseFormTransformToWorldPositionMm(hostHouseForm.transform)
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
                    // Drag-to-reposition is object-id based for every house
                    // form. The geometry solve reads the committed transform
                    // directly.
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
              isLocked={isLocked}
              objectSelectionActions={objectSelectionActions}
              objectWorkbenchActions={objectWorkbenchActions}
              setUi={setUi}
              store={store}
            />
          </RightInspectorPanel>
        </div>
      </aside>
    </div>
  );
}
