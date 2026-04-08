import type { CostOutputV1 } from '@sp/costing';
import type { RawGeometryModuleInput } from '@sp/geometry';
import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
  normalizeAttachmentSide,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

function resolveRoofMode(module: CalculatorModuleInputs): string | null {
  if (module.boxPerimeterEnabled) {
    return 'box_perimeter';
  }
  if (module.roofMaterial === 'mixed') {
    return module.timberRoofAboveType;
  }
  return null;
}

function resolveAttachmentSide(module: CalculatorModuleInputs): RawGeometryModuleInput['connection']['attachmentSide'] {
  if (module.houseConnectionType === 'none') {
    return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  }

  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  }

  return normalizeAttachmentSide(module.attachmentSide);
}

function resolveFootprintPreset(module: CalculatorModuleInputs): RawGeometryModuleInput['houseContext']['footprintPreset'] {
  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET;
  }

  return normalizeHouseFootprintPreset(module.houseFootprintPreset);
}

function resolveFootprintParams(module: CalculatorModuleInputs): RawGeometryModuleInput['houseContext']['footprintParams'] {
  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return normalizeHouseFootprintParams(null);
  }

  return normalizeHouseFootprintParams(module.houseFootprintParams);
}

function resolveDerivedRoofPitchDeg(module: CalculatorModuleInputs, result: CostOutputV1 | null): number | null {
  if (module.boxPerimeterEnabled) {
    return result?.derived.box_pitch_deg_used ?? result?.derived.roof_pitch_deg_used ?? null;
  }
  return result?.derived.roof_pitch_deg_used ?? null;
}

function resolveDerivedSlopeDirection(result: CostOutputV1 | null): RawGeometryModuleInput['derived']['slopeDirection'] {
  const slopeDirection = result?.derived.slope_direction;
  if (slopeDirection === 'toward_house' || slopeDirection === 'away_from_house') {
    return slopeDirection;
  }
  return null;
}

function resolveOverhangAmountM(module: CalculatorModuleInputs, result: CostOutputV1 | null): string | number | null {
  const derivedEnabled = result?.derived.overhang_enabled;
  const enabled = typeof derivedEnabled === 'boolean' ? derivedEnabled : Boolean(module.overhangEnabled);
  if (!enabled) {
    return 0;
  }
  return result?.derived.overhang_amount_m ?? module.overhangAmountM;
}

function resolveStructuralHeights(module: CalculatorModuleInputs, result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['heights'] {
  const houseUndersideM = result?.derived.post_cut_height_house_side_m ?? result?.derived.ledger_underside_height_m ?? module.postCutHeightM ?? null;
  const outerUndersideM = result?.derived.post_cut_height_outer_side_m ?? null;

  return {
    houseUndersideM,
    outerUndersideM,
    referenceUndersideM: houseUndersideM,
  };
}

function resolveStructuralProfiles(module: CalculatorModuleInputs, result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['profiles'] {
  const derived = result?.derived as
    | (CostOutputV1['derived'] & {
        support_beam_profile_used?: string | null;
        box_perimeter_beam_profile_used?: string | null;
      })
    | undefined;
  const normalized = result?.inputs_normalized;

  return {
    post: derived?.post_profile_used ?? module.overrides?.postProfile ?? null,
    rafter: normalized?.rafter_profile ?? derived?.rafter_profile_auto ?? module.overrides?.rafterProfile ?? null,
    ledger: derived?.ledger_profile_used ?? module.overrides?.ledgerProfile ?? null,
    supportBeam: derived?.support_beam_profile_used ?? derived?.front_beam_profile_used ?? module.overrides?.supportBeamProfile ?? module.overrides?.frontBeamProfile ?? null,
    gutter: normalized?.gutter_type ?? derived?.front_beam_profile_used ?? module.overrides?.frontBeamProfile ?? null,
    ridge: derived?.ridge_beam_profile_used ?? module.overrides?.ridgeBeamProfile ?? null,
    boxPerimeter: derived?.box_perimeter_beam_profile_used ?? module.overrides?.boxPerimeterBeamProfile ?? null,
  };
}

function resolveStructuralFraming(result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['framing'] {
  return {
    rafterCount: result?.derived.rafter_count ?? null,
    rafterSpacingMm: result?.derived.rafter_spacing_mm ?? null,
  };
}

function resolveStructuralDrainage(result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['drainage'] {
  return {
    gutterType: result?.inputs_normalized.gutter_type ?? null,
    gutterAssemblyMode: result?.derived.gutter_assembly_mode ?? null,
    integratedGutterBeam: result?.derived.integrated_gutter_beam ?? null,
    hasOurGutter: result?.derived.has_our_gutter ?? null,
  };
}

export function buildRawGeometryModuleInput(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId?: string | null;
  module: CalculatorModuleInputs;
  result: CostOutputV1 | null;
}): RawGeometryModuleInput {
  const { projectId, estimateId, designRequestId = null, moduleId = null, module, result } = input;

  return {
    projectId,
    estimateId,
    designRequestId,
    moduleId,
    pergolaStyle: module.pergolaStyle,
    boxPerimeterEnabled: Boolean(module.boxPerimeterEnabled),
    roof: {
      material: module.roofMaterial,
      mode: resolveRoofMode(module),
      slopeDirection: module.invertedEnabled ? 'toward_house' : 'away_from_house',
      roofPitchDeg: module.roofPitchDeg,
      overhangEnabled: typeof result?.derived.overhang_enabled === 'boolean' ? result.derived.overhang_enabled : Boolean(module.overhangEnabled),
      overhangM: resolveOverhangAmountM(module, result),
    },
    gable: {
      endFramesMode: module.gableEndFramesMode,
      houseEaveGutter: module.gableHouseEdgeGutter,
      outerEaveGutter: module.gableOuterEdgeGutter,
    },
    box: {
      houseEdgeGutter: module.boxGutterHouseEdge,
      farEdgeGutter: module.boxGutterFarEdge,
    },
    connection: {
      houseConnectionType: module.houseConnectionType,
      attachmentSide: resolveAttachmentSide(module),
    },
    supports: {
      postMode: 'standard',
      postCount: module.postCount,
      postCutHeightM: module.postCutHeightM,
      postConnectionType: module.postConnectionType,
      ground: module.ground,
    },
    structural: {
      heights: resolveStructuralHeights(module, result),
      profiles: resolveStructuralProfiles(module, result),
      framing: resolveStructuralFraming(result),
      drainage: resolveStructuralDrainage(result),
    },
    houseContext: {
      footprintPreset: resolveFootprintPreset(module),
      footprintParams: resolveFootprintParams(module),
    },
    dimensions: {
      lengthM: module.lengthM,
      projectionM: module.projectionM,
      hipCornerLengthBM: module.hipCornerLengthBM,
      hipCornerProjectionBM: module.hipCornerProjectionBM,
    },
    derived: {
      lengthM: result?.derived.length_m ?? null,
      projectionM: result?.derived.projection_m ?? null,
      roofPitchDeg: resolveDerivedRoofPitchDeg(module, result),
      slopeDirection: resolveDerivedSlopeDirection(result),
      boxEffectiveRunM: (result?.derived as { box_effective_run_m?: number | null } | undefined)?.box_effective_run_m ?? null,
      boxRiseMm: (result?.derived as { box_rise_mm?: number | null } | undefined)?.box_rise_mm ?? null,
      boxMaxFallMm: (result?.derived as { box_max_fall_mm?: number | null } | undefined)?.box_max_fall_mm ?? null,
    },
  };
}
