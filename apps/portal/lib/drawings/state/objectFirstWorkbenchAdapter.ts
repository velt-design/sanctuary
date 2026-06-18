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

function buildHouseFormDraftFromModel(
  houseForm: HouseFormModel,
): ObjectFirstHouseFormDraft {
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
    // PR-COMP-PHASE2 (2026-06-18): preserve composition on the
    // model → draft round-trip. The normaliser on the draft → model
    // path validates structurally; this side just passes through.
    ...(houseForm.composition ? { composition: houseForm.composition } : null),
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
  return {
    id: input.id,
    label: input.label,
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: 0,
      ...input.transform,
    },
    footprint: {
      mode: "preset",
      preset: "straight",
      params: {
        widthM: "6",
        offsetXM: "0",
        setbackM: "0",
        bandDepthM: "4",
        returnRunM: "0",
        recessWidthM: "0",
        recessDepthM: "0",
        leftLegRunM: "0",
        rightLegRunM: "0",
        sideRunM: "0",
      } as ObjectFirstHouseFormDraft["footprint"]["params"],
      polygon: [],
      attachmentSide: "rear",
    },
    roofIntent: {
      form: "hipped",
      material: "corrugated_iron",
      primaryPitchDeg: "5",
      primaryFallDirection: "negative_y",
      ridgeAxis: "x",
      openGableEndIds: [],
    },
    storeyMode: "single_storey",
    attachmentStrategy: null,
  };
}

/**
 * Append a new house form to the draft's `houseAssembly.houseForms[]`.
 * Clones the chosen source form's footprint/roof/etc. so the new form
 * has sensible defaults the user can then edit. Offsets the transform
 * by `offsetXM: 10` (10 m east by default) so the cloned form doesn't
 * land directly on top of the source in plan/3D. When no source form
 * exists, creates a deterministic first form instead of reviving the
 * legacy `house-main` snapshot form.
 *
 * The returned draft's last entry is the new form; callers can read
 * `result.houseAssembly!.houseForms.at(-1)!.id` to drive selection.
 */
export function addHouseFormToObjectFirstDraft(input: {
  draft: ObjectFirstWorkbenchDraftVNext;
  /** Form to clone from. Defaults to the primary (first) form. */
  sourceHouseFormId?: string | null;
  /** Override the generated label. Defaults to `House <N>` where N is the new entry's 1-based index. */
  label?: string;
  /** Override the auto-offset position. Defaults to `{ offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 }`. */
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
