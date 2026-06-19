import type {
  HouseFormModel,
  ObjectFirstHouseAssemblyDraft,
  ObjectFirstHouseFormDraft,
  ObjectFirstWorkbenchDraftVNext,
  ObjectFirstWorkbenchProjectModel,
} from "./objectFirstWorkbenchModel";
import { normalizeObjectFirstWorkbenchDraftVNext } from "./objectFirstWorkbenchModel";
import { deriveHouseFormDisplayLabel } from "./houseFormDisplayLabel";
import { reconcileHouseFormRoofIntentForFootprint } from "./houseFormRoofIntentForFootprint";
import { buildDefaultRectangleComposition } from "./houseFormCompositionAdapter";

function buildHouseFormDraftFromModel(
  houseForm: HouseFormModel,
): ObjectFirstHouseFormDraft {
  return {
    id: houseForm.id,
    label: houseForm.label,
    transform: houseForm.transform,
    composition: houseForm.composition,
    attachmentSide: houseForm.attachmentSide,
    ...(houseForm.position ? { position: houseForm.position } : null),
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

export function nextHouseFormId(
  existing: ReadonlyArray<{ id: string }>,
): string {
  const used = new Set(existing.map((form) => form.id));
  let index = existing.length === 0 ? 1 : existing.length + 1;
  while (used.has(`house-form-${index}`)) index += 1;
  return `house-form-${index}`;
}

function buildDefaultHouseAssemblyDraft(): ObjectFirstHouseAssemblyDraft {
  return {
    id: "assembly-main",
    label: "House Assembly",
    houseForms: [],
  };
}

function buildDefaultHouseFormDraft(input: {
  id: string;
  label: string;
  transform?: Partial<ObjectFirstHouseFormDraft["transform"]>;
}): ObjectFirstHouseFormDraft {
  const roofIntent = {
    form: "hipped" as const,
    material: "corrugated_iron" as const,
    primaryPitchDeg: "5",
    primaryFallDirection: "negative_y" as const,
    ridgeAxis: "x" as const,
    openGableEndIds: [] as string[],
  };
  return {
    id: input.id,
    label: input.label,
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: 0,
      ...input.transform,
    },
    composition: buildDefaultRectangleComposition(roofIntent),
    attachmentSide: "rear",
    roofIntent,
    storeyMode: "single_storey",
    attachmentStrategy: null,
  };
}

/**
 * Append a new house form to the draft's `houseAssembly.houseForms[]`.
 * Clones the chosen source form's composition/roof/etc. so the new
 * form has sensible defaults the user can then edit. Offsets the
 * transform by `offsetXM: 10` (10 m east by default) so the cloned
 * form doesn't land directly on top of the source.
 *
 * PR-WB-COMPOSITION-ONLY (2026-06-19): composition is required
 * on every form. When cloning, copy the source's composition. When
 * creating fresh, generate a default 6m × 4m rectangle.
 */
export function addHouseFormToObjectFirstDraft(input: {
  draft: ObjectFirstWorkbenchDraftVNext;
  sourceHouseFormId?: string | null;
  label?: string;
  transformOverride?: Partial<ObjectFirstHouseFormDraft["transform"]>;
}): ObjectFirstWorkbenchDraftVNext {
  const assembly =
    input.draft.houseAssembly ?? buildDefaultHouseAssemblyDraft();
  const source: ObjectFirstHouseFormDraft | null =
    (input.sourceHouseFormId
      ? assembly.houseForms.find((form) => form.id === input.sourceHouseFormId)
      : null) ??
    assembly.houseForms[0] ??
    null;
  const id = nextHouseFormId(assembly.houseForms);
  const label =
    input.label ?? deriveHouseFormDisplayLabel(assembly.houseForms.length);
  const nextForm: ObjectFirstHouseFormDraft =
    reconcileHouseFormRoofIntentForFootprint(
      source
        ? {
            ...source,
            id,
            label,
            transform: {
              offsetXM: source.transform.offsetXM + 10,
              offsetYM: source.transform.offsetYM,
              rotationQuarterTurns: source.transform.rotationQuarterTurns,
              ...input.transformOverride,
            },
          }
        : buildDefaultHouseFormDraft({
            id,
            label,
            transform: input.transformOverride,
          }),
    );
  return normalizeObjectFirstWorkbenchDraftVNext({
    ...input.draft,
    houseAssembly: {
      ...assembly,
      houseForms: [...assembly.houseForms, nextForm],
    },
  });
}

export function removeHouseFormFromObjectFirstDraft(input: {
  draft: ObjectFirstWorkbenchDraftVNext;
  houseFormId: string;
}): ObjectFirstWorkbenchDraftVNext {
  const assembly = input.draft.houseAssembly;
  if (!assembly) return input.draft;
  const next = assembly.houseForms.filter(
    (form) => form.id !== input.houseFormId,
  );
  if (next.length === assembly.houseForms.length) return input.draft;
  return normalizeObjectFirstWorkbenchDraftVNext({
    ...input.draft,
    houseAssembly: {
      ...assembly,
      houseForms: next,
    },
  });
}

export function resolveNextHouseFormIdAfterRemoval(
  houseForms: ReadonlyArray<{ id: string }>,
  removedHouseFormId: string,
): string | null | undefined {
  const removedIndex = houseForms.findIndex(
    (form) => form.id === removedHouseFormId,
  );
  if (removedIndex === -1) return undefined;
  const nextForms = houseForms.filter((form) => form.id !== removedHouseFormId);
  return nextForms[Math.min(removedIndex, nextForms.length - 1)]?.id ?? null;
}
