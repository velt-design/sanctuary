'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  applyGeometryEditIntent,
  translateEstimateDrawingFieldToGeometryIntent,
  type GeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchCanonicalSelectionState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseModel,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { sanitizeDeckPresetRect } from '@/lib/drawings/state/houseFirstDeckPresets';
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

type DraftBuildResult =
  | { ok: true; draft: EstimateDrawingDraft }
  | { ok: false; error: string };

type DraftTransaction = {
  buildNextDraft: (draft: EstimateDrawingDraft) => DraftBuildResult;
  validateDraft?: (draft: EstimateDrawingDraft) => CommitResult;
  afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
};

type DeckMutationInput = {
  currentDecks: HouseFirstDeckDraft[];
  housePolygon: Array<{ alongM: string; depthM: string }>;
};

type OpeningMutationInput = {
  currentOpenings: HouseFirstOpeningDraft[];
};

function missingDrawingDraftResult(): CommitResult {
  return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
}

function missingSharedHouseResult(): CommitResult {
  return { ok: false, error: 'Shared house context is not available yet.' };
}

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
            floatingRect:
              input.patch.floatingRect === undefined
                ? deck.floatingRect
                : input.patch.floatingRect === null
                  ? null
                  : {
                      ...(deck.floatingRect ?? {}),
                      ...input.patch.floatingRect,
                    },
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

