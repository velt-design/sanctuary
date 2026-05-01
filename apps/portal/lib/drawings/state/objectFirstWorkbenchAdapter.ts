import type {
  HouseFormModel,
  ObjectFirstHouseAssemblyDraft,
  ObjectFirstHouseFormDraft,
  ObjectFirstWorkbenchDraftVNext,
  ObjectFirstWorkbenchProjectModel,
} from './objectFirstWorkbenchModel';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';

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
