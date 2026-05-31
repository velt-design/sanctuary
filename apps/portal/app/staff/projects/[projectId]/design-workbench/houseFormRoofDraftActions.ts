import {
  getHouseRoofFormBehavior,
  isHouseRoofForm,
  normalizeHouseRoofPitchInputForForm,
} from '@sp/geometry';
import {
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type {
  HouseFormRoofIntentModel,
  ObjectFirstHouseFormDraft,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { deriveHouseFormRoofIntentForFootprint } from '@/lib/drawings/state/houseFormRoofIntentForFootprint';

export type HouseFormRoofIntentCommitDraftResult =
  | { ok: true; draft: EstimateDrawingDraft }
  | { ok: false; error: string };

function mirrorLegacySharedRoofDraftToModules(
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

function normalizeHouseFormRoofIntentForCommit(
  roof: HouseFormRoofIntentModel,
): HouseFormRoofIntentModel {
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
    openGableEndIds: form === 'hipped' ? roof.openGableEndIds ?? [] : [],
  };
}

function applyHouseFormRoofIntentCommit(input: {
  houseForm: ObjectFirstHouseFormDraft;
  roof: HouseFormRoofIntentModel;
}): ObjectFirstHouseFormDraft {
  const nextHouseForm: ObjectFirstHouseFormDraft = {
    ...input.houseForm,
    roofIntentAuthored: true,
    roofIntent: normalizeHouseFormRoofIntentForCommit(input.roof),
  };
  return {
    ...nextHouseForm,
    roofIntent: deriveHouseFormRoofIntentForFootprint({ houseForm: nextHouseForm }),
  };
}

export function buildHouseFormRoofIntentCommitDraft(input: {
  draft: EstimateDrawingDraft;
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  houseFormId: string;
  roof: HouseFormRoofIntentModel;
  mirrorToLegacyModules?: boolean;
}): HouseFormRoofIntentCommitDraftResult {
  const houseAssembly = input.objectFirstDraft.houseAssembly;
  if (!houseAssembly) {
    return { ok: false, error: 'No house forms are available.' };
  }
  let foundTarget = false;
  const houseForms = houseAssembly.houseForms.map((houseForm) => {
    if (houseForm.id !== input.houseFormId) return houseForm;
    foundTarget = true;
    return applyHouseFormRoofIntentCommit({
      houseForm,
      roof: input.roof,
    });
  });
  if (!foundTarget) {
    return { ok: false, error: 'This house form is no longer available.' };
  }
  const nextObjectFirstDraft: ObjectFirstWorkbenchDraftVNext = {
    ...input.objectFirstDraft,
    houseAssembly: {
      ...houseAssembly,
      houseForms,
    },
  };
  const normalizedRoof = normalizeHouseFormRoofIntentForCommit(input.roof);
  return {
    ok: true,
    draft: updateEstimateDrawingObjectFirstWorkbenchDraft({
      draft: input.mirrorToLegacyModules
        ? mirrorLegacySharedRoofDraftToModules(input.draft, normalizedRoof)
        : input.draft,
      objectFirst: nextObjectFirstDraft,
    }),
  };
}

export function buildLegacySharedHouseRoofCommitDraft(input: {
  draft: EstimateDrawingDraft;
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext;
  roof: HouseFormRoofIntentModel;
}): EstimateDrawingDraft {
  const firstHouseFormId = input.objectFirstDraft.houseAssembly?.houseForms[0]?.id ?? null;
  if (!firstHouseFormId) {
    return updateEstimateDrawingObjectFirstWorkbenchDraft({
      draft: input.draft,
      objectFirst: input.objectFirstDraft,
    });
  }
  const result = buildHouseFormRoofIntentCommitDraft({
    ...input,
    houseFormId: firstHouseFormId,
    mirrorToLegacyModules: true,
  });
  return result.ok ? result.draft : input.draft;
}
