import type { CostOutputV1 } from '@sp/costing';
import type { RawGeometryModuleInput } from '@sp/geometry';
import type {
  DeckObjectModel,
  HouseFormModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { connectionTypeFromAttachment } from '@/lib/drawings/state/pergolaAttachment';
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

/**
 * Step 8 of the first-class spatial-entities migration. When the pergola has
 * a snap-derived `attachment` set, project it onto the broader
 * `RawHouseConnectionType` the geometry input accepts. Otherwise fall back
 * to the legacy `module.houseConnectionType` field. This is the boundary
 * that makes the new attachment shape load-bearing for the cost engine
 * without rewiring downstream consumers.
 *
 * Return type is the geometry input's `RawHouseConnectionType` (which
 * includes `'wall'` and `'freestanding'`) — broader than costing's
 * `HouseConnectionType` (`'soffit' | 'fascia' | 'facade' | 'none'`). The
 * legacy fallback is narrower but assignable.
 */
function resolveHouseConnectionType(
  module: CalculatorModuleInputs,
  pergola: PergolaObjectModel | null,
): RawGeometryModuleInput['connection']['houseConnectionType'] {
  if (pergola?.attachment) {
    return connectionTypeFromAttachment(pergola.attachment);
  }
  return module.houseConnectionType;
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

/**
 * Map a pergola's per-object world position (Phase 2 free-floating-objects) to
 * the geometry module input. When the pergola has a `position` set, geometry
 * will treat it as free-floating and ignore the connection-driven datum. When
 * unset, the field is null and geometry falls back to the existing rigid path.
 */
function resolvePergolaPosition(
  pergola: PergolaObjectModel | null,
): RawGeometryModuleInput['position'] {
  if (!pergola?.position) return null;
  return {
    origin: {
      x: pergola.position.originXMm,
      y: pergola.position.originYMm,
    },
    rotationDeg: pergola.position.rotationDeg,
  };
}

/**
 * Map a house's first-class spatial `position` (stage 3 of the house
 * decoupling migration) to the geometry module input. Read from
 * `module.houseFootprintPosition` (CalculatorModuleInputs field, persists
 * via the snapshot/draft pipeline). When set, geometry decodes the custom
 * polygon against a unit frame and applies this position post-decode — so
 * the house's world location is invariant to pergola dimensions. When null
 * or empty, the legacy real-frame decoder runs (back-compat).
 */
function resolveHousePosition(
  module: CalculatorModuleInputs,
): RawGeometryModuleInput['houseContext']['position'] {
  const position = module.houseFootprintPosition;
  if (!position || !position.originXMm || !position.originYMm) return null;
  return {
    origin: {
      x: position.originXMm,
      y: position.originYMm,
    },
    rotationDeg: position.rotationDeg ?? '0',
  };
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

/**
 * Public project-level deck mapper (PR-G3b, 2026-05-22). Lets the workbench
 * solve compute once per project instead of per pergola module.
 */
export function mapProjectDecks(
  projectModel: WorkbenchProjectModel | null,
): RawGeometryModuleInput['houseContext']['decks'] {
  return mapDecks(projectModel);
}

/**
 * Public project-level opening mapper (PR-G3b, 2026-05-22). Lets the workbench
 * solve compute once per project instead of per pergola module.
 */
export function mapProjectOpenings(
  projectModel: WorkbenchProjectModel | null,
): RawGeometryModuleInput['houseContext']['openings'] {
  return mapOpenings(projectModel);
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
    position: deck.position
      ? {
          origin: { x: deck.position.originXMm, y: deck.position.originYMm },
          rotationDeg: deck.position.rotationDeg,
        }
      : null,
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
  /**
   * PR-G3b (2026-05-22): pre-computed project-level decks/openings, so the
   * per-pergola call doesn't redundantly remap the same project data once
   * per module. Closes audit row 9 in spirit (production workbench solve no
   * longer wraps project-level data per pergola). When omitted, falls back
   * to internal `mapDecks`/`mapOpenings` against `projectModel` — that
   * default is preserved so test fixtures don't have to wire the pre-pass
   * themselves. The structural per-object split (`RawGeometryProjectInput`
   * vs `RawGeometryModuleInput`) is deferred until consumers in the
   * geometry package can read decks/openings from a separate field.
   */
  projectDecks?: RawGeometryModuleInput['houseContext']['decks'];
  projectOpenings?: RawGeometryModuleInput['houseContext']['openings'];
}): RawGeometryModuleInput {
  const {
    projectId,
    estimateId,
    designRequestId = null,
    moduleId = null,
    module,
    result,
    objectWorkbenchGeometryContext = null,
    projectDecks,
    projectOpenings,
  } = input;
  const projectModel = objectWorkbenchGeometryContext?.projectModel ?? null;
  const decks = projectDecks !== undefined ? projectDecks : mapDecks(projectModel);
  const openings = projectOpenings !== undefined ? projectOpenings : mapOpenings(projectModel);
  const houseForm = selectHouseForm({ projectModel, module, moduleId });
  const roofIntent = houseForm?.roofIntent ?? null;
  const pergola = projectModel
    ? resolvePergolaForModule({ projectModel, module, moduleId })
    : null;

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
      houseConnectionType: resolveHouseConnectionType(module, pergola),
      attachmentSide: resolveAttachmentSide(module),
    },
    position: resolvePergolaPosition(pergola),
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
      position: resolveHousePosition(module),
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
      decks,
      openings,
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
