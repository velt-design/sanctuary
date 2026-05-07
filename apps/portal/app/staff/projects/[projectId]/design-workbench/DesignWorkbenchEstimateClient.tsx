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
import { pergolaAttachmentFromSnap } from '@/lib/drawings/state/pergolaAttachment';
import type { PergolaAttachment } from '@/lib/drawings/state/objectFirstWorkbenchModel';
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
                  // Unconditional outer log so we can verify the commit is
                  // even reaching this handler. Surfaces in any browser
                  // console regardless of URL flags.
                  // eslint-disable-next-line no-console
                  console.log('[edge-drag] onCommitOutlineEdit fired', {
                    family: commit.family,
                    outlineId: commit.outlineId,
                    nextPolygonLength: commit.nextPolygon.length,
                    activeObject: {
                      family: store.ui.activeObjectRef.family,
                      objectId: store.ui.activeObjectRef.objectId,
                    },
                  });
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
                    // Build the atomic patch. The snap engine surfaces only `wall` or
                    // `roof_eave` host edge kinds today (per `buildHouseSnapTargets`);
                    // both map to `host.objectFamily: 'house_forms'`. The legacy
                    // `connection.type` enum is preserved as a derived projection —
                    // see `connectionTypeFromAttachment`. No snap → leave the
                    // existing attachment unchanged (caller can clear via the
                    // inspector if needed).
                    let snapAttachment: PergolaAttachment | undefined = undefined;
                    if (commit.snap) {
                      const hostEdgeKind = commit.snap.target.edgeKind;
                      if (hostEdgeKind === 'wall' || hostEdgeKind === 'roof_eave') {
                        snapAttachment = pergolaAttachmentFromSnap({
                          hostObjectFamily: 'house_forms',
                          hostObjectId: commit.snap.target.sourceObjectId,
                          hostEdgeKind,
                          hostEdgeId: commit.snap.target.id,
                          // EdgeDragTool's commit doesn't yet pass through
                          // myEdgeIndex on the snap result; the dragged edge
                          // is `commit.snap.target` aligned to one polygon
                          // edge. Until the tool plumbs edgeIndex on the snap
                          // result, fall back to 0 (re-solve will recover
                          // alignment from edge geometry).
                          myEdgeIndex: 0,
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
                    void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(pergolaId, {
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
                    });
                    return;
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
                    // eslint-disable-next-line no-console
                    console.log('[deck-edge-drag] commit fired', {
                      activeFamily: store.ui.activeObjectRef.family,
                      activeObjectId: store.ui.activeObjectRef.objectId,
                      outlineId: commit.outlineId,
                      matchedDeckId: deckId,
                      projectModelDeckIds: projectModelDecks.map((deck) => deck.id),
                      nextPolygonLength: commit.nextPolygon.length,
                    });
                    if (!deckId || commit.nextPolygon.length < 3) {
                      // eslint-disable-next-line no-console
                      console.warn('[deck-edge-drag] bailed early', {
                        reason: !deckId
                          ? `outline ${commit.outlineId} did not match any deck in project model`
                          : 'polygon < 3 vertices',
                      });
                      return;
                    }
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
                    const positionXMm = minX;
                    const positionYMm = minY;
                    // Polygon coords relative to position (so unit-frame decode
                    // + position == nextPolygon).
                    const localWorldPolygon = commit.nextPolygon.map((p) => ({
                      x: p.x - positionXMm,
                      y: p.y - positionYMm,
                    }));
                    // Standardize on attachmentSide='rear' so the deck's polygon
                    // is decoupled from the host's current attachmentSide.
                    // Pairs with the same standardization in normalize.ts when
                    // `deck.position` is set.
                    const sideLocalPoints = buildSideLocalPolygonFromWorld({
                      worldPolygonMm: localWorldPolygon,
                      pergolaWidthMm: 1000,
                      pergolaDepthMm: 1000,
                      attachmentSide: 'rear',
                      params: null,
                    });
                    const patch = {
                      shape: 'custom' as const,
                      outline: sideLocalPoints.map((p) => ({
                        alongM: p.alongM.toString(),
                        depthM: p.depthM.toString(),
                      })),
                      position: {
                        originXMm: positionXMm.toString(),
                        originYMm: positionYMm.toString(),
                        rotationDeg: '0',
                      },
                    };
                    // eslint-disable-next-line no-console
                    console.log('[deck-edge-drag] dispatching patch', {
                      deckId,
                      bbox: { minX, minY, maxX, maxY },
                      position: patch.position,
                      outlineLength: patch.outline.length,
                      outline: patch.outline,
                    });
                    void objectWorkbenchActions
                      .commitSharedHouseDeckPatch(deckId, patch)
                      .then((result) => {
                        // eslint-disable-next-line no-console
                        console.log('[deck-edge-drag] commit result', result);
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
