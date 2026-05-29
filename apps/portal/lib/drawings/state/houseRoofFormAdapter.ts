import {
  deriveHouseGableTerminalEnds,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  normalizeHouseRoofPitchInputForForm,
} from '@sp/geometry';
import {
  normalizeHouseRoofMaterial,
  type CalculatorHouseAttachmentStrategy,
  type CalculatorHouseFootprintMode,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
  type CalculatorHouseFootprintPreset,
  type CalculatorHouseRoofMaterial,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  HouseFirstMigrationWarning,
  HouseFirstRoofDraft,
  HouseModel,
  HouseRoofApproximationReason,
  HouseRoofFieldSource,
  HouseRoofForm,
  HouseRoofProvenance,
} from './houseFirstWorkbenchModel';
import {
  hasExplicitRoofPitch,
  localPolygonToGeometryPolygon,
  normalizeRoofOpenGableEndIds,
  normalizeRoofPrimaryFallDirection,
  normalizeRoofRidgeAxis,
} from './houseRoofFormNormalize';
import {
  resolveDerivedMonoFallDirection,
  resolveDerivedRidgeAxis,
} from './houseRoofFormRidgeAxis';
import { validateSharedRoof } from './houseRoofFormValidate';

/**
 * Roof projection adapter — the second-highest layer of the house-first
 * pipeline. Takes the already-normalised collected fields off
 * `buildSharedHouse` plus an optional explicit roof draft, and produces
 * the canonical `HouseModel['roof']` view-model (terminal ends, gates,
 * validation, provenance, capabilities) along with any migration warnings
 * the projection raises.
 *
 * Extracted from `houseFirstWorkbenchAdapter.buildSharedHouse` so the
 * roof-form rules (`form === 'hipped'` gates that ship-broke during the
 * Dutch-hip rollout) live in one named module instead of inline inside
 * the 2k-line god adapter. Behaviour is preserved byte-for-byte; only
 * the call sites moved.
 *
 * Two gate predicates are exported as their own functions so each
 * mistake-prone "which forms accept this field?" decision has its own
 * focused test surface:
 *
 *   - `roofFormAcceptsOpenGableEnds`: open gable end IDs only meaningful
 *     for hipped (Dutch-hip topology). Returning the wrong answer for
 *     hipped is exactly the bug that hid the Dutch-hip toggle commit
 *     from the geometry pipeline — see `docs/decision-log.md` 2026-05-14.
 *   - `roofFormHasRidgeAxis`: ridge axis only meaningful for hipped.
 *     Mono drains in a primary fall direction instead.
 */

export function roofFormAcceptsOpenGableEnds(form: HouseRoofForm): boolean {
  return form === 'hipped';
}

export function roofFormHasRidgeAxis(form: HouseRoofForm): boolean {
  return form === 'hipped';
}

export type ResolveHouseRoofProjectionInput = {
  /** The explicit house-first roof draft, if any. */
  roofDraft: HouseFirstRoofDraft | null;
  /** Side-local footprint polygon — either user polygon or preset-derived. */
  derivedHousePolygon: CalculatorHouseFootprintPolygonPoint[];
  /** Resolved footprint mode (preset/custom_polygon). */
  normalizedFootprintMode: CalculatorHouseFootprintMode;
  /** Resolved footprint preset (only meaningful when mode=preset). */
  normalizedFootprintPreset: CalculatorHouseFootprintPreset;
  /** Resolved footprint params. */
  normalizedFootprintParams: CalculatorHouseFootprintParams;
  /** Resolved attachment side. */
  normalizedAttachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  /** Resolved attachment kind (soffit / fascia / wall / freestanding). */
  attachmentKind: 'soffit' | 'fascia' | 'wall' | 'freestanding';
  /** Resolved attachment strategy (null when no explicit strategy). */
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  /** Resolved roof material (from legacy module collect). */
  normalizedRoofMaterial: CalculatorHouseRoofMaterial;
  /** Source flag for the collected roof material (provenance). */
  roofMaterialSource: Extract<HouseRoofFieldSource, 'legacy_shared_value' | 'default_fallback'>;
  /** Source flag for the collected roof pitch (provenance). */
  roofPitchSource: Extract<HouseRoofFieldSource, 'legacy_shared_value' | 'default_fallback'>;
  /** Inferred mono pitch used as fallback when no explicit pitch. */
  inferredPrimaryPitchDeg: string;
  /** Roof form inferred from legacy pergola style (collect()). */
  roofForm: HouseRoofForm;
  /** First-module pergola dimensions used to build the attachment line. */
  firstModuleLengthMm: number;
  firstModuleProjectionMm: number;
  /** Raw eave height string (used to derive mm and copied into model). */
  eaveHeightM: string;
  /** Raw eave overhang string. */
  eaveOverhangMm: string;
};

