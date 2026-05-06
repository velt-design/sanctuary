'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  applyObjectWorkbenchGeometryEditIntent,
  buildObjectWorkbenchPergolaPatchFromGeometryIntent,
  mirrorObjectWorkbenchPergolaPatchToTemporaryGeometryModuleFields,
  translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent,
  type ObjectWorkbenchGeometryEditIntent,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  HouseFormRoofIntentModel,
  ObjectFirstWorkbenchDraftVNext,
  WorkbenchObjectRef,
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
  applyObjectWorkbenchPergolaPatch,
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
  type ObjectWorkbenchDeckMutationInput,
  type ObjectWorkbenchDraftBuildResult,
  type ObjectWorkbenchObjectPatchCommit,
  type ObjectWorkbenchOpeningMutationInput,
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

type PergolaAttachmentKind = ObjectWorkbenchPergolaConnectionKind;
type PergolaAttachmentStrategyValue = ObjectWorkbenchPergolaAttachmentStrategy;
type DeckPatchCommit = Extract<ObjectWorkbenchObjectPatchCommit, { target: { family: 'decks' } }>;
type OpeningPatchCommit = Extract<ObjectWorkbenchObjectPatchCommit, { target: { family: 'openings' } }>;
type PergolaPatchCommit = Extract<ObjectWorkbenchObjectPatchCommit, { target: { family: 'pergolas' } }>;

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

function isDeckPatchCommit(commit: ObjectWorkbenchObjectPatchCommit): commit is DeckPatchCommit {
  return commit.target.family === 'decks';
}

function isOpeningPatchCommit(commit: ObjectWorkbenchObjectPatchCommit): commit is OpeningPatchCommit {
  return commit.target.family === 'openings';
}

