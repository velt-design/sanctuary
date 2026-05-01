import type {
  DeckObjectModel,
  HouseFormModel,
  ObjectFirstDeckDraft,
  ObjectFirstHouseAssemblyDraft,
  ObjectFirstHouseFormDraft,
  ObjectFirstOpeningDraft,
  ObjectFirstPergolaDraft,
  ObjectFirstWorkbenchDraftVNext,
  ObjectFirstWorkbenchProjectModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchCompatibilityDeckDraft,
  ObjectWorkbenchCompatibilityMigrationWarning,
  ObjectWorkbenchCompatibilityOpeningDraft,
  ObjectWorkbenchCompatibilityPergolaDraft,
  ObjectWorkbenchCompatibilityRoofDraft,
  ObjectWorkbenchCompatibilityProjectModel,
  ObjectWorkbenchCompatibilityHouseModel,
  ObjectWorkbenchCompatibilityPergolaModel,
} from './compat/objectWorkbenchCompatibilityModel';

export type {
  ObjectWorkbenchCompatibilityDraft,
  ObjectWorkbenchCompatibilityProjectModel,
} from './compat/objectWorkbenchCompatibilityModel';

function buildRoofIntentFromCompatibilityHouse(house: ObjectWorkbenchCompatibilityHouseModel): HouseFormModel['roofIntent'] {
  return {
    form: house.roof.form,
    material: house.roof.material,
    primaryPitchDeg: house.roof.primaryPitchDeg,
    primaryFallDirection: house.roof.primaryFallDirection,
    ridgeAxis: house.roof.ridgeAxis,
    openGableEndIds: house.roof.openGableEndIds,
    appendage: {
      enabled: house.roof.appendage.enabled,
      form: house.roof.appendage.form,
      hostEdge: house.roof.appendage.hostEdge,
      pitchDeg: house.roof.appendage.pitchDeg,
      dropMm: house.roof.appendage.dropMm,
    },
  };
}

function buildHouseFormFromCompatibilityHouse(house: ObjectWorkbenchCompatibilityHouseModel): HouseFormModel {
  return {
    id: house.id,
    label: house.label,
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: house.footprint.drawingRotationQuarterTurns,
    },
    footprint: {
      mode: house.footprint.mode,
      preset: house.footprint.preset,
      params: house.footprint.params,
      polygon: house.footprint.polygon,
      attachmentSide: house.footprint.attachmentSide,
    },
    roofIntent: buildRoofIntentFromCompatibilityHouse(house),
    storeyMode: house.storeyMode,
    attachmentStrategy: house.attachmentStrategy,
    eaveHeightM: house.eaveHeightM,
    wallHeightM: house.wallHeightM,
    soffitDepthMm: house.soffitDepthMm,
    fasciaHeightMm: house.fasciaHeightMm,
    gutterWidthMm: house.gutterWidthMm,
    gutterDepthMm: house.gutterDepthMm,
    gutterProjectionMm: house.gutterProjectionMm,
    eaveOverhangMm: house.eaveOverhangMm,
    sourceModuleIndexes: house.sourceModuleIndexes,
    sourceModuleIds: house.sourceModuleIds,
  };
}

function buildDeckObjects(house: ObjectWorkbenchCompatibilityHouseModel | null): DeckObjectModel[] {
  return (house?.decks ?? []).flatMap((deck) =>
    deck
      ? [
          {
            id: deck.id,
            label: deck.name ?? deck.id,
            kind: deck.kind,
            shape: deck.shape,
            presetType: deck.presetType,
            presetRect: deck.presetRect,
            floatingRect: deck.floatingRect,
            outline: deck.outline,
            elevationMode: deck.elevationMode,
            levelOffsetMm: deck.levelOffsetMm,
            isAttached: deck.isAttached,
            surfaceMaterial: deck.surfaceMaterial,
            hostEdgeId: deck.hostEdgeId,
            attachmentMode: deck.attachmentMode,
            primaryHostEdgeId: deck.primaryHostEdgeId,
            secondaryHostEdgeId: deck.secondaryHostEdgeId,
            cornerVertexId: deck.cornerVertexId,
            topSurfaceElevationMm: deck.topSurfaceElevationMm,
            supportContext: deck.supportContext,
            validation: deck.validation,
          },
        ]
      : [],
  );
}

function buildOpeningObjects(house: ObjectWorkbenchCompatibilityHouseModel | null): OpeningObjectModel[] {
  return (house?.openings ?? []).map((opening) => ({
    id: opening.id,
    label: opening.label,
    kind: opening.kind,
    panelCount: opening.panelCount,
    hostWallId: opening.hostWallId,
    sourceFormId: house?.id ?? null,
    wallId: opening.wallId,
    hostEdgeId: opening.hostEdgeId,
    widthM: opening.widthM,
    heightM: opening.heightM,
    sillHeightM: opening.sillHeightM,
    offsetAlongWallM: opening.offsetAlongWallM,
    validation: opening.validation,
  }));
}

