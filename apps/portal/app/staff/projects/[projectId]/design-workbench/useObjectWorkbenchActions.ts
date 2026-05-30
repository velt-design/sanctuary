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
  PergolaAttachment,
  WorkbenchObjectRef,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  addHouseFormToObjectFirstDraft,
  removeHouseFormFromObjectFirstDraft,
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchPergolaPatch,
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
  buildNewObjectWorkbenchPergolaDraft,
  buildObjectFirstDraftWithDecks,
  buildObjectFirstDraftWithOpenings,
  buildObjectFirstDraftWithPergolas,
  buildObjectWorkbenchRoofCommitDraft,
  mergeHouseFormRoofIntentAfterFootprintSync,
  nextObjectWorkbenchDeckId,
  nextObjectWorkbenchOpeningId,
  nextObjectWorkbenchPergolaId,
  resolveCurrentObjectWorkbenchDeckDrafts,
  resolveCurrentObjectWorkbenchOpeningDrafts,
  resolveCurrentObjectWorkbenchPergolaDrafts,
  resolveDeckReferencePolygon,
  resolvePreferredNewObjectWorkbenchOpeningHostWall,
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
      // PR-Bug3 (2026-05-25): the preview store is built with `objectFirst: null`,
      // which strips authored additional house forms from the project model rebuild.
      // The previewObjectFirst therefore only carries the synthesized primary
      // (from `buildSharedHouse`). Without explicit preservation, the map below
      // would drop every additional form on every footprint sync — silent data
      // loss when the user resizes House 1.
      //
      // Footprint sync only affects the active pergola's host (the primary
      // today). Additional forms (sleepouts, granny flats) aren't touched by
      // the sync and pass through unchanged. We merge them after the
      // primary-form sync to preserve them.
      const previewHouseFormIds = new Set(
        (previewObjectFirst.houseAssembly?.houseForms ?? []).map((form) => form.id),
      );
      const additionalHouseForms = existingHouseForms.filter(
        (form) => !previewHouseFormIds.has(form.id),
      );
      return {
        ...objectFirstDraft,
        houseAssembly: previewObjectFirst.houseAssembly
          ? {
              ...previewObjectFirst.houseAssembly,
              houseForms: [
                ...previewObjectFirst.houseAssembly.houseForms.map((houseForm, index) => {
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
                ...additionalHouseForms,
              ],
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
            module.solution.sourceKind === 'drawing_module' &&
            module.drawingModule.input.pergolaId === commit.target.objectId
              ? [moduleIndex]
              : [],
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

  const commitHouseFormTransformDelta = useCallback(
    async (input: {
      houseFormId: string;
      deltaXMm: number;
      deltaYMm: number;
    }): Promise<CommitResult> => {
      // Plan-view drag-to-reposition for all house forms.
      // The MoveTool delivers a delta in mm (world coords); we add it to
      // the form's existing transform (which is in metres). Rotation is
      // not touched -- PR12 will add rotation gestures.
      const deltaXM = input.deltaXMm / 1000;
      const deltaYM = input.deltaYMm / 1000;
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const assembly = objectFirstDraft.houseAssembly;
          if (!assembly) {
            return { ok: false, error: 'No house assembly available.' };
          }
          const formIndex = assembly.houseForms.findIndex((form) => form.id === input.houseFormId);
          if (formIndex === -1) {
            return { ok: false, error: `House form ${input.houseFormId} not found.` };
          }
          const current = assembly.houseForms[formIndex]!;
          const nextForms = [...assembly.houseForms];
          nextForms[formIndex] = {
            ...current,
            transform: {
              offsetXM: current.transform.offsetXM + deltaXM,
              offsetYM: current.transform.offsetYM + deltaYM,
              rotationQuarterTurns: current.transform.rotationQuarterTurns,
            },
          };
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                houseAssembly: { ...assembly, houseForms: nextForms },
              },
            }),
          };
        },
      });
    },
    [runDraftTransaction, store],
  );

  const addSharedHouseForm = useCallback(
    async (): Promise<CommitResult> => {
      // PR10: rail "Add structure" button. Clones the active form (or
      // primary if none selected) 10 m east via PR5's
      // `addHouseFormToObjectFirstDraft`, then selects the new form so
      // the inspector and viewports follow.
      if (!houseForm) return missingSharedHouseResult();
      let newFormId: string | null = null;
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextObjectFirst = addHouseFormToObjectFirstDraft({
            draft: objectFirstDraft,
            sourceHouseFormId: houseForm.id,
          });
          newFormId = nextObjectFirst.houseAssembly?.houseForms.at(-1)?.id ?? null;
          return {
            ok: true,
            draft: updateDraftObjectFirst({ draft, objectFirst: nextObjectFirst }),
          };
        },
        afterPersist: () => {
          if (newFormId) {
            selectObjectTarget({ family: 'house_forms', objectId: newFormId });
          }
        },
      });
    },
    [houseForm, runDraftTransaction, selectObjectTarget, store],
  );

  const removeSharedHouseForm = useCallback(
    async (input: { houseFormId: string }): Promise<CommitResult> => {
      // PR-Bug3 (2026-05-25): inverse of `addSharedHouseForm`. Removes the
      // named house form via `removeHouseFormFromObjectFirstDraft` (which
      // refuses to delete when only one form remains, preserving the
      // legacy-compat invariant that every estimate has at least one
      // house). On success, falls back to selecting the primary form so
      // the inspector doesn't strand on a deleted target.
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextObjectFirst = removeHouseFormFromObjectFirstDraft({
            draft: objectFirstDraft,
            houseFormId: input.houseFormId,
          });
          if (nextObjectFirst === objectFirstDraft) {
            return { ok: false, error: 'Cannot remove this house form.' };
          }
          return {
            ok: true,
            draft: updateDraftObjectFirst({ draft, objectFirst: nextObjectFirst }),
          };
        },
        afterPersist: () => {
          const primaryFormId =
            store.derived.houseForms[0]?.id ?? null;
          if (primaryFormId) {
            selectObjectTarget({ family: 'house_forms', objectId: primaryFormId });
          }
        },
      });
    },
    [runDraftTransaction, selectObjectTarget, store],
  );

  const addSharedHouseDeck = useCallback(
    async (mode: 'preset' | 'custom_outline'): Promise<CommitResult> => {
      if (!houseForm) return missingSharedHouseResult();

      let deckId = '';
      // PR-D (2026-05-22): bind the deck to the selected form via the new
      // `attachment` snap reference. `buildNewObjectWorkbenchDeckDraft`
      // writes `attachment.host.objectId = hostHouseFormObjectId`. The
      // `host.edgeId` stays empty until the user drags the deck to a wall
      // (PR-F's snap migration populates it then). For decks added while
      // no form is selected the read path's null-fallback routes the deck
      // to the synthesized primary form.
      const hostHouseFormObjectId = houseForm.id;

      return commitDeckDraftMutation({
        buildNextDecks: ({ currentDecks, housePolygon }) => {
          deckId = nextObjectWorkbenchDeckId(currentDecks);
          const nextDeck = buildNewObjectWorkbenchDeckDraft({
            deckId,
            deckIndex: currentDecks.length,
            hostEdgeId: houseForm.footprint.attachmentSide ?? 'rear',
            housePolygon,
            mode,
            hostHouseFormObjectId,
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

  const addSharedPergola = useCallback(
    async (): Promise<CommitResult> => {
      let newPergolaId: string | null = null;
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentPergolas = resolveCurrentObjectWorkbenchPergolaDrafts(objectFirstDraft);
          const activePergolaId =
            ui.activeObjectFamily === 'pergolas' && ui.activeObjectRef.family === 'pergolas'
              ? ui.activeObjectRef.objectId
              : null;
          newPergolaId = nextObjectWorkbenchPergolaId(currentPergolas);
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: buildObjectFirstDraftWithPergolas({
                objectFirstDraft,
                pergolas: [
                  ...currentPergolas,
                  buildNewObjectWorkbenchPergolaDraft({
                    pergolaId: newPergolaId,
                    currentPergolas,
                    activePergolaId,
                  }),
                ],
              }),
            }),
          };
        },
        afterPersist: () => {
          if (!newPergolaId) return;
          setUi((current) => ({
            ...current,
            activePergolaId: newPergolaId,
            ...buildDrawingWorkbenchObjectSelectionState({
              activeRailTab: 'pergolas',
              activeObjectRef: { family: 'pergolas', objectId: newPergolaId },
            }),
            selection: { kind: 'none', targetId: null },
          }));
        },
      });
    },
    [
      runDraftTransaction,
      setUi,
      store,
      ui.activeObjectFamily,
      ui.activeObjectRef.family,
      ui.activeObjectRef.objectId,
    ],
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
   * Step 8 of the first-class spatial-entities migration. Writes the
   * snap-derived `PergolaAttachment` (host + spatialKind + method) onto the
   * pergola draft. Used by the inspector's Attachment Method picker (a
   * single-field write, no race risk). The pergola edge-drag handler uses
   * the atomic `commitSharedPergolaEdgeDragResult` instead — see below for
   * why.
   */
  const commitSharedPergolaAttachment = useCallback(
    async (pergolaId: string, attachment: PergolaAttachment | null): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch: { attachment },
      });
    },
    [commitObjectWorkbenchPatch, store.derived.objectWorkbench.pergolas],
  );

  /**
   * Atomic commit for the pergola edge-drag result. Combines `position`,
   * `geometry.dimensions.{lengthM,projectionM}`, and `attachment` into a
   * single pergola patch — one transaction, one persist, one re-render.
   *
   * Why atomic: each `commitObjectWorkbenchPatch` call clones the current
   * draft, applies its patch, and persists. When the edge-drag handler
   * fired four separate fire-and-forget commits in the same React tick,
   * each clone read from the SAME pre-tick draft and the last persist won —
   * which made the snap-release "jump back" because position+dimensions
   * landed in one persist while the attachment write (which derives
   * `connection.type` via Step 8 follow-up #1) landed in another, and the
   * later persist dropped the earlier fields.
   *
   * Pass `null` (or omit) to skip a field. The mirror step inside
   * `commitObjectWorkbenchPatch` propagates the dimension fields to the
   * legacy module inputs the solver reads, so callers don't need a
   * separate `commitGeometryIntent` write.
   */
  const commitSharedPergolaEdgeDragResult = useCallback(
    async (
      pergolaId: string,
      fields: {
        position?: { originXMm: number; originYMm: number; rotationDeg: number } | null;
        lengthMm?: number | null;
        projectionMm?: number | null;
        attachment?: PergolaAttachment | null;
      },
    ): Promise<CommitResult> => {
      const currentPergola =
        store.derived.objectWorkbench.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
      if (!currentPergola) {
        return { ok: false, error: 'This pergola is no longer available.' };
      }
      const patch: ObjectWorkbenchPergolaPatch = {};
      if (fields.position !== undefined) {
        patch.position = fields.position
          ? {
              originXMm: String(Math.round(fields.position.originXMm)),
              originYMm: String(Math.round(fields.position.originYMm)),
              rotationDeg: String(fields.position.rotationDeg),
            }
          : null;
      }
      const dimensions: { lengthM?: string; projectionM?: string } = {};
      if (fields.lengthMm != null) {
        dimensions.lengthM = (fields.lengthMm / 1000).toString();
      }
      if (fields.projectionMm != null) {
        dimensions.projectionM = (fields.projectionMm / 1000).toString();
      }
      if (Object.keys(dimensions).length) {
        patch.geometry = { dimensions };
      }
      if (fields.attachment !== undefined) {
        patch.attachment = fields.attachment;
      }
      if (Object.keys(patch).length === 0) {
        return { ok: true };
      }
      return commitObjectWorkbenchPatch({
        target: { family: 'pergolas', objectId: pergolaId },
        patch,
      });
    },
    [commitObjectWorkbenchPatch, store.derived.objectWorkbench.pergolas],
  );

  return {
    addSharedPergola,
    addSharedHouseDeck,
    addSharedHouseForm,
    addSharedHouseOpening,
    commitHouseFormTransformDelta,
    commitDrawingField,
    commitDeckDimension,
    commitGeometryIntent,
    commitHouseFormFootprintDimension,
    commitOpeningDimension,
    commitSharedPergolaAttachment,
    commitSharedPergolaEdgeDragResult,
    commitSharedDeckCustomPolygon,
    commitSharedHouseDeckPatch,
    commitSharedHouseFootprintEdit,
    commitSharedHouseOpeningPatch,
    commitSharedHouseRoofDraft,
    removeSharedHouseDeck,
    removeSharedHouseForm,
    removeSharedHouseOpening,
  };
}
