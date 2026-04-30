import type { CostOutputV1 } from '@sp/costing';
import type { RawGeometryModuleInput } from '@sp/geometry';
import type { HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
  normalizeAttachmentSide,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  normalizeHouseRoofMaterial,
  supportsHouseFootprints,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

type RawGeometryDerived = NonNullable<RawGeometryModuleInput['derived']>;

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

function resolveFootprintMode(module: CalculatorModuleInputs): RawGeometryModuleInput['houseContext']['footprintMode'] {
  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return 'preset';
  }

  return normalizeHouseFootprintMode(module.houseFootprintMode);
}

function resolveFootprintParams(module: CalculatorModuleInputs): RawGeometryModuleInput['houseContext']['footprintParams'] {
  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return normalizeHouseFootprintParams(null);
  }

  return normalizeHouseFootprintParams(module.houseFootprintParams);
}

function resolveFootprintPolygon(module: CalculatorModuleInputs): RawGeometryModuleInput['houseContext']['footprintPolygon'] {
  if (!supportsHouseFootprints(module.pergolaStyle)) {
    return null;
  }

  const polygon = normalizeHouseFootprintPolygon(module.houseFootprintPolygon);
  return polygon.length ? polygon : null;
}

function resolveOptionalOverride(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveSharedHouseRoofFallDirection(
  house: HouseModel | null | undefined,
): RawGeometryModuleInput['houseContext']['roofPrimaryFallDirection'] {
  if (!house) return undefined;
  switch (house.roof.primaryFallDirection) {
    case 'positive_x':
    case 'negative_x':
    case 'negative_y':
      return house.roof.primaryFallDirection;
    case 'positive_y':
    default:
      return 'positive_y';
  }
}

function resolveSharedHouseRoofRidgeAxis(
  house: HouseModel | null | undefined,
): RawGeometryModuleInput['houseContext']['roofRidgeAxis'] {
  if (!house) return undefined;
  return house.roof.ridgeAxis === 'y' ? 'y' : 'x';
}

function resolveDerivedRoofPitchDeg(module: CalculatorModuleInputs, result: CostOutputV1 | null): number | null {
  if (module.boxPerimeterEnabled) {
    return result?.derived.box_pitch_deg_used ?? result?.derived.roof_pitch_deg_used ?? null;
  }
  return result?.derived.roof_pitch_deg_used ?? null;
}

function resolveDerivedSlopeDirection(result: CostOutputV1 | null): RawGeometryDerived['slopeDirection'] {
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
        tie_beam_profile_used?: string | null;
        strut_profile_used?: string | null;
      })
    | undefined;
  const normalized = result?.inputs_normalized;

  return {
    post: derived?.post_profile_used ?? module.overrides?.postProfile ?? null,
    rafter: normalized?.rafter_profile ?? derived?.rafter_profile_auto ?? module.overrides?.rafterProfile ?? null,
    ledger: derived?.ledger_profile_used ?? module.overrides?.ledgerProfile ?? null,
    supportBeam: derived?.support_beam_profile_used ?? derived?.front_beam_profile_used ?? module.overrides?.frontBeamProfile ?? null,
    gutter: normalized?.gutter_type ?? derived?.front_beam_profile_used ?? module.overrides?.frontBeamProfile ?? null,
    ridge: derived?.ridge_beam_profile_used ?? module.overrides?.ridgeBeamProfile ?? (module.pergolaStyle === 'gable' ? '150x50' : null),
    tieBeam: derived?.tie_beam_profile_used ?? module.overrides?.tieBeamProfile ?? '150x50',
    strut: derived?.strut_profile_used ?? module.overrides?.strutProfile ?? '50x50',
    boxPerimeter: derived?.box_perimeter_beam_profile_used ?? module.overrides?.boxPerimeterBeamProfile ?? null,
  };
}