function buildPergolaObjects(pergolas: ObjectWorkbenchCompatibilityPergolaModel[]): PergolaObjectModel[] {
  return pergolas.map((pergola) => ({
    id: pergola.id,
    label: pergola.label,
    family: pergola.family,
    connectionKind: pergola.attachment.kind,
    attachmentEdgeId: pergola.attachment.attachmentEdgeId,
    attachmentZoneId: pergola.attachment.attachmentZoneId,
    side: pergola.attachment.side,
    strategy: pergola.attachment.strategy,
  }));
}

function formatWarning(warning: ObjectWorkbenchCompatibilityMigrationWarning): string {
  return warning.message;
}

function buildHouseFormDraftFromModel(houseForm: HouseFormModel): ObjectFirstHouseFormDraft {
  return {
    id: houseForm.id,
    label: houseForm.label,
    transform: houseForm.transform,
    footprint: houseForm.footprint,
    roofIntent: houseForm.roofIntent,
    roofIntentAuthored: houseForm.roofIntentAuthored,
    storeyMode: houseForm.storeyMode,
    attachmentStrategy: houseForm.attachmentStrategy,
    eaveHeightM: houseForm.eaveHeightM,
    wallHeightM: houseForm.wallHeightM,
    soffitDepthMm: houseForm.soffitDepthMm,
    fasciaHeightMm: houseForm.fasciaHeightMm,
    gutterWidthMm: houseForm.gutterWidthMm,
    gutterDepthMm: houseForm.gutterDepthMm,
    gutterProjectionMm: houseForm.gutterProjectionMm,
    eaveOverhangMm: houseForm.eaveOverhangMm,
  };
}

function buildHouseAssemblyDraftFromProject(
  projectModel: ObjectFirstWorkbenchProjectModel,
): ObjectFirstHouseAssemblyDraft | null {
  const houseAssembly = projectModel.houseAssembly;
  if (!houseAssembly) return null;
  return {
    id: houseAssembly.id,
    label: houseAssembly.label,
    houseForms: houseAssembly.houseForms.map(buildHouseFormDraftFromModel),
  };
}

export function buildObjectFirstDeckDraftsFromCompatibilityDrafts(
  decks: ObjectWorkbenchCompatibilityDeckDraft[] | null | undefined,
): ObjectFirstDeckDraft[] {
  return (decks ?? []).map((deck, index) => ({
    id: deck.id,
    label: deck.name?.trim() || `Deck ${index + 1}`,
    kind: deck.kind ?? 'deck',
    shape: deck.shape ?? 'preset',
    presetType: deck.presetType ?? null,
    presetRect: deck.presetRect ?? null,
    floatingRect: deck.floatingRect ?? null,
    outline: deck.outline ?? [],
    elevationMode: deck.elevationMode ?? 'ground',
    levelOffsetMm: deck.levelOffsetMm?.trim() || '0',
    isAttached: deck.isAttached ?? true,
    surfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
    hostEdgeId: deck.hostEdgeId ?? null,
    attachmentMode: deck.attachmentMode ?? null,
    primaryHostEdgeId: deck.primaryHostEdgeId ?? null,
    secondaryHostEdgeId: deck.secondaryHostEdgeId ?? null,
    cornerVertexId: deck.cornerVertexId ?? null,
  }));
}

export function buildObjectFirstDeckDraftsFromHouseFirstDrafts(
  decks: ObjectWorkbenchCompatibilityDeckDraft[] | null | undefined,
): ObjectFirstDeckDraft[] {
  return buildObjectFirstDeckDraftsFromCompatibilityDrafts(decks);
}

export function buildObjectFirstOpeningDraftsFromCompatibilityDrafts(
  openings: ObjectWorkbenchCompatibilityOpeningDraft[] | null | undefined,
  sourceFormId: string | null = null,
): ObjectFirstOpeningDraft[] {
  return (openings ?? []).map((opening, index) => ({
    id: opening.id,
    label: opening.label?.trim() || `Opening ${index + 1}`,
    kind: opening.kind ?? 'window',
    panelCount: opening.panelCount ?? null,
    hostWallId: opening.hostWallId ?? null,
    sourceFormId,
    wallId: opening.wallId ?? null,
    hostEdgeId: opening.hostEdgeId ?? null,
    widthM: opening.widthM?.trim() || '0',
    heightM: opening.heightM?.trim() || '0',
    sillHeightM: opening.sillHeightM?.trim() || '0',
    offsetAlongWallM: opening.offsetAlongWallM?.trim() || '0',
  }));
}