function isPergolaPatchCommit(commit: ObjectWorkbenchObjectPatchCommit): commit is PergolaPatchCommit {
  return commit.target.family === 'pergolas';
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

  const commitObjectWorkbenchPatch = useCallback(
    async (
      commit: ObjectWorkbenchObjectPatchCommit,
      options: Pick<DraftTransaction, 'validateDraft' | 'afterPersist'> = {},
    ): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);

          if (isDeckPatchCommit(commit)) {
            const currentDecks = resolveCurrentObjectWorkbenchDeckDrafts(objectFirstDraft);
            if (!currentDecks.some((deck) => deck.id === commit.target.objectId)) {
              return { ok: false, error: 'This deck is no longer available.' };
            }
            const housePolygon = resolveDeckReferencePolygon(houseForm, activeModuleInput);
            return {
              ok: true,
              draft: updateDraftObjectFirst({
                draft,
                objectFirst: buildObjectFirstDraftWithDecks({
                  objectFirstDraft,
                  decks: applyObjectWorkbenchDeckPatch({
                    currentDecks,
                    deckId: commit.target.objectId,
                    housePolygon,
                    patch: commit.patch,
                  }),
                }),
              }),
            };
          }

          if (isOpeningPatchCommit(commit)) {
            const currentOpenings = resolveCurrentObjectWorkbenchOpeningDrafts(objectFirstDraft);
            if (!currentOpenings.some((opening) => opening.id === commit.target.objectId)) {
              return { ok: false, error: 'This opening is no longer available.' };
            }
            return {
              ok: true,
              draft: updateDraftObjectFirst({
                draft,
                objectFirst: buildObjectFirstDraftWithOpenings({
                  objectFirstDraft,
                  openings: applyObjectWorkbenchOpeningPatch({
                    activeModuleInput,
                    currentOpenings,
                    openingId: commit.target.objectId,
                    houseAssembly: store.derived.houseAssembly,
                    houseForm,
                    patch: commit.patch,
                  }),
                  sourceFormId: houseForm?.id ?? null,
                }),
              }),
            };
          }

          if (!isPergolaPatchCommit(commit)) {
            return { ok: false, error: 'This object patch target is not supported yet.' };
          }

          const currentPergolas = resolveCurrentObjectWorkbenchPergolaDrafts(objectFirstDraft);
          const currentPergola =
            store.derived.objectWorkbench.pergolas.find(
              (pergola) => pergola.id === commit.target.objectId,
            ) ?? null;
          if (!currentPergola) {
            return { ok: false, error: 'This pergola is no longer available.' };
          }
          const moduleIndexes = store.persisted.modules.flatMap((module, moduleIndex) =>
            module.drawingModule.input.pergolaId === commit.target.objectId ? [moduleIndex] : [],
          );
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: buildObjectFirstDraftWithPergolas({
              objectFirstDraft,
              pergolas: applyObjectWorkbenchPergolaPatch({
                currentPergolas,
                pergolaId: commit.target.objectId,
                patch: commit.patch,
                fallbackPergola: currentPergola,
              }),
            }),
          });
          const mirrorResult = mirrorObjectWorkbenchPergolaPatchToTemporaryGeometryModuleFields({
            snapshot,
            draft: nextDraft,
            moduleIndexes,
            patch: commit.patch,
          });
          if (!mirrorResult.ok) {
            return {
              ok: false,
              error: mirrorResult.message,
            };
          }
          return {
            ok: true,
            draft: mirrorResult.draft,
          };
        },
        validateDraft: options.validateDraft,
        afterPersist: options.afterPersist,
      }),
    [
      activeModuleInput,
      houseForm,
      houseForm?.id,
      runDraftTransaction,
      snapshot,
      store,
    ],
  );

  const runGeometryIntentTransaction = useCallback(
    async (intent: ObjectWorkbenchGeometryEditIntent): Promise<CommitResult> => {
      const activePergolaId =
        ui.activeObjectFamily === 'pergolas' && ui.activeObjectRef.family === 'pergolas'
          ? ui.activeObjectRef.objectId
          : null;
      const pergolaPatch = activePergolaId
        ? buildObjectWorkbenchPergolaPatchFromGeometryIntent(intent)
        : null;
      if (activePergolaId && pergolaPatch) {
        return commitObjectWorkbenchPatch({
          target: { family: 'pergolas', objectId: activePergolaId },
          patch: pergolaPatch,
        });
      }

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
      commitObjectWorkbenchPatch,
      drawingDraft,
      persistDrawingDraftLocally,
      snapshot,
      store.derived.activeModuleIndex,
      ui.activeObjectFamily,
      ui.activeObjectRef.family,
      ui.activeObjectRef.objectId,
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

  const selectObjectTarget = useCallback(
    (ref: WorkbenchObjectRef) => {
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchObjectSelectionState({
          activeRailTab: ref.family,
          activeObjectRef: ref,
        }),
        selection:
          ref.family === 'decks'
            ? { kind: 'geometry', targetId: ref.objectId, targetKind: 'deck' }
            : ref.family === 'openings'
              ? { kind: 'geometry', targetId: ref.objectId, targetKind: 'opening' }
              : { kind: 'none', targetId: null },
      }));
    },
    [setUi],
  );

  const clearSelectedObjectTarget = useCallback(
    (family: WorkbenchObjectRef['family'], targetId: string) => {
      setUi((current) => {
        if (current.activeObjectRef.family !== family || current.activeObjectRef.objectId !== targetId) {
          return current;
        }
        return {
          ...current,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: current.activeRailTab,
            activeObjectFamily: current.activeObjectFamily,
            activeObjectRef: {
              family,
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
      commitObjectWorkbenchPatch({
        target: { family: 'decks', objectId: deckId },
        patch,
      }),
    [commitObjectWorkbenchPatch],
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
          selectObjectTarget({ family: 'decks', objectId: deckId });
        },
      });
    },
    [commitDeckDraftMutation, houseForm, selectObjectTarget, startDeckOutlineEditor],
  );

  const removeSharedHouseDeck = useCallback(
    async (deckId: string): Promise<CommitResult> =>
      commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks }) => currentDecks.filter((deck) => deck.id !== deckId),
        afterPersist: () => {
          clearSelectedObjectTarget('decks', deckId);
          resetDrawOutlineDeckTarget(deckId);
        },
      }),
    [clearSelectedObjectTarget, commitDeckDraftMutation, resetDrawOutlineDeckTarget],
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
      commitObjectWorkbenchPatch({
        target: { family: 'openings', objectId: openingId },
        patch,
      }),
    [commitObjectWorkbenchPatch],
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
          selectObjectTarget({ family: 'openings', objectId: openingId });
        },
      });
    },
    [
      activeModuleInput,
      activeObjectWorkbenchOpening?.hostWallId,
      commitOpeningDraftMutation,
      houseForm,
      selectObjectTarget,
      store.derived.houseAssembly,
    ],
  );

  const removeSharedHouseOpening = useCallback(
    async (openingId: string): Promise<CommitResult> =>
      commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) =>
          currentOpenings.filter((opening) => opening.id !== openingId),
        afterPersist: () => {
          clearSelectedObjectTarget('openings', openingId);
        },
      }),
    [clearSelectedObjectTarget, commitOpeningDraftMutation],
  );

  const commitSharedPergolaConnectionKind = useCallback(
    async (pergolaId: string, kind: PergolaAttachmentKind): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
      const nextZone =
        kind === 'freestanding'
          ? null
          : resolvePreferredObjectWorkbenchPergolaZone({
              houseAssembly: store.derived.houseAssembly,
              currentPergola,
              nextKind: kind,
            });
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: {
          connectionKind: kind,
          attachmentEdgeId: nextZone?.hostEdgeId ?? null,
          attachmentZoneId: nextZone?.id ?? null,
          ...(nextZone?.side ? { side: nextZone.side } : null),
        },
      });
    },
    [commitObjectWorkbenchPatch, store.derived.houseAssembly, store.derived.objectWorkbench.pergolas],
  );

  const commitSharedPergolaAttachmentEdge = useCallback(
    async (pergolaId: string, edgeId: string): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
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
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: {
          attachmentEdgeId: edgeId,
          attachmentZoneId: nextZone.id,
          side: nextZone.side,
        },
      });
    },
    [commitObjectWorkbenchPatch, store.derived.houseAssembly, store.derived.objectWorkbench.pergolas],
  );

  const commitSharedPergolaAttachmentZone = useCallback(
    async (pergolaId: string, zoneId: string): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
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
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: {
          attachmentEdgeId: zone.hostEdgeId,
          attachmentZoneId: zone.id,
          side: zone.side,
        },
      });
    },
    [commitObjectWorkbenchPatch, store.derived.houseAssembly, store.derived.objectWorkbench.pergolas],
  );

  const commitSharedPergolaAttachmentStrategy = useCallback(
    async (pergolaId: string, strategy: PergolaAttachmentStrategyValue): Promise<CommitResult> =>
      commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: {
          strategy: strategy === 'auto' ? null : strategy,
        },
      }),
    [commitObjectWorkbenchPatch],
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
      commitObjectWorkbenchPatch(
        {
          target: { family: 'decks', objectId: deckId },
          patch,
        },
        {
          validateDraft: (nextDraft) => validateDeckPreview(nextDraft, deckId),
        },
      ),
    [commitObjectWorkbenchPatch, validateDeckPreview],
  );

  const commitOpeningDimension = useCallback(
    async (openingId: string, patch: ObjectWorkbenchOpeningPatch): Promise<CommitResult> =>
      commitSharedHouseOpeningPatch(openingId, patch),
    [commitSharedHouseOpeningPatch],
  );

  /**
   * Phase 2 free-floating-objects (Slice C): write a per-object world position
   * onto the pergola. Once set, geometry treats the pergola as free-floating —
   * it ignores the connection-driven datum and sits at this position regardless
   * of subsequent house-footprint edits.
   *
   * Position values are millimetres (string-encoded for parity with the rest
   * of the persisted draft).
   */
  const commitSharedPergolaPosition = useCallback(
    async (
      pergolaId: string,
      position: { originXMm: number; originYMm: number; rotationDeg: number },
    ): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: {
          position: {
            originXMm: String(Math.round(position.originXMm)),
            originYMm: String(Math.round(position.originYMm)),
            rotationDeg: String(position.rotationDeg),
          },
        },
      });
    },
    [commitObjectWorkbenchPatch, store.derived.objectWorkbench.pergolas],
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
    commitSharedPergolaPosition,
    commitSharedDeckCustomPolygon,
    commitSharedHouseDeckPatch,
    commitSharedHouseFootprintEdit,
    commitSharedHouseOpeningPatch,
    commitSharedHouseRoofDraft,
    removeSharedHouseDeck,
    removeSharedHouseOpening,
  };
}
