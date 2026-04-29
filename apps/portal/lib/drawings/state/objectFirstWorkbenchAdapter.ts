import type {
  DeckObjectModel,
  HouseFormModel,
  ObjectFirstWorkbenchProjectModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';
import type {
  HouseFirstMigrationWarning,
  HouseFirstWorkbenchProjectModel,
  HouseModel,
  PergolaModel,
} from './houseFirstWorkbenchModel';

function buildHouseFormFromCompatibilityHouse(house: HouseModel): HouseFormModel {
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
    roofIntent: {
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
    },
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

function buildDeckObjects(house: HouseModel | null): DeckObjectModel[] {
  return (house?.decks ?? []).map((deck) => ({
    id: deck.id,
    label: deck.name,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: deck.levelOffsetMm,
    isAttached: deck.isAttached,
    surfaceMaterial: deck.surfaceMaterial,
    hostEdgeId: deck.hostEdgeId,
  }));
}

function buildOpeningObjects(house: HouseModel | null): OpeningObjectModel[] {
  return (house?.openings ?? []).map((opening) => ({
    id: opening.id,
    label: opening.label,
    kind: opening.kind,
    panelCount: opening.panelCount,
    hostWallId: opening.hostWallId,
    sourceFormId: house?.id ?? null,
    widthM: opening.widthM,
    heightM: opening.heightM,
    sillHeightM: opening.sillHeightM,
    offsetAlongWallM: opening.offsetAlongWallM,
  }));
}

function buildPergolaObjects(pergolas: PergolaModel[]): PergolaObjectModel[] {
  return pergolas.map((pergola) => ({
    id: pergola.id,
    label: pergola.label,
    family: pergola.family,
    attachmentEdgeId: pergola.attachment.attachmentEdgeId,
    attachmentZoneId: pergola.attachment.attachmentZoneId,
    side: pergola.attachment.side,
    strategy: pergola.attachment.strategy,
  }));
}

function formatWarning(warning: HouseFirstMigrationWarning): string {
  return warning.message;
}

export function buildObjectFirstWorkbenchProjectModel(input: {
  compatibilityProjectModel: HouseFirstWorkbenchProjectModel;
}): ObjectFirstWorkbenchProjectModel {
  const house = input.compatibilityProjectModel.house;
  const houseForm = house ? buildHouseFormFromCompatibilityHouse(house) : null;

  return {
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
}