function resolveFallbackRafterSpacingMm(module: CalculatorModuleInputs, result: CostOutputV1 | null): number | null {
  const rafterCount = result?.derived.rafter_count;
  const lengthM = Number(module.lengthM);
  if (
    typeof rafterCount !== 'number' ||
    !Number.isFinite(rafterCount) ||
    rafterCount <= 1 ||
    !Number.isFinite(lengthM) ||
    lengthM <= 0
  ) {
    return null;
  }

  return Math.round((lengthM * 1000) / (rafterCount - 1));
}

function resolveStructuralFraming(module: CalculatorModuleInputs, result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['framing'] {
  return {
    rafterCount: result?.derived.rafter_count ?? null,
    rafterSpacingMm: result?.derived.rafter_spacing_mm ?? resolveFallbackRafterSpacingMm(module, result),
  };
}

function resolveStructuralDrainage(result: CostOutputV1 | null): NonNullable<RawGeometryModuleInput['structural']>['drainage'] {
  return {
    gutterType: result?.inputs_normalized?.gutter_type ?? null,
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
  sharedHouse?: HouseModel | null;
}): RawGeometryModuleInput {
  const { projectId, estimateId, designRequestId = null, moduleId = null, module, result, sharedHouse = null } = input;

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
      mixedAcrylicBaysMain: module.mixedAcrylicBaysMain,
      mixedAcrylicBaysA: module.mixedAcrylicBaysA,
      mixedAcrylicBaysB: module.mixedAcrylicBaysB,
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
      framing: resolveStructuralFraming(module, result),
      drainage: resolveStructuralDrainage(result),
    },
    houseContext: {
      footprintMode: sharedHouse?.footprint.mode ?? resolveFootprintMode(module),
      footprintPreset: sharedHouse?.footprint.preset ?? resolveFootprintPreset(module),
      footprintParams: sharedHouse?.footprint.params ?? resolveFootprintParams(module),
      footprintPolygon:
        sharedHouse && sharedHouse.footprint.polygon.length
          ? sharedHouse.footprint.polygon
          : resolveFootprintPolygon(module),
      storeyMode: sharedHouse?.storeyMode ?? module.houseStoreyMode ?? null,
      roofForm: sharedHouse?.roof.form ?? null,
      roofMaterial: sharedHouse?.roof.material ?? normalizeHouseRoofMaterial(module.houseRoofMaterial),
      roofPrimaryFallDirection: resolveSharedHouseRoofFallDirection(sharedHouse),
      roofRidgeAxis: resolveSharedHouseRoofRidgeAxis(sharedHouse),
      openGableEndIds: sharedHouse?.roof.openGableEndIds ?? null,
      roofAppendage: sharedHouse?.roof.appendage.enabled
        ? {
            enabled: true,
            form: sharedHouse.roof.appendage.form,
            hostEdge: sharedHouse.roof.appendage.hostEdge,
            pitchDeg: resolveOptionalOverride(sharedHouse.roof.appendage.pitchDeg),
            dropMm: resolveOptionalOverride(sharedHouse.roof.appendage.dropMm),
          }
        : null,
      decks:
        sharedHouse?.decks.map((deck) => ({
          id: deck.id,
          name: deck.name,
          kind: deck.kind,
          shape: deck.shape,
          presetType: deck.presetType,
          presetRect: deck.presetRect
            ? {
                widthMm: Math.round(Number(deck.presetRect.widthM) * 1000),
                depthMm: Math.round(Number(deck.presetRect.depthM) * 1000),
                centerOffsetMm: Math.round(Number(deck.presetRect.centerOffsetM) * 1000),
                detachedGapMm: Math.round(Number(deck.presetRect.detachedGapM ?? '0') * 1000),
              }
            : null,
          outline: deck.outline,
          elevationMode: deck.elevationMode,
          levelOffsetMm: resolveOptionalOverride(deck.levelOffsetMm) ?? '0',
          hostEdgeId: deck.hostEdgeId,
          isAttached: deck.isAttached,
          surfaceMaterial: deck.surfaceMaterial,
          topSurfaceElevationMm: deck.topSurfaceElevationMm,
          supportContext: {
            classification: deck.supportContext.classification,
            nearestHouseEdgeId: deck.supportContext.nearestHouseEdgeId,
            nearestHouseEdgeDistanceMm: deck.supportContext.nearestHouseEdgeDistanceMm,
            attachmentContactLengthMm: deck.supportContext.attachmentContactLengthMm,
            warningCodes: deck.supportContext.warningCodes,
            warningMessages: deck.supportContext.warningMessages,
          },
          validation: {
            status: deck.validation.status,
            codes: deck.validation.codes,
            messages: deck.validation.messages,
          },
        })) ?? null,
      openings:
        sharedHouse?.openings.map((opening) => ({
          id: opening.id,
          label: opening.label,
          kind: normalizeWallOpeningKind(opening.kind),
          panelCount: resolveOpeningPanelCount(normalizeWallOpeningKind(opening.kind), opening.panelCount),
          wallId: opening.wallId,
          hostEdgeId: opening.hostEdgeId,
          widthMm: Math.round(Number(opening.widthM) * 1000),
          heightMm: Math.round(Number(opening.heightM) * 1000),
          sillHeightMm: Math.round(Number(opening.sillHeightM) * 1000),
          offsetAlongWallMm: Math.round(Number(opening.offsetAlongWallM) * 1000),
          validation: {
            status: opening.validation.status,
            codes: opening.validation.codes,
            message: opening.validation.message,
          },
        })) ?? null,
      attachmentStrategy: sharedHouse?.attachmentStrategy ?? module.houseAttachmentStrategy ?? null,
      eaveHeightM: resolveOptionalOverride(sharedHouse?.eaveHeightM ?? module.houseEaveHeightM),
      wallHeightM: resolveOptionalOverride(sharedHouse?.wallHeightM ?? module.houseWallHeightM),
      roofPitchDeg: resolveOptionalOverride(sharedHouse?.roof.primaryPitchDeg ?? module.houseRoofPitchDeg),
      eave: {
        soffitDepthMm: resolveOptionalOverride(sharedHouse?.soffitDepthMm ?? module.houseSoffitDepthMm),
        fasciaHeightMm: resolveOptionalOverride(sharedHouse?.fasciaHeightMm ?? module.houseFasciaHeightMm),
        gutterWidthMm: resolveOptionalOverride(sharedHouse?.gutterWidthMm ?? module.houseGutterWidthMm),
        gutterDepthMm: resolveOptionalOverride(sharedHouse?.gutterDepthMm ?? module.houseGutterDepthMm),
        gutterProjectionMm: resolveOptionalOverride(
          sharedHouse?.gutterProjectionMm ?? module.houseGutterProjectionMm,
        ),
        eaveOverhangMm: resolveOptionalOverride(sharedHouse?.eaveOverhangMm ?? module.houseEaveOverhangMm),
      },
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
      effectiveRunM: result?.derived.effective_run_m ?? null,
      acrylicRequiredDownslopeM: result?.derived.acrylic_required_downslope_m ?? null,
      joinerPieceLengthM: result?.derived.joiner_piece_length_m ?? null,
      joinerRunsTotal: result?.derived.joiner_runs_total ?? null,
      rafterHouseAllowanceM: result?.derived.rafter_house_allowance_m ?? null,
      rafterFarAllowanceM: result?.derived.rafter_far_allowance_m ?? null,
      acrylicAreaM2: result?.derived.acrylic_area_m2 ?? null,
      boxEffectiveRunM: (result?.derived as { box_effective_run_m?: number | null } | undefined)?.box_effective_run_m ?? null,
      boxRiseMm: (result?.derived as { box_rise_mm?: number | null } | undefined)?.box_rise_mm ?? null,
      boxMaxFallMm: (result?.derived as { box_max_fall_mm?: number | null } | undefined)?.box_max_fall_mm ?? null,
    },
  };
}