export type HouseRoofProjection = {
  roof: HouseModel['roof'];
  warnings: HouseFirstMigrationWarning[];
};

export function resolveHouseRoofProjection(
  input: ResolveHouseRoofProjectionInput,
): HouseRoofProjection {
  const warnings: HouseFirstMigrationWarning[] = [];
  const derivedMonoFallDirection = resolveDerivedMonoFallDirection({
    attachmentSide: input.normalizedAttachmentSide,
  });
  const derivedRidgeAxis = resolveDerivedRidgeAxis({
    footprintMode: input.normalizedFootprintMode,
    footprintPreset: input.normalizedFootprintPreset,
    footprintParams: input.normalizedFootprintParams,
    footprintPolygon: input.derivedHousePolygon,
  });
  const normalizedRoofDraft = input.roofDraft ?? null;
  const explicitRoofForm = normalizedRoofDraft?.form ?? null;
  const explicitRoofMaterial = normalizedRoofDraft?.material ?? null;
  const explicitRoofPitchDeg = normalizedRoofDraft?.primaryPitchDeg ?? null;
  const explicitPrimaryFallDirection = normalizeRoofPrimaryFallDirection(
    normalizedRoofDraft?.primaryFallDirection,
  );
  const explicitRidgeAxis = normalizeRoofRidgeAxis(normalizedRoofDraft?.ridgeAxis);
  const explicitOpenGableEndIds = normalizedRoofDraft?.openGableEndIds;
  const sharedRoofForm = explicitRoofForm ?? input.roofForm;
  const sharedRoofPitchFallback =
    explicitRoofPitchDeg === null || explicitRoofPitchDeg === undefined || sharedRoofForm === 'mono'
      ? input.inferredPrimaryPitchDeg
      : null;
  const sharedRoofPitchDeg = normalizeHouseRoofPitchInputForForm({
    roofForm: sharedRoofForm,
    value: explicitRoofPitchDeg,
    fallbackValue: sharedRoofPitchFallback,
  });
  const sharedRoofMaterial =
    explicitRoofMaterial
      ? (normalizeHouseRoofMaterial(explicitRoofMaterial) as CalculatorHouseRoofMaterial)
      : input.normalizedRoofMaterial;
  const sharedPrimaryFallDirection =
    explicitPrimaryFallDirection ??
    derivedMonoFallDirection.value;
  const ridgeAxisRelevant = roofFormHasRidgeAxis(sharedRoofForm);
  const shouldHealPresetRidgeAxis =
    input.normalizedFootprintMode !== 'custom_polygon' &&
    ridgeAxisRelevant &&
    explicitRidgeAxis !== null &&
    explicitRidgeAxis !== derivedRidgeAxis.value;
  const effectiveRidgeAxisExplicit = explicitRidgeAxis !== null && !shouldHealPresetRidgeAxis;
  const sharedRidgeAxis =
    shouldHealPresetRidgeAxis
      ? derivedRidgeAxis.value
      : (explicitRidgeAxis ?? derivedRidgeAxis.value);
  const roofProvenance: HouseRoofProvenance = {
    form: explicitRoofForm ? 'house_first_draft' : 'legacy_pergola_inference',
    material: explicitRoofMaterial ? 'house_first_draft' : input.roofMaterialSource,
    primaryPitchDeg: hasExplicitRoofPitch(explicitRoofPitchDeg)
      ? 'house_first_draft'
      : input.roofPitchSource,
    primaryFallDirection: explicitPrimaryFallDirection
      ? 'house_first_draft'
      : derivedMonoFallDirection.source,
    ridgeAxis: effectiveRidgeAxisExplicit ? 'house_first_draft' : derivedRidgeAxis.source,
    openGableEndIds: Array.isArray(explicitOpenGableEndIds) ? 'house_first_draft' : 'default_fallback',
  };
  const terminalEnds = deriveHouseGableTerminalEnds({
    footprint: localPolygonToGeometryPolygon(input.derivedHousePolygon),
    ridgeAxis: sharedRidgeAxis,
  });
  const validTerminalEndIds = new Set(terminalEnds.map((end) => end.id));
  // Milestone 13 session C: openGableEndIds applies to `'hipped'`
  // only -- legacy `'gable'` was retired from the type union and is
  // mapped to `'hipped'` at the normalize boundary.
  const formAcceptsOpenGableEndIds = roofFormAcceptsOpenGableEnds(sharedRoofForm);
  const requestedOpenGableEndIds = formAcceptsOpenGableEndIds
    ? normalizeRoofOpenGableEndIds(normalizedRoofDraft?.openGableEndIds)
    : [];
  const openGableEndIds = formAcceptsOpenGableEndIds
    ? requestedOpenGableEndIds.filter((id) => validTerminalEndIds.has(id))
    : [];
  if (
    input.normalizedFootprintMode === 'custom_polygon' &&
    requestedOpenGableEndIds.length !== openGableEndIds.length
  ) {
    warnings.push({
      id: 'house-roof-open-gable-ends',
      code: 'invalid_house_first_roof_overlay',
      severity: 'blocking',
      field: 'houseFirst.roof.openGableEndIds',
      chosenModuleIndex: 0,
      conflictingModuleIndexes: [],
      message: 'Some saved open gable ends no longer match the current footprint or ridge orientation and were cleared.',
    });
  }
  const geometryFootprint = localPolygonToGeometryPolygon(input.derivedHousePolygon);
  const validation = validateSharedRoof({
    footprint: geometryFootprint,
    roofForm: sharedRoofForm,
    roofPrimaryFallDirection: sharedPrimaryFallDirection,
    roofPrimaryFallDirectionExplicit: explicitPrimaryFallDirection !== null,
    preferredMonoFallDirection:
      sharedRoofForm === 'mono'
        ? derivedMonoFallDirection.value
        : null,
    attachmentRequiresDrainEdge:
      input.attachmentKind === 'soffit' || input.attachmentKind === 'fascia',
    roofRidgeAxis: sharedRidgeAxis,
    roofRidgeAxisExplicit: effectiveRidgeAxisExplicit,
    preferredRidgeAxis: sharedRoofForm === 'hipped' ? derivedRidgeAxis.value : null,
  });
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: sharedRoofForm,
    footprint: geometryFootprint,
  });
  const roofGeometryKind = deriveHouseRoofGeometryKind({
    roofForm: sharedRoofForm,
    footprint: geometryFootprint,
    openGableEndIds,
    roofRidgeAxis: sharedRidgeAxis,
  });
  const approximationReasons = new Set<HouseRoofApproximationReason>();
  if (roofProvenance.form === 'legacy_pergola_inference') {
    approximationReasons.add('inferred_form');
  }
  if (
    sharedRoofForm === 'mono' &&
    explicitPrimaryFallDirection === null &&
    roofProvenance.primaryFallDirection === 'legacy_pergola_inference'
  ) {
    approximationReasons.add('inferred_fall_direction');
  }
  if (ridgeAxisRelevant && !effectiveRidgeAxisExplicit && derivedRidgeAxis.usedFallback) {
    approximationReasons.add('inferred_ridge_axis');
  }
  if (
    ridgeAxisRelevant &&
    !effectiveRidgeAxisExplicit &&
    derivedRidgeAxis.ambiguous
  ) {
    approximationReasons.add('ambiguous_ridge_axis');
  }
  const roofApproximationReasons = Array.from(approximationReasons);
  const roofValidation: HouseModel['roof']['validation'] =
    validation.status === 'invalid'
      ? {
          ...validation,
          approximationReasons: roofApproximationReasons,
        }
      : {
          ...validation,
          status: roofApproximationReasons.length > 0 ? 'approximate' : 'valid',
          approximationReasons: roofApproximationReasons,
        };
  const hasExplicitRoofDraftField =
    explicitRoofForm !== null ||
    explicitRoofMaterial !== null ||
    hasExplicitRoofPitch(explicitRoofPitchDeg) ||
    explicitPrimaryFallDirection !== null ||
    explicitRidgeAxis !== null ||
    (explicitOpenGableEndIds !== undefined && explicitOpenGableEndIds !== null);
  return {
    roof: {
      id: 'house-roof-main',
      form: sharedRoofForm,
      material: sharedRoofMaterial,
      pitchDeg: sharedRoofPitchDeg,
      primaryPitchDeg: sharedRoofPitchDeg,
      primaryFallDirection: sharedPrimaryFallDirection,
      ridgeAxis: sharedRidgeAxis,
      openGableEndIds,
      terminalEnds: terminalEnds.map((end) => ({
        ...end,
        isOpen: openGableEndIds.includes(end.id),
      })),
      geometryKind: roofGeometryKind,
      validation: roofValidation,
      provenance: roofProvenance,
      capabilities,
      // Confidence is overlaid by `buildSharedHouse` once it knows
      // whether any of the collect()'d shared fields hit a low-confidence
      // fallback. Default to 'high' here; the caller flips to 'low' if
      // its own lowConfidence flag is set.
      confidence: 'high',
      source: hasExplicitRoofDraftField ? 'house_first_draft' : 'legacy_module_inference',
    },
    warnings,
  };
}