export function buildObjectFirstOpeningDraftsFromHouseFirstDrafts(
  openings: ObjectWorkbenchCompatibilityOpeningDraft[] | null | undefined,
  sourceFormId: string | null = null,
): ObjectFirstOpeningDraft[] {
  return buildObjectFirstOpeningDraftsFromCompatibilityDrafts(openings, sourceFormId);
}

export function buildObjectFirstPergolaDraftsFromCompatibilityDrafts(
  pergolas: ObjectWorkbenchCompatibilityPergolaDraft[] | null | undefined,
  compatibilityPergolas: ObjectWorkbenchCompatibilityPergolaModel[] = [],
): ObjectFirstPergolaDraft[] {
  const compatibilityById = new Map(compatibilityPergolas.map((pergola) => [pergola.id, pergola]));
  return (pergolas ?? []).map((pergola) => {
    const compatibilityPergola = compatibilityById.get(pergola.id);
    return {
      id: pergola.id,
      label: compatibilityPergola?.label ?? pergola.id,
      family: compatibilityPergola?.family ?? 'unknown',
      connectionKind: compatibilityPergola?.attachment.kind,
      attachmentEdgeId: pergola.attachmentEdgeId ?? null,
      attachmentZoneId: pergola.attachmentZoneId ?? null,
      side: compatibilityPergola?.attachment.side ?? 'rear',
      strategy: compatibilityPergola?.attachment.strategy ?? null,
    };
  });
}

export function buildObjectFirstPergolaDraftsFromHouseFirstDrafts(
  pergolas: ObjectWorkbenchCompatibilityPergolaDraft[] | null | undefined,
  compatibilityPergolas: ObjectWorkbenchCompatibilityPergolaModel[] = [],
): ObjectFirstPergolaDraft[] {
  return buildObjectFirstPergolaDraftsFromCompatibilityDrafts(pergolas, compatibilityPergolas);
}

export function buildObjectFirstWorkbenchDraftFromProjectModel(
  projectModel: ObjectFirstWorkbenchProjectModel,
): ObjectFirstWorkbenchDraftVNext {
  return normalizeObjectFirstWorkbenchDraftVNext({
    houseAssembly: buildHouseAssemblyDraftFromProject(projectModel),
    decks: projectModel.decks,
    openings: projectModel.openings,
    pergolas: projectModel.pergolas,
  });
}

function buildDeckModelsFromDrafts(
  decks: ObjectFirstDeckDraft[],
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null,
): DeckObjectModel[] {
  const compatibilityDeckById = new Map((compatibilityHouse?.decks ?? []).map((deck) => [deck.id, deck]));
  return decks.map((deck) => {
    const compatibilityDeck = compatibilityDeckById.get(deck.id);
    return {
      ...deck,
      topSurfaceElevationMm: compatibilityDeck?.topSurfaceElevationMm,
      supportContext: compatibilityDeck?.supportContext,
      validation: compatibilityDeck?.validation,
    };
  });
}

function buildOpeningModelsFromDrafts(
  openings: ObjectFirstOpeningDraft[],
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null,
): OpeningObjectModel[] {
  const compatibilityOpeningById = new Map((compatibilityHouse?.openings ?? []).map((opening) => [opening.id, opening]));
  return openings.map((opening) => {
    const compatibilityOpening = compatibilityOpeningById.get(opening.id);
    return {
      ...opening,
      hostWallId: opening.hostWallId ?? compatibilityOpening?.hostWallId ?? null,
      wallId: opening.wallId ?? compatibilityOpening?.wallId ?? null,
      hostEdgeId: opening.hostEdgeId ?? compatibilityOpening?.hostEdgeId ?? null,
      validation: compatibilityOpening?.validation,
    };
  });
}

function buildPergolaModelsFromDrafts(pergolas: ObjectFirstPergolaDraft[]): PergolaObjectModel[] {
  return pergolas.map((pergola) => ({
    ...pergola,
  }));
}

function buildHouseAssemblyFromDraft(
  draft: ObjectFirstHouseAssemblyDraft | null,
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null,
) {
  if (!draft) return null;
  return {
    id: draft.id,
    label: draft.label,
    houseForms: draft.houseForms.map((houseForm) => {
      const compatibilitySource =
        compatibilityHouse && houseForm.id === compatibilityHouse.id
          ? compatibilityHouse
          : compatibilityHouse && draft.houseForms.length === 1
            ? compatibilityHouse
            : null;
      return {
        ...houseForm,
        ...(compatibilitySource
          ? { roofIntent: buildRoofIntentFromCompatibilityHouse(compatibilitySource) }
          : null),
        sourceModuleIndexes: compatibilitySource?.sourceModuleIndexes,
        sourceModuleIds: compatibilitySource?.sourceModuleIds,
      };
    }),
    derivedEnvelope: compatibilityHouse?.derivedEnvelope ?? null,
  };
}

