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
  buildObjectFirstDraftWithDecks,
  buildObjectFirstDraftWithOpenings,
  buildObjectFirstDraftWithPergolas,
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
} from './objectWorkbenchDraftActions';

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
  const houseForm = store.derived.activeHouseForm ?? store.derived.houseForms[0] ?? null;
  const activeObjectWorkbenchOpening =
    ui.activeObjectFamily === 'openings'
      ? store.derived.objectWorkbench.openings.find((opening) => opening.id === ui.activeObjectRef.objectId) ?? null
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
        previewStore.derived.objectWorkbench.houseForm.roof.terminalEnds.map((end) => end.id),
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
      const nextDeck = previewStore.derived.objectWorkbench.decks.find(
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
          const housePolygon = resolveDeckReferencePolygon(houseForm, activeModuleInput);
          const nextDecks = input.buildNextDecks({
            currentDecks,
            housePolygon,
          });
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: buildObjectFirstDraftWithDecks({
                objectFirstDraft,
                decks: nextDecks,
              }),
            }),
          };
        },
        validateDraft: input.validateDraft,
        afterPersist: input.afterPersist,
      }),
    [activeModuleInput, houseForm, runDraftTransaction, store],
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
              objectFirst: buildObjectFirstDraftWithOpenings({
                objectFirstDraft,
                openings: nextOpenings,
                sourceFormId: houseForm?.id ?? null,
              }),
            }),
          };
        },
        afterPersist: input.afterPersist,
      }),
    [houseForm?.id, runDraftTransaction, store],
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
            store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === input.pergolaId) ?? null;
          if (!currentPergola) {
            return {
              ok: false,
              error: 'This pergola is no longer available.',
            };
          }
          const moduleIndexes = store.persisted.modules.flatMap((module, moduleIndex) =>
            module.drawingModule.input.pergolaId === input.pergolaId ? [moduleIndex] : [],
          );
          return input.buildNextPergolas({
            draft,
            currentPergolas,
            currentPergola,
            moduleIndexes,
          });
        },
        afterPersist: input.afterPersist,
      }),
    [runDraftTransaction, store],
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
      if (!houseForm) return missingSharedHouseResult();

      let deckId = '';

      return commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) => {
          deckId = nextObjectWorkbenchDeckId(currentDecks);
          const nextDeck = buildNewObjectWorkbenchDeckDraft({
            deckId,
            deckIndex: currentDecks.length,
            hostEdgeId: houseForm.footprint.attachmentSide ?? 'rear',
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
    [commitDeckDraftMutation, houseForm, selectHouseTarget, startDeckOutlineEditor],
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
            houseForm,
            patch,
          }),
      }),
    [activeModuleInput, commitOpeningDraftMutation, houseForm, store.derived.houseAssembly],
  );

  const addSharedHouseOpening = useCallback(
    async (kind: 'window' | 'hinged_door' | 'slider' | 'stacker'): Promise<CommitResult> => {
      if (!houseForm) return missingSharedHouseResult();

      let openingId = '';

      return commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) => {
          openingId = nextObjectWorkbenchOpeningId(currentOpenings);
          const preferredWall = resolvePreferredNewObjectWorkbenchOpeningHostWall({
            activeModuleInput,
            houseAssembly: store.derived.houseAssembly,
            houseForm,
            preferredHostWallId: activeObjectWorkbenchOpening?.hostWallId ?? null,
            preferredSide: houseForm.footprint.attachmentSide ?? 'rear',
          });
          return [
            ...currentOpenings,
            buildNewObjectWorkbenchOpeningDraft({
              currentOpenings,
              kind,
              openingId,
              sourceFormId: houseForm.id,
              hostWallId: preferredWall?.wallId ?? null,
              hostEdgeId: preferredWall?.hostEdgeId ?? null,
              wallId: preferredWall?.semanticSide ?? houseForm.footprint.attachmentSide ?? 'rear',
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
      activeObjectWorkbenchOpening?.hostWallId,
      commitOpeningDraftMutation,
      houseForm,
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
        buildNextPergolas: ({ draft, currentPergolas, currentPergola, moduleIndexes }) => {
          const nextZone =
            kind === 'freestanding'
              ? null
              : resolvePreferredObjectWorkbenchPergolaZone({
                  houseAssembly: store.derived.houseAssembly,
                  currentPergola,
                  nextKind: kind,
                });
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(
            currentPergolas,
            pergolaId,
            {
              attachmentEdgeId: nextZone?.hostEdgeId ?? null,
              attachmentZoneId: nextZone?.id ?? null,
              ...(nextZone?.side ? { side: nextZone.side } : null),
            },
            currentPergola,
          );
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes,
            kind,
            side: nextZone?.side ?? null,
          });
        },
      }),
    [commitPergolaDraftMutation, store],
  );

  const commitSharedPergolaAttachmentEdge = useCallback(
    async (pergolaId: string, edgeId: string): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola, moduleIndexes }) => {
          if (currentPergola.connectionKind === 'freestanding') {
            return {
              ok: false,
              error: 'Switch this pergola to an attached connection before selecting a host edge.',
            };
          }
          const nextZone = resolvePreferredObjectWorkbenchPergolaZone({
            houseAssembly: store.derived.houseAssembly,
            currentPergola,
            nextKind: currentPergola.connectionKind,
            preferredEdgeId: edgeId,
          });
          if (!nextZone || nextZone.hostEdgeId !== edgeId) {
            return {
              ok: false,
              error: 'The selected host edge does not expose a compatible derived attachment zone.',
            };
          }
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(
            currentPergolas,
            pergolaId,
            {
              attachmentEdgeId: edgeId,
              attachmentZoneId: nextZone.id,
              side: nextZone.side,
            },
            currentPergola,
          );
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes,
            side: nextZone.side,
          });
        },
      }),
    [commitPergolaDraftMutation, store],
  );

  const commitSharedPergolaAttachmentZone = useCallback(
    async (pergolaId: string, zoneId: string): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola, moduleIndexes }) => {
          const zone = buildObjectWorkbenchPergolaZoneLookup(store.derived.houseAssembly).get(zoneId) ?? null;
          if (!zone || zone.hostEdgeId === null) {
            return {
              ok: false,
              error: 'The selected derived host zone is no longer available.',
            };
          }
          if (currentPergola.connectionKind !== 'freestanding') {
            const expectedKind = resolveObjectWorkbenchPergolaZoneKind(currentPergola.connectionKind);
            if (zone.kind !== expectedKind) {
              return {
                ok: false,
                error: 'The selected host zone does not match this pergola connection type.',
              };
            }
          }
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(
            currentPergolas,
            pergolaId,
            {
              attachmentEdgeId: zone.hostEdgeId,
              attachmentZoneId: zone.id,
              side: zone.side,
            },
            currentPergola,
          );
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes,
            side: zone.side,
          });
        },
      }),
    [commitPergolaDraftMutation, store],
  );

  const commitSharedPergolaAttachmentStrategy = useCallback(
    async (pergolaId: string, strategy: PergolaAttachmentStrategyValue): Promise<CommitResult> =>
      commitPergolaDraftMutation({
        pergolaId,
        buildNextPergolas: ({ draft, currentPergolas, currentPergola, moduleIndexes }) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextPergolas = upsertObjectWorkbenchPergolaDrafts(
            currentPergolas,
            pergolaId,
            {
              strategy: strategy === 'auto' ? null : strategy,
            },
            currentPergola,
          );
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithPergolas({
              objectFirstDraft,
              pergolas: nextPergolas,
            }),
          });
          return applyObjectWorkbenchPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes,
            strategy,
          });
        },
      }),
    [commitPergolaDraftMutation, store],
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
