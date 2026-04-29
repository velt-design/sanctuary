'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import HouseFirstWorkbenchRail from '@/components/drawings/rail/HouseFirstWorkbenchRail';
import {
  labelForAttachmentSideList,
  labelForRoofApproximationReason,
  labelForRoofFieldSource,
  labelForRoofGeometryKind,
} from '@/components/drawings/rail/houseRailShared';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import {
  buildGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { buildHouseFirstWorkbenchProjectModel } from '@/lib/drawings/state/houseFirstWorkbenchAdapter';
import {
  buildDrawingWorkbenchCanonicalSelectionState,
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchRailTab,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import { type DrawOutlineTarget } from './houseWorkbenchClientTypes';
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

const PERGOLA_CONNECTION_OPTIONS = [
  { value: 'soffit', label: 'Soffit attached' },
  { value: 'fascia', label: 'Fascia attached' },
  { value: 'wall', label: 'Wall attached' },
  { value: 'freestanding', label: 'Freestanding' },
] as const;

const PERGOLA_ATTACHMENT_STRATEGY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'soffit_brackets', label: 'Soffit brackets' },
  { value: 'fascia_under_gutter', label: 'Fascia under gutter' },
  { value: 'facade_ledger', label: 'Facade ledger' },
  { value: 'post_supported_tieback', label: 'Post supported tieback' },
  { value: 'none', label: 'None' },
] as const;

function resolvePergolaZoneKind(
  kind: 'freestanding' | 'soffit' | 'fascia' | 'wall',
): 'wall' | 'soffit' | 'fascia' | null {
  if (kind === 'freestanding') return null;
  if (kind === 'wall') return 'wall';
  return kind;
}

