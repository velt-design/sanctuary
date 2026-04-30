import { getHouseRoofFormBehavior, isHouseRoofForm } from '@sp/geometry';
import {
  applyEstimateDrawingFootprintEdit,
  applyEstimateDrawingModuleFieldEdit,
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type {
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  DerivedAttachmentZoneModel,
  DerivedWallModel,
  HouseAssemblyModel,
  HouseFormRoofIntentModel,
  ObjectFirstHouseFormDraft,
  ObjectFirstPergolaDraft,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  buildHouseFirstCompatibilityDraftFromObjectFirstDraft,
  buildObjectFirstDeckDraftsFromHouseFirstDrafts,
  buildObjectFirstOpeningDraftsFromHouseFirstDrafts,
  buildObjectFirstPergolaDraftsFromHouseFirstDrafts,
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
  WorkbenchHouseSelection,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchPergolaAttachmentStrategy,
  ObjectWorkbenchPergolaConnectionKind,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import {
  resolveDeckHostEdgeFrame,
  sanitizeDeckPresetRect,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import {
  deckReferenceHousePolygon,
  houseLocalPolygon,
  nextDeckId,
  nextOpeningId,
  resolveDeckDraftGeometry,
} from './workbenchCompatibilityDraftBuilders';

export type ObjectWorkbenchCompatibilitySelection = WorkbenchHouseSelection;
export type ObjectWorkbenchCompatibilityDeckDraft = HouseFirstDeckDraft;
export type ObjectWorkbenchCompatibilityOpeningDraft = HouseFirstOpeningDraft;
export type ObjectWorkbenchCompatibilityPergolaDraft = HouseFirstPergolaDraft;
export type ObjectWorkbenchCompatibilityPergolaModel = PergolaModel;
export type ObjectWorkbenchCompatibilityHostSide = WallOpeningHostSide;

export type ObjectWorkbenchDraftBuildResult =
  | { ok: true; draft: EstimateDrawingDraft }
  | { ok: false; error: string };

export type ObjectWorkbenchDeckMutationInput = {
  currentDecks: ObjectWorkbenchCompatibilityDeckDraft[];
  housePolygon: Array<{ alongM: string; depthM: string }>;
};

export type ObjectWorkbenchOpeningMutationInput = {
  currentOpenings: ObjectWorkbenchCompatibilityOpeningDraft[];
};

export type ObjectWorkbenchPergolaMutationInput = {
  draft: EstimateDrawingDraft;
  currentPergolas: ObjectWorkbenchCompatibilityPergolaDraft[];
  currentPergola: ObjectWorkbenchCompatibilityPergolaModel;
};

type OpeningHostWallOption = {
  wallId: string;
  label: string;
  semanticSide: WallOpeningHostSide | null;
  hostEdgeId: string | null;
  spanM: number;
};

type PergolaAttachmentKind = ObjectWorkbenchPergolaConnectionKind;
type PergolaAttachmentStrategyValue = ObjectWorkbenchPergolaAttachmentStrategy;
type PergolaDerivedAttachmentZoneOption = DerivedAttachmentZoneModel;

export function resolveCurrentObjectWorkbenchDeckDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchCompatibilityDeckDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).decks ?? [];
}

export function resolveCurrentObjectWorkbenchOpeningDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchCompatibilityOpeningDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).openings ?? [];
}

export function resolveCurrentObjectWorkbenchPergolaDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchCompatibilityPergolaDraft[] {
  return buildHouseFirstCompatibilityDraftFromObjectFirstDraft(objectFirstDraft).pergolas ?? [];
}

export function updateDraftObjectFirst(input: {
  draft: EstimateDrawingDraft;
  objectFirst: ObjectFirstWorkbenchDraftVNext;
}): EstimateDrawingDraft {
  return updateEstimateDrawingObjectFirstWorkbenchDraft({
    draft: input.draft,
    objectFirst: input.objectFirst,
  });
}

export function buildObjectFirstDraftWithCompatibilityDecks(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  decks: ObjectWorkbenchCompatibilityDeckDraft[];
}): ObjectFirstWorkbenchDraftVNext {
  return {
    ...input.objectFirstDraft,
    decks: buildObjectFirstDeckDraftsFromHouseFirstDrafts(input.decks),
  };
}

export function buildObjectFirstDraftWithCompatibilityOpenings(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  openings: ObjectWorkbenchCompatibilityOpeningDraft[];
  sourceFormId: string | null;
}): ObjectFirstWorkbenchDraftVNext {
  return {
    ...input.objectFirstDraft,
    openings: buildObjectFirstOpeningDraftsFromHouseFirstDrafts(
      input.openings,
      input.sourceFormId,
    ),
  };
}

