import type { CostOutputV1 } from '@sp/costing';
import type { RawGeometryModuleInput } from '@sp/geometry';
import type {
  DeckObjectModel,
  HouseFormModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';
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
type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;

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

function resolveHouseFormRoofFallDirection(
  houseForm: HouseFormModel | null,
): RawGeometryModuleInput['houseContext']['roofPrimaryFallDirection'] {
  if (!houseForm) return undefined;
  switch (houseForm.roofIntent.primaryFallDirection) {
    case 'positive_x':
    case 'negative_x':
    case 'negative_y':
      return houseForm.roofIntent.primaryFallDirection;
    case 'positive_y':
    default:
      return 'positive_y';
  }
}

function resolveHouseFormRoofRidgeAxis(
  houseForm: HouseFormModel | null,
): RawGeometryModuleInput['houseContext']['roofRidgeAxis'] {
  if (!houseForm) return undefined;
  return houseForm.roofIntent.ridgeAxis === 'y' ? 'y' : 'x';
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

function parsePositiveNumber(value: string | number | null | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveFallbackOuterUndersideM(
  module: CalculatorModuleInputs,
  result: CostOutputV1 | null,
  houseUndersideM: string | number | null,
): number | string | null {
  const houseUnderside = parsePositiveNumber(houseUndersideM);
  if (houseUnderside === null) return null;
  const pitchDeg = parsePositiveNumber(resolveDerivedRoofPitchDeg(module, result) ?? module.roofPitchDeg) ?? 0;
  const runM =
    parsePositiveNumber(result?.derived.effective_run_m) ??
    parsePositiveNumber(module.projectionM) ??
    0;
  const slopeDirection =
    resolveDerivedSlopeDirection(result) ?? (module.invertedEnabled ? 'toward_house' : 'away_from_house');
  const fallM = Math.max(0, runM) * Math.tan((pitchDeg * Math.PI) / 180);
  const outerUnderside = houseUnderside + (slopeDirection === 'toward_house' ? fallM : -fallM);
  if (!Number.isFinite(outerUnderside)) return houseUndersideM;
  return Math.max(0, Math.round(outerUnderside * 1000) / 1000);
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
  const outerUndersideM =
    result?.derived.post_cut_height_outer_side_m ??
    resolveFallbackOuterUndersideM(module, result, houseUndersideM);

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

function isAttachmentSide(value: unknown): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function resolvePergolaForModule(input: {
  projectModel: WorkbenchProjectModel;
  module: CalculatorModuleInputs;
  moduleId: string | null;
}): PergolaObjectModel | null {
  const pergolaId = typeof input.module.pergolaId === 'string' ? input.module.pergolaId.trim() : '';
  if (pergolaId) {
    const byPergolaId = input.projectModel.pergolas.find((pergola) => pergola.id === pergolaId) ?? null;
    if (byPergolaId) return byPergolaId;
  }

  if (input.moduleId) {
    return input.projectModel.pergolas.find((pergola) => pergola.id === input.moduleId) ?? null;
  }

  return null;
}

function resolvePergolaSourceFormIds(input: {
  projectModel: WorkbenchProjectModel;
  pergola: PergolaObjectModel | null;
}): string[] {
  const envelope = input.projectModel.houseAssembly?.derivedEnvelope ?? null;
  if (!envelope || !input.pergola) return [];

  const attachmentZone = input.pergola.attachmentZoneId
    ? envelope.attachmentZones.find((zone) => zone.id === input.pergola?.attachmentZoneId) ?? null
    : null;
  if (attachmentZone?.sourceFormIds.length) return attachmentZone.sourceFormIds;

  const attachmentEdge = input.pergola.attachmentEdgeId
    ? envelope.edges.find((edge) => edge.id === input.pergola?.attachmentEdgeId) ?? null
    : null;
  return attachmentEdge?.sourceFormIds ?? [];
}

function selectHouseForm(input: {
  projectModel: WorkbenchProjectModel | null;
  module: CalculatorModuleInputs;
  moduleId: string | null;
}): HouseFormModel | null {
  const forms = input.projectModel?.houseAssembly?.houseForms ?? [];
  if (!forms.length || !input.projectModel) return null;

  const pergola = resolvePergolaForModule({
    projectModel: input.projectModel,
    module: input.module,
    moduleId: input.moduleId,
  });
  const pergolaSourceFormIds = new Set(resolvePergolaSourceFormIds({
    projectModel: input.projectModel,
    pergola,
  }));
  const pergolaForm = forms.find((form) => pergolaSourceFormIds.has(form.id)) ?? null;
  if (pergolaForm) return pergolaForm;

  if (input.moduleId) {
    const sourceModuleForm = forms.find((form) => form.sourceModuleIds?.includes(input.moduleId ?? '')) ?? null;
    if (sourceModuleForm) return sourceModuleForm;
  }

  return forms[0] ?? null;
}

function toOptionalMillimetresFromMetres(value: string | number | null | undefined): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue * 1000) : null;
}

function mapDeckPresetRect(
  presetRect: DeckObjectModel['presetRect'],
): NonNullable<NonNullable<RawGeometryModuleInput['houseContext']['decks']>[number]['presetRect']> | null {
  if (!presetRect) return null;
  return {
    widthMm: Math.round(Number(presetRect.widthM) * 1000),
    depthMm: Math.round(Number(presetRect.depthM) * 1000),
    centerOffsetMm: Math.round(Number(presetRect.centerOffsetM) * 1000),
    detachedGapMm: Math.round(Number(presetRect.detachedGapM ?? '0') * 1000),
  };
}

function mapDecks(
  projectModel: WorkbenchProjectModel | null,
): RawGeometryModuleInput['houseContext']['decks'] {
  if (!projectModel) return null;
  return projectModel.decks.map((deck) => ({
    id: deck.id,
    name: deck.label,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    presetRect: mapDeckPresetRect(deck.presetRect ?? null),
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: resolveOptionalOverride(deck.levelOffsetMm) ?? '0',
    hostEdgeId: deck.hostEdgeId,
    isAttached: deck.isAttached,
    surfaceMaterial: deck.surfaceMaterial,
    topSurfaceElevationMm: deck.topSurfaceElevationMm ?? null,
    supportContext: deck.supportContext
      ? {
          classification: deck.supportContext.classification,
          nearestHouseEdgeId: deck.supportContext.nearestHouseEdgeId,
          nearestHouseEdgeDistanceMm: deck.supportContext.nearestHouseEdgeDistanceMm,
          attachmentContactLengthMm: deck.supportContext.attachmentContactLengthMm,
          warningCodes: deck.supportContext.warningCodes,
          warningMessages: deck.supportContext.warningMessages,
        }
      : null,
    validation: deck.validation
      ? {
          status: deck.validation.status,
          codes: deck.validation.codes,
          messages: deck.validation.messages,
        }
      : null,
  }));
}

function resolveOpeningHostEdgeId(input: {
  projectModel: WorkbenchProjectModel | null;
  opening: OpeningObjectModel;
}): string | null {
  if (input.opening.hostEdgeId) return input.opening.hostEdgeId;
  const envelope = input.projectModel?.houseAssembly?.derivedEnvelope ?? null;
  if (!envelope || !input.opening.hostWallId) return null;

  const wall = envelope.wallGraph.walls.find((candidate) => candidate.id === input.opening.hostWallId) ?? null;
  if (!wall) return null;

  const preferredEdge = wall.edgeIds
    .map((edgeId) => envelope.edges.find((edge) => edge.id === edgeId) ?? null)
    .find((edge) => edge?.semanticKind === 'wall_perimeter');
  return preferredEdge?.id ?? wall.edgeIds[0] ?? null;
}

function resolveOpeningWallId(input: {
  projectModel: WorkbenchProjectModel | null;
  opening: OpeningObjectModel;
  hostEdgeId: string | null;
}): AttachmentSide | null {
  if (isAttachmentSide(input.opening.wallId)) return input.opening.wallId;
  const envelope = input.projectModel?.houseAssembly?.derivedEnvelope ?? null;
  if (!envelope) return null;

  const hostZone = envelope.attachmentZones.find((zone) =>
    (input.hostEdgeId && zone.hostEdgeId === input.hostEdgeId) ||
    (input.opening.hostWallId && zone.hostWallId === input.opening.hostWallId),
  );
  return hostZone?.side ?? null;
}

function normalizeOpeningKind(value: OpeningObjectModel['kind']): NonNullable<NonNullable<RawGeometryModuleInput['houseContext']['openings']>[number]['kind']> {
  if (value === 'hinged_door' || value === 'slider' || value === 'stacker' || value === 'window') {
    return value;
  }
  return 'window';
}

function resolveOpeningPanelCount(
  kind: NonNullable<NonNullable<RawGeometryModuleInput['houseContext']['openings']>[number]['kind']>,
  value: OpeningObjectModel['panelCount'],
): 2 | 3 | 4 | null {
  if (kind !== 'slider') return null;
  return value === 3 || value === 4 ? value : 2;
}

function mapOpenings(
  projectModel: WorkbenchProjectModel | null,
): RawGeometryModuleInput['houseContext']['openings'] {
  if (!projectModel) return null;
  return projectModel.openings.map((opening) => {
    const kind = normalizeOpeningKind(opening.kind);
    const hostEdgeId = resolveOpeningHostEdgeId({ projectModel, opening });
    return {
      id: opening.id,
      label: opening.label,
      kind,
      panelCount: resolveOpeningPanelCount(kind, opening.panelCount),
      wallId: resolveOpeningWallId({ projectModel, opening, hostEdgeId }),
      hostEdgeId,
      widthMm: toOptionalMillimetresFromMetres(opening.widthM),
      heightMm: toOptionalMillimetresFromMetres(opening.heightM),
      sillHeightMm: toOptionalMillimetresFromMetres(opening.sillHeightM),
      offsetAlongWallMm: toOptionalMillimetresFromMetres(opening.offsetAlongWallM),
      validation: opening.validation
        ? {
            status: opening.validation.status,
            codes: opening.validation.codes,
            message: opening.validation.message,
          }
        : null,
    };
  });
}

export function buildRawGeometryModuleInput(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId?: string | null;
  module: CalculatorModuleInputs;
  result: CostOutputV1 | null;
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
}): RawGeometryModuleInput {
  const {
    projectId,
    estimateId,
    designRequestId = null,
    moduleId = null,
    module,
    result,
    objectWorkbenchGeometryContext = null,
  } = input;
  const projectModel = objectWorkbenchGeometryContext?.projectModel ?? null;
  const houseForm = selectHouseForm({ projectModel, module, moduleId });
  const roofIntent = houseForm?.roofIntent ?? null;

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
      footprintMode: houseForm?.footprint.mode ?? resolveFootprintMode(module),
      footprintPreset: houseForm?.footprint.preset ?? resolveFootprintPreset(module),
      footprintParams: houseForm?.footprint.params ?? resolveFootprintParams(module),
      footprintPolygon:
        houseForm && houseForm.footprint.polygon.length
          ? houseForm.footprint.polygon
          : resolveFootprintPolygon(module),
      storeyMode: houseForm?.storeyMode ?? module.houseStoreyMode ?? null,
      roofForm: roofIntent?.form ?? null,
      roofMaterial: roofIntent?.material ?? normalizeHouseRoofMaterial(module.houseRoofMaterial),
      roofPrimaryFallDirection: resolveHouseFormRoofFallDirection(houseForm),
      roofRidgeAxis: resolveHouseFormRoofRidgeAxis(houseForm),
      openGableEndIds: roofIntent?.openGableEndIds ?? null,
      roofAppendage: roofIntent?.appendage.enabled
        ? {
            enabled: true,
            form: roofIntent.appendage.form,
            hostEdge: roofIntent.appendage.hostEdge,
            pitchDeg: resolveOptionalOverride(roofIntent.appendage.pitchDeg),
            dropMm: resolveOptionalOverride(roofIntent.appendage.dropMm),
          }
        : null,
      decks: mapDecks(projectModel),
      openings: mapOpenings(projectModel),
      attachmentStrategy: houseForm?.attachmentStrategy ?? module.houseAttachmentStrategy ?? null,
      eaveHeightM: resolveOptionalOverride(houseForm?.eaveHeightM ?? module.houseEaveHeightM),
      wallHeightM: resolveOptionalOverride(houseForm?.wallHeightM ?? module.houseWallHeightM),
      roofPitchDeg: resolveOptionalOverride(roofIntent?.primaryPitchDeg ?? module.houseRoofPitchDeg),
      eave: {
        soffitDepthMm: resolveOptionalOverride(houseForm?.soffitDepthMm ?? module.houseSoffitDepthMm),
        fasciaHeightMm: resolveOptionalOverride(houseForm?.fasciaHeightMm ?? module.houseFasciaHeightMm),
        gutterWidthMm: resolveOptionalOverride(houseForm?.gutterWidthMm ?? module.houseGutterWidthMm),
        gutterDepthMm: resolveOptionalOverride(houseForm?.gutterDepthMm ?? module.houseGutterDepthMm),
        gutterProjectionMm: resolveOptionalOverride(
          houseForm?.gutterProjectionMm ?? module.houseGutterProjectionMm,
        ),
        eaveOverhangMm: resolveOptionalOverride(houseForm?.eaveOverhangMm ?? module.houseEaveOverhangMm),
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

export { buildRawGeometryModuleInput as buildObjectWorkbenchRawGeometryModuleInput };
