'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import HouseFirstWorkbenchRail from '@/components/drawings/rail/HouseFirstWorkbenchRail';
import {
  labelForRoofApproximationReason,
  labelForRoofFieldSource,
} from '@/components/drawings/rail/houseRailShared';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import {
  buildGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import {
  type DeckInteractionTelemetry,
  type DrawOutlineTarget,
} from './houseWorkbenchClientTypes';
import { useHouseDraftPersistence } from './useHouseDraftPersistence';
import { useHouseMutationActions } from './useHouseMutationActions';
import { useHouseWorkbenchSelection } from './useHouseWorkbenchSelection';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

const DEFAULT_MODEL_VIEWPORT_TRANSFORM = createDrawingWorkbenchUiState().viewportTransform;

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
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const [modelViewportTransformsByKey, setModelViewportTransformsByKey] = useState<
    Record<string, DrawingWorkbenchViewportTransform>
  >({});
  const [geometryViewportStatesByKey, setGeometryViewportStatesByKey] = useState<
    Record<string, Geometry3DViewportState>
  >({});
  const [deckInteractionTelemetry, setDeckInteractionTelemetry] = useState<DeckInteractionTelemetry | null>(null);
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
    setUi((current) => ({
      ...current,
      activeModuleIndex: 0,
      activePergolaId: null,
      activeHouseSelection: { kind: 'house', targetId: null },
    }));
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setDeckInteractionTelemetry(null);
  }, [estimate.calculatorSnapshot]);

  useEffect(() => {
    if (
      store.ui.activeModuleIndex === ui.activeModuleIndex &&
      store.ui.workbenchMode === ui.workbenchMode &&
      store.ui.activePergolaId === ui.activePergolaId &&
      store.ui.activeHouseSelection.kind === ui.activeHouseSelection.kind &&
      store.ui.activeHouseSelection.targetId === ui.activeHouseSelection.targetId
    ) {
      return;
    }
    setUi((current) => ({
      ...current,
      activeModuleIndex: store.ui.activeModuleIndex,
      workbenchMode: store.ui.workbenchMode,
      activePergolaId: store.ui.activePergolaId,
      activeHouseSelection: store.ui.activeHouseSelection,
    }));
  }, [
    store.ui.activeHouseSelection.kind,
    store.ui.activeHouseSelection.targetId,
    store.ui.activeModuleIndex,
    store.ui.activePergolaId,
    store.ui.workbenchMode,
    ui.activeHouseSelection.kind,
    ui.activeHouseSelection.targetId,
    ui.activeModuleIndex,
    ui.activePergolaId,
    ui.workbenchMode,
  ]);

  const activeModule = store.derived.activeModule;
  const activeModuleInput = activeModule?.drawingModule.input ?? null;
  const activeDeck =
    store.derived.house?.decks.find((deck) => deck.id === drawOutlineTarget.deckId) ??
    store.derived.activeDeck ??
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
  const drawingEditableFields = useMemo(
    () =>
      !drawingDraft || isLocked || !supportsSanctuaryEditing || store.ui.workbenchMode !== 'pergolas'
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
      store.ui.workbenchMode,
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
  const attachmentZoneKindsSummary = useMemo(() => {
    const zones = store.derived.house?.attachmentZones ?? [];
    if (!zones.length) return 'none';
    const zonesBySide = new Map<string, string[]>();
    for (const zone of zones) {
      const existing = zonesBySide.get(zone.side) ?? [];
      existing.push(zone.kind);
      zonesBySide.set(zone.side, existing);
    }
    return Array.from(zonesBySide.entries())
      .map(([side, kinds]) => `${side}: ${kinds.join(', ')}`)
      .join(' | ');
  }, [store.derived.house?.attachmentZones]);
  const attachmentZoneBlockedSummary = useMemo(() => {
    const blocked = store.derived.house?.attachmentZoneDiagnostics.blocked ?? [];
    if (!blocked.length) return 'none';
    return blocked
      .map((entry) => `${entry.side} ${entry.kind} (${entry.reason})`)
      .join(' | ');
  }, [store.derived.house?.attachmentZoneDiagnostics.blocked]);
  const resolvedPergolaAttachmentZoneCount = useMemo(
    () => store.derived.pergolas.filter((pergola) => pergola.attachment.houseAttachmentZoneId !== null).length,
    [store.derived.pergolas],
  );
  const unresolvedPergolaAttachmentZoneCount = useMemo(
    () =>
      store.derived.pergolas.filter(
        (pergola) => pergola.attachment.kind !== 'freestanding' && pergola.attachment.houseAttachmentZoneId === null,
      ).length,
    [store.derived.pergolas],
  );
  const modelViewportSurfaceKey = `${store.ui.workbenchMode}:${store.derived.activeModuleIndex}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${store.ui.workbenchMode}:${store.derived.activeModuleIndex}`;
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
  const houseSelectionActions = useHouseWorkbenchSelection({
    setUi,
    setDrawOutlineTarget,
    setDrawOutlineRequestId,
  });
  const houseActions = useHouseMutationActions({
    activeModuleInput,
    drawingDraft,
    drawOutlineTarget,
    persistDrawingDraftLocally,
    setDrawOutlineTarget,
    setUi,
    snapshot: estimate.calculatorSnapshot,
    startDeckOutlineEditor: houseSelectionActions.startDeckOutlineEditor,
    store,
    ui,
  });

  const workbenchFieldCommit =
    !isLocked && supportsSanctuaryEditing && store.ui.workbenchMode === 'pergolas'
      ? houseActions.commitDrawingField
      : undefined;
  const workbenchFootprintCommit =
    !isLocked && store.ui.workbenchMode === 'house' && store.ui.viewportMode === 'model'
      ? houseActions.commitSharedHouseFootprintEdit
      : undefined;
  const pergolaFallbackRail =
    supportsSanctuaryEditing && activeModuleInput ? (
      <SanctuaryWorkbenchRail
        moduleLabel={store.derived.activeModuleLabel}
        geometryState={geometryEditState}
        view={store.ui.activeView}
        disabled={isLocked}
        canStartDrawOutline={!isLocked}
        onStartDrawOutline={houseSelectionActions.startDrawOutlineEditor}
        onCommitGeometryEdit={!isLocked ? houseActions.commitGeometryIntent : undefined}
      />
    ) : (
      <section className={styles.notice}>
        <p className={styles.noticeTitle}>Editing Deferred</p>
        <p className={styles.noticeText}>
          This module is not supported for Sanctuary editing yet. The hidden route stays open so the design can still be reviewed here.
        </p>
      </section>
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
    <div className={styles.shell}>
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Workbench mode</p>
          <div className={styles.modeSwitch} role="tablist" aria-label="Workbench mode">
            <button
              type="button"
              role="tab"
              aria-selected={store.ui.workbenchMode === 'house'}
              className={`${styles.modeButton} ${store.ui.workbenchMode === 'house' ? styles.modeButtonActive : ''}`}
              onClick={() => {
                houseSelectionActions.selectHouseWorkbenchMode();
              }}
            >
              House
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={store.ui.workbenchMode === 'pergolas'}
              className={`${styles.modeButton} ${store.ui.workbenchMode === 'pergolas' ? styles.modeButtonActive : ''}`}
              onClick={() => {
                houseSelectionActions.selectPergolaWorkbenchMode(
                  store.derived.activePergolaId ?? activeModule.drawingModule.input.pergolaId ?? null,
                );
              }}
            >
              Pergolas
            </button>
          </div>
        </section>

        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Migration diagnostics</p>
          <div className={styles.diagnosticsList}>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Mode</span>
              <span className={styles.diagnosticValue}>{store.ui.workbenchMode}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Derived houses</span>
              <span className={styles.diagnosticValue}>{store.derived.houseCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Pergolas</span>
              <span className={styles.diagnosticValue}>{store.derived.pergolas.length}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck count</span>
              <span className={styles.diagnosticValue}>{store.derived.deckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Opening count</span>
              <span className={styles.diagnosticValue}>{store.derived.openingCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Attachment zones</span>
              <span className={styles.diagnosticValue}>{store.derived.house?.attachmentZones.length ?? 0}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Attachment zone kinds</span>
              <span className={styles.diagnosticValue}>{attachmentZoneKindsSummary}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Attachment zone blocks</span>
              <span className={styles.diagnosticValue}>{attachmentZoneBlockedSummary}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Resolved pergola zones</span>
              <span className={styles.diagnosticValue}>{resolvedPergolaAttachmentZoneCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Unresolved pergola zones</span>
              <span className={styles.diagnosticValue}>{unresolvedPergolaAttachmentZoneCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Slider openings</span>
              <span className={styles.diagnosticValue}>{store.derived.sliderOpeningCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Invalid openings</span>
              <span className={styles.diagnosticValue}>{store.derived.invalidOpeningCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Preset decks snapped</span>
              <span className={styles.diagnosticValue}>{store.derived.snappedPresetDeckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Preset decks floating</span>
              <span className={styles.diagnosticValue}>{store.derived.floatingPresetDeckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Custom decks</span>
              <span className={styles.diagnosticValue}>{store.derived.customDeckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Invalid decks</span>
              <span className={styles.diagnosticValue}>{store.derived.invalidDeckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck support warnings</span>
              <span className={styles.diagnosticValue}>{store.derived.deckSupportWarningCount}</span>
            </div>
            {store.derived.activeDeckSupport ? (
              <>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Active host side</span>
                  <span className={styles.diagnosticValue}>{store.derived.activeDeckSupport.activeHostSide}</span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Active-side deck present</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckSupport.hasRelevantDeck ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck support class</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckSupport.resolvedClassification}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck bracket eligible</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckSupport.deckBracketEligible ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck support codes</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckSupport.warningCodes.join(', ') || 'none'}
                  </span>
                </div>
              </>
            ) : null}
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Selected deck id</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckId ?? 'none'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Selected opening id</span>
              <span className={styles.diagnosticValue}>{store.derived.activeOpeningId ?? 'none'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>House polygon source</span>
              <span className={styles.diagnosticValue}>
                {store.derived.house?.footprint.mode === 'custom_polygon' ? 'custom_saved' : 'preset_derived'}
              </span>
            </div>
            {store.derived.activeDeckInteraction ? (
              <>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Selected deck type</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckInteraction.selectedDeckType}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck drag eligible</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckInteraction.dragEligible ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck drag reason</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckInteraction.dragReason ?? 'none'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck host-edge resolvable</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckInteraction.hostEdgeResolvable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Deck relationship dims</span>
                  <span className={styles.diagnosticValue}>
                    {store.derived.activeDeckInteraction.relationshipDimensionsAvailable ? 'Yes' : 'No'}
                  </span>
                </div>
              </>
            ) : null}
            {deckInteractionTelemetry ? (
              <>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space house polygon</span>
                  <span className={styles.diagnosticValue}>
                    {deckInteractionTelemetry.housePolygonSource ?? 'none'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space deck type</span>
                  <span className={styles.diagnosticValue}>{deckInteractionTelemetry.selectedDeckType}</span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space drag eligible</span>
                  <span className={styles.diagnosticValue}>
                    {deckInteractionTelemetry.dragEligible ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space host-edge resolvable</span>
                  <span className={styles.diagnosticValue}>
                    {deckInteractionTelemetry.hostEdgeResolvable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space relationship dims</span>
                  <span className={styles.diagnosticValue}>
                    {deckInteractionTelemetry.relationshipDimensionsAvailable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space snap state</span>
                  <span className={styles.diagnosticValue}>{deckInteractionTelemetry.snapState}</span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>Model-space snap message</span>
                  <span className={styles.diagnosticValue}>
                    {deckInteractionTelemetry.snapMessage ?? 'none'}
                  </span>
                </div>
              </>
            ) : null}
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Warnings</span>
              <span className={styles.diagnosticValue}>{store.derived.migrationWarningCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Low confidence</span>
              <span className={styles.diagnosticValue}>{store.derived.houseIsLowConfidence ? 'Yes' : 'No'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Selected roof form</span>
              <span className={styles.diagnosticValue}>
                {store.derived.roofForm ?? 'none'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof status</span>
              <span className={styles.diagnosticValue}>
                {store.derived.roofReviewStatus === 'blocked'
                  ? 'Blocked'
                  : store.derived.roofReviewStatus === 'approximate'
                    ? 'Approximate'
                    : store.derived.roofReviewStatus === 'ready'
                      ? 'Ready'
                      : 'none'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof approximation reasons</span>
              <span className={styles.diagnosticValue}>
                {store.derived.roofApproximationReasons.map((reason) => labelForRoofApproximationReason(reason)).join(', ') || 'none'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof reason code</span>
              <span className={styles.diagnosticValue}>{store.derived.roofValidationCode ?? 'none'}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof form source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.form)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof material source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.material)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof pitch source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.primaryPitchDeg)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof fall source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.primaryFallDirection)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof ridge source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.ridgeAxis)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof open-end source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.openGableEndIds)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof appendage source</span>
              <span className={styles.diagnosticValue}>
                {labelForRoofFieldSource(store.derived.roofProvenance?.appendage)}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof appendage</span>
              <span className={styles.diagnosticValue}>{store.derived.roofAppendageStatus}</span>
            </div>
            {store.derived.roofValidationMessage ? (
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Roof note</span>
                <span className={styles.diagnosticValue}>{store.derived.roofValidationMessage}</span>
              </div>
            ) : null}
            {geometryPreview.kind !== 'error' ? (
              <>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D deck host side</span>
                  <span className={styles.diagnosticValue}>{geometryPreview.deckSupport.activeHostSide}</span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D deck present</span>
                  <span className={styles.diagnosticValue}>
                    {geometryPreview.deckSupport.hasRelevantDeck ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D deck class</span>
                  <span className={styles.diagnosticValue}>
                    {geometryPreview.deckSupport.resolvedClassification}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D deck bracket</span>
                  <span className={styles.diagnosticValue}>
                    {geometryPreview.deckSupport.deckBracketEligible ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D deck warnings</span>
                  <span className={styles.diagnosticValue}>
                    {geometryPreview.deckSupport.warningCodes.join(', ') || 'none'}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D opening count</span>
                  <span className={styles.diagnosticValue}>
                    {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningCount ?? 0 : 0)}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D attachment zones</span>
                  <span className={styles.diagnosticValue}>
                    {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseAttachmentZoneCount ?? 0 : 0)}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D zone kinds</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseAttachmentZoneKinds ?? 'none'
                        : 'none',
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D zone blocks</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseAttachmentZoneBlockedReasons ?? 'none'
                        : 'none',
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D resolved pergola zones</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.pergolaResolvedAttachmentZoneCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D unresolved pergola zones</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.pergolaUnresolvedAttachmentZoneCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D valid openings</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningValidCount ?? 0 : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D host edges resolved</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseOpeningHostEdgeResolvedCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D host edges unresolved</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseOpeningHostEdgeUnresolvedCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D rendered markers</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseOpeningRenderedMarkerCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D skipped invalid</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseOpeningSkippedInvalidCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D unresolved valid</span>
                  <span className={styles.diagnosticValue}>
                    {String(
                      geometryPreview.kind === 'ready'
                        ? geometryPreview.scene.metadata?.houseOpeningUnresolvedValidCount ?? 0
                        : 0,
                    )}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </section>

        {store.ui.workbenchMode === 'pergolas' && modules.length > 1 ? (
          <section className={styles.moduleSection}>
            <p className={styles.moduleSectionTitle}>Module</p>
            <select
              className={styles.moduleSelect}
              aria-label="Drawing module"
              value={String(store.derived.activeModuleIndex)}
              onChange={(event) =>
                setUi((current) => {
                  const nextIndex = Number(event.target.value);
                  const nextModule = store.persisted.modules[nextIndex];
                  return {
                    ...current,
                    workbenchMode: 'pergolas',
                    activeModuleIndex: nextIndex,
                    activePergolaId: nextModule?.drawingModule.input.pergolaId ?? current.activePergolaId,
                  };
                })
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

        <HouseFirstWorkbenchRail
          workbenchMode={store.ui.workbenchMode}
          house={store.derived.house}
          activeDeckId={store.derived.activeDeckId}
          activeOpeningId={store.derived.activeOpeningId}
          pergolas={store.derived.pergolas}
          warnings={store.derived.migrationWarnings}
          disabled={isLocked}
          canEditFootprint={Boolean(activeModule.assemblyModel.capabilities.canEditHouseFootprint)}
          canStartDrawOutline={!isLocked}
          onStartDrawOutline={houseSelectionActions.startDrawOutlineEditor}
          onCommitFootprintEdit={!isLocked ? houseActions.commitSharedHouseFootprintEdit : undefined}
          onCommitRoofDraft={!isLocked ? houseActions.commitSharedHouseRoofDraft : undefined}
          onSelectDeck={houseSelectionActions.selectSharedHouseDeck}
          onSelectOpening={houseSelectionActions.selectSharedHouseOpening}
          onAddDeck={!isLocked ? houseActions.addSharedHouseDeck : undefined}
          onAddOpening={!isLocked ? houseActions.addSharedHouseOpening : undefined}
          onRemoveDeck={!isLocked ? houseActions.removeSharedHouseDeck : undefined}
          onRemoveOpening={!isLocked ? houseActions.removeSharedHouseOpening : undefined}
          onCommitDeckPatch={!isLocked ? houseActions.commitSharedHouseDeckPatch : undefined}
          onCommitOpeningPatch={!isLocked ? houseActions.commitSharedHouseOpeningPatch : undefined}
          onStartDeckOutline={!isLocked ? houseSelectionActions.startDeckOutlineEditor : undefined}
          pergolaFallback={pergolaFallbackRail}
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
              activePergolaId:
                store.ui.workbenchMode === 'pergolas'
                  ? store.persisted.modules[index]?.drawingModule.input.pergolaId ?? current.activePergolaId
                  : current.activePergolaId,
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
          workbenchDisplayMode={store.ui.workbenchMode}
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
          modelEditableFields={store.ui.workbenchMode === 'pergolas' ? drawingEditableFields : []}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
          onCommitCustomPolygon={!isLocked ? houseActions.commitSharedDeckCustomPolygon : undefined}
          onSelectHouseFirstTarget={!isLocked ? houseSelectionActions.selectHouseFirstTarget : undefined}
          onCommitHouseFirstFootprintDimension={!isLocked ? houseActions.commitHouseFirstFootprintDimension : undefined}
          onCommitHouseFirstDeckDimension={!isLocked ? houseActions.commitHouseFirstDeckDimension : undefined}
          onCommitHouseFirstOpeningDimension={!isLocked ? houseActions.commitHouseFirstOpeningDimension : undefined}
          onDeckInteractionTelemetryChange={setDeckInteractionTelemetry}
        />
        </div>
      </div>
    </div>
  );
}
