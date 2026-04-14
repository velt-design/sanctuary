import type {
  AttachmentSide,
  AssemblyMemberProfile,
  BoxGutterMode,
  ConnectionType,
  FootingType,
  GableEaveGutterMode,
  GableEndFramesMode,
  GutterAssemblyMode,
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseFootprintMode,
  HouseFootprintPreset,
  HouseModelConfig,
  HouseRoofForm,
  HouseRoofMaterial,
  HouseStoreyMode,
  HouseWallConstruction,
  RawGableEaveGutterMode,
  RawGableEndFramesMode,
  RawBoxGutterMode,
  RawGeometryModuleInput,
  RoofFallDirection,
  RoofMaterial,
} from './contracts';
import { buildCustomHouseFootprintPolygon, buildHouseFootprintPolygon } from './footprints';
import { makeDatumFrame } from './math3d';
import { parseAssemblyMemberProfile } from './profiles';
import { metresToMillimetres, parseNonNegativeInteger, parseNonNegativeNumber, parsePositiveNumber } from './units';

export type NormalizeGeometryConfigErrorCode = 'unsupported_family' | 'unsupported_variant' | 'missing_required_input' | 'invalid_numeric_input';

export type NormalizeGeometryConfigResult =
  | {
      ok: true;
      value: GeometryConfig;
    }
  | {
      ok: false;
      code: NormalizeGeometryConfigErrorCode;
      error: string;
    };

function ok(value: GeometryConfig): NormalizeGeometryConfigResult {
  return { ok: true, value };
}

function fail(code: NormalizeGeometryConfigErrorCode, error: string): NormalizeGeometryConfigResult {
  return { ok: false, code, error };
}

const BOX_HOUSE_SETBACK_MM = 150;
const BOX_OUTER_SETBACK_MM = 50;
const DEFAULT_HOUSE_EAVE_HEIGHT_MM = 2400;
const DEFAULT_HOUSE_ROOF_PITCH_DEG = 25;
const DEFAULT_HOUSE_SOFFIT_DEPTH_MM = 450;
const DEFAULT_HOUSE_FASCIA_HEIGHT_MM = 180;
const DEFAULT_HOUSE_GUTTER_WIDTH_MM = 125;
const DEFAULT_HOUSE_GUTTER_DEPTH_MM = 90;
const DEFAULT_HOUSE_GUTTER_PROJECTION_MM = 125;
const DEFAULT_HOUSE_EAVE_OVERHANG_MM = 450;
const DEFAULT_HOUSE_ROOF_MATERIAL: HouseRoofMaterial = 'corrugated_iron';

function resolveFamily(input: RawGeometryModuleInput): GeometryConfig['family'] | null {
  if (input.pergolaStyle === 'pitched') {
    return input.boxPerimeterEnabled ? 'box' : 'mono';
  }
  if (input.pergolaStyle === 'gable') return 'gable';
  return null;
}

function resolveAttachmentSide(side: AttachmentSide | null | undefined): AttachmentSide {
  if (side === 'front' || side === 'left' || side === 'right') return side;
  return 'rear';
}

function resolveConnectionType(value: RawGeometryModuleInput['connection']['houseConnectionType']): ConnectionType {
  if (value === 'none' || value === 'freestanding') return 'freestanding';
  if (value === 'facade' || value === 'wall') return 'wall';
  if (value === 'fascia') return 'fascia';
  return 'soffit';
}

function resolveHouseStoreyMode(value: HouseStoreyMode | null | undefined): HouseStoreyMode {
  if (value === 'double_storey' || value === 'custom') return value;
  return 'single_storey';
}

function resolveHouseWallConstruction(value: HouseWallConstruction | null | undefined): HouseWallConstruction {
  if (value === 'timber_frame') return value;
  return 'timber_frame';
}

function resolveHouseRoofForm(value: HouseRoofForm | null | undefined): HouseRoofForm {
  if (value === 'hipped') return value;
  return 'hipped';
}

function resolveHouseRoofMaterial(value: HouseRoofMaterial | null | undefined): HouseRoofMaterial {
  if (
    value === 'trapezoidal_5_rib' ||
    value === 'eurotray_300' ||
    value === 'eurotray_500' ||
    value === 'shingles'
  ) {
    return value;
  }
  return DEFAULT_HOUSE_ROOF_MATERIAL;
}