export function buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft(
  objectFirstDraft: Partial<ObjectFirstWorkbenchDraftVNext> | null | undefined,
): {
  roof?: ObjectWorkbenchCompatibilityRoofDraft | null;
  decks?: ObjectWorkbenchCompatibilityDeckDraft[] | null;
  openings?: ObjectWorkbenchCompatibilityOpeningDraft[] | null;
  pergolas?: ObjectWorkbenchCompatibilityPergolaDraft[] | null;
} {
  const normalized = normalizeObjectFirstWorkbenchDraftVNext(objectFirstDraft);
  const houseForm = normalized.houseAssembly?.houseForms[0] ?? null;
  const roof = houseForm?.roofIntentAuthored
    ? {
        form: houseForm.roofIntent.form,
        material: houseForm.roofIntent.material,
        primaryPitchDeg: houseForm.roofIntent.primaryPitchDeg,
        primaryFallDirection: houseForm.roofIntent.primaryFallDirection,
        ridgeAxis: houseForm.roofIntent.ridgeAxis,
        openGableEndIds: houseForm.roofIntent.openGableEndIds,
        appendage: houseForm.roofIntent.appendage,
      }
    : null;
  return {
    ...(roof ? { roof } : null),
    decks: normalized.decks.map((deck) => ({
      id: deck.id,
      name: deck.label,
      kind: deck.kind,
      shape: deck.shape,
      presetType: deck.presetType,
      presetRect: deck.presetRect ?? null,
      floatingRect: deck.floatingRect ?? null,
      outline: deck.outline,
      elevationMode: deck.elevationMode,
      levelOffsetMm: deck.levelOffsetMm,
      hostEdgeId: deck.hostEdgeId,
      attachmentMode: deck.attachmentMode ?? null,
      primaryHostEdgeId: deck.primaryHostEdgeId ?? null,
      secondaryHostEdgeId: deck.secondaryHostEdgeId ?? null,
      cornerVertexId: deck.cornerVertexId ?? null,
      isAttached: deck.isAttached,
      surfaceMaterial: deck.surfaceMaterial,
    })),
    openings: normalized.openings.map((opening) => ({
      id: opening.id,
      label: opening.label,
      kind: opening.kind,
      panelCount: opening.panelCount,
      hostWallId: opening.hostWallId,
      wallId: opening.wallId ?? null,
      hostEdgeId: opening.hostEdgeId ?? null,
      widthM: opening.widthM,
      heightM: opening.heightM,
      sillHeightM: opening.sillHeightM,
      offsetAlongWallM: opening.offsetAlongWallM,
    })),
    pergolas: normalized.pergolas.map((pergola) => ({
      id: pergola.id,
      attachmentEdgeId: pergola.attachmentEdgeId,
      attachmentZoneId: pergola.attachmentZoneId,
    })),
  };
}

export function buildHouseFirstCompatibilityDraftFromObjectFirstDraft(
  objectFirstDraft: Partial<ObjectFirstWorkbenchDraftVNext> | null | undefined,
): ReturnType<typeof buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft> {
  return buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft(objectFirstDraft);
}

export function buildObjectFirstWorkbenchProjectModel(input: {
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel;
  objectFirstDraft?: Partial<ObjectFirstWorkbenchDraftVNext> | null;
}): ObjectFirstWorkbenchProjectModel {
  const house = input.compatibilityProjectModel.house;
  const houseForm = house ? buildHouseFormFromCompatibilityHouse(house) : null;
  const baseProject: ObjectFirstWorkbenchProjectModel = {
    source: 'legacy_estimate_snapshot',
    houseAssembly: house
      ? {
          id: 'assembly-main',
          label: house.label,
          houseForms: houseForm ? [houseForm] : [],
          derivedEnvelope: house.derivedEnvelope,
        }
      : null,
    decks: buildDeckObjects(house),
    openings: buildOpeningObjects(house),
    pergolas: buildPergolaObjects(input.compatibilityProjectModel.pergolas),
    warnings: input.compatibilityProjectModel.warnings.map(formatWarning),
  };

  if (input.objectFirstDraft === undefined || input.objectFirstDraft === null) {
    return baseProject;
  }

  const objectFirstDraft = normalizeObjectFirstWorkbenchDraftVNext(input.objectFirstDraft);

  return {
    source: 'legacy_estimate_snapshot',
    houseAssembly:
      objectFirstDraft.houseAssembly !== null
        ? buildHouseAssemblyFromDraft(objectFirstDraft.houseAssembly, house)
        : null,
    decks: buildDeckModelsFromDrafts(objectFirstDraft.decks, house),
    openings: buildOpeningModelsFromDrafts(objectFirstDraft.openings, house),
    pergolas: buildPergolaModelsFromDrafts(objectFirstDraft.pergolas),
    warnings: input.compatibilityProjectModel.warnings.map(formatWarning),
  };
}