export function buildObjectFirstDraftWithCompatibilityPergolas(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  pergolas: ObjectWorkbenchCompatibilityPergolaDraft[];
  compatibilityPergolas: ObjectWorkbenchCompatibilityPergolaModel[];
  mapPergola?: (pergola: ObjectFirstPergolaDraft) => ObjectFirstPergolaDraft;
}): ObjectFirstWorkbenchDraftVNext {
  const pergolas = buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
    input.pergolas,
    input.compatibilityPergolas,
  );
  return {
    ...input.objectFirstDraft,
    pergolas: input.mapPergola ? pergolas.map(input.mapPergola) : pergolas,
  };
}

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

export function resolvePreferredNewObjectWorkbenchOpeningHostWall(input: {
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

export function resolveObjectWorkbenchPergolaZoneKind(
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

export function buildObjectWorkbenchPergolaZoneLookup(
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
  const zoneKind = resolveObjectWorkbenchPergolaZoneKind(kind);
  if (!zoneKind) return [];
  return (houseAssembly?.derivedEnvelope?.attachmentZones ?? []).filter((zone) => zone.kind === zoneKind);
}

export function resolvePreferredObjectWorkbenchPergolaZone(input: {
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

export function upsertObjectWorkbenchPergolaDrafts(
  currentPergolas: ObjectWorkbenchCompatibilityPergolaDraft[],
  pergolaId: string,
  patch: Partial<ObjectWorkbenchCompatibilityPergolaDraft>,
): ObjectWorkbenchCompatibilityPergolaDraft[] {
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

export function applyObjectWorkbenchPergolaModuleEdits(input: {
  draft: EstimateDrawingDraft;
  moduleIndexes: number[];
  kind?: PergolaAttachmentKind;
  strategy?: PergolaAttachmentStrategyValue;
  side?: NonNullable<CalculatorModuleInputs['attachmentSide']> | null;
}): ObjectWorkbenchDraftBuildResult {
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

function buildHouseFirstDeckPatchFromObjectPatch(
  patch: ObjectWorkbenchDeckPatch,
): Partial<HouseFirstDeckDraft> {
  const { label, ...objectPatch } = patch;
  return {
    ...objectPatch,
    ...(label !== undefined ? { name: label } : null),
  } as Partial<HouseFirstDeckDraft>;
}

export function applyObjectWorkbenchDeckPatch(input: {
  currentDecks: ObjectWorkbenchCompatibilityDeckDraft[];
  deckId: string;
  housePolygon: Array<{ alongM: string; depthM: string }>;
  patch: ObjectWorkbenchDeckPatch;
}): ObjectWorkbenchCompatibilityDeckDraft[] {
  const patch = buildHouseFirstDeckPatchFromObjectPatch(input.patch);
  return input.currentDecks.map((deck) =>
    deck.id === input.deckId
      ? resolveDeckDraftGeometry({
          deck: {
            ...deck,
            ...patch,
            floatingRect:
              patch.floatingRect === undefined
                ? deck.floatingRect
                : patch.floatingRect === null
                  ? null
                  : {
                      ...(deck.floatingRect ?? {}),
                      ...patch.floatingRect,
                    },
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
          housePolygon: input.housePolygon,
        })
      : deck,
  );
}

function buildHouseFirstOpeningPatchFromObjectPatch(
  patch: ObjectWorkbenchOpeningPatch,
): Partial<HouseFirstOpeningDraft> {
  return patch as Partial<HouseFirstOpeningDraft>;
}

export function applyObjectWorkbenchOpeningPatch(input: {
  activeModuleInput: CalculatorModuleInputs | null;
  currentOpenings: ObjectWorkbenchCompatibilityOpeningDraft[];
  openingId: string;
  houseAssembly: HouseAssemblyModel | null;
  house: HouseModel | null;
  patch: ObjectWorkbenchOpeningPatch;
}): ObjectWorkbenchCompatibilityOpeningDraft[] {
  const compatibilityPatch = buildHouseFirstOpeningPatchFromObjectPatch(input.patch);
  const patch = normalizeOpeningPatchAgainstDerivedWalls({
    activeModuleInput: input.activeModuleInput,
    currentOpening: input.currentOpenings.find((opening) => opening.id === input.openingId) ?? {
      id: input.openingId,
    },
    houseAssembly: input.houseAssembly,
    house: input.house,
    patch: compatibilityPatch,
  });

  return input.currentOpenings.map((opening) => {
    if (opening.id !== input.openingId) return opening;
    const nextKind =
      patch.kind === undefined
        ? normalizeWallOpeningKind(opening.kind)
        : normalizeWallOpeningKind(patch.kind);
    return {
      ...opening,
      ...patch,
      kind: nextKind,
      panelCount:
        patch.panelCount !== undefined || patch.kind !== undefined
          ? resolveOpeningPanelCount(nextKind, patch.panelCount ?? opening.panelCount)
          : opening.panelCount ?? resolveOpeningPanelCount(nextKind, opening.panelCount),
      ...(patch.wallId !== undefined &&
      patch.hostWallId === undefined &&
      patch.hostEdgeId === undefined
        ? { hostWallId: null, hostEdgeId: null }
        : null),
    };
  });
}

export function resolveDeckReferencePolygon(
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

function buildHouseFirstRoofDraftFromIntent(roof: HouseFormRoofIntentModel): HouseFirstRoofDraft {
  return {
    form: roof.form,
    material: roof.material,
    primaryPitchDeg: roof.primaryPitchDeg,
    primaryFallDirection: roof.primaryFallDirection,
    ridgeAxis: roof.ridgeAxis,
    openGableEndIds: roof.openGableEndIds,
    appendage: roof.appendage,
  };
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

export function mergeHouseFormRoofIntentAfterFootprintSync(input: {
  previewHouseForm: ObjectFirstHouseFormDraft;
  existingHouseForm: ObjectFirstHouseFormDraft | null;
  terminalEndIds: ReadonlySet<string>;
}): ObjectFirstHouseFormDraft {
  const { previewHouseForm, existingHouseForm, terminalEndIds } = input;
  if (!existingHouseForm?.roofIntentAuthored) return previewHouseForm;

  const existingRoof = existingHouseForm.roofIntent;
  const previewRoof = previewHouseForm.roofIntent;
  const form = existingRoof.form;
  const behavior = getHouseRoofFormBehavior(form);
  const openGableEndIds =
    form === 'gable'
      ? existingRoof.openGableEndIds.filter((id) => terminalEndIds.has(id))
      : [];

  return {
    ...previewHouseForm,
    roofIntentAuthored: true,
    roofIntent: {
      ...previewRoof,
      form,
      material: existingRoof.material,
      primaryPitchDeg: behavior.controls.pitch ? existingRoof.primaryPitchDeg : '0',
      primaryFallDirection: behavior.controls.primaryFallDirection
        ? existingRoof.primaryFallDirection
        : 'negative_y',
      ridgeAxis: behavior.controls.ridgeAxis ? previewRoof.ridgeAxis : 'x',
      openGableEndIds,
      appendage: behavior.controls.appendage
        ? existingRoof.appendage
        : {
            ...previewRoof.appendage,
            enabled: false,
          },
    },
  };
}

export function buildObjectWorkbenchRoofCommitDraft(input: {
  draft: EstimateDrawingDraft;
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  roof: HouseFormRoofIntentModel;
}): EstimateDrawingDraft {
  const normalizedRoof = normalizeSharedHouseRoofDraftForCommit(
    buildHouseFirstRoofDraftFromIntent(input.roof),
  );
  const nextObjectFirstDraft: ObjectFirstWorkbenchDraftVNext = {
    ...input.objectFirstDraft,
    houseAssembly: input.objectFirstDraft.houseAssembly
      ? {
          ...input.objectFirstDraft.houseAssembly,
          houseForms: input.objectFirstDraft.houseAssembly.houseForms.map((houseForm, index) =>
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
      : input.objectFirstDraft.houseAssembly,
  };
  return updateDraftObjectFirst({
    draft: mirrorSharedRoofDraftToModules(input.draft, normalizedRoof),
    objectFirst: nextObjectFirstDraft,
  });
}

export function buildNewObjectWorkbenchDeckDraft(input: {
  deckId: string;
  deckIndex: number;
  hostEdgeId: string;
  housePolygon: Array<{ alongM: string; depthM: string }>;
  mode: 'preset' | 'custom_outline';
}): ObjectWorkbenchCompatibilityDeckDraft {
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

export function buildNewObjectWorkbenchOpeningDraft(input: {
  currentOpenings: ObjectWorkbenchCompatibilityOpeningDraft[];
  kind: 'window' | 'hinged_door' | 'slider' | 'stacker';
  openingId: string;
  hostWallId: string | null;
  hostEdgeId: string | null;
  wallId: WallOpeningHostSide;
}): ObjectWorkbenchCompatibilityOpeningDraft {
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

export function nextObjectWorkbenchDeckId(existing: ObjectWorkbenchCompatibilityDeckDraft[]): string {
  return nextDeckId(existing);
}

export function nextObjectWorkbenchOpeningId(existing: ObjectWorkbenchCompatibilityOpeningDraft[]): string {
  return nextOpeningId(existing);
}
