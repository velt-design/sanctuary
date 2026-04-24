'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildHouseFootprintPresetSideLocalPoints } from '@sp/geometry';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import {
  applyGeometryEditIntent,
  buildGeometryEditState,
  translateEstimateDrawingFieldToGeometryIntent,
  type GeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildDeckReferenceHousePolygon,
  buildRectangularDeckOutline,
  inferDeckPresetRectFromOutline,
  sanitizeDeckPresetRect,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import {
  applyEstimateDrawingFootprintEdit,
  buildEstimateDrawingDraftFromSnapshot,
  buildEstimateDrawingSheetMetaOverrides,
  deriveEstimateDrawingEditableFields,
  estimateDrawingDraftMatchesSnapshot,
  updateEstimateDrawingHouseFirstDeckDrafts,
  updateEstimateDrawingHouseFirstOpeningDrafts,
  updateEstimateDrawingHouseFirstRoofDraft,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseModel,
  WorkbenchHouseSelection,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorHouseFootprintPolygonPoint, CalculatorModuleInputs } from '@/lib/types/calculator';
import styles from './DesignWorkbenchEstimateClient.module.css';

const SanctuaryWorkbenchRail = dynamic(() => import('@/components/drawings/rail/SanctuaryWorkbenchRail'));
const HouseFirstWorkbenchRail = dynamic(() => import('@/components/drawings/rail/HouseFirstWorkbenchRail'));

