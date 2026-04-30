'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { getHouseRoofFormBehavior, isHouseRoofForm } from '@sp/geometry';
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
  DerivedAttachmentZoneModel,
  DerivedWallModel,
  HouseAssemblyModel,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildHouseFirstCompatibilityDraftFromObjectFirstDraft,
  buildObjectFirstDeckDraftsFromHouseFirstDrafts,
  buildObjectFirstOpeningDraftsFromHouseFirstDrafts,
  buildObjectFirstPergolaDraftsFromHouseFirstDrafts,
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstPergolaDraft,
  HouseFirstRoofDraft,
  HouseModel,
  HouseRoofForm,
  PergolaModel,
  WallOpeningHostSide,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { resolveDeckHostEdgeFrame, sanitizeDeckPresetRect } from '@/lib/drawings/state/houseFirstDeckPresets';
import {
  applyEstimateDrawingModuleFieldEdit,
  applyEstimateDrawingFootprintEdit,
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import type { EstimateDetail } from '@/lib/estimates/types';
import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type { CommitResult, DrawOutlineTarget } from './houseWorkbenchClientTypes';
import {
  deckReferenceHousePolygon,
  houseLocalPolygon,
  nextDeckId,
  nextOpeningId,
  resolveDeckDraftGeometry,
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

type PergolaMutationInput = {
  currentPergolas: HouseFirstPergolaDraft[];
};

type PergolaAttachmentKind = PergolaModel['attachment']['kind'];
type PergolaAttachmentStrategyValue = CalculatorHouseAttachmentStrategy | 'auto';

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

function resolveCurrentDeckDrafts(objectFirstDraft: ObjectFirstWorkbenchDraftVNext): HouseFirstDeckDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).decks ?? [];
}

function resolveCurrentOpeningDrafts(objectFirstDraft: ObjectFirstWorkbenchDraftVNext): HouseFirstOpeningDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).openings ?? [];
}

function resolveCurrentPergolaDrafts(objectFirstDraft: ObjectFirstWorkbenchDraftVNext): HouseFirstPergolaDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).pergolas ?? [];
}

function updateDraftObjectFirst(input: {
  draft: EstimateDrawingDraft;
  objectFirst: ObjectFirstWorkbenchDraftVNext;
}): EstimateDrawingDraft {
  return updateEstimateDrawingObjectFirstWorkbenchDraft({
    draft: input.draft,
    objectFirst: input.objectFirst,
  });
}

type OpeningHostWallOption = {
  wallId: string;
  label: string;
  semanticSide: WallOpeningHostSide | null;
  hostEdgeId: string | null;
  spanM: number;
};

type PergolaDerivedAttachmentZoneOption = DerivedAttachmentZoneModel;