function resolveHouseAttachmentStrategy(
  value: HouseAttachmentStrategy | null | undefined,
  connectionType: ConnectionType,
): HouseAttachmentStrategy {
  if (
    value === 'soffit_brackets' ||
    value === 'fascia_under_gutter' ||
    value === 'facade_ledger' ||
    value === 'post_supported_tieback' ||
    value === 'none'
  ) {
    return value;
  }

  if (connectionType === 'freestanding') return 'none';
  if (connectionType === 'wall') return 'facade_ledger';
  if (connectionType === 'fascia') return 'fascia_under_gutter';
  return 'soffit_brackets';
}

function resolveRoofMaterial(input: RawGeometryModuleInput): { material: RoofMaterial; mode?: string | null } {
  if (input.roof.material === 'mixed') {
    return {
      material: 'timber',
      mode: input.roof.mode ?? 'mixed',
    };
  }
  if (input.roof.material === 'insulated' || input.roof.material === 'louvre') {
    return {
      material: input.roof.material,
      mode: input.roof.mode ?? null,
    };
  }
  return {
    material: input.roof.material,
    mode: input.roof.mode ?? null,
  };
}

function resolveFallDirection(input: RawGeometryModuleInput, family: GeometryConfig['family']): RoofFallDirection {
  if (family === 'gable') return 'dual';
  const slopeDirection = input.derived?.slopeDirection ?? input.roof.slopeDirection ?? 'away_from_house';
  return slopeDirection === 'toward_house' ? 'negativeY' : 'positiveY';
}

function resolveFootingType(value: RawGeometryModuleInput['supports']['postConnectionType']): FootingType | null {
  if (value === 'slab_anchors') return 'slab';
  if (value === 'pile_1m' || value === 'pile_1_5m') return 'pile';
  return null;
}

function resolveDimensionMm(input: {
  label: string;
  derivedValue?: number | null;
  rawValue?: string | number | null;
}): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  const derivedValue = parsePositiveNumber(input.derivedValue);
  if (derivedValue !== null) {
    return { ok: true, value: metresToMillimetres(derivedValue) };
  }

  const rawParsed = parsePositiveNumber(input.rawValue);
  if (rawParsed !== null) {
    return { ok: true, value: metresToMillimetres(rawParsed) };
  }

  const hasAnyRaw = input.rawValue !== undefined && input.rawValue !== null && String(input.rawValue).trim() !== '';
  const hasAnyDerived = typeof input.derivedValue === 'number';
  if (hasAnyRaw || hasAnyDerived) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: `Enter a valid ${input.label}.`,
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: `${input.label} is required.`,
  };
}

function resolvePitchDeg(input: RawGeometryModuleInput): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  const derivedValue = parseNonNegativeNumber(input.derived?.roofPitchDeg);
  if (derivedValue !== null) {
    return { ok: true, value: derivedValue };
  }

  const rawParsed = parseNonNegativeNumber(input.roof.roofPitchDeg);
  if (rawParsed !== null) {
    return { ok: true, value: rawParsed };
  }

  const hasAnyRaw = input.roof.roofPitchDeg !== undefined && input.roof.roofPitchDeg !== null && String(input.roof.roofPitchDeg).trim() !== '';
  const hasAnyDerived = typeof input.derived?.roofPitchDeg === 'number';
  if (hasAnyRaw || hasAnyDerived) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: 'Enter a valid roof pitch.',
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: 'roof pitch is required.',
  };
}

function resolvePostCutHeightMm(value: RawGeometryModuleInput['supports']['postCutHeightM']): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = parsePositiveNumber(value);
  if (parsed === null) {
    return null;
  }

  return metresToMillimetres(parsed);
}

function resolveOverhangMm(input: RawGeometryModuleInput): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  if (!input.roof.overhangEnabled) {
    return { ok: true, value: 0 };
  }

  const parsed = parseNonNegativeNumber(input.roof.overhangM);
  if (parsed !== null) {
    return { ok: true, value: metresToMillimetres(parsed) };
  }

  const hasAnyRaw = input.roof.overhangM !== undefined && input.roof.overhangM !== null && String(input.roof.overhangM).trim() !== '';
  if (hasAnyRaw) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: 'Enter a valid overhang.',
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: 'overhang amount is required.',
  };
}

function resolveStructuralHeightMm(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : metresToMillimetres(parsed);
}

function resolveStructuralProfile(value: string | null | undefined): AssemblyMemberProfile | null {
  return parseAssemblyMemberProfile(value);
}

function resolveRafterCount(value: string | number | null | undefined): number | null {
  const parsed = parseNonNegativeInteger(value);
  if (parsed === null || parsed < 2) {
    return null;
  }
  return parsed;
}