function applyOpeningPatch(input: {
  currentOpenings: HouseFirstOpeningDraft[];
  openingId: string;
  patch: Partial<HouseFirstOpeningDraft>;
}): HouseFirstOpeningDraft[] {
  return input.currentOpenings.map((opening) => {
    if (opening.id !== input.openingId) return opening;
    const nextKind =
      input.patch.kind === undefined
        ? normalizeWallOpeningKind(opening.kind)
        : normalizeWallOpeningKind(input.patch.kind);
    return {
      ...opening,
      ...input.patch,
      kind: nextKind,
      panelCount:
        input.patch.panelCount !== undefined || input.patch.kind !== undefined
          ? resolveOpeningPanelCount(nextKind, input.patch.panelCount ?? opening.panelCount)
          : opening.panelCount ?? resolveOpeningPanelCount(nextKind, opening.panelCount),
      ...(input.patch.wallId !== undefined ? { hostEdgeId: null } : null),
    };
  });
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

function mirrorSharedRoofDraftToModules(
  draft: EstimateDrawingDraft,
  roof: HouseFirstRoofDraft,
): EstimateDrawingDraft {
  const material = roof.material;
  const pitchDeg = roof.primaryPitchDeg?.trim() ?? '';
  for (const module of draft.inputs.modules) {
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
  return draft;
}

function buildNewDeckDraft(input: {
  deckId: string;
  deckIndex: number;
  hostEdgeId: string;
  housePolygon: Array<{ alongM: string; depthM: string }>;
  mode: 'preset' | 'custom_outline';
}): HouseFirstDeckDraft {
  const baseDeck: HouseFirstDeckDraft = {
    id: input.deckId,
    name: `Deck ${input.deckIndex + 1}`,
    kind: 'deck',
    shape: input.mode === 'custom_outline' ? 'custom' : 'preset',
    presetType: input.mode === 'preset' ? 'rect_attached' : null,
    elevationMode: input.mode === 'preset' ? 'aligned_to_threshold' : 'ground',
    levelOffsetMm: '0',
    hostEdgeId: input.hostEdgeId,
    attachmentMode: input.mode === 'preset' ? 'single_edge' : 'floating',
    primaryHostEdgeId: input.hostEdgeId,
    secondaryHostEdgeId: null,
    cornerVertexId: null,
    isAttached: input.mode === 'preset',
    surfaceMaterial: 'timber_decking',
  };
  if (input.mode === 'custom_outline') {
    return {
      ...baseDeck,
      outline: [],
    };
  }
  return resolveDeckDraftGeometry({
    deck: {
      ...baseDeck,
      presetRect: sanitizeDeckPresetRect({
        housePolygon: input.housePolygon,
        hostEdgeId: input.hostEdgeId,
        attached: true,
        presetRect: null,
      }),
    },
    housePolygon: input.housePolygon,
  });
}

function buildNewOpeningDraft(input: {
  currentOpenings: HouseFirstOpeningDraft[];
  kind: 'window' | 'hinged_door' | 'slider' | 'stacker';
  openingId: string;
  wallId: string;
}): HouseFirstOpeningDraft {
  const baseOpening: HouseFirstOpeningDraft =
    input.kind === 'slider'
      ? {
          id: input.openingId,
          label: `Slider ${
            input.currentOpenings.filter((opening) => normalizeWallOpeningKind(opening.kind) === 'slider').length + 1
          }`,
          kind: 'slider',
          panelCount: 2,
          wallId: input.wallId,
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.6',
        }
      : input.kind === 'stacker'
        ? {
            id: input.openingId,
            label: `Stacker ${
              input.currentOpenings.filter((opening) => normalizeWallOpeningKind(opening.kind) === 'stacker').length +
              1
            }`,
            kind: 'stacker',
            panelCount: null,
            wallId: input.wallId,
            widthM: '3.6',
            heightM: '2.1',
            sillHeightM: '0',
            offsetAlongWallM: '0.6',
          }
        : input.kind === 'hinged_door'
          ? {
              id: input.openingId,
              label: `Door ${
                input.currentOpenings.filter(
                  (opening) => normalizeWallOpeningKind(opening.kind) === 'hinged_door',
                ).length + 1
              }`,
              kind: 'hinged_door',
              panelCount: null,
              wallId: input.wallId,
              widthM: '0.9',
              heightM: '2.1',
              sillHeightM: '0',
              offsetAlongWallM: '0.6',
            }
      : {
          id: input.openingId,
          label: `Window ${
            input.currentOpenings.filter((opening) => normalizeWallOpeningKind(opening.kind) === 'window').length + 1
          }`,
          kind: 'window',
          panelCount: null,
          wallId: input.wallId,
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.6',
        };
  return {
    ...baseOpening,
    panelCount: resolveOpeningPanelCount(input.kind, baseOpening.panelCount),
  };
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
  const runDraftTransaction = useCallback(
    async (transaction: DraftTransaction): Promise<CommitResult> => {
      if (!drawingDraft) return missingDrawingDraftResult();

      const buildResult = transaction.buildNextDraft(structuredClone(drawingDraft));
      if (!buildResult.ok) return buildResult;

      const validationResult = transaction.validateDraft?.(buildResult.draft);
      if (validationResult && !validationResult.ok) return validationResult;

      await persistDrawingDraftLocally(buildResult.draft);
      const sideEffectResult = await transaction.afterPersist?.();
      return sideEffectResult ?? { ok: true };
    },
    [drawingDraft, persistDrawingDraftLocally],
  );

  const runGeometryIntentTransaction = useCallback(
    async (intent: GeometryEditIntent): Promise<CommitResult> => {
      if (!drawingDraft) return missingDrawingDraftResult();

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

  const validateDeckPreview = useCallback(
    (nextDraft: EstimateDrawingDraft, deckId: string): CommitResult => {
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
      return { ok: true };
    },
    [snapshot, ui],
  );

  const selectHouseTarget = useCallback(
    (selection: DrawingWorkbenchUiState['activeHouseSelection']) => {
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab:
            selection.kind === 'deck' ? 'decks' : selection.kind === 'opening' ? 'openings' : 'house_forms',
          activeObjectRef: {
            family:
              selection.kind === 'deck'
                ? 'decks'
                : selection.kind === 'opening'
                  ? 'openings'
                  : 'house_forms',
            objectId:
              selection.kind === 'deck' || selection.kind === 'opening'
                ? selection.targetId ?? null
                : store.derived.house?.id ?? null,
          },
          activeHouseSelection: selection,
        }),
      }));
    },
    [setUi, store.derived.house?.id],
  );

  const clearSelectedHouseTarget = useCallback(
    (kind: DrawingWorkbenchUiState['activeHouseSelection']['kind'], targetId: string) => {
      setUi((current) => ({
        ...current,
        ...(current.activeHouseSelection.kind === kind && current.activeHouseSelection.targetId === targetId
          ? buildDrawingWorkbenchCanonicalSelectionState({
              activeRailTab: current.activeRailTab,
              activeObjectFamily: current.activeObjectFamily,
              activeObjectRef: {
                family: current.activeObjectFamily,
                objectId: null,
              },
              activeHouseSelection:
                current.activeObjectFamily === 'house_forms' ||
                current.activeObjectFamily === 'decks' ||
                current.activeObjectFamily === 'openings'
                  ? { kind: 'house', targetId: null }
                  : current.activeHouseSelection,
              activePergolaId: current.activePergolaId,
            })
          : {
              activeHouseSelection: current.activeHouseSelection,
            }),
      }));
    },
    [setUi],
  );

  const resetDrawOutlineDeckTarget = useCallback(
    (deckId: string) => {
      setDrawOutlineTarget((current) =>
        current.kind === 'deck' && current.deckId === deckId
          ? { kind: 'footprint', deckId: null }
          : current,
      );
    },
    [setDrawOutlineTarget],
  );

  const commitDeckDraftMutation = useCallback(
    async (input: {
      buildNextDecks: (context: DeckMutationInput) => HouseFirstDeckDraft[];
      validateDraft?: (draft: EstimateDrawingDraft) => CommitResult;
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const house = store.derived.house;
          const currentDecks = resolveCurrentDeckDrafts(draft, house);
          const housePolygon = resolveDeckReferencePolygon(house, activeModuleInput);
          const nextDecks = input.buildNextDecks({
            currentDecks,
            housePolygon,
          });
          return {
            ok: true,
            draft: updateEstimateDrawingHouseFirstDeckDrafts({
              draft,
              decks: nextDecks,
            }),
          };
        },
        validateDraft: input.validateDraft,
        afterPersist: input.afterPersist,
      }),
    [activeModuleInput, runDraftTransaction, store.derived.house],
  );

  const commitOpeningDraftMutation = useCallback(
    async (input: {
      buildNextOpenings: (context: OpeningMutationInput) => HouseFirstOpeningDraft[];
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const currentOpenings = resolveCurrentOpeningDrafts(draft, store.derived.house);
          const nextOpenings = input.buildNextOpenings({
            currentOpenings,
          });
          return {
            ok: true,
            draft: updateEstimateDrawingHouseFirstOpeningDrafts({
              draft,
              openings: nextOpenings,
            }),
          };
        },
        afterPersist: input.afterPersist,
      }),
    [runDraftTransaction, store.derived.house],
  );

  const commitSharedHouseFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          let nextDraft = draft;
          for (let moduleIndex = 0; moduleIndex < nextDraft.inputs.modules.length; moduleIndex += 1) {
            const result = applyEstimateDrawingFootprintEdit({
              draft: nextDraft,
              moduleIndex,
              edit,
            });
            if (!result.ok) {
              return {
                ok: false,
                error: result.error,
              };
            }
            nextDraft = result.draft;
          }
          return { ok: true, draft: nextDraft };
        },
      }),
    [runDraftTransaction],
  );

  const commitSharedHouseRoofDraft = useCallback(
    async (roof: HouseFirstRoofDraft): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => ({
          ok: true,
          draft: mirrorSharedRoofDraftToModules(
            updateEstimateDrawingHouseFirstRoofDraft({
              draft,
              roof,
            }),
            roof,
          ),
        }),
      }),
    [runDraftTransaction],
  );

  const commitSharedHouseDeckPatch = useCallback(
    async (deckId: string, patch: Partial<HouseFirstDeckDraft>): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) =>
          applyDeckPatch({
            currentDecks,
            deckId,
            housePolygon,
            patch,
          }),
      }),
    [commitDeckDraftMutation],
  );

  const addSharedHouseDeck = useCallback(
    async (mode: 'preset' | 'custom_outline'): Promise<CommitResult> => {
      const house = store.derived.house;
      if (!house) return missingSharedHouseResult();

      let deckId = '';

      return commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) => {
          deckId = nextDeckId(currentDecks);
          const nextDeck = buildNewDeckDraft({
            deckId,
            deckIndex: currentDecks.length,
            hostEdgeId: house.footprint.attachmentSide ?? 'rear',
            housePolygon,
            mode,
          });
          return [...currentDecks, nextDeck];
        },
        afterPersist: () => {
          if (mode === 'custom_outline') {
            return startDeckOutlineEditor(deckId);
          }
          selectHouseTarget({ kind: 'deck', targetId: deckId });
        },
      });
    },
    [commitDeckDraftMutation, selectHouseTarget, startDeckOutlineEditor, store.derived.house],
  );

  const removeSharedHouseDeck = useCallback(
    async (deckId: string): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks }) => currentDecks.filter((deck) => deck.id !== deckId),
        afterPersist: () => {
          clearSelectedHouseTarget('deck', deckId);
          resetDrawOutlineDeckTarget(deckId);
        },
      }),
    [clearSelectedHouseTarget, commitDeckDraftMutation, resetDrawOutlineDeckTarget],
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

  const commitSharedHouseOpeningPatch = useCallback(
    async (openingId: string, patch: Partial<HouseFirstOpeningDraft>): Promise<CommitResult> =>
      commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) =>
          applyOpeningPatch({
            currentOpenings,
            openingId,
            patch,
          }),
      }),
    [commitOpeningDraftMutation],
  );

  const addSharedHouseOpening = useCallback(
    async (kind: 'window' | 'hinged_door' | 'slider' | 'stacker'): Promise<CommitResult> => {
      const house = store.derived.house;
      if (!house) return missingSharedHouseResult();

      let openingId = '';

      return commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) => {
          openingId = nextOpeningId(currentOpenings);
          return [
            ...currentOpenings,
            buildNewOpeningDraft({
              currentOpenings,
              kind,
              openingId,
              wallId: house.footprint.attachmentSide ?? 'rear',
            }),
          ];
        },
        afterPersist: () => {
          selectHouseTarget({ kind: 'opening', targetId: openingId });
        },
      });
    },
    [commitOpeningDraftMutation, selectHouseTarget, store.derived.house],
  );

  const removeSharedHouseOpening = useCallback(
    async (openingId: string): Promise<CommitResult> =>
      commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) =>
          currentOpenings.filter((opening) => opening.id !== openingId),
        afterPersist: () => {
          clearSelectedHouseTarget('opening', openingId);
        },
      }),
    [clearSelectedHouseTarget, commitOpeningDraftMutation],
  );

  const commitDrawingField = useCallback(
    async (field: EstimateDrawingField, nextValue: string): Promise<CommitResult> => {
      const intent = translateEstimateDrawingFieldToGeometryIntent(field, nextValue);
      if (!intent) {
        return {
          ok: false,
          error: 'This drawing field is not supported in the geometry-backed workbench yet.',
        };
      }
      return runGeometryIntentTransaction(intent);
    },
    [runGeometryIntentTransaction],
  );

  const commitGeometryIntent = useCallback(
    async (intent: GeometryEditIntent): Promise<CommitResult> => runGeometryIntentTransaction(intent),
    [runGeometryIntentTransaction],
  );

  const commitHouseFirstFootprintDimension = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => commitSharedHouseFootprintEdit(edit),
    [commitSharedHouseFootprintEdit],
  );

  const commitHouseFirstDeckDimension = useCallback(
    async (deckId: string, patch: Partial<HouseFirstDeckDraft>): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) =>
          applyDeckPatch({
            currentDecks,
            deckId,
            housePolygon,
            patch,
          }),
        validateDraft: (nextDraft) => validateDeckPreview(nextDraft, deckId),
      }),
    [commitDeckDraftMutation, validateDeckPreview],
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