function buildInitialWorkbenchUiState(snapshot: Record<string, unknown> | null) {
  const defaultHouseFormId =
    buildHouseFirstWorkbenchProjectModel({
      snapshot,
      draft: null,
    }).house?.id ?? null;

  return createDrawingWorkbenchUiState({
    viewportMode: 'geometry3d',
    activeObjectRef: {
      family: 'house_forms',
      objectId: defaultHouseFormId,
    },
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
      buildHouseFirstWorkbenchProjectModel({
        snapshot: estimate.calculatorSnapshot,
        draft: null,
      }).house?.id ?? null;

    setUi((current) => ({
      ...current,
      activeModuleIndex: 0,
      activePergolaId: null,
      activeRailTab: 'house_forms',
      activeHouseSelection: { kind: 'house', targetId: null },
      activeObjectFamily: 'house_forms',
      activeObjectRef: { family: 'house_forms', objectId: defaultHouseFormId },
    }));
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
  }, [estimate.calculatorSnapshot]);

  useEffect(() => {
    if (
      store.ui.activeModuleIndex === ui.activeModuleIndex &&
      store.ui.workbenchMode === ui.workbenchMode &&
      store.ui.activePergolaId === ui.activePergolaId &&
      store.ui.activeRailTab === ui.activeRailTab &&
      store.ui.activeHouseSelection.kind === ui.activeHouseSelection.kind &&
      store.ui.activeHouseSelection.targetId === ui.activeHouseSelection.targetId &&
      store.ui.activeObjectFamily === ui.activeObjectFamily &&
      store.ui.activeObjectRef.family === ui.activeObjectRef.family &&
      store.ui.activeObjectRef.objectId === ui.activeObjectRef.objectId &&
      store.ui.visibility.house === ui.visibility.house &&
      store.ui.visibility.pergolas === ui.visibility.pergolas &&
      store.ui.visibility.decks === ui.visibility.decks &&
      store.ui.visibility.openings === ui.visibility.openings
    ) {
      return;
    }
    setUi((current) => ({
      ...current,
      activeModuleIndex: store.ui.activeModuleIndex,
      workbenchMode: store.ui.workbenchMode,
      activePergolaId: store.ui.activePergolaId,
      activeRailTab: store.ui.activeRailTab,
      activeHouseSelection: store.ui.activeHouseSelection,
      activeObjectFamily: store.ui.activeObjectFamily,
      activeObjectRef: store.ui.activeObjectRef,
      visibility: store.ui.visibility,
    }));
  }, [
    store.ui.activeObjectFamily,
    store.ui.activeObjectRef.family,
    store.ui.activeObjectRef.objectId,
    store.ui.activeRailTab,
    store.ui.visibility.decks,
    store.ui.visibility.house,
    store.ui.visibility.openings,
    store.ui.visibility.pergolas,
    store.ui.activeHouseSelection.kind,
    store.ui.activeHouseSelection.targetId,
    store.ui.activeModuleIndex,
    store.ui.activePergolaId,
    store.ui.workbenchMode,
    ui.activeHouseSelection.kind,
    ui.activeHouseSelection.targetId,
    ui.activeModuleIndex,
    ui.activeObjectFamily,
    ui.activeObjectRef.family,
    ui.activeObjectRef.objectId,
    ui.activePergolaId,
    ui.activeRailTab,
    ui.visibility.decks,
    ui.visibility.house,
    ui.visibility.openings,
    ui.visibility.pergolas,
    ui.workbenchMode,
  ]);

  const activeModule = store.derived.activeModule;
  const activeModuleInput = activeModule?.drawingModule.input ?? null;
  const activePergolaModel =
    store.derived.pergolas.find((pergola) => pergola.id === store.derived.activePergolaId) ??
    store.derived.pergolas[0] ??
    null;
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
  const activeSelectionFamily =
    store.ui.activeRailTab === 'diagnostics' ? store.ui.activeObjectFamily : store.ui.activeRailTab;
  const canonicalWorkbenchDisplayMode = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house';
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
  const attachmentZoneKindsSummary = useMemo(() => {
    const zones = store.derived.house?.attachmentZones ?? [];
    if (!zones.length) return 'none';
    const zonesBySide = new Map<string, Set<string>>();
    for (const zone of zones) {
      const existing = zonesBySide.get(zone.side) ?? new Set<string>();
      existing.add(zone.kind);
      zonesBySide.set(zone.side, existing);
    }
    return Array.from(zonesBySide.entries())
      .map(([side, kinds]) => `${side}: ${Array.from(kinds).join(', ')}`)
      .join(' | ');
  }, [store.derived.house?.attachmentZones]);
  const attachmentZoneBlockedSummary = useMemo(() => {
    const blocked = store.derived.house?.attachmentZoneDiagnostics.blocked ?? [];
    if (!blocked.length) return 'none';
    return Array.from(
      new Set(blocked.map((entry) => `${entry.side} ${entry.kind} (${entry.reason})`)),
    ).join(' | ');
  }, [store.derived.house?.attachmentZoneDiagnostics.blocked]);
  const resolvedPergolaAttachmentZoneCount = useMemo(
    () =>
      store.derived.pergolas.filter(
        (pergola) =>
          pergola.attachment.kind !== 'freestanding' &&
          pergola.attachment.resolution.status === 'resolved' &&
          pergola.attachment.attachmentZoneId !== null,
      ).length,
    [store.derived.pergolas],
  );
  const unresolvedPergolaAttachmentZoneCount = useMemo(
    () =>
      store.derived.pergolas.filter(
        (pergola) =>
          pergola.attachment.kind !== 'freestanding' &&
          pergola.attachment.resolution.status !== 'resolved',
      ).length,
    [store.derived.pergolas],
  );
  const modelViewportSurfaceKey = `${canonicalWorkbenchDisplayMode}:${store.derived.activeModuleIndex}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${canonicalWorkbenchDisplayMode}:${store.derived.activeModuleIndex}`;
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
    availableObjectIdsByFamily: {
      house_forms: store.derived.railModel.objectLists.house_forms.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      decks: store.derived.railModel.objectLists.decks.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      openings: store.derived.railModel.objectLists.openings.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
      pergolas: store.derived.railModel.objectLists.pergolas.map((entry) => entry.ref.objectId ?? '').filter(Boolean),
    },
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
  const [pergolaAttachmentPendingFieldId, setPergolaAttachmentPendingFieldId] = useState<string | null>(null);
  const [pergolaAttachmentFieldErrors, setPergolaAttachmentFieldErrors] = useState<Record<string, string>>({});
  const activePergolaZoneKind = activePergolaModel
    ? resolvePergolaZoneKind(activePergolaModel.attachment.kind)
    : null;
  const compatiblePergolaZones = useMemo(() => {
    if (!activePergolaModel || !activePergolaZoneKind) return [];
    return (store.derived.house?.derivedEnvelope?.attachmentZones ?? []).filter(
      (zone) => zone.kind === activePergolaZoneKind,
    );
  }, [activePergolaModel, activePergolaZoneKind, store.derived.house?.derivedEnvelope?.attachmentZones]);
  const compatiblePergolaEdges = useMemo(() => {
    const allowedEdgeIds = new Set(
      compatiblePergolaZones
        .map((zone) => zone.hostEdgeId)
        .filter((hostEdgeId): hostEdgeId is string => typeof hostEdgeId === 'string' && hostEdgeId.length > 0),
    );
    return (store.derived.house?.derivedEnvelope?.edges ?? []).filter((edge) => allowedEdgeIds.has(edge.id));
  }, [compatiblePergolaZones, store.derived.house?.derivedEnvelope?.edges]);
  const selectedPergolaEdgeOptionMissing = Boolean(
    activePergolaModel?.attachment.attachmentEdgeId &&
      !compatiblePergolaEdges.some((edge) => edge.id === activePergolaModel.attachment.attachmentEdgeId),
  );
  const selectedPergolaZoneOptionMissing = Boolean(
    activePergolaModel?.attachment.attachmentZoneId &&
      !compatiblePergolaZones.some((zone) => zone.id === activePergolaModel.attachment.attachmentZoneId),
  );
  const runPergolaAttachmentAction = useCallback(
    async (
      fieldId: string,
      action: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string } | undefined,
      fallbackMessage: string,
    ) => {
      setPergolaAttachmentPendingFieldId(fieldId);
      const result = await Promise.resolve(action ?? { ok: false, error: fallbackMessage });
      setPergolaAttachmentFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
      setPergolaAttachmentPendingFieldId((current) => (current === fieldId ? null : current));
    },
    [],
  );

  const workbenchFieldCommit =
    !isLocked && supportsSanctuaryEditing && isPergolaTabActive
      ? houseActions.commitDrawingField
      : undefined;
  const workbenchFootprintCommit =
    !isLocked && canonicalWorkbenchDisplayMode === 'house' && store.ui.viewportMode === 'model'
      ? houseActions.commitSharedHouseFootprintEdit
      : undefined;

  if (!activeModule) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No Drawing</p>
        <p className={styles.emptyText}>No plan or section drawing is available for this design.</p>
      </div>
    );
  }

  const defaultPergolaId =
    store.ui.activeObjectFamily === 'pergolas' && store.ui.activeObjectRef.objectId
      ? store.ui.activeObjectRef.objectId
      : store.derived.activePergolaId ??
        activeModule.drawingModule.input.pergolaId ??
        store.derived.railModel.objectLists.pergolas[0]?.ref.objectId ??
        null;
  const handleRailTabSelect = useCallback(
    (tab: DrawingWorkbenchRailTab) => {
      if (tab !== 'pergolas') {
        houseSelectionActions.selectRailTab(tab);
        return;
      }

      setUi((current) => {
        const nextModuleIndex =
          defaultPergolaId === null
            ? current.activeModuleIndex
            : Math.max(
                0,
                store.persisted.modules.findIndex((module) => module.drawingModule.input.pergolaId === defaultPergolaId),
              );
        return {
          ...current,
          activeModuleIndex: nextModuleIndex,
          ...buildDrawingWorkbenchCanonicalSelectionState({
            activeRailTab: 'pergolas',
            activeObjectFamily: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: defaultPergolaId },
            activeHouseSelection: current.activeHouseSelection,
            activePergolaId: defaultPergolaId,
          }),
        };
      });
    },
    [defaultPergolaId, houseSelectionActions, setUi, store.persisted.modules],
  );
  const handleCanonicalPergolaSelection = useCallback(
    (pergolaId: string | null) => {
      setUi((current) => {
        const nextModuleIndex =
          pergolaId === null
            ? current.activeModuleIndex
            : Math.max(
                0,
                store.persisted.modules.findIndex((module) => module.drawingModule.input.pergolaId === pergolaId),
              );
        return {
          ...current,
          activeModuleIndex: nextModuleIndex,
          ...buildDrawingWorkbenchCanonicalSelectionState({
            activeRailTab: 'pergolas',
            activeObjectFamily: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: pergolaId },
            activeHouseSelection: current.activeHouseSelection,
            activePergolaId: pergolaId,
          }),
        };
      });
    },
    [setUi, store.persisted.modules],
  );
  const handleRailObjectSelect = useCallback(
    (ref: { family: 'house_forms' | 'decks' | 'openings' | 'pergolas'; objectId: string | null }) => {
      if (ref.family === 'pergolas') {
        handleCanonicalPergolaSelection(ref.objectId);
        return;
      }
      houseSelectionActions.selectObjectRef(ref);
    },
    [houseSelectionActions, handleCanonicalPergolaSelection],
  );
  const houseContextPanel =
    supportsSanctuaryEditing && activeModuleInput ? (
      <SanctuaryWorkbenchRail
        moduleLabel={store.derived.activeModuleLabel}
        geometryState={geometryEditState}
        view={store.ui.activeView}
        disabled={isLocked}
        canStartDrawOutline={!isLocked}
        onStartDrawOutline={houseSelectionActions.startDrawOutlineEditor}
        onCommitGeometryEdit={!isLocked ? houseActions.commitGeometryIntent : undefined}
        chrome="embedded"
        renderSummary={false}
        houseContextSectionTitle="Attachment Context"
        sections={{
          geometry: false,
          roof: false,
          gable: false,
          houseContext: 'canonical_extras',
          supports: false,
          overrides: false,
        }}
      />
    ) : null;
  const pergolaInspectorPanel = (
    <>
      <section className={styles.moduleSection}>
        <p className={styles.moduleSectionTitle}>Pergola Inspector</p>
        <p className={styles.noticeText}>
          Geometry, roof, supports, and overrides live here. Footprint and drawing rotation still live in House Forms.
        </p>
        <button
          type="button"
          className={styles.modeButton}
          onClick={() => handleRailTabSelect('house_forms')}
        >
          Open House Forms
        </button>
      </section>
      {activePergolaModel ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Host Attachment</p>
          <label className={styles.moduleSectionTitle} htmlFor="pergola-connection-type">
            Connection
          </label>
          <select
            id="pergola-connection-type"
            className={styles.moduleSelect}
            aria-label="Pergola connection"
            value={activePergolaModel.attachment.kind}
            disabled={isLocked || pergolaAttachmentPendingFieldId === 'pergola-connection'}
            onChange={(event) =>
              runPergolaAttachmentAction(
                'pergola-connection',
                !isLocked
                  ? houseActions.commitSharedPergolaConnectionKind(
                      activePergolaModel.id,
                      event.target.value as typeof activePergolaModel.attachment.kind,
                    )
                  : undefined,
                'Unable to update the pergola connection.',
              )
            }
          >
            {PERGOLA_CONNECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className={styles.moduleSectionTitle} htmlFor="pergola-attachment-strategy">
            Attachment strategy
          </label>
          <select
            id="pergola-attachment-strategy"
            className={styles.moduleSelect}
            aria-label="Pergola attachment strategy"
            value={activePergolaModel.attachment.strategy ?? 'auto'}
            disabled={
              isLocked ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              pergolaAttachmentPendingFieldId === 'pergola-strategy'
            }
            onChange={(event) =>
              runPergolaAttachmentAction(
                'pergola-strategy',
                !isLocked
                  ? houseActions.commitSharedPergolaAttachmentStrategy(
                      activePergolaModel.id,
                      event.target.value as (typeof PERGOLA_ATTACHMENT_STRATEGY_OPTIONS)[number]['value'],
                    )
                  : undefined,
                'Unable to update the pergola attachment strategy.',
              )
            }
          >
            {PERGOLA_ATTACHMENT_STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className={styles.moduleSectionTitle} htmlFor="pergola-host-edge">
            Host edge
          </label>
          <select
            id="pergola-host-edge"
            className={styles.moduleSelect}
            aria-label="Pergola host edge"
            value={activePergolaModel.attachment.attachmentEdgeId ?? ''}
            disabled={
              isLocked ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              (!compatiblePergolaEdges.length && !selectedPergolaEdgeOptionMissing) ||
              pergolaAttachmentPendingFieldId === 'pergola-edge'
            }
            onChange={(event) =>
              runPergolaAttachmentAction(
                'pergola-edge',
                !isLocked
                  ? houseActions.commitSharedPergolaAttachmentEdge(activePergolaModel.id, event.target.value)
                  : undefined,
                'Unable to update the pergola host edge.',
              )
            }
          >
            {selectedPergolaEdgeOptionMissing && activePergolaModel.attachment.attachmentEdgeId ? (
              <option value={activePergolaModel.attachment.attachmentEdgeId}>Unavailable saved edge</option>
            ) : null}
            {compatiblePergolaEdges.map((edge) => (
              <option key={edge.id} value={edge.id}>
                {edge.label}
              </option>
            ))}
          </select>
          <label className={styles.moduleSectionTitle} htmlFor="pergola-host-zone">
            Host zone
          </label>
          <select
            id="pergola-host-zone"
            className={styles.moduleSelect}
            aria-label="Pergola host zone"
            value={activePergolaModel.attachment.attachmentZoneId ?? ''}
            disabled={
              isLocked ||
              activePergolaModel.attachment.kind === 'freestanding' ||
              (!compatiblePergolaZones.length && !selectedPergolaZoneOptionMissing) ||
              pergolaAttachmentPendingFieldId === 'pergola-zone'
            }
            onChange={(event) =>
              runPergolaAttachmentAction(
                'pergola-zone',
                !isLocked
                  ? houseActions.commitSharedPergolaAttachmentZone(activePergolaModel.id, event.target.value)
                  : undefined,
                'Unable to update the pergola host zone.',
              )
            }
          >
            {selectedPergolaZoneOptionMissing && activePergolaModel.attachment.attachmentZoneId ? (
              <option value={activePergolaModel.attachment.attachmentZoneId}>Unavailable saved zone</option>
            ) : null}
            {compatiblePergolaZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </select>
          <div className={styles.diagnosticsList}>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Resolution</span>
              <span className={styles.diagnosticValue}>{activePergolaModel.attachment.resolution.status}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Host side</span>
              <span className={styles.diagnosticValue}>
                {labelForAttachmentSideList([activePergolaModel.attachment.side])}
              </span>
            </div>
          </div>
          {activePergolaModel.attachment.resolution.message ? (
            <p className={styles.noticeText}>{activePergolaModel.attachment.resolution.message}</p>
          ) : null}
          {pergolaAttachmentFieldErrors['pergola-connection'] ? (
            <p className={styles.noticeText}>{pergolaAttachmentFieldErrors['pergola-connection']}</p>
          ) : null}
          {pergolaAttachmentFieldErrors['pergola-strategy'] ? (
            <p className={styles.noticeText}>{pergolaAttachmentFieldErrors['pergola-strategy']}</p>
          ) : null}
          {pergolaAttachmentFieldErrors['pergola-edge'] ? (
            <p className={styles.noticeText}>{pergolaAttachmentFieldErrors['pergola-edge']}</p>
          ) : null}
          {pergolaAttachmentFieldErrors['pergola-zone'] ? (
            <p className={styles.noticeText}>{pergolaAttachmentFieldErrors['pergola-zone']}</p>
          ) : null}
        </section>
      ) : null}
      {modules.length > 1 ? (
        <section className={styles.moduleSection}>
          <p className={styles.moduleSectionTitle}>Module</p>
          <select
            className={styles.moduleSelect}
            aria-label="Drawing module"
            value={String(store.derived.activeModuleIndex)}
            onChange={(event) =>
              handleCanonicalPergolaSelection(
                store.persisted.modules[Number(event.target.value)]?.drawingModule.input.pergolaId ?? null,
              )
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
      {supportsSanctuaryEditing && activeModuleInput && activePergolaModel ? (
        <>
          <section className={styles.moduleSection}>
            <p className={styles.moduleSectionTitle}>Selection</p>
            <div className={styles.diagnosticsList}>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Active pergola</span>
                <span className={styles.diagnosticValue}>{activePergolaModel.label || activePergolaModel.id}</span>
              </div>
              <div className={styles.diagnosticRow}>
                <span className={styles.diagnosticLabel}>Module</span>
                <span className={styles.diagnosticValue}>{store.derived.activeModuleLabel}</span>
              </div>
            </div>
          </section>
          <SanctuaryWorkbenchRail
            moduleLabel={store.derived.activeModuleLabel}
            geometryState={geometryEditState}
            view={store.ui.activeView}
            disabled={isLocked}
            canStartDrawOutline={!isLocked}
            onStartDrawOutline={houseSelectionActions.startDrawOutlineEditor}
            onCommitGeometryEdit={!isLocked ? houseActions.commitGeometryIntent : undefined}
            chrome="embedded"
            renderSummary={false}
            sections={{
              geometry: true,
              roof: true,
              gable: true,
              houseContext: 'none',
              supports: true,
              overrides: true,
            }}
          />
        </>
      ) : activePergolaModel ? (
        <section className={styles.notice}>
          <p className={styles.noticeTitle}>Editing Deferred</p>
          <p className={styles.noticeText}>
            This pergola family is not supported for native editing yet, but it can still be reviewed in the canonical workbench.
          </p>
        </section>
      ) : null}
    </>
  );
  const diagnosticsPanel = (
    <section className={styles.moduleSection}>
      <p className={styles.moduleSectionTitle}>Migration diagnostics</p>
      <div className={styles.diagnosticsList}>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Canonical tab</span>
          <span className={styles.diagnosticValue}>{store.ui.activeRailTab}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Selection family</span>
          <span className={styles.diagnosticValue}>{store.ui.activeObjectFamily}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Compatibility mode</span>
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
              <span className={styles.diagnosticValue}>{store.derived.activeDeckSupport.resolvedClassification}</span>
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
              <span className={styles.diagnosticValue}>{store.derived.activeDeckInteraction.selectedDeckType}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag eligible</span>
              <span className={styles.diagnosticValue}>
                {store.derived.activeDeckInteraction.dragEligible ? 'Yes' : 'No'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Deck drag reason</span>
              <span className={styles.diagnosticValue}>{store.derived.activeDeckInteraction.dragReason ?? 'none'}</span>
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
          <span className={styles.diagnosticValue}>{store.derived.roofForm ?? 'none'}</span>
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
          <span className={styles.diagnosticLabel}>Roof geometry</span>
          <span className={styles.diagnosticValue}>{labelForRoofGeometryKind(store.derived.roofGeometryKind)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof form source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.form)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof material source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.material)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof pitch source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.primaryPitchDeg)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof fall source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.primaryFallDirection)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof ridge source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.ridgeAxis)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof open-end source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.openGableEndIds)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof appendage source</span>
          <span className={styles.diagnosticValue}>{labelForRoofFieldSource(store.derived.roofProvenance?.appendage)}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Roof appendage</span>
          <span className={styles.diagnosticValue}>{store.derived.roofAppendageStatus}</span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Appendage support</span>
          <span className={styles.diagnosticValue}>
            {store.derived.roofAppendageSupportReason ??
              (store.derived.roofAppendageSupportedHostEdges.length > 0 ? 'Supported' : 'Not supported')}
          </span>
        </div>
        <div className={styles.diagnosticRow}>
          <span className={styles.diagnosticLabel}>Appendage supported edges</span>
          <span className={styles.diagnosticValue}>
            {labelForAttachmentSideList(store.derived.roofAppendageSupportedHostEdges)}
          </span>
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
              <span className={styles.diagnosticValue}>{geometryPreview.deckSupport.resolvedClassification}</span>
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
                {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningValidCount ?? 0 : 0)}
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
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
        <HouseFirstWorkbenchRail
          model={store.derived.railModel}
          activeRailTab={store.ui.activeRailTab}
          activeObjectRef={store.ui.activeObjectRef}
          disabled={isLocked}
          visibility={store.ui.visibility}
          onSelectRailTab={handleRailTabSelect}
          onSelectObjectRef={handleRailObjectSelect}
          onVisibilityChange={(family, visible) =>
            setUi((current) => ({
              ...current,
              visibility: {
                ...current.visibility,
                [family]: visible,
              },
            }))
          }
          compatibilityInspectorState={{
            house: store.derived.house,
            activeDeckId: store.derived.activeDeckId,
            activeOpeningId: store.derived.activeOpeningId,
            pergolas: store.derived.pergolas,
            warnings: store.derived.migrationWarnings,
            canEditFootprint: Boolean(activeModule.assemblyModel.capabilities.canEditHouseFootprint),
            canStartDrawOutline: !isLocked,
            onStartDrawOutline: houseSelectionActions.startDrawOutlineEditor,
            onCommitFootprintEdit: !isLocked ? houseActions.commitSharedHouseFootprintEdit : undefined,
            onCommitRoofDraft: !isLocked ? houseActions.commitSharedHouseRoofDraft : undefined,
            onAddDeck: !isLocked ? houseActions.addSharedHouseDeck : undefined,
            onAddOpening: !isLocked ? houseActions.addSharedHouseOpening : undefined,
            onRemoveDeck: !isLocked ? houseActions.removeSharedHouseDeck : undefined,
            onRemoveOpening: !isLocked ? houseActions.removeSharedHouseOpening : undefined,
            onCommitDeckPatch: !isLocked ? houseActions.commitSharedHouseDeckPatch : undefined,
            onCommitOpeningPatch: !isLocked ? houseActions.commitSharedHouseOpeningPatch : undefined,
            onStartDeckOutline: !isLocked ? houseSelectionActions.startDeckOutlineEditor : undefined,
            houseContextPanel,
            pergolaInspectorPanel,
            diagnosticsPanel,
          }}
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
                ? buildDrawingWorkbenchCanonicalSelectionState({
                    activeRailTab: current.activeRailTab,
                    activeObjectFamily: current.activeObjectFamily,
                    activeObjectRef: {
                      family: 'pergolas',
                      objectId: store.persisted.modules[index]?.drawingModule.input.pergolaId ?? current.activePergolaId,
                    },
                    activeHouseSelection: current.activeHouseSelection,
                    activePergolaId:
                      store.persisted.modules[index]?.drawingModule.input.pergolaId ?? current.activePergolaId,
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
          workbenchDisplayMode={canonicalWorkbenchDisplayMode}
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
          activePergolaId={store.derived.activePergolaId}
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
          onCommitCustomPolygon={!isLocked ? houseActions.commitSharedDeckCustomPolygon : undefined}
          onSelectHouseFirstTarget={!isLocked ? houseSelectionActions.selectHouseFirstTarget : undefined}
          onSelectPergolaTarget={!isLocked ? houseSelectionActions.selectPergolaObject : undefined}
          onClearWorkbenchSelection={!isLocked ? houseSelectionActions.clearActiveWorkbenchSelection : undefined}
          onCommitHouseFirstFootprintDimension={!isLocked ? houseActions.commitHouseFirstFootprintDimension : undefined}
          onCommitHouseFirstDeckDimension={!isLocked ? houseActions.commitHouseFirstDeckDimension : undefined}
          onCommitHouseFirstOpeningDimension={!isLocked ? houseActions.commitHouseFirstOpeningDimension : undefined}
        />
        </div>
      </div>
    </div>
  );
}