function resolveRafterSpacingMm(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function resolveGutterAssemblyMode(value: GutterAssemblyMode | null | undefined): GutterAssemblyMode | null {
  if (value === 'integrated' || value === 'separate' || value === 'none') {
    return value;
  }
  return null;
}

function resolveGableEndFramesMode(value: RawGableEndFramesMode | null | undefined): GableEndFramesMode | null {
  if (value === 'none' || value === 'outer_end_only' || value === 'both_ends') {
    return value;
  }
  return null;
}

function resolveGableEaveGutterMode(
  value: RawGableEaveGutterMode | null | undefined,
): GableEaveGutterMode | null {
  if (value === 'house' || value === 'our') {
    return value;
  }
  return null;
}

function resolveBoxGutterMode(value: RawBoxGutterMode | null | undefined): BoxGutterMode | null {
  if (value === 'house' || value === 'our' || value === 'none') {
    return value;
  }
  return null;
}

function resolveOptionalMillimetres(value: string | number | null | undefined): number | null {
  const parsed = parseNonNegativeNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function resolveOptionalMetresToMillimetres(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : metresToMillimetres(parsed);
}

function resolveOptionalDegrees(value: string | number | null | undefined): number | null {
  return parseNonNegativeNumber(value);
}

function resolveMillimetresWithDefault(value: string | number | null | undefined, fallback: number): number {
  return resolveOptionalMillimetres(value) ?? fallback;
}

function resolveOptionalSquareMetresToSquareMillimetres(value: number | null | undefined): number | null {
  const parsed = parseNonNegativeNumber(value);
  return parsed === null ? null : Math.round(parsed * 1_000_000);
}

function resolveFootprintPreset(value: HouseFootprintPreset | null | undefined): HouseFootprintPreset {
  if (
    value === 'l_left' ||
    value === 'l_right' ||
    value === 'recess_left' ||
    value === 'recess_right' ||
    value === 'u_shape' ||
    value === 'wrap_left' ||
    value === 'wrap_right'
  ) {
    return value;
  }
  return 'straight';
}

function resolveFootprintMode(value: HouseFootprintMode | 'orthogonal_polygon' | null | undefined): HouseFootprintMode {
  return value === 'custom_polygon' || value === 'orthogonal_polygon' ? 'custom_polygon' : 'preset';
}

function buildHouseModelConfig(input: {
  rawHouseContext: RawGeometryModuleInput['houseContext'];
  footprint: GeometryConfig['houseContext']['footprint'];
  connectionType: ConnectionType;
  houseUndersideMm: number | null;
  referenceUndersideMm: number | null;
}): HouseModelConfig | null {
  if (input.connectionType === 'freestanding' || !input.footprint) {
    return null;
  }

  const eaveHeightMm =
    resolveOptionalMetresToMillimetres(input.rawHouseContext.eaveHeightM) ??
    input.referenceUndersideMm ??
    input.houseUndersideMm ??
    DEFAULT_HOUSE_EAVE_HEIGHT_MM;
  const wallHeightMm = resolveOptionalMetresToMillimetres(input.rawHouseContext.wallHeightM) ?? eaveHeightMm;
  const roofPitchDeg = resolveOptionalDegrees(input.rawHouseContext.roofPitchDeg) ?? DEFAULT_HOUSE_ROOF_PITCH_DEG;
  const rawEave = input.rawHouseContext.eave;

  return {
    footprint: input.footprint,
    storeyMode: resolveHouseStoreyMode(input.rawHouseContext.storeyMode),
    wallConstruction: resolveHouseWallConstruction(input.rawHouseContext.wallConstruction),
    roofForm: resolveHouseRoofForm(input.rawHouseContext.roofForm),
    roofMaterial: resolveHouseRoofMaterial(input.rawHouseContext.roofMaterial),
    eaveHeightMm,
    wallHeightMm,
    roofPitchDeg,
    attachmentStrategy: resolveHouseAttachmentStrategy(input.rawHouseContext.attachmentStrategy, input.connectionType),
    eave: {
      soffitDepthMm: resolveMillimetresWithDefault(rawEave?.soffitDepthMm, DEFAULT_HOUSE_SOFFIT_DEPTH_MM),
      fasciaHeightMm: resolveMillimetresWithDefault(rawEave?.fasciaHeightMm, DEFAULT_HOUSE_FASCIA_HEIGHT_MM),
      gutterWidthMm: resolveMillimetresWithDefault(rawEave?.gutterWidthMm, DEFAULT_HOUSE_GUTTER_WIDTH_MM),
      gutterDepthMm: resolveMillimetresWithDefault(rawEave?.gutterDepthMm, DEFAULT_HOUSE_GUTTER_DEPTH_MM),
      gutterProjectionMm: resolveMillimetresWithDefault(rawEave?.gutterProjectionMm, DEFAULT_HOUSE_GUTTER_PROJECTION_MM),
      eaveOverhangMm: resolveMillimetresWithDefault(rawEave?.eaveOverhangMm, DEFAULT_HOUSE_EAVE_OVERHANG_MM),
    },
  };
}

export function normalizeGeometryConfig(input: RawGeometryModuleInput): NormalizeGeometryConfigResult {
  const family = resolveFamily(input);
  if (!family) {
    return fail('unsupported_family', `Pergola style ${input.pergolaStyle} is not supported by Sanctuary geometry V1.`);
  }

  const length = resolveDimensionMm({
    label: 'length',
    derivedValue: input.derived?.lengthM,
    rawValue: input.dimensions.lengthM,
  });
  if (!length.ok) return fail(length.code, length.error);

  const projection = resolveDimensionMm({
    label: 'projection',
    derivedValue: input.derived?.projectionM,
    rawValue: input.dimensions.projectionM,
  });
  if (!projection.ok) return fail(projection.code, projection.error);

  const pitch = resolvePitchDeg(input);
  if (!pitch.ok) return fail(pitch.code, pitch.error);

  const overhang = resolveOverhangMm(input);
  if (!overhang.ok) return fail(overhang.code, overhang.error);

  const attachmentSide = resolveAttachmentSide(input.connection.attachmentSide);
  const connectionType = resolveConnectionType(input.connection.houseConnectionType);
  const roof = resolveRoofMaterial(input);
  const fallDirection = resolveFallDirection(input, family);
  const houseUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.houseUndersideM);
  const outerUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.outerUndersideM);
  const referenceUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.referenceUndersideM);
  const gableEndFramesMode = resolveGableEndFramesMode(input.gable?.endFramesMode);
  const gableHouseEaveGutterMode =
    resolveGableEaveGutterMode(input.gable?.houseEaveGutter) ??
    (connectionType === 'freestanding' ? 'our' : 'house');
  const gableOuterEaveGutterMode = resolveGableEaveGutterMode(input.gable?.outerEaveGutter) ?? 'our';
  const boxHouseEdgeGutterMode =
    resolveBoxGutterMode(input.box?.houseEdgeGutter) ??
    (connectionType === 'freestanding' ? 'none' : 'house');
  const boxFarEdgeGutterMode =
    resolveBoxGutterMode(input.box?.farEdgeGutter) ??
    (connectionType === 'freestanding' ? 'none' : 'our');
  const boxEffectiveRunMm = resolveOptionalMetresToMillimetres(input.derived?.boxEffectiveRunM);
  const boxRiseMm = resolveOptionalMillimetres(input.derived?.boxRiseMm);
  const boxMaxFallMm = resolveOptionalMillimetres(input.derived?.boxMaxFallMm);
  const roofCoveringKind =
    (family === 'mono' || family === 'gable') && roof.material === 'acrylic' ? 'acrylic' : null;
  const footprintMode = resolveFootprintMode(input.houseContext.footprintMode);
  let houseFootprint: GeometryConfig['houseContext']['footprint'] = null;
  if (connectionType !== 'freestanding') {
    if (footprintMode === 'custom_polygon') {
      const customFootprint = buildCustomHouseFootprintPolygon({
        pergolaWidthMm: length.value,
        pergolaDepthMm: projection.value,
        polygon: input.houseContext.footprintPolygon,
        params: input.houseContext.footprintParams,
        attachmentSide,
      });
      if (!customFootprint.ok) {
        return fail('invalid_numeric_input', customFootprint.error);
      }
      houseFootprint = customFootprint.polygon;
    } else {
      houseFootprint = buildHouseFootprintPolygon({
        pergolaWidthMm: length.value,
        pergolaDepthMm: projection.value,
        preset: resolveFootprintPreset(input.houseContext.footprintPreset),
        params: input.houseContext.footprintParams,
        attachmentSide,
      });
    }
  }
  const houseAttachmentStrategy =
    connectionType === 'freestanding'
      ? 'none'
      : resolveHouseAttachmentStrategy(input.houseContext.attachmentStrategy, connectionType);
  const houseModel = buildHouseModelConfig({
    rawHouseContext: input.houseContext,
    footprint: houseFootprint,
    connectionType,
    houseUndersideMm,
    referenceUndersideMm,
  });

  if (
    family === 'gable' &&
    houseUndersideMm !== null &&
    outerUndersideMm !== null &&
    houseUndersideMm !== outerUndersideMm
  ) {
    return fail('unsupported_variant', 'Gable solver currently requires symmetrical eave underside heights.');
  }

  const datum = makeDatumFrame(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  );

  return ok({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    family,
    datum: {
      ...datum,
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: length.value, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: length.value,
      projectionMm: projection.value,
      roofPitchDeg: pitch.value,
    },
    roof: {
      material: roof.material,
      mode: roof.mode ?? null,
      fallDirection,
      boxPerimeterEnabled: input.boxPerimeterEnabled,
      overhangMm: overhang.value,
    },
    roofCovering: {
      kind: roofCoveringKind,
      effectiveRunMm: roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.effectiveRunM) : null,
      acrylicRequiredDownslopeMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.acrylicRequiredDownslopeM) : null,
      joinerPieceLengthMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.joinerPieceLengthM) : null,
      joinerRunsTotal:
        roofCoveringKind === 'acrylic' ? parseNonNegativeInteger(input.derived?.joinerRunsTotal) : null,
      houseAllowanceMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.rafterHouseAllowanceM) : null,
      farAllowanceMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.rafterFarAllowanceM) : null,
      acrylicAreaMm2:
        roofCoveringKind === 'acrylic' ? resolveOptionalSquareMetresToSquareMillimetres(input.derived?.acrylicAreaM2) : null,
    },
    gable: {
      ridgePositionMm: family === 'gable' ? projection.value / 2 : null,
      endFramesMode: family === 'gable' ? gableEndFramesMode ?? 'none' : null,
      houseEaveGutterMode: family === 'gable' ? gableHouseEaveGutterMode : null,
      outerEaveGutterMode: family === 'gable' ? gableOuterEaveGutterMode : null,
    },
    box: {
      houseEdgeGutterMode: family === 'box' ? boxHouseEdgeGutterMode : null,
      farEdgeGutterMode: family === 'box' ? boxFarEdgeGutterMode : null,
      houseSetbackMm: family === 'box' ? BOX_HOUSE_SETBACK_MM : null,
      outerSetbackMm: family === 'box' ? BOX_OUTER_SETBACK_MM : null,
      effectiveRunMm: family === 'box' ? boxEffectiveRunMm : null,
      riseMm: family === 'box' ? boxRiseMm : null,
      maxFallMm: family === 'box' ? boxMaxFallMm : null,
    },
    connection: {
      type: connectionType,
      attachmentSide,
    },
    supports: {
      postMode: input.supports.postMode ?? (input.supports.postPositions?.length ? 'custom' : 'standard'),
      postPositions: input.supports.postPositions ?? undefined,
      postCount: parseNonNegativeInteger(input.supports.postCount) ?? undefined,
      postCutHeightMm: resolvePostCutHeightMm(input.supports.postCutHeightM),
      footingType: resolveFootingType(input.supports.postConnectionType),
      postConnectionType: input.supports.postConnectionType ?? null,
      groundCondition: input.supports.ground ?? null,
      groundLevelMm: null,
    },
    structural: {
      heights: {
        houseUndersideMm,
        outerUndersideMm,
        referenceUndersideMm,
      },
      profiles: {
        post: resolveStructuralProfile(input.structural?.profiles?.post),
        rafter: resolveStructuralProfile(input.structural?.profiles?.rafter),
        ledger: resolveStructuralProfile(input.structural?.profiles?.ledger),
        supportBeam: resolveStructuralProfile(input.structural?.profiles?.supportBeam),
        gutter: resolveStructuralProfile(input.structural?.profiles?.gutter),
        ridge: resolveStructuralProfile(input.structural?.profiles?.ridge),
        tieBeam: resolveStructuralProfile(input.structural?.profiles?.tieBeam),
        strut: resolveStructuralProfile(input.structural?.profiles?.strut),
        boxPerimeter: resolveStructuralProfile(input.structural?.profiles?.boxPerimeter),
      },
      framing: {
        rafterCount: resolveRafterCount(input.structural?.framing?.rafterCount),
        rafterSpacingMm: resolveRafterSpacingMm(input.structural?.framing?.rafterSpacingMm),
      },
      drainage: {
        gutterType: input.structural?.drainage?.gutterType ?? null,
        gutterAssemblyMode: resolveGutterAssemblyMode(input.structural?.drainage?.gutterAssemblyMode),
        integratedGutterBeam: input.structural?.drainage?.integratedGutterBeam ?? null,
        hasOurGutter: input.structural?.drainage?.hasOurGutter ?? null,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: null,
      footprint: houseFootprint,
      footprintMode: connectionType === 'freestanding' ? 'preset' : footprintMode,
      footprintPolygon: footprintMode === 'custom_polygon' ? input.houseContext.footprintPolygon ?? null : null,
      model: houseModel,
      attachmentStrategy: houseAttachmentStrategy,
    },
  });
}
