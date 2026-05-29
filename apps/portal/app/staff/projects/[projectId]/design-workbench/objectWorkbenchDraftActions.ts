import {
  buildHouseFootprintPresetSideLocalPoints,
  getHouseRoofFormBehavior,
  isHouseRoofForm,
  normalizeHouseRoofPitchInputForForm,
} from '@sp/geometry';
import {
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type {
  CalculatorHouseFootprintPolygonPoint,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  buildDeckReferenceHousePolygon,
  resolveDeckHostEdgeFrame,
  resolveDeckPresetGeometry,
  sanitizeDeckPresetRect,
} from '@/lib/drawings/state/objectWorkbenchDeckGeometry';
import type {
  DerivedWallModel,
  HouseAssemblyModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
  ObjectFirstDeckDraft,
  ObjectFirstHouseFormDraft,
  ObjectFirstOpeningDraft,
  ObjectFirstPergolaDraft,
  ObjectFirstWorkbenchDraftVNext,
  PergolaAttachment,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { pergolaAttachmentFromLegacyFields } from '@/lib/drawings/state/pergolaAttachment';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchPergolaInspectorModel,
  ObjectWorkbenchPergolaPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';

type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;

export type ObjectWorkbenchDeckDraft = ObjectFirstDeckDraft;
export type ObjectWorkbenchOpeningDraft = ObjectFirstOpeningDraft;
export type ObjectWorkbenchPergolaDraft = ObjectFirstPergolaDraft;

export type ObjectWorkbenchObjectPatchCommit =
  | {
      target: { family: 'decks'; objectId: string };
      patch: ObjectWorkbenchDeckPatch;
    }
  | {
      target: { family: 'openings'; objectId: string };
      patch: ObjectWorkbenchOpeningPatch;
    }
  | {
      target: { family: 'pergolas'; objectId: string };
      patch: ObjectWorkbenchPergolaPatch;
    };

export type ObjectWorkbenchDraftBuildResult =
  | { ok: true; draft: EstimateDrawingDraft }
  | { ok: false; error: string };

export type ObjectWorkbenchDeckMutationInput = {
  currentDecks: ObjectWorkbenchDeckDraft[];
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
};

export type ObjectWorkbenchOpeningMutationInput = {
  currentOpenings: ObjectWorkbenchOpeningDraft[];
};

type OpeningHostWallOption = {
  wallId: string;
  label: string;
  semanticSide: AttachmentSide | null;
  hostEdgeId: string | null;
  spanM: number;
};

export function resolveCurrentObjectWorkbenchDeckDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchDeckDraft[] {
  return objectFirstDraft.decks;
}

export function resolveCurrentObjectWorkbenchOpeningDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchOpeningDraft[] {
  return objectFirstDraft.openings;
}

export function resolveCurrentObjectWorkbenchPergolaDrafts(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): ObjectWorkbenchPergolaDraft[] {
  return objectFirstDraft.pergolas;
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

export function buildObjectFirstDraftWithDecks(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  decks: ObjectWorkbenchDeckDraft[];
}): ObjectFirstWorkbenchDraftVNext {
  return {
    ...input.objectFirstDraft,
    decks: input.decks,
  };
}

export function buildObjectFirstDraftWithOpenings(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  openings: ObjectWorkbenchOpeningDraft[];
  sourceFormId: string | null;
}): ObjectFirstWorkbenchDraftVNext {
  return {
    ...input.objectFirstDraft,
    openings: input.openings.map((opening) => ({
      ...opening,
      sourceFormId: opening.sourceFormId ?? input.sourceFormId ?? undefined,
    })),
  };
}

export function buildObjectFirstDraftWithPergolas(input: {
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  pergolas: ObjectWorkbenchPergolaDraft[];
}): ObjectFirstWorkbenchDraftVNext {
  return {
    ...input.objectFirstDraft,
    pergolas: input.pergolas,
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

function houseFormLocalPolygon(input: {
  houseForm: HouseFormModel;
  moduleLengthM: string | undefined;
  moduleProjectionM: string | undefined;
}): CalculatorHouseFootprintPolygonPoint[] {
  if (input.houseForm.footprint.mode === 'custom_polygon' && input.houseForm.footprint.polygon.length) {
    return input.houseForm.footprint.polygon;
  }
  const widthMm = Math.round((Number(input.moduleLengthM) || 6) * 1000);
  const depthMm = Math.round((Number(input.moduleProjectionM) || 3) * 1000);
  return buildHouseFootprintPresetSideLocalPoints({
    pergolaWidthMm: widthMm,
    pergolaDepthMm: depthMm,
    preset: input.houseForm.footprint.preset,
    params: input.houseForm.footprint.params,
    attachmentSide: input.houseForm.footprint.attachmentSide,
  }).map((point) => ({
    alongM: String(point.alongM),
    depthM: String(point.depthM),
  }));
}

function buildOpeningHostWallOptions(input: {
  activeModuleInput: CalculatorModuleInputs | null;
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
}): OpeningHostWallOption[] {
  const walls = input.houseAssembly?.derivedEnvelope?.wallGraph.walls ?? [];
  if (!walls.length) return [];
  const wallPolygon = input.houseForm
    ? houseFormLocalPolygon({
        houseForm: input.houseForm,
        moduleLengthM: input.activeModuleInput?.lengthM,
        moduleProjectionM: input.activeModuleInput?.projectionM,
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
  opening: ObjectWorkbenchOpeningDraft;
  patch: ObjectWorkbenchOpeningPatch;
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
  currentOpening: ObjectWorkbenchOpeningDraft;
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  patch: ObjectWorkbenchOpeningPatch;
}): ObjectWorkbenchOpeningPatch {
  if (input.patch.hostWallId === undefined) return input.patch;

  const resolvedWall = buildOpeningHostWallOptions({
    activeModuleInput: input.activeModuleInput,
    houseAssembly: input.houseAssembly,
    houseForm: input.houseForm,
  }).find((wall) => wall.wallId === input.patch.hostWallId);
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
  houseForm: HouseFormModel | null;
  preferredHostWallId: string | null;
  preferredSide: AttachmentSide;
}): OpeningHostWallOption | null {
  const options = buildOpeningHostWallOptions({
    activeModuleInput: input.activeModuleInput,
    houseAssembly: input.houseAssembly,
    houseForm: input.houseForm,
  });
  if (!options.length) return null;

  if (input.preferredHostWallId) {
    const preferredWall = options.find((option) => option.wallId === input.preferredHostWallId);
    if (preferredWall) return preferredWall;
  }

  const matchingSide = options.filter((option) => option.semanticSide === input.preferredSide);
  if (matchingSide.length === 1) return matchingSide[0]!;
  return options[0] ?? null;
}


export function upsertObjectWorkbenchPergolaDrafts(
  currentPergolas: ObjectWorkbenchPergolaDraft[],
  pergolaId: string,
  patch: Partial<ObjectWorkbenchPergolaDraft>,
  fallbackPergola?: ObjectWorkbenchPergolaInspectorModel | ObjectFirstPergolaDraft | null,
): ObjectWorkbenchPergolaDraft[] {
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
      label: fallbackPergola?.label ?? pergolaId,
      family: fallbackPergola?.family ?? 'unknown',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: fallbackPergola?.side ?? 'rear',
      strategy: fallbackPergola?.strategy ?? null,
      ...patch,
    },
  ];
}

function mergePergolaGeometryDraft(
  current: ObjectWorkbenchPergolaDraft['geometry'] | null | undefined,
  patch: ObjectWorkbenchPergolaPatch['geometry'] | undefined,
): ObjectWorkbenchPergolaDraft['geometry'] | null | undefined {
  if (patch === undefined) return current;
  if (patch === null) return null;
  return {
    ...(current ?? {}),
    ...patch,
    dimensions:
      patch.dimensions === undefined
        ? current?.dimensions
        : {
            ...(current?.dimensions ?? {}),
            ...patch.dimensions,
          },
    roof:
      patch.roof === undefined
        ? current?.roof
        : {
            ...(current?.roof ?? {}),
            ...patch.roof,
          },
    gable:
      patch.gable === undefined
        ? current?.gable
        : {
            ...(current?.gable ?? {}),
            ...patch.gable,
          },
    supports:
      patch.supports === undefined
        ? current?.supports
        : {
            ...(current?.supports ?? {}),
            ...patch.supports,
          },
    overrides:
      patch.overrides === undefined
        ? current?.overrides
        : {
            ...(current?.overrides ?? {}),
            ...patch.overrides,
          },
  };
}

/**
 * Step 8 follow-up #2 (lazy attachment migration). When a legacy pergola
 * (no `attachment` set, but with `connectionKind` + optional `strategy`) is
 * patched for any reason, derive a `PergolaAttachment` from the post-patch
 * legacy fields and write it through alongside the patch. The migration is
 * one-time per pergola: subsequent patches see `currentPergola.attachment`
 * already set and skip derivation.
 *
 * Derivation reads from `{...currentPergola, ...patch}` so a patch that
 * changes `connectionKind` (legacy inspector path) produces an attachment
 * matching the new state, not the stale pre-patch state.
 *
 * Returns `undefined` (= no attachment in the merged patch) when the caller
 * already supplied one, or when the pergola is fully snap-managed.
 */
function deriveLazyAttachmentForPergolaPatch(input: {
  currentPergola: ObjectWorkbenchPergolaDraft | null;
  patch: ObjectWorkbenchPergolaPatch;
}): PergolaAttachment | undefined {
  if (input.patch.attachment !== undefined) return undefined;
  if (input.currentPergola?.attachment) return undefined;
  const postPatch = { ...(input.currentPergola ?? {}), ...input.patch };
  return pergolaAttachmentFromLegacyFields({
    connectionKind: postPatch.connectionKind ?? null,
    strategy: postPatch.strategy ?? null,
  });
}

export function applyObjectWorkbenchPergolaPatch(input: {
  currentPergolas: ObjectWorkbenchPergolaDraft[];
  pergolaId: string;
  patch: ObjectWorkbenchPergolaPatch;
  fallbackPergola?: ObjectWorkbenchPergolaInspectorModel | ObjectFirstPergolaDraft | null;
}): ObjectWorkbenchPergolaDraft[] {
  const currentPergola = input.currentPergolas.find((pergola) => pergola.id === input.pergolaId) ?? null;
  const lazyAttachment = deriveLazyAttachmentForPergolaPatch({ currentPergola, patch: input.patch });
  return upsertObjectWorkbenchPergolaDrafts(
    input.currentPergolas,
    input.pergolaId,
    {
      ...input.patch,
      ...(input.patch.geometry !== undefined
        ? { geometry: mergePergolaGeometryDraft(currentPergola?.geometry, input.patch.geometry) }
        : null),
      ...(lazyAttachment ? { attachment: lazyAttachment } : null),
    },
    input.fallbackPergola,
  );
}

function resolveObjectWorkbenchDeckDraftGeometry(input: {
  deck: ObjectWorkbenchDeckDraft;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
}): ObjectWorkbenchDeckDraft {
  const resolved = resolveDeckPresetGeometry({
    deck: {
      ...input.deck,
      name: input.deck.label,
    },
    housePolygon: input.housePolygon,
  });

  return {
    ...input.deck,
    hostEdgeId: resolved.hostEdgeId,
    attachmentMode: resolved.attachmentMode,
    primaryHostEdgeId: resolved.primaryHostEdgeId,
    secondaryHostEdgeId: resolved.secondaryHostEdgeId,
    cornerVertexId: resolved.cornerVertexId,
    presetRect: resolved.presetRect,
    floatingRect: resolved.floatingRect,
    outline: resolved.outline,
  };
}

export function applyObjectWorkbenchDeckPatch(input: {
  currentDecks: ObjectWorkbenchDeckDraft[];
  deckId: string;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  patch: ObjectWorkbenchDeckPatch;
}): ObjectWorkbenchDeckDraft[] {
  return input.currentDecks.map((deck) => {
    if (deck.id !== input.deckId) return deck;
    const patch = input.patch;
    return resolveObjectWorkbenchDeckDraftGeometry({
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
    });
  });
}

export function applyObjectWorkbenchOpeningPatch(input: {
  activeModuleInput: CalculatorModuleInputs | null;
  currentOpenings: ObjectWorkbenchOpeningDraft[];
  openingId: string;
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  patch: ObjectWorkbenchOpeningPatch;
}): ObjectWorkbenchOpeningDraft[] {
  const patch = normalizeOpeningPatchAgainstDerivedWalls({
    activeModuleInput: input.activeModuleInput,
    currentOpening: input.currentOpenings.find((opening) => opening.id === input.openingId) ?? {
      id: input.openingId,
      label: input.openingId,
      kind: 'window',
      panelCount: null,
      hostWallId: null,
      widthM: '0',
      heightM: '0',
      sillHeightM: '0',
      offsetAlongWallM: '0',
    },
    houseAssembly: input.houseAssembly,
    houseForm: input.houseForm,
    patch: input.patch,
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
  houseForm: HouseFormModel | null,
  activeModuleInput: CalculatorModuleInputs | null,
): CalculatorHouseFootprintPolygonPoint[] {
  return houseForm
    ? buildDeckReferenceHousePolygon({
        housePolygon: houseFormLocalPolygon({
          houseForm,
          moduleLengthM: activeModuleInput?.lengthM,
          moduleProjectionM: activeModuleInput?.projectionM,
        }),
        footprintParams: houseForm.footprint.params,
      })
    : [];
}

function mirrorSharedRoofDraftToModules(
  draft: EstimateDrawingDraft,
  roof: HouseFormRoofIntentModel,
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

function normalizeSharedHouseRoofIntentForCommit(roof: HouseFormRoofIntentModel): HouseFormRoofIntentModel {
  const form = isHouseRoofForm(roof.form) ? roof.form : 'mono';
  const behavior = getHouseRoofFormBehavior(form);
  const pitchDeg = normalizeHouseRoofPitchInputForForm({
    roofForm: form,
    value: roof.primaryPitchDeg,
  });

  return {
    ...roof,
    form,
    primaryPitchDeg: behavior.controls.pitch ? pitchDeg : '0',
    primaryFallDirection: behavior.controls.primaryFallDirection ? roof.primaryFallDirection : 'negative_y',
    ridgeAxis: behavior.controls.ridgeAxis ? roof.ridgeAxis : 'x',
    // Milestone 13 session C: openGableEndIds applies to `'hipped'`
    // only -- legacy `'gable'` was retired from the type union and is
    // mapped to `'hipped'` at the normalize boundary. Forms without
    // terminal ends (flat, mono) still have the field cleared.
    openGableEndIds: form === 'hipped' ? roof.openGableEndIds ?? [] : [],
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
  // Milestone 13 session C: openGableEndIds applies to `'hipped'` only.
  const openGableEndIds =
    form === 'hipped'
      ? existingRoof.openGableEndIds.filter((id) => terminalEndIds.has(id))
      : [];

  return {
    ...previewHouseForm,
    roofIntentAuthored: true,
    roofIntent: {
      ...previewRoof,
      form,
      material: existingRoof.material,
      primaryPitchDeg: normalizeHouseRoofPitchInputForForm({
        roofForm: form,
        value: existingRoof.primaryPitchDeg,
        fallbackValue: previewRoof.primaryPitchDeg,
      }),
      primaryFallDirection: behavior.controls.primaryFallDirection
        ? existingRoof.primaryFallDirection
        : 'negative_y',
      ridgeAxis: behavior.controls.ridgeAxis ? previewRoof.ridgeAxis : 'x',
      openGableEndIds,
    },
  };
}

export function buildObjectWorkbenchRoofCommitDraft(input: {
  draft: EstimateDrawingDraft;
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  roof: HouseFormRoofIntentModel;
}): EstimateDrawingDraft {
  const normalizedRoof = normalizeSharedHouseRoofIntentForCommit(input.roof);
  const nextObjectFirstDraft: ObjectFirstWorkbenchDraftVNext = {
    ...input.objectFirstDraft,
    houseAssembly: input.objectFirstDraft.houseAssembly
      ? {
          ...input.objectFirstDraft.houseAssembly,
          houseForms: input.objectFirstDraft.houseAssembly.houseForms.map((houseForm, index) =>
            index === 0
              ? {
                  ...houseForm,
                  roofIntentAuthored: true,
                  roofIntent: normalizedRoof,
                }
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
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  mode: 'preset' | 'custom_outline';
  /**
   * PR-D (2026-05-22): id of the host house form. Becomes
   * `attachment.host.objectId` on the new deck (replaces the PR9
   * `hostHouseFormId` band-aid). Required when adding a deck while a
   * form is selected; if null, the deck is born freestanding and the
   * read path routes via null-fallback to the synthesized primary.
   */
  hostHouseFormObjectId?: string | null;
}): ObjectWorkbenchDeckDraft {
  const baseDeck: ObjectWorkbenchDeckDraft = {
    id: input.deckId,
    label: `Deck ${input.deckIndex + 1}`,
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
    outline: [],
    // PR-D: snap-derived attachment. `host.edgeId` is empty when the
    // snap has not resolved yet (PR-F populates it via drag-to-wall);
    // `host.objectId` is the routing key the read path uses today.
    attachment: input.hostHouseFormObjectId
      ? {
          host: {
            objectFamily: 'house_forms',
            objectId: input.hostHouseFormObjectId,
            edgeKind: 'wall',
            edgeId: '',
            myEdgeIndex: 0,
          },
          spatialKind: 'wall',
        }
      : null,
  };
  if (input.mode === 'custom_outline') return baseDeck;
  return resolveObjectWorkbenchDeckDraftGeometry({
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
  currentOpenings: ObjectWorkbenchOpeningDraft[];
  kind: 'window' | 'hinged_door' | 'slider' | 'stacker';
  openingId: string;
  sourceFormId: string | null;
  hostWallId: string | null;
  hostEdgeId: string | null;
  wallId: AttachmentSide;
}): ObjectWorkbenchOpeningDraft {
  const baseOpening: ObjectWorkbenchOpeningDraft =
    input.kind === 'slider'
      ? {
          id: input.openingId,
          label: `Slider ${
            input.currentOpenings.filter((opening) => normalizeWallOpeningKind(opening.kind) === 'slider').length + 1
          }`,
          kind: 'slider',
          panelCount: 2,
          sourceFormId: input.sourceFormId ?? undefined,
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
            sourceFormId: input.sourceFormId ?? undefined,
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
              sourceFormId: input.sourceFormId ?? undefined,
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
              sourceFormId: input.sourceFormId ?? undefined,
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

export function nextObjectWorkbenchDeckId(existing: ObjectWorkbenchDeckDraft[]): string {
  const used = new Set(existing.map((deck) => deck.id));
  let index = existing.length + 1;
  while (used.has(`deck-${index}`)) index += 1;
  return `deck-${index}`;
}

export function nextObjectWorkbenchOpeningId(existing: ObjectWorkbenchOpeningDraft[]): string {
  const used = new Set(existing.map((opening) => opening.id));
  let index = existing.length + 1;
  while (used.has(`opening-${index}`)) index += 1;
  return `opening-${index}`;
}
