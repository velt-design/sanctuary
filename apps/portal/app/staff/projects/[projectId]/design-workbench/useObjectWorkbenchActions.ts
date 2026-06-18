'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  HouseFormModel,
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
  nextHouseFormId,
  removeHouseFormFromObjectFirstDraft,
  buildObjectFirstWorkbenchDraftFromProjectModel,
  resolveNextHouseFormIdAfterRemoval,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import {
  detachHouseFormAtSeam as detachHouseFormAtSeamGeometry,
  joinTwoHouseForms,
  type HouseComposition,
} from '@sp/geometry';
import { deriveHouseFormDisplayLabel } from '@/lib/drawings/state/houseFormDisplayLabel';
import { rebasePartitionIntoOwnFrame } from '@/lib/drawings/state/houseFormCompositionDetach';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchPergolaPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import {
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import { applyHouseFormFootprintEdit } from './houseFormFootprintDraftActions';
import {
  buildHouseFormRoofIntentCommitDraft,
} from './houseFormRoofDraftActions';
import {
  resolveObjectOwnedHouseActionContext,
  resolveSelectedHouseActionContext,
} from './objectWorkbenchActionContext';
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
  drawingDraft: EstimateDrawingDraft | null;
  drawOutlineTarget: DrawOutlineTarget;
  persistDrawingDraftLocally: (nextDraft: EstimateDrawingDraft) => Promise<void>;
  setDrawOutlineTarget: Dispatch<SetStateAction<DrawOutlineTarget>>;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
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
  drawingDraft,
  drawOutlineTarget,
  persistDrawingDraftLocally,
  setDrawOutlineTarget,
  setUi,
  startDeckOutlineEditor,
  store,
  ui,
}: UseObjectWorkbenchActionsInput) {
  const selectedHouseContext = resolveSelectedHouseActionContext({
    activeObjectRef: ui.activeObjectRef,
    houseForms: store.derived.houseForms,
  });
  const selectedHouseForm = selectedHouseContext?.houseForm ?? null;
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
            const resolvedHouse = resolveObjectOwnedHouseActionContext({
              target: commit.target,
              houseForms: store.derived.houseForms,
              decks: currentDecks,
            });
            const housePolygon = resolveDeckReferencePolygon(resolvedHouse?.houseForm ?? null);
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
            const resolvedHouse = resolveObjectOwnedHouseActionContext({
              target: commit.target,
              houseForms: store.derived.houseForms,
              openings: currentOpenings,
            });
            if (!resolvedHouse) {
              return { ok: false, error: 'Opening host house form is not available.' };
            }
            return {
              ok: true,
              draft: updateDraftObjectFirst({
                draft,
                objectFirst: buildObjectFirstDraftWithOpenings({
                  objectFirstDraft,
                  openings: applyObjectWorkbenchOpeningPatch({
                    currentOpenings,
                    openingId: commit.target.objectId,
                    houseAssembly: store.derived.houseAssembly,
                    houseForm: resolvedHouse.houseForm,
                    patch: commit.patch,
                  }),
                  sourceFormId: resolvedHouse.houseForm.id,
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
          return {
            ok: true,
            draft: nextDraft,
          };
        },
        validateDraft: options.validateDraft,
        afterPersist: options.afterPersist,
      }),
    [
      runDraftTransaction,
      store,
    ],
  );

  const runGeometryIntentTransaction = useCallback(
    async (_intent: unknown): Promise<CommitResult> => ({
      ok: false,
      error: 'Generic drawing-field edits are unavailable in the object-first workbench.',
    }),
    [],
  );

  const validateDeckPreview = useCallback(
    (nextDraft: EstimateDrawingDraft, deckId: string): CommitResult => {
      const previewStore = buildDrawingWorkbenchStore({
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
    [ui],
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
      houseForm?: HouseFormModel | null;
      validateDraft?: (draft: EstimateDrawingDraft) => CommitResult;
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentDecks = resolveCurrentObjectWorkbenchDeckDrafts(objectFirstDraft);
          const housePolygon = resolveDeckReferencePolygon(input.houseForm ?? null);
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
    [runDraftTransaction, store],
  );

  const commitOpeningDraftMutation = useCallback(
    async (input: {
      buildNextOpenings: (context: OpeningMutationInput) => OpeningMutationInput['currentOpenings'];
      houseForm?: HouseFormModel | null;
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
                sourceFormId: input.houseForm?.id ?? null,
              }),
            }),
          };
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
          const assembly = objectFirstDraft.houseAssembly;
          const houseFormId = selectedHouseForm?.id ?? assembly?.houseForms[0]?.id ?? null;
          if (!assembly || !houseFormId) {
            return { ok: false, error: 'No house forms are available.' };
          }
          const result = applyHouseFormFootprintEdit({
            houseForms: assembly.houseForms,
            houseFormId,
            edit,
          });
          if (!result.ok) return result;
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                houseAssembly: {
                  ...assembly,
                  houseForms: result.houseForms,
                },
              },
            }),
          };
        },
      }),
    [runDraftTransaction, selectedHouseForm?.id, store],
  );

  const commitHouseFormFootprintEdit = useCallback(
    async (input: {
      houseFormId: string;
      edit: EstimateDrawingFootprintEdit;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const assembly = objectFirstDraft.houseAssembly;
          if (!assembly) {
            return { ok: false, error: 'No house assembly available.' };
          }
          const result = applyHouseFormFootprintEdit({
            houseForms: assembly.houseForms,
            houseFormId: input.houseFormId,
            edit: input.edit,
          });
          if (!result.ok) return result;

          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                houseAssembly: {
                  ...assembly,
                  houseForms: result.houseForms,
                },
              },
            }),
          };
        },
      }),
    [runDraftTransaction, store],
  );

  const commitHouseFormRoofIntent = useCallback(
    async (input: {
      houseFormId: string;
      roof: HouseFormRoofIntentModel;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          return buildHouseFormRoofIntentCommitDraft({
            draft,
            objectFirstDraft,
            houseFormId: input.houseFormId,
            roof: input.roof,
          });
        },
      }),
    [runDraftTransaction, store],
  );

  const commitSharedHouseRoofDraft = useCallback(
    async (roof: HouseFormRoofIntentModel): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const houseFormId = selectedHouseForm?.id ?? objectFirstDraft.houseAssembly?.houseForms[0]?.id ?? null;
          if (!houseFormId) {
            return { ok: false, error: 'No house forms are available.' };
          }
          return buildHouseFormRoofIntentCommitDraft({
            draft,
            objectFirstDraft,
            houseFormId,
            roof,
          });
        },
      }),
    [runDraftTransaction, selectedHouseForm?.id, store],
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
      // Rail "Add structure" clones the selected/current form when one
      // exists, or creates a deterministic first form for explicit
      // zero-house object-first assemblies.
      let newFormId: string | null = null;
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextObjectFirst = addHouseFormToObjectFirstDraft({
            draft: objectFirstDraft,
            sourceHouseFormId: selectedHouseForm?.id ?? null,
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
    [runDraftTransaction, selectObjectTarget, selectedHouseForm?.id, store],
  );

  // PR-COMP-PHASE4b.2 (2026-06-18): Join two house forms into one
  // composite. The geometry primitive (joinTwoHouseForms in
  // @sp/geometry) handles the structural merge; this action wraps
  // it in a draft transaction: looks up form A and form B by id,
  // converts their world transforms from metres to mm, calls the
  // primitive, replaces form A's composition with the merged
  // result, removes form B, and selects the merged form.
  //
  // Form A is "kept" — its id, transform, and other workbench
  // metadata (label, eave height, opening list, etc.) survive
  // unchanged. Form B is removed. The merged composition lives in
  // form A's local coordinate frame.
  const joinHouseForms = useCallback(
    async (input: { formAId: string; formBId: string }): Promise<CommitResult> => {
      if (input.formAId === input.formBId) {
        return { ok: false, error: 'Cannot join a house form to itself.' };
      }
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const assembly = objectFirstDraft.houseAssembly;
          if (!assembly) {
            return { ok: false, error: 'No house assembly available.' };
          }
          const formA = assembly.houseForms.find((form) => form.id === input.formAId);
          const formB = assembly.houseForms.find((form) => form.id === input.formBId);
          if (!formA || !formB) {
            return { ok: false, error: 'One or both house forms are no longer available.' };
          }
          if (!formA.composition || !formB.composition) {
            return {
              ok: false,
              error: 'Both house forms must have a composition before joining (legacy free-form forms cannot be joined).',
            };
          }
          if (
            formA.transform.rotationQuarterTurns !== formB.transform.rotationQuarterTurns
          ) {
            return {
              ok: false,
              error: 'Rotated house forms cannot be joined yet — align rotations first.',
            };
          }
          const joinResult = joinTwoHouseForms({
            formA: formA.composition,
            formAWorldOffsetXMm: formA.transform.offsetXM * 1000,
            formAWorldOffsetYMm: formA.transform.offsetYM * 1000,
            formB: formB.composition,
            formBWorldOffsetXMm: formB.transform.offsetXM * 1000,
            formBWorldOffsetYMm: formB.transform.offsetYM * 1000,
          });
          if (!joinResult.ok) {
            return {
              ok: false,
              error:
                joinResult.error.code === 'no_shared_seam'
                  ? 'These house forms do not share an edge. Move them closer until they snap, then try again.'
                  : 'These house forms overlap. Pull them apart before joining.',
            };
          }
          const mergedForm: HouseFormModel = {
            ...formA,
            composition: joinResult.merged,
          };
          const nextForms = assembly.houseForms
            .map((form) => (form.id === formA.id ? mergedForm : form))
            .filter((form) => form.id !== formB.id);
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
        afterPersist: () => {
          selectObjectTarget({ family: 'house_forms', objectId: input.formAId });
        },
      });
    },
    [runDraftTransaction, selectObjectTarget, store],
  );

  // PR-COMP-PHASE4b.2 (2026-06-18): Detach a composite house form
  // at a specific seam. The geometry primitive
  // (detachHouseFormAtSeam in @sp/geometry) returns one
  // HouseComposition per connected component of the post-detach
  // adjacency graph. This action wraps it: replaces the original
  // form's composition with partitions[0] (preserving its id,
  // transform, label, openings, etc.), then creates N-1 new house
  // forms — each cloning the original's workbench metadata but
  // with a new id, auto-derived label, and composition =
  // partitions[i]. Every new form keeps the original's world
  // transform so its primitives (which carry their original form-
  // local coordinates from the parent composition) render at the
  // correct world positions.
  const detachHouseFormAtSeam = useCallback(
    async (input: { houseFormId: string; joinIndex: number }): Promise<CommitResult> => {
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const assembly = objectFirstDraft.houseAssembly;
          if (!assembly) {
            return { ok: false, error: 'No house assembly available.' };
          }
          const form = assembly.houseForms.find((candidate) => candidate.id === input.houseFormId);
          if (!form) {
            return { ok: false, error: 'House form not found.' };
          }
          if (!form.composition || form.composition.joins.length === 0) {
            return { ok: false, error: 'This house form has no internal seams to detach.' };
          }
          const detachResult = detachHouseFormAtSeamGeometry({
            composition: form.composition,
            joinIndex: input.joinIndex,
          });
          if (!detachResult.ok) {
            return {
              ok: false,
              error:
                detachResult.error.code === 'invalid_join_index'
                  ? 'This seam is no longer available.'
                  : 'This composite cannot be detached cleanly at that seam.',
            };
          }
          const partitions: HouseComposition[] = detachResult.partitions;
          // PR-WB-DETACH-NO-MOVE (2026-06-19): rebase every
          // partition into its own form-local frame so each
          // resulting house form renders at the same world
          // position its rectangles occupied inside the composite.
          // Without this, the new form inherits the parent's
          // footprint params (describing the composite's anchor)
          // and the legacy walls land overlapping the parent.
          //
          // Partition 0 keeps the parent's id + label + workbench
          // metadata but its composition + transform + footprint
          // params are all rebased into a frame matching its own
          // bounding box. Partitions 1..N-1 become new forms with
          // new ids + auto-derived labels.
          const rebasedPartitions = partitions.map((partition) =>
            rebasePartitionIntoOwnFrame({
              partition,
              parentTransform: form.transform,
            }),
          );
          if (rebasedPartitions.some((entry) => entry === null)) {
            return { ok: false, error: 'Detach produced an invalid partition.' };
          }
          const rebasedHead = rebasedPartitions[0]!;
          const updatedOriginal: HouseFormModel = {
            ...form,
            composition: rebasedHead.composition,
            transform: rebasedHead.transformOverride,
            footprint: {
              ...form.footprint,
              params: {
                ...form.footprint.params,
                widthM: rebasedHead.footprintParamsPatch.widthM,
                bandDepthM: rebasedHead.footprintParamsPatch.bandDepthM,
                offsetXM: rebasedHead.footprintParamsPatch.offsetXM,
                setbackM: rebasedHead.footprintParamsPatch.setbackM,
              },
            },
          };
          // Build the new forms iteratively so each new id is
          // unique relative to the running list (nextHouseFormId
          // computes from the array length + existing ids).
          const runningForms: HouseFormModel[] = assembly.houseForms.map((candidate) =>
            candidate.id === form.id ? updatedOriginal : candidate,
          );
          for (let i = 1; i < partitions.length; i += 1) {
            const newId = nextHouseFormId(runningForms);
            const newLabel = deriveHouseFormDisplayLabel(runningForms.length);
            const rebased = rebasedPartitions[i]!;
            const newForm: HouseFormModel = {
              ...form,
              id: newId,
              label: newLabel,
              composition: rebased.composition,
              transform: rebased.transformOverride,
              footprint: {
                ...form.footprint,
                params: {
                  ...form.footprint.params,
                  widthM: rebased.footprintParamsPatch.widthM,
                  bandDepthM: rebased.footprintParamsPatch.bandDepthM,
                  offsetXM: rebased.footprintParamsPatch.offsetXM,
                  setbackM: rebased.footprintParamsPatch.setbackM,
                },
              },
            };
            runningForms.push(newForm);
          }
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                houseAssembly: { ...assembly, houseForms: runningForms },
              },
            }),
          };
        },
        afterPersist: () => {
          selectObjectTarget({ family: 'house_forms', objectId: input.houseFormId });
        },
      });
    },
    [runDraftTransaction, selectObjectTarget, store],
  );

  const removeSharedHouseForm = useCallback(
    async (input: { houseFormId: string }): Promise<CommitResult> => {
      let nextSelectedHouseFormId: string | null = null;
      return runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentForms = objectFirstDraft.houseAssembly?.houseForms ?? [];
          const nextSelection = resolveNextHouseFormIdAfterRemoval(currentForms, input.houseFormId);
          if (typeof nextSelection === 'undefined') {
            return { ok: false, error: 'This house form is no longer available.' };
          }
          nextSelectedHouseFormId = nextSelection;
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
          selectObjectTarget({ family: 'house_forms', objectId: nextSelectedHouseFormId });
        },
      });
    },
    [runDraftTransaction, selectObjectTarget, store],
  );

  const addSharedHouseDeck = useCallback(
    async (mode: 'preset' | 'custom_outline'): Promise<CommitResult> => {
      if (!selectedHouseForm) return missingSharedHouseResult();

      let deckId = '';
      // PR-D (2026-05-22): bind the deck to the selected form via the new
      // `attachment` snap reference. `buildNewObjectWorkbenchDeckDraft`
      // writes `attachment.host.objectId = hostHouseFormObjectId`. The
      // `host.edgeId` stays empty until the user drags the deck to a wall
      // (PR-F's snap migration populates it then).
      const hostHouseFormObjectId = selectedHouseForm.id;

      return commitDeckDraftMutation({
        houseForm: selectedHouseForm,
        buildNextDecks: ({ currentDecks, housePolygon }) => {
          deckId = nextObjectWorkbenchDeckId(currentDecks);
          const nextDeck = buildNewObjectWorkbenchDeckDraft({
            deckId,
            deckIndex: currentDecks.length,
            hostEdgeId: selectedHouseForm.footprint.attachmentSide ?? 'rear',
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
    [commitDeckDraftMutation, selectObjectTarget, selectedHouseForm, startDeckOutlineEditor],
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
      if (!selectedHouseForm) return missingSharedHouseResult();

      let openingId = '';

      return commitOpeningDraftMutation({
        houseForm: selectedHouseForm,
        buildNextOpenings: ({ currentOpenings }) => {
          openingId = nextObjectWorkbenchOpeningId(currentOpenings);
          const preferredWall = resolvePreferredNewObjectWorkbenchOpeningHostWall({
            houseAssembly: store.derived.houseAssembly,
            houseForm: selectedHouseForm,
            preferredHostWallId: activeObjectWorkbenchOpening?.hostWallId ?? null,
            preferredSide: selectedHouseForm.footprint.attachmentSide ?? 'rear',
          });
          return [
            ...currentOpenings,
            buildNewObjectWorkbenchOpeningDraft({
              currentOpenings,
              kind,
              openingId,
              sourceFormId: selectedHouseForm.id,
              hostWallId: preferredWall?.wallId ?? null,
              hostEdgeId: preferredWall?.hostEdgeId ?? null,
              wallId: preferredWall?.semanticSide ?? selectedHouseForm.footprint.attachmentSide ?? 'rear',
            }),
          ];
        },
        afterPersist: () => {
          selectObjectTarget({ family: 'openings', objectId: openingId });
        },
      });
    },
    [
      activeObjectWorkbenchOpening?.hostWallId,
      commitOpeningDraftMutation,
      selectObjectTarget,
      selectedHouseForm,
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
    async (_field: string, _nextValue: string): Promise<CommitResult> => ({
      ok: false,
      error: 'Calculator drawing fields are unavailable in the object-first workbench.',
    }),
    [],
  );

  const commitGeometryIntent = useCallback(
    async (intent: unknown): Promise<CommitResult> => runGeometryIntentTransaction(intent),
    [runGeometryIntentTransaction],
  );

  const commitHouseFormFootprintDimension = useCallback(
    async (edit: EstimateDrawingFootprintEdit): Promise<CommitResult> => {
      const houseFormId =
        ui.activeObjectRef.family === 'house_forms' && ui.activeObjectRef.objectId
          ? ui.activeObjectRef.objectId
          : null;
      if (!houseFormId) {
        return { ok: false, error: 'This house form is no longer available.' };
      }
      return commitHouseFormFootprintEdit({ houseFormId, edit });
    },
    [
      commitHouseFormFootprintEdit,
      ui.activeObjectRef.family,
      ui.activeObjectRef.objectId,
    ],
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
    commitHouseFormFootprintEdit,
    commitHouseFormRoofIntent,
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
    detachHouseFormAtSeam,
    joinHouseForms,
    removeSharedHouseDeck,
    removeSharedHouseForm,
    removeSharedHouseOpening,
  };
}
