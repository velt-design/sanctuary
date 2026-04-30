'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  applyObjectWorkbenchGeometryEditIntent,
  translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent,
  type ObjectWorkbenchGeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
  buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget,
  deriveDrawingWorkbenchCompatibilitySelection,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  HouseFormRoofIntentModel,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchPergolaAttachmentStrategy,
  ObjectWorkbenchPergolaConnectionKind,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import {
  applyEstimateDrawingFootprintEdit,
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type { EstimateDetail } from '@/lib/estimates/types';
import type {
  CalculatorHouseFootprintPolygonPoint,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type { CommitResult, DrawOutlineTarget } from './objectWorkbenchClientTypes';
import {
  applyObjectWorkbenchDeckPatch,
  applyObjectWorkbenchOpeningPatch,
  applyObjectWorkbenchPergolaModuleEdits,
  buildNewObjectWorkbenchDeckDraft,
  buildNewObjectWorkbenchOpeningDraft,
  buildObjectFirstDraftWithCompatibilityDecks,
  buildObjectFirstDraftWithCompatibilityOpenings,
  buildObjectFirstDraftWithCompatibilityPergolas,
  buildObjectWorkbenchPergolaZoneLookup,
  buildObjectWorkbenchRoofCommitDraft,
  mergeHouseFormRoofIntentAfterFootprintSync,
  nextObjectWorkbenchDeckId,
  nextObjectWorkbenchOpeningId,
  resolveCurrentObjectWorkbenchDeckDrafts,
  resolveCurrentObjectWorkbenchOpeningDrafts,
  resolveCurrentObjectWorkbenchPergolaDrafts,
  resolveDeckReferencePolygon,
  resolveObjectWorkbenchPergolaZoneKind,
  resolvePreferredNewObjectWorkbenchOpeningHostWall,
  resolvePreferredObjectWorkbenchPergolaZone,
  updateDraftObjectFirst,
  upsertObjectWorkbenchPergolaDrafts,
  type ObjectWorkbenchCompatibilitySelection,
  type ObjectWorkbenchDeckMutationInput,
  type ObjectWorkbenchDraftBuildResult,
  type ObjectWorkbenchOpeningMutationInput,
  type ObjectWorkbenchPergolaMutationInput,
} from './compat/objectWorkbenchDraftActionBridge';

type UseObjectWorkbenchActionsInput = {
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

type DraftBuildResult = ObjectWorkbenchDraftBuildResult;

type DraftTransaction = {
  buildNextDraft: (draft: EstimateDrawingDraft) => DraftBuildResult;
  validateDraft?: (draft: EstimateDrawingDraft) => CommitResult;
  afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
};

type DeckMutationInput = ObjectWorkbenchDeckMutationInput;

type OpeningMutationInput = ObjectWorkbenchOpeningMutationInput;

type PergolaMutationInput = ObjectWorkbenchPergolaMutationInput;

type PergolaAttachmentKind = ObjectWorkbenchPergolaConnectionKind;
type PergolaAttachmentStrategyValue = ObjectWorkbenchPergolaAttachmentStrategy;

function missingDrawingDraftResult(): CommitResult {
  return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
}

function missingSharedHouseResult(): CommitResult {
  return { ok: false, error: 'Shared house context is not available yet.' };
}

function resolveObjectFirstDraft(
  drawingDraft: EstimateDrawingDraft,
  store: ReturnType<typeof buildDrawingWorkbenchStore>,
): ObjectFirstWorkbenchDraftVNext {
  return normalizeObjectFirstWorkbenchDraftVNext(
    drawingDraft.objectFirst ?? buildObjectFirstWorkbenchDraftFromProjectModel(store.persisted.projectModel),
  );
}

export type ObjectWorkbenchActions = ReturnType<typeof useObjectWorkbenchActions>;

export function useObjectWorkbenchActions({
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
}: UseObjectWorkbenchActionsInput) {
  const compatibilityProjectModel = store.persisted.compatibilityBridge.projectModel;
  const compatibilityHouse = compatibilityProjectModel.house;
  const compatibilityPergolas = compatibilityProjectModel.pergolas;
  const activeCompatibilityOpening =
    ui.activeObjectFamily === 'openings'
      ? compatibilityHouse?.openings.find((opening) => opening.id === ui.activeObjectRef.objectId) ?? null
      : null;

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

  const syncHouseAssemblyFromDraftInputs = useCallback(
    (
      draft: EstimateDrawingDraft,
      objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
    ): ObjectFirstWorkbenchDraftVNext => {
      const previewStore = buildDrawingWorkbenchStore({
        snapshot,
        draft: updateEstimateDrawingObjectFirstWorkbenchDraft({ draft, objectFirst: null }),
        ui,
      });
      const previewObjectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(
        previewStore.persisted.projectModel,
      );
      const existingHouseForms = objectFirstDraft.houseAssembly?.houseForms ?? [];
      const terminalEndIds = new Set(
        previewStore.persisted.compatibilityBridge.projectModel.house?.roof.terminalEnds.map((end) => end.id) ?? [],
      );
      return {
        ...objectFirstDraft,
        houseAssembly: previewObjectFirst.houseAssembly
          ? {
              ...previewObjectFirst.houseAssembly,
              houseForms: previewObjectFirst.houseAssembly.houseForms.map((houseForm, index) => {
                const existingHouseForm =
                  existingHouseForms.find((candidate) => candidate.id === houseForm.id) ??
                  existingHouseForms[index] ??
                  null;
                return mergeHouseFormRoofIntentAfterFootprintSync({
                  previewHouseForm: houseForm,
                  existingHouseForm,
                  terminalEndIds,
                });
              }),
            }
          : previewObjectFirst.houseAssembly,
      };
    },
    [snapshot, ui],
  );

  const runGeometryIntentTransaction = useCallback(
    async (intent: ObjectWorkbenchGeometryEditIntent): Promise<CommitResult> => {
      if (!drawingDraft) return missingDrawingDraftResult();

      const result = applyObjectWorkbenchGeometryEditIntent({
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
    [
      drawingDraft,
      persistDrawingDraftLocally,
      snapshot,
      store.derived.activeModuleIndex,
    ],
  );

  const validateDeckPreview = useCallback(
    (nextDraft: EstimateDrawingDraft, deckId: string): CommitResult => {
      const previewStore = buildDrawingWorkbenchStore({
        snapshot,
        draft: nextDraft,
        ui,
      });
      const nextDeck = previewStore.persisted.compatibilityBridge.projectModel.house?.decks.find(
        (deck) => deck.id === deckId,
      );
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
    (selection: ObjectWorkbenchCompatibilitySelection) => {
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget({
          target: selection,
          defaultHouseFormId: store.derived.houseForms[0]?.id ?? null,
        }),
        selection: {
          kind: selection.kind === 'house' ? 'none' : 'geometry',
          targetId: selection.targetId,
          targetKind: selection.kind === 'house' ? undefined : selection.kind,
        },
      }));
    },
    [setUi, store.derived.houseForms],
  );

  const clearSelectedHouseTarget = useCallback(
    (kind: ObjectWorkbenchCompatibilitySelection['kind'], targetId: string) => {
      setUi((current) => {
        const compatibilitySelection = deriveDrawingWorkbenchCompatibilitySelection(current);
        if (
          compatibilitySelection.activeHouseSelection.kind !== kind ||
          compatibilitySelection.activeHouseSelection.targetId !== targetId
        ) {
          return current;
        }
        return {
          ...current,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: current.activeRailTab,
            activeObjectFamily: current.activeObjectFamily,
            activeObjectRef: {
              family: current.activeObjectFamily,
              objectId: null,
            },
          }),
          selection: { kind: 'none', targetId: null },
        };
      });
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
      buildNextDecks: (context: DeckMutationInput) => DeckMutationInput['currentDecks'];
      validateDraft?: (draft: EstimateDrawingDraft) => CommitResult;
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentDecks = resolveCurrentObjectWorkbenchDeckDrafts(objectFirstDraft);
          const housePolygon = resolveDeckReferencePolygon(compatibilityHouse, activeModuleInput);
          const nextDecks = input.buildNextDecks({
            currentDecks,
            housePolygon,
          });
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: buildObjectFirstDraftWithCompatibilityDecks({
                objectFirstDraft,
                decks: nextDecks,
              }),
            }),
          };
        },
        validateDraft: input.validateDraft,
        afterPersist: input.afterPersist,
      }),
    [activeModuleInput, compatibilityHouse, runDraftTransaction, store],
  );

  const commitOpeningDraftMutation = useCallback(
    async (input: {
      buildNextOpenings: (context: OpeningMutationInput) => OpeningMutationInput['currentOpenings'];
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentOpenings = resolveCurrentObjectWorkbenchOpeningDrafts(objectFirstDraft);
          const nextOpenings = input.buildNextOpenings({
            currentOpenings,
          });
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: buildObjectFirstDraftWithCompatibilityOpenings({
                objectFirstDraft,
                openings: nextOpenings,
                sourceFormId: store.derived.activeHouseForm?.id ?? compatibilityHouse?.id ?? null,
              }),
            }),
          };
        },
        afterPersist: input.afterPersist,
      }),
    [compatibilityHouse?.id, runDraftTransaction, store],
  );

  const commitPergolaDraftMutation = useCallback(
    async (input: {
      pergolaId: string;
      buildNextPergolas: (context: PergolaMutationInput) => DraftBuildResult;
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentPergolas = resolveCurrentObjectWorkbenchPergolaDrafts(objectFirstDraft);
          const currentPergola =
            compatibilityPergolas.find((pergola) => pergola.id === input.pergolaId) ?? null;
          if (!currentPergola) {
            return {
              ok: false,
              error: 'This pergola is no longer available.',
            };
          }
          return input.buildNextPergolas({
            draft,
            currentPergolas,
            currentPergola,
          });
        },
        afterPersist: input.afterPersist,
      }),
    [compatibilityPergolas, runDraftTransaction, store],
  );

  const commitSharedHouseFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
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
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft: nextDraft,
              objectFirst: syncHouseAssemblyFromDraftInputs(nextDraft, objectFirstDraft),
            }),
          };
        },
      }),
    [runDraftTransaction, store, syncHouseAssemblyFromDraftInputs],
  );

  const commitSharedHouseRoofDraft = useCallback(
    async (roof: HouseFormRoofIntentModel): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          return {
            ok: true,
            draft: buildObjectWorkbenchRoofCommitDraft({
              draft,
              objectFirstDraft,
              roof,
            }),
          };
        },
      }),
    [runDraftTransaction, store],
  );

  const commitSharedHouseDeckPatch = useCallback(
    async (deckId: string, patch: ObjectWorkbenchDeckPatch): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) =>
          applyObjectWorkbenchDeckPatch({
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
      const house = compatibilityHouse;
      if (!house) return missingSharedHouseResult();

      let deckId = '';

      return commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) => {
          deckId = nextObjectWorkbenchDeckId(currentDecks);
          const nextDeck = buildNewObjectWorkbenchDeckDraft({
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
    [commitDeckDraftMutation, compatibilityHouse, selectHouseTarget, startDeckOutlineEditor],
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
    async (openingId: string, patch: ObjectWorkbenchOpeningPatch): Promise<CommitResult> =>
      commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) =>
          applyObjectWorkbenchOpeningPatch({
            activeModuleInput,
            currentOpenings,
            openingId,
            houseAssembly: store.derived.houseAssembly,
            house: compatibilityHouse,
            patch,
          }),
      }),
    [activeModuleInput, commitOpeningDraftMutation, compatibilityHouse, store.derived.houseAssembly],
  );

  const addSharedHouseOpening = useCallback(
    async (kind: 'window' | 'hinged_door' | 'slider' | 'stacker'): Promise<CommitResult> => {
      const house = compatibilityHouse;
      if (!house) return missingSharedHouseResult();

      let openingId = '';

      return commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) => {
          openingId = nextObjectWorkbenchOpeningId(currentOpenings);
          const preferredWall = resolvePreferredNewObjectWorkbenchOpeningHostWall({
            activeModuleInput,
            houseAssembly: store.derived.houseAssembly,
            house,
            preferredHostWallId: activeCompatibilityOpening?.hostWallId ?? null,
            preferredSide: house.footprint.attachmentSide ?? 'rear',
          });
          return [
            ...currentOpenings,
            buildNewObjectWorkbenchOpeningDraft({
              currentOpenings,
              kind,
              openingId,
              hostWallId: preferredWall?.wallId ?? null,
              hostEdgeId: preferredWall?.hostEdgeId ?? null,
              wallId: preferredWall?.semanticSide ?? house.footprint.attachmentSide ?? 'rear',
            }),
          ];
        },
        afterPersist: () => {
          selectHouseTarget({ kind: 'opening', targetId: openingId });
        },
      });
    },
    [
      activeModuleInput,
      activeCompatibilityOpening?.hostWallId,
      commitOpeningDraftMutation,
      compatibilityHouse,
      selectHouseTarget,
      store.derived.houseAssembly,
    ],
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

  const commitSharedPergolaConnectionKind = useCallback(
    async (pergolaId: string, kind: PergolaAttachmentKind): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          const nextZone =
            kind === 'freestanding'
              ? null
              : resolvePreferredObjectWorkbenchPergolaZone({
                  houseAssembly: store.derived.houseAssembly,
                  currentPergola,
                  nextKind: kind,
                });
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: nextZone?.hostEdgeId ?? null,
            attachmentZoneId: nextZone?.id ?? null,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithCompatibilityPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
              compatibilityPergolas,
              mapPergola: (pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: nextZone?.side ?? pergola.side,
                    }
                  : pergola,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
            kind,
            side: nextZone?.side ?? null,
          });
        },
      }),
    [commitPergolaDraftMutation, compatibilityPergolas, store],
  );

  const commitSharedPergolaAttachmentEdge = useCallback(
    async (pergolaId: string, edgeId: string): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          if (currentPergola.attachment.kind === 'freestanding') {
            return {
              ok: false,
              error: 'Switch this pergola to an attached connection before selecting a host edge.',
            };
          }
          const nextZone = resolvePreferredObjectWorkbenchPergolaZone({
            houseAssembly: store.derived.houseAssembly,
            currentPergola,
            nextKind: currentPergola.attachment.kind,
            preferredEdgeId: edgeId,
          });
          if (!nextZone || nextZone.hostEdgeId !== edgeId) {
            return {
              ok: false,
              error: 'The selected host edge does not expose a compatible derived attachment zone.',
            };
          }
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: edgeId,
            attachmentZoneId: nextZone.id,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithCompatibilityPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
              compatibilityPergolas,
              mapPergola: (pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: nextZone.side,
                    }
                  : pergola,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
            side: nextZone.side,
          });
        },
      }),
    [commitPergolaDraftMutation, compatibilityPergolas, store],
  );

  const commitSharedPergolaAttachmentZone = useCallback(
    async (pergolaId: string, zoneId: string): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          const zone = buildObjectWorkbenchPergolaZoneLookup(store.derived.houseAssembly).get(zoneId) ?? null;
          if (!zone || zone.hostEdgeId === null) {
            return {
              ok: false,
              error: 'The selected derived host zone is no longer available.',
            };
          }
          if (currentPergola.attachment.kind !== 'freestanding') {
            const expectedKind = resolveObjectWorkbenchPergolaZoneKind(currentPergola.attachment.kind);
            if (zone.kind !== expectedKind) {
              return {
                ok: false,
                error: 'The selected host zone does not match this pergola connection type.',
              };
            }
          }
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: zone.hostEdgeId,
            attachmentZoneId: zone.id,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithCompatibilityPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
              compatibilityPergolas,
              mapPergola: (pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: zone.side,
                    }
                  : pergola,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
            side: zone.side,
          });
        },
      }),
    [commitPergolaDraftMutation, compatibilityPergolas, store],
  );

  const commitSharedPergolaAttachmentStrategy = useCallback(
    async (pergolaId: string, strategy: PergolaAttachmentStrategyValue): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithCompatibilityPergolas({
              objectFirstDraft,
              pergolas: upsertObjectWorkbenchPergolaDrafts(currentPergolas, pergolaId, {}),
              compatibilityPergolas,
              mapPergola: (pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      strategy: strategy === 'auto' ? null : strategy,
                    }
                  : pergola,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
            strategy,
          });
        },
      }),
    [commitPergolaDraftMutation, compatibilityPergolas, store],
  );

  const commitDrawingField = useCallback(
    async (field: EstimateDrawingField, nextValue: string): Promise<CommitResult> => {
      const intent = translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent(field, nextValue);
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
    async (intent: ObjectWorkbenchGeometryEditIntent): Promise<CommitResult> => runGeometryIntentTransaction(intent),
    [runGeometryIntentTransaction],
  );

  const commitHouseFormFootprintDimension = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => commitSharedHouseFootprintEdit(edit),
    [commitSharedHouseFootprintEdit],
  );

  const commitDeckDimension = useCallback(
    async (deckId: string, patch: ObjectWorkbenchDeckPatch): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) =>
          applyObjectWorkbenchDeckPatch({
            currentDecks,
            deckId,
            housePolygon,
            patch,
          }),
        validateDraft: (nextDraft) => validateDeckPreview(nextDraft, deckId),
      }),
    [commitDeckDraftMutation, validateDeckPreview],
  );

  const commitOpeningDimension = useCallback(
    async (openingId: string, patch: ObjectWorkbenchOpeningPatch): Promise<CommitResult> =>
      commitSharedHouseOpeningPatch(openingId, patch),
    [commitSharedHouseOpeningPatch],
  );

  return {
    addSharedHouseDeck,
    addSharedHouseOpening,
    commitDrawingField,
    commitDeckDimension,
    commitGeometryIntent,
    commitHouseFormFootprintDimension,
    commitOpeningDimension,
    commitSharedPergolaAttachmentEdge,
    commitSharedPergolaAttachmentStrategy,
    commitSharedPergolaAttachmentZone,
    commitSharedPergolaConnectionKind,
    commitSharedDeckCustomPolygon,
    commitSharedHouseDeckPatch,
    commitSharedHouseFootprintEdit,
    commitSharedHouseOpeningPatch,
    commitSharedHouseRoofDraft,
    removeSharedHouseDeck,
    removeSharedHouseOpening,
  };
}