type DesignWorkbenchEstimateClientProps = {
  estimate: EstimateDetail;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

type CommitResult = { ok: boolean; error?: string };
type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;

type DrawOutlineTarget =
  | { kind: 'footprint'; deckId: null }
  | { kind: 'deck'; deckId: string };

type PendingDeckCreation =
  | {
      kind: 'attached_preset';
      status: 'picking_host_edge';
    }
  | null;

type DeckInteractionTelemetry = {
  selectedDeckId: string | null;
  housePolygonSource: 'custom_saved' | 'preset_derived' | null;
  selectedDeckType: 'none' | 'attached_preset_rect' | 'detached_preset_rect' | 'custom_outline' | 'preset_unresolved';
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
  snapState: 'idle' | 'free' | 'snapped';
  snapMessage: string | null;
};

function toDeckDrafts(house: HouseModel | null | undefined): HouseFirstDeckDraft[] {
  return (house?.decks ?? []).map((deck) => ({
    id: deck.id,
    name: deck.name,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    presetRect: deck.presetRect,
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: deck.levelOffsetMm,
    hostEdgeId: deck.hostEdgeId,
    isAttached: deck.isAttached,
    surfaceMaterial: deck.surfaceMaterial,
  }));
}

function nextDeckId(existing: HouseFirstDeckDraft[]): string {
  const used = new Set(existing.map((deck) => deck.id));
  let index = existing.length + 1;
  while (used.has(`deck-${index}`)) index += 1;
  return `deck-${index}`;
}

function toOpeningDrafts(house: HouseModel | null | undefined): HouseFirstOpeningDraft[] {
  return (house?.openings ?? []).map((opening) => ({
    id: opening.id,
    label: opening.label,
    kind: 'window',
    wallId: opening.wallId,
    hostEdgeId: opening.hostEdgeId,
    widthM: opening.widthM,
    heightM: opening.heightM,
    sillHeightM: opening.sillHeightM,
    offsetAlongWallM: opening.offsetAlongWallM,
  }));
}

function nextOpeningId(existing: HouseFirstOpeningDraft[]): string {
  const used = new Set(existing.map((opening) => opening.id));
  let index = existing.length + 1;
  while (used.has(`opening-${index}`)) index += 1;
  return `opening-${index}`;
}

function houseLocalPolygon(input: {
  house: HouseModel;
  moduleLengthM: string | undefined;
  moduleProjectionM: string | undefined;
}): Array<{ alongM: string; depthM: string }> {
  if (input.house.footprint.mode === 'custom_polygon' && input.house.footprint.polygon.length) {
    return input.house.footprint.polygon;
  }
  const widthMm = Math.round((Number(input.moduleLengthM) || 6) * 1000);
  const depthMm = Math.round((Number(input.moduleProjectionM) || 3) * 1000);
  return buildHouseFootprintPresetSideLocalPoints({
    pergolaWidthMm: widthMm,
    pergolaDepthMm: depthMm,
    preset: input.house.footprint.preset,
    params: input.house.footprint.params,
    attachmentSide: input.house.footprint.attachmentSide,
  }).map((point) => ({
    alongM: String(point.alongM),
    depthM: String(point.depthM),
  }));
}

function deckReferenceHousePolygon(input: {
  house: HouseModel;
  moduleLengthM: string | undefined;
  moduleProjectionM: string | undefined;
}): Array<{ alongM: string; depthM: string }> {
  return buildDeckReferenceHousePolygon({
    housePolygon: houseLocalPolygon(input),
    footprintParams: input.house.footprint.params,
  });
}

function resolveDeckDraftGeometry(input: {
  deck: HouseFirstDeckDraft;
  housePolygon: Array<{ alongM: string; depthM: string }>;
}): HouseFirstDeckDraft {
  const attached = Boolean(input.deck.isAttached);
  const fallbackHostEdgeId = input.deck.hostEdgeId ?? 'rear';
  const hostEdgeId = input.deck.shape === 'preset' ? fallbackHostEdgeId : input.deck.hostEdgeId ?? null;
  const inferredPresetRect =
    input.deck.shape === 'preset'
      ? inferDeckPresetRectFromOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          outline: input.deck.outline,
        })
      : null;
  const presetRect =
    input.deck.shape === 'preset'
      ? sanitizeDeckPresetRect({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect: input.deck.presetRect ?? inferredPresetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.presetRect ?? inferredPresetRect;
  const outline =
    input.deck.shape === 'preset'
      ? buildRectangularDeckOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.outline ?? [];

  return {
    ...input.deck,
    hostEdgeId,
    presetRect,
    outline,
  };
}

export default function DesignWorkbenchEstimateClient({
  estimate,
  projectName,
  siteAddress,
  backHref,
}: DesignWorkbenchEstimateClientProps) {
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const [deckInteractionTelemetry, setDeckInteractionTelemetry] = useState<DeckInteractionTelemetry | null>(null);
  const [drawOutlineRequestId, setDrawOutlineRequestId] = useState(0);
  const [drawOutlineTarget, setDrawOutlineTarget] = useState<DrawOutlineTarget>({
    kind: 'footprint',
    deckId: null,
  });
  const [pendingDeckCreation, setPendingDeckCreation] = useState<PendingDeckCreation>(null);
  const baseDraft = useMemo(() => buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot), [estimate.calculatorSnapshot]);
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    buildEstimateDrawingDraftEntityKey(estimate.id),
    baseDraft,
  );
  const drawingDraft = drawingWorkingCopy.value;

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
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setPendingDeckCreation(null);
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

  const commitSharedHouseFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      let nextDraft = drawingDraft;
      for (let moduleIndex = 0; moduleIndex < nextDraft.inputs.modules.length; moduleIndex += 1) {
        const result = applyEstimateDrawingFootprintEdit({
          draft: nextDraft,
          moduleIndex,
          edit,
        });
        if (!result.ok) return { ok: false, error: result.error };
        nextDraft = result.draft;
      }

      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitSharedHouseRoofDraft = useCallback(
    async (roof: HouseFirstRoofDraft): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const nextDraft = updateEstimateDrawingHouseFirstRoofDraft({
        draft: structuredClone(drawingDraft),
        roof,
      });
      const material = roof.material;
      const pitchDeg = roof.primaryPitchDeg?.trim() ?? '';
      for (const module of nextDraft.inputs.modules) {
        if (!module) continue;
        if (material) {
          module.houseRoofMaterial = material;
        }
        if (pitchDeg) {
          module.houseRoofPitchDeg = pitchDeg;
        } else {
          delete module.houseRoofPitchDeg;
        }
      }

      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitSharedHouseDeckDrafts = useCallback(
    async (decks: HouseFirstDeckDraft[]): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const nextDraft = updateEstimateDrawingHouseFirstDeckDrafts({
        draft: structuredClone(drawingDraft),
        decks,
      });
      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitSharedHouseOpeningDrafts = useCallback(
    async (openings: HouseFirstOpeningDraft[]): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const nextDraft = updateEstimateDrawingHouseFirstOpeningDrafts({
        draft: structuredClone(drawingDraft),
        openings,
      });
      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const commitSharedHouseDeckPatch = useCallback(
    async (deckId: string, patch: Partial<HouseFirstDeckDraft>): Promise<CommitResult> => {
      const house = store.derived.house;
      const currentDecks =
        drawingDraft?.houseFirst?.decks?.map((deck) => ({ ...deck })) ??
        toDeckDrafts(house);
      const housePolygon = house
        ? deckReferenceHousePolygon({
            house,
            moduleLengthM: activeModuleInput?.lengthM,
            moduleProjectionM: activeModuleInput?.projectionM,
          })
        : [];
      const nextDecks = currentDecks.map((deck) =>
        deck.id === deckId
          ? resolveDeckDraftGeometry({
              deck: {
                ...deck,
                ...patch,
                presetRect:
                  patch.presetRect === undefined
                    ? deck.presetRect
                    : patch.presetRect === null
                      ? null
                      : {
                          ...(deck.presetRect ?? {}),
                          ...patch.presetRect,
                        },
                shape:
                  patch.outline && patch.outline.length
                    ? 'custom'
                    : patch.shape ?? deck.shape ?? 'preset',
              },
              housePolygon,
            })
          : deck,
      );
      return commitSharedHouseDeckDrafts(nextDecks);
    },
    [
      activeModuleInput?.lengthM,
      activeModuleInput?.projectionM,
      commitSharedHouseDeckDrafts,
      drawingDraft?.houseFirst?.decks,
      store.derived.house,
    ],
  );

  const addSharedHouseDeck = useCallback(
    async (
      mode: 'attached_preset' | 'detached_preset' | 'custom_outline',
      hostEdgeOverride?: AttachmentSide,
    ): Promise<CommitResult> => {
      const house = store.derived.house;
      if (!house) {
        return { ok: false, error: 'Shared house context is not available yet.' };
      }
      const currentDecks =
        drawingDraft?.houseFirst?.decks?.map((deck) => ({ ...deck })) ??
        toDeckDrafts(house);
      const deckId = nextDeckId(currentDecks);
      const hostEdge = hostEdgeOverride ?? house.footprint.attachmentSide ?? 'rear';
      const housePolygon = deckReferenceHousePolygon({
        house,
        moduleLengthM: activeModuleInput?.lengthM,
        moduleProjectionM: activeModuleInput?.projectionM,
      });
      const baseDeck: HouseFirstDeckDraft = {
        id: deckId,
        name: `Deck ${currentDecks.length + 1}`,
        kind: 'deck',
        shape: mode === 'custom_outline' ? 'custom' : 'preset',
        presetType:
          mode === 'attached_preset'
            ? 'rect_attached'
            : mode === 'detached_preset'
              ? 'rect_detached'
              : null,
        elevationMode: mode === 'attached_preset' ? 'aligned_to_threshold' : 'ground',
        levelOffsetMm: '0',
        hostEdgeId: hostEdge,
        isAttached: mode === 'attached_preset',
        surfaceMaterial: 'timber_decking',
      };
      const nextDeck =
        mode === 'custom_outline'
          ? {
              ...baseDeck,
              outline: [],
            }
          : resolveDeckDraftGeometry({
              deck: {
                ...baseDeck,
                presetRect: sanitizeDeckPresetRect({
                  housePolygon,
                  hostEdgeId: hostEdge,
                  attached: mode === 'attached_preset',
                  presetRect: null,
                }),
              },
              housePolygon,
            });
      const result = await commitSharedHouseDeckDrafts([...currentDecks, nextDeck]);
      if (!result.ok) return result;
      setPendingDeckCreation(null);
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: deckId },
      }));
      if (mode === 'custom_outline') {
        setDrawOutlineTarget({ kind: 'deck', deckId });
        setDrawOutlineRequestId((current) => current + 1);
        setUi((current) => ({
          ...current,
          viewportMode: 'model',
          activeView: 'plan',
        }));
      }
      return { ok: true };
    },
    [
      activeModuleInput?.lengthM,
      activeModuleInput?.projectionM,
      commitSharedHouseDeckDrafts,
      drawingDraft?.houseFirst?.decks,
      store.derived.house,
    ],
  );

  const commitSharedHouseOpeningPatch = useCallback(
    async (openingId: string, patch: Partial<HouseFirstOpeningDraft>): Promise<CommitResult> => {
      const house = store.derived.house;
      const currentOpenings =
        drawingDraft?.houseFirst?.openings?.map((opening) => ({ ...opening })) ??
        toOpeningDrafts(house);
      return commitSharedHouseOpeningDrafts(
        currentOpenings.map((opening) =>
          opening.id === openingId
            ? {
                ...opening,
                ...patch,
                ...(patch.wallId !== undefined ? { hostEdgeId: null } : null),
              }
            : opening,
        ),
      );
    },
    [commitSharedHouseOpeningDrafts, drawingDraft?.houseFirst?.openings, store.derived.house],
  );

  const addSharedHouseOpening = useCallback(async (): Promise<CommitResult> => {
    const house = store.derived.house;
    if (!house) {
      return { ok: false, error: 'Shared house context is not available yet.' };
    }
    const currentOpenings =
      drawingDraft?.houseFirst?.openings?.map((opening) => ({ ...opening })) ??
      toOpeningDrafts(house);
    const openingId = nextOpeningId(currentOpenings);
    const wallId = house.footprint.attachmentSide ?? 'rear';
    const nextOpening: HouseFirstOpeningDraft = {
      id: openingId,
      label: `Window ${currentOpenings.length + 1}`,
      kind: 'window',
      wallId,
      widthM: '1.8',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0.6',
    };
    const result = await commitSharedHouseOpeningDrafts([...currentOpenings, nextOpening]);
    if (!result.ok) return result;
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      activeHouseSelection: { kind: 'opening', targetId: openingId },
    }));
    return { ok: true };
  }, [commitSharedHouseOpeningDrafts, drawingDraft?.houseFirst?.openings, store.derived.house]);

  const removeSharedHouseOpening = useCallback(
    async (openingId: string): Promise<CommitResult> => {
      const currentOpenings =
        drawingDraft?.houseFirst?.openings?.map((opening) => ({ ...opening })) ??
        toOpeningDrafts(store.derived.house);
      const result = await commitSharedHouseOpeningDrafts(
        currentOpenings.filter((opening) => opening.id !== openingId),
      );
      if (!result.ok) return result;
      setUi((current) => ({
        ...current,
        activeHouseSelection:
          current.activeHouseSelection.kind === 'opening' && current.activeHouseSelection.targetId === openingId
            ? { kind: 'house', targetId: null }
            : current.activeHouseSelection,
      }));
      return { ok: true };
    },
    [commitSharedHouseOpeningDrafts, drawingDraft?.houseFirst?.openings, store.derived.house],
  );

  const beginAttachedDeckHostEdgePick = useCallback((): CommitResult => {
    setPendingDeckCreation({
      kind: 'attached_preset',
      status: 'picking_host_edge',
    });
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setUi((current) => {
      const unsupportedCurrentSurface =
        current.viewportMode === 'sheet' || (current.viewportMode === 'model' && current.activeView === 'section');
      return {
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'house', targetId: null },
        viewportMode: unsupportedCurrentSurface ? 'model' : current.viewportMode,
        activeView: unsupportedCurrentSurface ? 'plan' : current.activeView,
      };
    });
    return { ok: true };
  }, []);

  const handleAttachedDeckHostEdgePick = useCallback(
    async (side: AttachmentSide) => {
      if (pendingDeckCreation?.kind !== 'attached_preset') return;
      await addSharedHouseDeck('attached_preset', side);
    },
    [addSharedHouseDeck, pendingDeckCreation?.kind],
  );

  const cancelPendingDeckCreation = useCallback(() => {
    setPendingDeckCreation(null);
  }, []);

  const runAddSharedHouseDeck = useCallback(
    async (mode: 'attached_preset' | 'detached_preset' | 'custom_outline'): Promise<CommitResult> => {
      if (mode === 'attached_preset') {
        return beginAttachedDeckHostEdgePick();
      }
      setPendingDeckCreation(null);
      return addSharedHouseDeck(mode);
    },
    [addSharedHouseDeck, beginAttachedDeckHostEdgePick],
  );

  const removeSharedHouseDeck = useCallback(
    async (deckId: string): Promise<CommitResult> => {
      const currentDecks =
        drawingDraft?.houseFirst?.decks?.map((deck) => ({ ...deck })) ??
        toDeckDrafts(store.derived.house);
      const nextDecks = currentDecks.filter((deck) => deck.id !== deckId);
      const result = await commitSharedHouseDeckDrafts(nextDecks);
      if (!result.ok) return result;
      setUi((current) => ({
        ...current,
        activeHouseSelection:
          current.activeHouseSelection.kind === 'deck' && current.activeHouseSelection.targetId === deckId
            ? { kind: 'house', targetId: null }
            : current.activeHouseSelection,
      }));
      if (drawOutlineTarget.kind === 'deck' && drawOutlineTarget.deckId === deckId) {
        setDrawOutlineTarget({ kind: 'footprint', deckId: null });
      }
      return { ok: true };
    },
    [commitSharedHouseDeckDrafts, drawOutlineTarget, drawingDraft?.houseFirst?.decks, store.derived.house],
  );

  const startDeckOutlineEditor = useCallback(
    (deckId: string): CommitResult => {
      setDrawOutlineTarget({ kind: 'deck', deckId });
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        viewportMode: 'model',
        activeView: 'plan',
        activeHouseSelection: { kind: 'deck', targetId: deckId },
      }));
      setDrawOutlineRequestId((current) => current + 1);
      return { ok: true };
    },
    [],
  );

  const commitSharedDeckCustomPolygon = useCallback(
    async (polygon: CalculatorHouseFootprintPolygonPoint[]): Promise<CommitResult> => {
      if (drawOutlineTarget.kind !== 'deck') {
        return { ok: false, error: 'No deck outline target is active.' };
      }
      return commitSharedHouseDeckPatch(drawOutlineTarget.deckId, {
        shape: 'custom',
        outline: polygon,
      });
    },
    [commitSharedHouseDeckPatch, drawOutlineTarget],
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

  const startDrawOutlineEditor = useCallback((): CommitResult => {
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      viewportMode: 'model',
      activeView: 'plan',
      activeHouseSelection: { kind: 'footprint', targetId: null },
    }));
    setDrawOutlineRequestId((current) => current + 1);
    return { ok: true };
  }, []);

  const selectSharedHouseDeck = useCallback((deckId: string | null) => {
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      activeHouseSelection: deckId ? { kind: 'deck', targetId: deckId } : { kind: 'house', targetId: null },
    }));
  }, []);

  const selectSharedHouseOpening = useCallback((openingId: string | null) => {
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      activeHouseSelection: openingId ? { kind: 'opening', targetId: openingId } : { kind: 'house', targetId: null },
    }));
  }, []);

  const selectHouseFirstTarget = useCallback((selection: WorkbenchHouseSelection) => {
    setDrawOutlineTarget({ kind: 'footprint', deckId: null });
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      activeHouseSelection: selection,
    }));
  }, []);

  const commitHouseFirstFootprintDimension = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => commitSharedHouseFootprintEdit(edit),
    [commitSharedHouseFootprintEdit],
  );

  const commitHouseFirstDeckDimension = useCallback(
    async (deckId: string, patch: Partial<HouseFirstDeckDraft>): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const house = store.derived.house;
      const currentDecks =
        drawingDraft.houseFirst?.decks?.map((deck) => ({ ...deck })) ??
        toDeckDrafts(house);
      const housePolygon = house
        ? deckReferenceHousePolygon({
            house,
            moduleLengthM: activeModuleInput?.lengthM,
            moduleProjectionM: activeModuleInput?.projectionM,
          })
        : [];
      const nextDecks = currentDecks.map((deck) =>
        deck.id === deckId
          ? resolveDeckDraftGeometry({
              deck: {
                ...deck,
                ...patch,
                presetRect:
                  patch.presetRect === undefined
                    ? deck.presetRect
                    : patch.presetRect === null
                      ? null
                      : {
                          ...(deck.presetRect ?? {}),
                          ...patch.presetRect,
                        },
                shape:
                  patch.outline && patch.outline.length
                    ? 'custom'
                    : patch.shape ?? deck.shape ?? 'preset',
              },
              housePolygon,
            })
          : deck,
      );
      const nextDraft = updateEstimateDrawingHouseFirstDeckDrafts({
        draft: structuredClone(drawingDraft),
        decks: nextDecks,
      });
      const previewStore = buildDrawingWorkbenchStore({
        snapshot: estimate.calculatorSnapshot,
        draft: nextDraft,
        ui,
      });
      const nextDeck = previewStore.derived.house?.decks.find((deck) => deck.id === deckId);
      if (nextDeck?.validation.status === 'invalid') {
        return {
          ok: false,
          error: nextDeck.validation.message ?? 'Unable to update the deck dimension.',
        };
      }
      await persistDrawingDraftLocally(nextDraft);
      return { ok: true };
    },
    [
      activeModuleInput?.lengthM,
      activeModuleInput?.projectionM,
      drawingDraft,
      estimate.calculatorSnapshot,
      persistDrawingDraftLocally,
      store.derived.house,
      ui,
    ],
  );

  const commitHouseFirstOpeningDimension = useCallback(
    async (openingId: string, patch: Partial<HouseFirstOpeningDraft>): Promise<CommitResult> =>
      commitSharedHouseOpeningPatch(openingId, patch),
    [commitSharedHouseOpeningPatch],
  );

  const workbenchFieldCommit =
    !isLocked && supportsSanctuaryEditing && store.ui.workbenchMode === 'pergolas'
      ? commitDrawingField
      : undefined;
  const workbenchFootprintCommit =
    !isLocked && store.ui.workbenchMode === 'house' && store.ui.viewportMode === 'model'
      ? commitSharedHouseFootprintEdit
      : undefined;
  const pergolaFallbackRail =
    supportsSanctuaryEditing && activeModuleInput ? (
      <SanctuaryWorkbenchRail
        moduleLabel={store.derived.activeModuleLabel}
        geometryState={geometryEditState}
        view={store.ui.activeView}
        disabled={isLocked}
        canStartDrawOutline={!isLocked}
        onStartDrawOutline={startDrawOutlineEditor}
        onCommitGeometryEdit={!isLocked ? commitGeometryIntent : undefined}
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
                setDrawOutlineTarget({ kind: 'footprint', deckId: null });
                setPendingDeckCreation(null);
                setUi((current) => ({
                  ...current,
                  workbenchMode: 'house',
                  activeHouseSelection: { kind: 'house', targetId: null },
                }));
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
                setDrawOutlineTarget({ kind: 'footprint', deckId: null });
                setPendingDeckCreation(null);
                setUi((current) => ({
                  ...current,
                  workbenchMode: 'pergolas',
                  activePergolaId:
                    store.derived.activePergolaId ??
                    activeModule.drawingModule.input.pergolaId ??
                    current.activePergolaId,
                }));
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
              <span className={styles.diagnosticLabel}>Invalid openings</span>
              <span className={styles.diagnosticValue}>{store.derived.invalidOpeningCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Decks attached</span>
              <span className={styles.diagnosticValue}>{store.derived.attachedDeckCount}</span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Decks detached</span>
              <span className={styles.diagnosticValue}>{store.derived.detachedDeckCount}</span>
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
                {store.derived.roofValidationStatus === 'invalid' ? 'Blocked' : 'Ready'}
              </span>
            </div>
            <div className={styles.diagnosticRow}>
              <span className={styles.diagnosticLabel}>Roof reason code</span>
              <span className={styles.diagnosticValue}>{store.derived.roofValidationCode ?? 'none'}</span>
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
                  <span className={styles.diagnosticLabel}>3D window count</span>
                  <span className={styles.diagnosticValue}>
                    {String(geometryPreview.kind === 'ready' ? geometryPreview.scene.metadata?.houseOpeningCount ?? 0 : 0)}
                  </span>
                </div>
                <div className={styles.diagnosticRow}>
                  <span className={styles.diagnosticLabel}>3D valid windows</span>
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
          onStartDrawOutline={startDrawOutlineEditor}
          onCommitFootprintEdit={!isLocked ? commitSharedHouseFootprintEdit : undefined}
          onCommitRoofDraft={!isLocked ? commitSharedHouseRoofDraft : undefined}
          onSelectDeck={selectSharedHouseDeck}
          onSelectOpening={selectSharedHouseOpening}
          onAddDeck={!isLocked ? runAddSharedHouseDeck : undefined}
          onAddOpening={!isLocked ? addSharedHouseOpening : undefined}
          onRemoveDeck={!isLocked ? removeSharedHouseDeck : undefined}
          onRemoveOpening={!isLocked ? removeSharedHouseOpening : undefined}
          onCommitDeckPatch={!isLocked ? commitSharedHouseDeckPatch : undefined}
          onCommitOpeningPatch={!isLocked ? commitSharedHouseOpeningPatch : undefined}
          onStartDeckOutline={!isLocked ? startDeckOutlineEditor : undefined}
          pendingDeckCreationKind={pendingDeckCreation?.kind ?? null}
          onCancelPendingDeckCreation={cancelPendingDeckCreation}
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
          viewportTransform={store.ui.viewportTransform}
          drawOutlineRequestId={drawOutlineRequestId}
          drawOutlineMode={drawOutlineMode}
          drawOutlineSeedPolygon={drawOutlineSeedPolygon ?? undefined}
          onViewportTransformChange={(viewportTransform) =>
            setUi((current) => ({
              ...current,
              viewportTransform,
            }))
          }
          meta={meta}
          backHref={backHref}
          modelEditableFields={store.ui.workbenchMode === 'pergolas' ? drawingEditableFields : []}
          onCommitModelField={workbenchFieldCommit}
          onCommitFootprintEdit={workbenchFootprintCommit}
          onCommitCustomPolygon={!isLocked ? commitSharedDeckCustomPolygon : undefined}
          onSelectHouseFirstTarget={!isLocked ? selectHouseFirstTarget : undefined}
          onCommitHouseFirstFootprintDimension={!isLocked ? commitHouseFirstFootprintDimension : undefined}
          onCommitHouseFirstDeckDimension={!isLocked ? commitHouseFirstDeckDimension : undefined}
          onCommitHouseFirstOpeningDimension={!isLocked ? commitHouseFirstOpeningDimension : undefined}
          pendingAttachedDeckHostEdgePick={pendingDeckCreation?.kind === 'attached_preset'}
          onPickAttachedDeckHostEdge={!isLocked ? (side) => void handleAttachedDeckHostEdgePick(side) : undefined}
          onDeckInteractionTelemetryChange={setDeckInteractionTelemetry}
        />
        </div>
      </div>
    </div>
  );
}
