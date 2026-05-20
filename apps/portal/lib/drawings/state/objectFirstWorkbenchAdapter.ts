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

/**
 * Generate the next house-form id for an authored multi-form estimate.
 * The legacy primary form sits at `house-main` (see
 * `LEGACY_PRIMARY_HOUSE_FORM_ID` in `houseFirstWorkbenchAdapter.ts`);
 * additional forms get `house-form-N` (starting at N=2 so the visual
 * sequence reads "main, form 2, form 3" rather than colliding with
 * the legacy id). Skips ids already in use so removals + re-adds
 * never clash.
 */
export function nextHouseFormId(existing: ReadonlyArray<{ id: string }>): string {
  const used = new Set(existing.map((form) => form.id));
  let index = Math.max(2, existing.length + 1);
  while (used.has(`house-form-${index}`)) index += 1;
  return `house-form-${index}`;
}

/**
 * Append a new house form to the draft's `houseAssembly.houseForms[]`.
 * Clones the chosen source form's footprint/roof/etc. so the new form
 * has sensible defaults the user can then edit. Offsets the transform
 * by `offsetXM: 10` (10 m east by default) so the cloned form doesn't
 * land directly on top of the source in plan/3D.
 *
 * Returns the draft unchanged when `houseAssembly` is missing — the
 * caller (rail "Add structure" handler) should never invoke this on
 * an estimate without a primary form, but the no-op keeps the contract
 * forgiving.
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
  transformOverride?: Partial<ObjectFirstHouseFormDraft['transform']>;
}): ObjectFirstWorkbenchDraftVNext {
  const assembly = input.draft.houseAssembly;
  if (!assembly || assembly.houseForms.length === 0) return input.draft;
  const source =
    (input.sourceHouseFormId
      ? assembly.houseForms.find((form) => form.id === input.sourceHouseFormId)
      : null) ?? assembly.houseForms[0]!;
  const id = nextHouseFormId(assembly.houseForms);
  const defaultTransform: ObjectFirstHouseFormDraft['transform'] = {
    offsetXM: source.transform.offsetXM + 10,
    offsetYM: source.transform.offsetYM,
    rotationQuarterTurns: source.transform.rotationQuarterTurns,
  };
  const cloned: ObjectFirstHouseFormDraft = {
    ...source,
    id,
    label: input.label ?? `House ${assembly.houseForms.length + 1}`,
    transform: { ...defaultTransform, ...input.transformOverride },
  };
  return normalizeObjectFirstWorkbenchDraftVNext({
    ...input.draft,
    houseAssembly: {
      ...assembly,
      houseForms: [...assembly.houseForms, cloned],
    },
  });
}

/**
 * Remove a house form from the draft. Refuses to remove the only
 * remaining form (`houseForms[]` must stay non-empty to keep the
 * legacy-compat invariant that every estimate has at least one house);
 * the caller is responsible for surfacing that as a UI error.
 */
export function removeHouseFormFromObjectFirstDraft(input: {
  draft: ObjectFirstWorkbenchDraftVNext;
  houseFormId: string;
}): ObjectFirstWorkbenchDraftVNext {
  const assembly = input.draft.houseAssembly;
  if (!assembly) return input.draft;
  if (assembly.houseForms.length <= 1) return input.draft;
  const next = assembly.houseForms.filter((form) => form.id !== input.houseFormId);
  if (next.length === assembly.houseForms.length) return input.draft;
  return normalizeObjectFirstWorkbenchDraftVNext({
    ...input.draft,
    houseAssembly: {
      ...assembly,
      houseForms: next,
    },
  });
}
