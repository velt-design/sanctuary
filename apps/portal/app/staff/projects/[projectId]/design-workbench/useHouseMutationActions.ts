'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  applyGeometryEditIntent,
  type GeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import {
  applyEstimateDrawingFootprintEdit,
  updateEstimateDrawingHouseFirstDeckDrafts,
  updateEstimateDrawingHouseFirstOpeningDrafts,
  updateEstimateDrawingHouseFirstRoofDraft,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type { EstimateDetail } from '@/lib/estimates/types';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseModel,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CalculatorHouseFootprintPolygonPoint, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { CommitResult, DrawOutlineTarget } from './houseWorkbenchClientTypes';
import {
  deckReferenceHousePolygon,
  nextDeckId,
  nextOpeningId,
  resolveDeckDraftGeometry,
  toDeckDrafts,
  toOpeningDrafts,
} from './houseDraftBuilders';
import { translateEstimateDrawingFieldToGeometryIntent } from '@/lib/drawings/geometry/geometryEditAdapter';
import { sanitizeDeckPresetRect } from '@/lib/drawings/state/houseFirstDeckPresets';

type UseHouseMutationActionsInput = {
  activeModuleInput: CalculatorModuleInputs | null;
  drawingDraft: EstimateDrawingDraft | null;
  drawOutlineTarget: DrawOutlineTarget;
  persistDrawingDraftLocally: (nextDraft: EstimateDrawingDraft) => Promise<void>;
  setDrawOutlineTarget: Dispatch<SetStateAction<DrawOutlineTarget>>;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  snapshot: EstimateDetail['calculatorSnapshot'];
  startDeckOutlineEditor: (deckId: string) => CommitResult;
  store: ReturnType<typeof buildDrawingWorkbenchStore>;
  ui: DrawingWorkbenchUiState;
};

function resolveCurrentDeckDrafts(
  drawingDraft: EstimateDrawingDraft | null,
  house: HouseModel | null,
): HouseFirstDeckDraft[] {
  return drawingDraft?.houseFirst?.decks?.map((deck) => ({ ...deck })) ?? toDeckDrafts(house);
}

function resolveCurrentOpeningDrafts(
  drawingDraft: EstimateDrawingDraft | null,
  house: HouseModel | null,
): HouseFirstOpeningDraft[] {
  return drawingDraft?.houseFirst?.openings?.map((opening) => ({ ...opening })) ?? toOpeningDrafts(house);
}

function applyDeckPatch(input: {
  currentDecks: HouseFirstDeckDraft[];
  deckId: string;
  housePolygon: Array<{ alongM: string; depthM: string }>;
  patch: Partial<HouseFirstDeckDraft>;
}): HouseFirstDeckDraft[] {
  return input.currentDecks.map((deck) =>
    deck.id === input.deckId
      ? resolveDeckDraftGeometry({
          deck: {
            ...deck,
            ...input.patch,
            presetRect:
              input.patch.presetRect === undefined
                ? deck.presetRect
                : input.patch.presetRect === null
                  ? null
                  : {
                      ...(deck.presetRect ?? {}),
                      ...input.patch.presetRect,
                    },
            shape:
              input.patch.outline && input.patch.outline.length
                ? 'custom'
                : input.patch.shape ?? deck.shape ?? 'preset',
          },
          housePolygon: input.housePolygon,
        })
      : deck,
  );
}

function resolveDeckReferencePolygon(
  house: HouseModel | null,
  activeModuleInput: CalculatorModuleInputs | null,
): Array<{ alongM: string; depthM: string }> {
  return house
    ? deckReferenceHousePolygon({
        house,
        moduleLengthM: activeModuleInput?.lengthM,
        moduleProjectionM: activeModuleInput?.projectionM,
      })
    : [];
}

export function useHouseMutationActions({
  activeModuleInput,
  drawingDraft,
  drawOutlineTarget,
  persistDrawingDraftLocally,
  setDrawOutlineTarget,
  setUi,
  snapshot,
  startDeckOutlineEditor,
  store,
  ui,
}: UseHouseMutationActionsInput) {
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
      const currentDecks = resolveCurrentDeckDrafts(drawingDraft, house);
      const housePolygon = resolveDeckReferencePolygon(house, activeModuleInput);
      const nextDecks = applyDeckPatch({
        currentDecks,
        deckId,
        housePolygon,
        patch,
      });
      return commitSharedHouseDeckDrafts(nextDecks);
    },
    [activeModuleInput, commitSharedHouseDeckDrafts, drawingDraft, store.derived.house],
  );

  const addSharedHouseDeck = useCallback(
    async (mode: 'preset' | 'custom_outline'): Promise<CommitResult> => {
      const house = store.derived.house;
      if (!house) {
        return { ok: false, error: 'Shared house context is not available yet.' };
      }
      const currentDecks = resolveCurrentDeckDrafts(drawingDraft, house);
      const deckId = nextDeckId(currentDecks);
      const hostEdge = house.footprint.attachmentSide ?? 'rear';
      const housePolygon = resolveDeckReferencePolygon(house, activeModuleInput);
      const baseDeck: HouseFirstDeckDraft = {
        id: deckId,
        name: `Deck ${currentDecks.length + 1}`,
        kind: 'deck',
        shape: mode === 'custom_outline' ? 'custom' : 'preset',
        presetType: mode === 'preset' ? 'rect_attached' : null,
        elevationMode: mode === 'preset' ? 'aligned_to_threshold' : 'ground',
        levelOffsetMm: '0',
        hostEdgeId: hostEdge,
        isAttached: mode === 'preset',
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
                  attached: mode === 'preset',
                  presetRect: null,
                }),
              },
              housePolygon,
            });
      const result = await commitSharedHouseDeckDrafts([...currentDecks, nextDeck]);
      if (!result.ok) return result;
      if (mode === 'custom_outline') {
        return startDeckOutlineEditor(deckId);
      }
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: deckId },
      }));
      return { ok: true };
    },
    [activeModuleInput, commitSharedHouseDeckDrafts, drawingDraft, setUi, startDeckOutlineEditor, store.derived.house],
  );

  const commitSharedHouseOpeningPatch = useCallback(
    async (openingId: string, patch: Partial<HouseFirstOpeningDraft>): Promise<CommitResult> => {
      const house = store.derived.house;
      const currentOpenings = resolveCurrentOpeningDrafts(drawingDraft, house);
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
    [commitSharedHouseOpeningDrafts, drawingDraft, store.derived.house],
  );

  const addSharedHouseOpening = useCallback(async (): Promise<CommitResult> => {
    const house = store.derived.house;
    if (!house) {
      return { ok: false, error: 'Shared house context is not available yet.' };
    }
    const currentOpenings = resolveCurrentOpeningDrafts(drawingDraft, house);
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
  }, [commitSharedHouseOpeningDrafts, drawingDraft, setUi, store.derived.house]);

  const removeSharedHouseOpening = useCallback(
    async (openingId: string): Promise<CommitResult> => {
      const currentOpenings = resolveCurrentOpeningDrafts(drawingDraft, store.derived.house);
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
    [commitSharedHouseOpeningDrafts, drawingDraft, setUi, store.derived.house],
  );

  const removeSharedHouseDeck = useCallback(
    async (deckId: string): Promise<CommitResult> => {
      const currentDecks = resolveCurrentDeckDrafts(drawingDraft, store.derived.house);
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
    [commitSharedHouseDeckDrafts, drawOutlineTarget, drawingDraft, setDrawOutlineTarget, setUi, store.derived.house],
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
        snapshot,
        draft: drawingDraft,
        moduleIndex: store.derived.activeModuleIndex,
        intent,
      });

      if (!result.ok) return { ok: false, error: result.message };
      await persistDrawingDraftLocally(result.draft);
      return { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally, snapshot, store.derived.activeModuleIndex],
  );

  const commitGeometryIntent = useCallback(
    async (intent: GeometryEditIntent): Promise<CommitResult> => {
      if (!drawingDraft) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }

      const result = applyGeometryEditIntent({
        snapshot,
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
    [drawingDraft, persistDrawingDraftLocally, snapshot, store.derived.activeModuleIndex],
  );

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
      const currentDecks = resolveCurrentDeckDrafts(drawingDraft, house);
      const housePolygon = resolveDeckReferencePolygon(house, activeModuleInput);
      const nextDecks = applyDeckPatch({
        currentDecks,
        deckId,
        housePolygon,
        patch,
      });
      const nextDraft = updateEstimateDrawingHouseFirstDeckDrafts({
        draft: structuredClone(drawingDraft),
        decks: nextDecks,
      });
      const previewStore = buildDrawingWorkbenchStore({
        snapshot,
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
    [activeModuleInput, drawingDraft, persistDrawingDraftLocally, snapshot, store.derived.house, ui],
  );

  const commitHouseFirstOpeningDimension = useCallback(
    async (openingId: string, patch: Partial<HouseFirstOpeningDraft>): Promise<CommitResult> =>
      commitSharedHouseOpeningPatch(openingId, patch),
    [commitSharedHouseOpeningPatch],
  );

  return {
    addSharedHouseDeck,
    addSharedHouseOpening,
    commitDrawingField,
    commitGeometryIntent,
    commitHouseFirstDeckDimension,
    commitHouseFirstFootprintDimension,
    commitHouseFirstOpeningDimension,
    commitSharedDeckCustomPolygon,
    commitSharedHouseDeckPatch,
    commitSharedHouseFootprintEdit,
    commitSharedHouseOpeningPatch,
    commitSharedHouseRoofDraft,
    removeSharedHouseDeck,
    removeSharedHouseOpening,
  };
}