function formatOpeningMetres(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function resolveOpeningWallSpanM(wall: DerivedWallModel): number {
  const start = wall.polygon[0];
  const end = wall.polygon[1];
  const dx = Number(end?.alongM ?? NaN) - Number(start?.alongM ?? NaN);
  const dy = Number(end?.depthM ?? NaN) - Number(start?.depthM ?? NaN);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  return Math.hypot(dx, dy);
}

function buildOpeningHostWallOptions(
  houseAssembly: HouseAssemblyModel | null,
  compatibilityHouse: HouseModel | null,
  activeModuleInput: CalculatorModuleInputs | null,
): OpeningHostWallOption[] {
  const walls = houseAssembly?.derivedEnvelope?.wallGraph.walls ?? [];
  if (!walls.length) return [];
  const wallPolygon = compatibilityHouse
    ? houseLocalPolygon({
        house: compatibilityHouse,
        moduleLengthM: activeModuleInput?.lengthM,
        moduleProjectionM: activeModuleInput?.projectionM,
      })
    : [];

  return walls.map((wall) => {
    const hostEdgeId = wall.edgeIds[0] ?? null;
    const frame = hostEdgeId && wallPolygon.length
      ? resolveDeckHostEdgeFrame({
          housePolygon: wallPolygon,
          hostEdgeId,
        })
      : null;
    return {
      wallId: wall.id,
      label: wall.label,
      semanticSide: frame?.hostEdge ?? null,
      hostEdgeId,
      spanM: resolveOpeningWallSpanM(wall),
    };
  });
}

function clampOpeningOffsetForHostWall(input: {
  opening: HouseFirstOpeningDraft;
  patch: Partial<HouseFirstOpeningDraft>;
  spanM: number;
}): string {
  const widthM = Number(input.patch.widthM ?? input.opening.widthM ?? '');
  if (!Number.isFinite(widthM) || widthM > input.spanM + 1e-6) return '0';

  const rawOffsetM = Number(input.patch.offsetAlongWallM ?? input.opening.offsetAlongWallM ?? '');
  const clampedOffsetM = Number.isFinite(rawOffsetM)
    ? Math.min(Math.max(rawOffsetM, 0), Math.max(0, input.spanM - widthM))
    : 0;
  return formatOpeningMetres(clampedOffsetM);
}

function normalizeOpeningPatchAgainstDerivedWalls(input: {
  activeModuleInput: CalculatorModuleInputs | null;
  currentOpening: HouseFirstOpeningDraft;
  houseAssembly: HouseAssemblyModel | null;
  house: HouseModel | null;
  patch: Partial<HouseFirstOpeningDraft>;
}): Partial<HouseFirstOpeningDraft> {
  if (input.patch.hostWallId === undefined) return input.patch;

  const resolvedWall = buildOpeningHostWallOptions(
    input.houseAssembly,
    input.house,
    input.activeModuleInput,
  ).find((wall) => wall.wallId === input.patch.hostWallId);
  if (!resolvedWall) {
    return {
      ...input.patch,
      hostEdgeId: null,
    };
  }

  return {
    ...input.patch,
    hostWallId: resolvedWall.wallId,
    hostEdgeId: resolvedWall.hostEdgeId,
    wallId: resolvedWall.semanticSide,
    offsetAlongWallM: clampOpeningOffsetForHostWall({
      opening: input.currentOpening,
      patch: input.patch,
      spanM: resolvedWall.spanM,
    }),
  };
}

function resolvePreferredNewOpeningHostWall(input: {
  activeModuleInput: CalculatorModuleInputs | null;
  houseAssembly: HouseAssemblyModel | null;
  house: HouseModel | null;
  preferredHostWallId: string | null;
  preferredSide: WallOpeningHostSide;
}): OpeningHostWallOption | null {
  const options = buildOpeningHostWallOptions(input.houseAssembly, input.house, input.activeModuleInput);
  if (!options.length) return null;

  if (input.preferredHostWallId) {
    const preferredWall = options.find((option) => option.wallId === input.preferredHostWallId);
    if (preferredWall) return preferredWall;
  }

  const matchingSide = options.filter((option) => option.semanticSide === input.preferredSide);
  if (matchingSide.length === 1) return matchingSide[0]!;
  return options[0] ?? null;
}

function resolvePergolaZoneKind(
  kind: PergolaAttachmentKind,
): PergolaDerivedAttachmentZoneOption['kind'] | null {
  if (kind === 'freestanding') return null;
  if (kind === 'wall') return 'wall';
  return kind;
}

function toModuleHouseConnectionType(
  kind: PergolaAttachmentKind,
): CalculatorModuleInputs['houseConnectionType'] {
  if (kind === 'freestanding') return 'none';
  if (kind === 'wall') return 'facade';
  return kind;
}

function buildPergolaZoneLookup(
  houseAssembly: HouseAssemblyModel | null,
): Map<string, PergolaDerivedAttachmentZoneOption> {
  const byId = new Map<string, PergolaDerivedAttachmentZoneOption>();
  for (const zone of houseAssembly?.derivedEnvelope?.attachmentZones ?? []) {
    byId.set(zone.id, zone);
  }
  return byId;
}

function resolvePergolaZonesForKind(
  houseAssembly: HouseAssemblyModel | null,
  kind: PergolaAttachmentKind,
): PergolaDerivedAttachmentZoneOption[] {
  const zoneKind = resolvePergolaZoneKind(kind);
  if (!zoneKind) return [];
  return (houseAssembly?.derivedEnvelope?.attachmentZones ?? []).filter((zone) => zone.kind === zoneKind);
}

function resolvePreferredPergolaZoneForKind(input: {
  houseAssembly: HouseAssemblyModel | null;
  currentPergola: PergolaModel;
  nextKind: PergolaAttachmentKind;
  preferredEdgeId?: string | null;
}): PergolaDerivedAttachmentZoneOption | null {
  const candidateZones = resolvePergolaZonesForKind(input.houseAssembly, input.nextKind);
  if (!candidateZones.length) return null;

  const preferredEdgeId = input.preferredEdgeId ?? input.currentPergola.attachment.attachmentEdgeId ?? null;
  if (preferredEdgeId) {
    const edgeZone = candidateZones.find((zone) => zone.hostEdgeId === preferredEdgeId);
    if (edgeZone) return edgeZone;
  }

  if (input.currentPergola.attachment.attachmentZoneId) {
    const currentZone = candidateZones.find((zone) => zone.id === input.currentPergola.attachment.attachmentZoneId);
    if (currentZone) return currentZone;
  }

  const sameSideZone = candidateZones.find((zone) => zone.side === input.currentPergola.attachment.side);
  return sameSideZone ?? candidateZones[0] ?? null;
}

function upsertPergolaDrafts(
  currentPergolas: HouseFirstPergolaDraft[],
  pergolaId: string,
  patch: Partial<HouseFirstPergolaDraft>,
): HouseFirstPergolaDraft[] {
  let found = false;
  const nextPergolas = currentPergolas.map((pergola) => {
    if (pergola.id !== pergolaId) return pergola;
    found = true;
    return {
      ...pergola,
      ...patch,
    };
  });
  if (found) return nextPergolas;
  return [
    ...nextPergolas,
    {
      id: pergolaId,
      ...patch,
    },
  ];
}

function applyPergolaModuleEdits(input: {
  draft: EstimateDrawingDraft;
  moduleIndexes: number[];
  kind?: PergolaAttachmentKind;
  strategy?: PergolaAttachmentStrategyValue;
  side?: NonNullable<CalculatorModuleInputs['attachmentSide']> | null;
}): DraftBuildResult {
  let nextDraft = input.draft;

  for (const moduleIndex of input.moduleIndexes) {
    if (input.kind) {
      const connectionResult = applyEstimateDrawingModuleFieldEdit({
        draft: nextDraft,
        moduleIndex,
        edit: {
          field: 'houseConnectionType',
          value: toModuleHouseConnectionType(input.kind),
        },
      });
      if (!connectionResult.ok) {
        return {
          ok: false,
          error: connectionResult.error,
        };
      }
      nextDraft = connectionResult.draft;
    }

    if (input.strategy !== undefined) {
      const strategyResult = applyEstimateDrawingModuleFieldEdit({
        draft: nextDraft,
        moduleIndex,
        edit: {
          field: 'moduleValue',
          key: 'houseAttachmentStrategy',
          value: input.strategy,
        },
      });
      if (!strategyResult.ok) {
        return {
          ok: false,
          error: strategyResult.error,
        };
      }
      nextDraft = strategyResult.draft;
    }

    if (input.side) {
      const sideResult = applyEstimateDrawingFootprintEdit({
        draft: nextDraft,
        moduleIndex,
        edit: {
          type: 'attachment_side',
          side: input.side,
        },
      });
      if (!sideResult.ok) {
        return {
          ok: false,
          error: sideResult.error,
        };
      }
      nextDraft = sideResult.draft;
    }
  }

  return {
    ok: true,
    draft: nextDraft,
  };
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
      ...(input.patch.wallId !== undefined &&
      input.patch.hostWallId === undefined &&
      input.patch.hostEdgeId === undefined
        ? { hostWallId: null, hostEdgeId: null }
        : null),
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

function normalizeSharedHouseRoofDraftForCommit(
  roof: HouseFirstRoofDraft,
): HouseFirstRoofDraft {
  const form: HouseRoofForm = isHouseRoofForm(roof.form) ? roof.form : 'mono';
  const behavior = getHouseRoofFormBehavior(form);
  const pitchDeg = roof.primaryPitchDeg?.trim() ?? '';
  const base: HouseFirstRoofDraft = {
    ...roof,
    form,
  };

  return {
    ...base,
    primaryPitchDeg: behavior.controls.pitch ? pitchDeg : '0',
    primaryFallDirection: behavior.controls.primaryFallDirection ? base.primaryFallDirection ?? null : null,
    ridgeAxis: behavior.controls.ridgeAxis ? base.ridgeAxis ?? null : null,
    openGableEndIds: form === 'gable' ? base.openGableEndIds ?? [] : [],
    appendage: behavior.controls.appendage ? base.appendage ?? null : null,
  };
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
  hostWallId: string | null;
  hostEdgeId: string | null;
  wallId: WallOpeningHostSide;
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
          hostWallId: input.hostWallId,
          wallId: input.wallId,
          hostEdgeId: input.hostEdgeId,
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
            hostWallId: input.hostWallId,
            wallId: input.wallId,
            hostEdgeId: input.hostEdgeId,
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
              hostWallId: input.hostWallId,
              wallId: input.wallId,
              hostEdgeId: input.hostEdgeId,
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
          hostWallId: input.hostWallId,
          wallId: input.wallId,
          hostEdgeId: input.hostEdgeId,
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

  const syncHouseAssemblyFromDraftInputs = useCallback(
    (
      draft: EstimateDrawingDraft,
      objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
    ): ObjectFirstWorkbenchDraftVNext => {
      const previewStore = buildDrawingWorkbenchStore({
        snapshot,
        draft: {
          ...draft,
          objectFirst: undefined,
          houseFirst: undefined,
        },
        ui,
      });
      const previewObjectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(
        previewStore.persisted.projectModel,
      );
      return {
        ...objectFirstDraft,
        houseAssembly: previewObjectFirst.houseAssembly,
      };
    },
    [snapshot, ui],
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
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const house = store.derived.house;
          const currentDecks = resolveCurrentDeckDrafts(objectFirstDraft);
          const housePolygon = resolveDeckReferencePolygon(house, activeModuleInput);
          const nextDecks = input.buildNextDecks({
            currentDecks,
            housePolygon,
          });
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                decks: buildObjectFirstDeckDraftsFromHouseFirstDrafts(nextDecks),
              },
            }),
          };
        },
        validateDraft: input.validateDraft,
        afterPersist: input.afterPersist,
      }),
    [activeModuleInput, runDraftTransaction, store],
  );

  const commitOpeningDraftMutation = useCallback(
    async (input: {
      buildNextOpenings: (context: OpeningMutationInput) => HouseFirstOpeningDraft[];
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentOpenings = resolveCurrentOpeningDrafts(objectFirstDraft);
          const nextOpenings = input.buildNextOpenings({
            currentOpenings,
          });
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft,
              objectFirst: {
                ...objectFirstDraft,
                openings: buildObjectFirstOpeningDraftsFromHouseFirstDrafts(
                  nextOpenings,
                  store.derived.activeHouseForm?.id ?? store.derived.house?.id ?? null,
                ),
              },
            }),
          };
        },
        afterPersist: input.afterPersist,
      }),
    [runDraftTransaction, store],
  );

  const commitPergolaDraftMutation = useCallback(
    async (input: {
      pergolaId: string;
      buildNextPergolas: (context: {
        draft: EstimateDrawingDraft;
        currentPergolas: HouseFirstPergolaDraft[];
        currentPergola: PergolaModel;
      }) => DraftBuildResult;
      afterPersist?: () => CommitResult | void | Promise<CommitResult | void>;
    }): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const currentPergolas = resolveCurrentPergolaDrafts(objectFirstDraft);
          const currentPergola =
            store.derived.pergolas.find((pergola) => pergola.id === input.pergolaId) ?? null;
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
    async (roof: HouseFirstRoofDraft): Promise<CommitResult> =>
      runDraftTransaction({
        buildNextDraft: (draft) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const normalizedRoof = normalizeSharedHouseRoofDraftForCommit(roof);
          const nextObjectFirstDraft: ObjectFirstWorkbenchDraftVNext = {
            ...objectFirstDraft,
            houseAssembly: objectFirstDraft.houseAssembly
              ? {
                  ...objectFirstDraft.houseAssembly,
                  houseForms: objectFirstDraft.houseAssembly.houseForms.map((houseForm, index) =>
                    index === 0
                      ? (() => {
                          const form = normalizedRoof.form ?? houseForm.roofIntent.form;
                          const behavior = getHouseRoofFormBehavior(form);
                          return {
                            ...houseForm,
                            roofIntentAuthored: true,
                            roofIntent: {
                              ...houseForm.roofIntent,
                              form,
                              material: normalizedRoof.material ?? houseForm.roofIntent.material,
                              primaryPitchDeg:
                                normalizedRoof.primaryPitchDeg ?? houseForm.roofIntent.primaryPitchDeg,
                              primaryFallDirection: behavior.controls.primaryFallDirection
                                ? normalizedRoof.primaryFallDirection ?? houseForm.roofIntent.primaryFallDirection
                                : 'negative_y',
                              ridgeAxis: behavior.controls.ridgeAxis
                                ? normalizedRoof.ridgeAxis ?? houseForm.roofIntent.ridgeAxis
                                : 'x',
                              openGableEndIds:
                                form === 'gable'
                                  ? normalizedRoof.openGableEndIds ?? houseForm.roofIntent.openGableEndIds
                                  : [],
                              appendage:
                                behavior.controls.appendage && normalizedRoof.appendage
                                  ? {
                                      enabled: Boolean(normalizedRoof.appendage.enabled),
                                      form: normalizedRoof.appendage.form ?? houseForm.roofIntent.appendage.form,
                                      hostEdge:
                                        normalizedRoof.appendage.hostEdge ?? houseForm.roofIntent.appendage.hostEdge,
                                      pitchDeg:
                                        normalizedRoof.appendage.pitchDeg ?? houseForm.roofIntent.appendage.pitchDeg,
                                      dropMm: normalizedRoof.appendage.dropMm ?? houseForm.roofIntent.appendage.dropMm,
                                    }
                                  : {
                                      ...houseForm.roofIntent.appendage,
                                      enabled: false,
                                    },
                            },
                          };
                        })()
                      : houseForm,
                  ),
                }
              : objectFirstDraft.houseAssembly,
          };
          return {
            ok: true,
            draft: updateDraftObjectFirst({
              draft: mirrorSharedRoofDraftToModules(draft, normalizedRoof),
              objectFirst: nextObjectFirstDraft,
            }),
          };
        },
      }),
    [runDraftTransaction, store],
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
            patch: normalizeOpeningPatchAgainstDerivedWalls({
              activeModuleInput,
              currentOpening: currentOpenings.find((opening) => opening.id === openingId) ?? { id: openingId },
              houseAssembly: store.derived.houseAssembly,
              house: store.derived.house,
              patch,
            }),
          }),
      }),
    [activeModuleInput, commitOpeningDraftMutation, store.derived.house, store.derived.houseAssembly],
  );

  const addSharedHouseOpening = useCallback(
    async (kind: 'window' | 'hinged_door' | 'slider' | 'stacker'): Promise<CommitResult> => {
      const house = store.derived.house;
      if (!house) return missingSharedHouseResult();

      let openingId = '';

      return commitOpeningDraftMutation({
        buildNextOpenings: ({ currentOpenings }) => {
          openingId = nextOpeningId(currentOpenings);
          const preferredWall = resolvePreferredNewOpeningHostWall({
            activeModuleInput,
            houseAssembly: store.derived.houseAssembly,
            house,
            preferredHostWallId: store.derived.activeOpening?.hostWallId ?? null,
            preferredSide: house.footprint.attachmentSide ?? 'rear',
          });
          return [
            ...currentOpenings,
            buildNewOpeningDraft({
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
      commitOpeningDraftMutation,
      selectHouseTarget,
      store.derived.activeOpening?.hostWallId,
      store.derived.house,
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
              : resolvePreferredPergolaZoneForKind({
                  houseAssembly: store.derived.houseAssembly,
                  currentPergola,
                  nextKind: kind,
                });
          const nextPergolas = upsertPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: nextZone?.hostEdgeId ?? null,
            attachmentZoneId: nextZone?.id ?? null,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: {
              ...objectFirstDraft,
              pergolas: buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
                nextPergolas,
                store.derived.pergolas,
              ).map((pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: nextZone?.side ?? pergola.side,
                    }
                  : pergola,
              ),
            },
          });
          return applyPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
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
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          if (currentPergola.attachment.kind === 'freestanding') {
            return {
              ok: false,
              error: 'Switch this pergola to an attached connection before selecting a host edge.',
            };
          }
          const nextZone = resolvePreferredPergolaZoneForKind({
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
          const nextPergolas = upsertPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: edgeId,
            attachmentZoneId: nextZone.id,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: {
              ...objectFirstDraft,
              pergolas: buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
                nextPergolas,
                store.derived.pergolas,
              ).map((pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: nextZone.side,
                    }
                  : pergola,
              ),
            },
          });
          return applyPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
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
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          const zone = buildPergolaZoneLookup(store.derived.houseAssembly).get(zoneId) ?? null;
          if (!zone || zone.hostEdgeId === null) {
            return {
              ok: false,
              error: 'The selected derived host zone is no longer available.',
            };
          }
          if (currentPergola.attachment.kind !== 'freestanding') {
            const expectedKind = resolvePergolaZoneKind(currentPergola.attachment.kind);
            if (zone.kind !== expectedKind) {
              return {
                ok: false,
                error: 'The selected host zone does not match this pergola connection type.',
              };
            }
          }
          const nextPergolas = upsertPergolaDrafts(currentPergolas, pergolaId, {
            attachmentEdgeId: zone.hostEdgeId,
            attachmentZoneId: zone.id,
          });
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: {
              ...objectFirstDraft,
              pergolas: buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
                nextPergolas,
                store.derived.pergolas,
              ).map((pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      side: zone.side,
                    }
                  : pergola,
              ),
            },
          });
          return applyPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
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
        buildNextPergolas: ({ draft, currentPergolas, currentPergola }) => {
          const objectFirstDraft = resolveObjectFirstDraft(draft, store);
          const nextDraft = updateDraftObjectFirst({
            draft,
            objectFirst: {
              ...objectFirstDraft,
              pergolas: buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
                upsertPergolaDrafts(currentPergolas, pergolaId, {}),
                store.derived.pergolas,
              ).map((pergola) =>
                pergola.id === pergolaId
                  ? {
                      ...pergola,
                      strategy: strategy === 'auto' ? null : strategy,
                    }
                  : pergola,
              ),
            },
          });
          return applyPergolaModuleEdits({
            draft: nextDraft,
            moduleIndexes: currentPergola.sourceModuleIndexes,
            strategy,
          });
        },
      }),
    [commitPergolaDraftMutation, store],
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
