import {
  COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
  type CommercialDesignInputV1,
  type CommercialDiagnosticV1,
  type CommercialIdentityV1,
  type CommercialModuleInputV1,
  type CommercialPergolaInputV1,
  type CommercialQuantityTakeoffV1,
  type CommercialSolvedGeometryV1,
  type CostOutputV1,
  type RoofType,
  type SiteOutputV1,
} from '@sp/costing';
import type { CalculatorInputs, CalculatorModuleInputs, CalculatorPergola } from '@/lib/types/calculator';
import { DEFAULT_CALCULATOR_ATTACHMENT_SIDE, normalizeAttachmentSide } from '@/lib/types/calculator';
import { buildSiteInputsFromCalculatorInputs } from './costingPayload';

type ModuleResultLookup = Map<number, CostOutputV1>;

type BuildCommercialDesignInputArgs = {
  inputs: CalculatorInputs;
  siteResult?: SiteOutputV1 | null;
  identity?: CommercialIdentityV1;
  diagnostics?: CommercialDiagnosticV1[];
};

type BuildCommercialModuleInputArgs = {
  module: CalculatorModuleInputs;
  moduleIndex: number;
  moduleResult?: CostOutputV1 | null;
  blinds?: CalculatorInputs['blinds'];
};

const SOURCE = 'calculator_compat' as const;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function numberOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumberOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function normalizePergolas(pergolas: CalculatorInputs['pergolas']): CalculatorPergola[] {
  const out =
    Array.isArray(pergolas) && pergolas.length
      ? pergolas
          .filter((pergola): pergola is CalculatorPergola => Boolean(pergola && typeof pergola.id === 'string' && pergola.id.trim()))
          .map((pergola, index) => ({
            id: pergola.id.trim(),
            label: typeof pergola.label === 'string' && pergola.label.trim() ? pergola.label.trim() : `Pergola ${index + 1}`,
          }))
      : [];

  return out.length ? out : [{ id: 'pergola-1', label: 'Pergola 1' }];
}

function buildModuleResultLookup(inputs: CalculatorInputs, siteResult?: SiteOutputV1 | null): ModuleResultLookup {
  const lookup: ModuleResultLookup = new Map();
  if (!siteResult) return lookup;

  const resultModules = (Array.isArray(siteResult.pergolas) ? siteResult.pergolas : []).flatMap((pergola) =>
    Array.isArray(pergola.modules) ? pergola.modules : [],
  );
  const pergolas = normalizePergolas(inputs.pergolas);
  const groupedByPergola = new Map(pergolas.map((pergola) => [pergola.id, [] as number[]]));
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';

  inputs.modules.forEach((module, moduleIndex) => {
    const pergolaId =
      typeof module.pergolaId === 'string' && groupedByPergola.has(module.pergolaId)
        ? module.pergolaId
        : fallbackPergolaId;
    groupedByPergola.get(pergolaId)?.push(moduleIndex);
  });

  let resultIndex = 0;
  for (const pergola of pergolas) {
    for (const moduleIndex of groupedByPergola.get(pergola.id) ?? []) {
      const moduleResult = resultModules[resultIndex];
      if (moduleResult) lookup.set(moduleIndex, moduleResult);
      resultIndex += 1;
    }
  }

  return lookup;
}

function effectiveRoofType(module: CalculatorModuleInputs, moduleResult?: CostOutputV1 | null): RoofType {
  const normalizedRoofType = moduleResult?.inputs_normalized?.roof_type;
  if (normalizedRoofType) return normalizedRoofType;
  if (module.pergolaStyle === 'gable' || module.pergolaStyle === 'hip' || module.pergolaStyle === 'hip_corner') {
    return module.pergolaStyle;
  }
  return module.internalRoofType ?? 'pitched';
}

function sanitizeOverrides(overrides: CalculatorModuleInputs['overrides']): Record<string, string | null | undefined> | undefined {
  if (!overrides) return undefined;
  const entries = Object.entries(overrides).filter(([, value]) => value == null || typeof value === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function collectModuleWarnings(moduleResult?: CostOutputV1 | null): string[] {
  const warnings = moduleResult?.totals?.warnings;
  if (Array.isArray(warnings) && warnings.length) {
    return warnings
      .map((warning) => (typeof warning?.message === 'string' ? warning.message.trim() : ''))
      .filter(Boolean);
  }

  const notes = moduleResult?.totals?.notes_and_warnings;
  return Array.isArray(notes) ? notes.map((note) => String(note ?? '').trim()).filter(Boolean) : [];
}

function buildSolvedGeometry(module: CalculatorModuleInputs, moduleResult?: CostOutputV1 | null): CommercialSolvedGeometryV1 {
  const normalized = moduleResult?.inputs_normalized;
  const derived = moduleResult?.derived;
  if (!moduleResult || !normalized || !derived) {
    return {
      status: 'blocked',
      geometrySource: SOURCE,
      primaryDimensionsM: {
        length: nonNegativeNumberOrNull(module.lengthM) ?? 0,
        projection: nonNegativeNumberOrNull(module.projectionM) ?? 0,
      },
      secondaryDimensionsM:
        module.pergolaStyle === 'hip_corner'
          ? {
              length: nonNegativeNumberOrNull(module.hipCornerLengthBM) ?? 0,
              projection: nonNegativeNumberOrNull(module.hipCornerProjectionBM) ?? 0,
            }
          : null,
      roofPlaneCount: null,
      attachmentLengthM: null,
      warnings: ['Calculator costing result was not supplied; solved geometry and takeoff are incomplete.'],
    };
  }

  return {
    status: 'approximate',
    geometrySource: SOURCE,
    primaryDimensionsM: {
      length: nonNegativeNumberOrNull(derived.length_m ?? normalized.length_m) ?? 0,
      projection: nonNegativeNumberOrNull(derived.projection_m ?? normalized.projection_m) ?? 0,
    },
    secondaryDimensionsM:
      normalized.hip_corner_length_b_m || normalized.hip_corner_projection_b_m
        ? {
            length: nonNegativeNumberOrNull(derived.hip_corner_length_b_m ?? normalized.hip_corner_length_b_m) ?? 0,
            projection: nonNegativeNumberOrNull(derived.hip_corner_projection_b_m ?? normalized.hip_corner_projection_b_m) ?? 0,
          }
        : null,
    roofPlaneCount: intOrNull(derived.roof_plane_count),
    attachmentLengthM: nonNegativeNumberOrNull(derived.attachment_length_m),
    warnings: collectModuleWarnings(moduleResult),
  };
}

function productOrNull(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  return left * right;
}

function sumNumbersOrNull(values: Array<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finiteValues.length) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0);
}

function buildRoofPlanes(moduleResult?: CostOutputV1 | null): NonNullable<CommercialQuantityTakeoffV1['roofPlanes']> {
  const planes = moduleResult?.derived?.roof_planes;
  if (!Array.isArray(planes)) return [];
  return planes.map((plane, index) => ({
    id: typeof plane.id === 'string' && plane.id.trim() ? plane.id : `roof-plane-${index + 1}`,
    label: typeof plane.label === 'string' && plane.label.trim() ? plane.label : undefined,
    areaM2: nonNegativeNumberOrNull(plane.roof_area_m2),
    rafterCount: intOrNull(plane.bay_count) == null ? null : (intOrNull(plane.bay_count) ?? 0) + 1,
    rafterLengthM: nonNegativeNumberOrNull(plane.rafter_length_m),
    rafterSpacingMm: nonNegativeNumberOrNull(moduleResult?.derived?.rafter_spacing_mm),
    rafterTotalLengthM: productOrNull(
      intOrNull(plane.bay_count) == null ? null : (intOrNull(plane.bay_count) ?? 0) + 1,
      nonNegativeNumberOrNull(plane.rafter_length_m),
    ),
    bayCount: intOrNull(plane.bay_count),
    claddingAreaM2: nonNegativeNumberOrNull(plane.roof_area_m2),
    claddingPanelCount: null,
    joinerCount: intOrNull(plane.bay_count) == null ? null : (intOrNull(plane.bay_count) ?? 0) + 1,
    joinerTotalLengthM: productOrNull(
      intOrNull(plane.bay_count) == null ? null : (intOrNull(plane.bay_count) ?? 0) + 1,
      nonNegativeNumberOrNull(moduleResult?.derived?.joiner_piece_length_m),
    ),
  }));
}

function buildQuantityTakeoff(args: {
  module: CalculatorModuleInputs;
  moduleResult?: CostOutputV1 | null;
  blindCount: number;
}): CommercialQuantityTakeoffV1 {
  const normalized = args.moduleResult?.inputs_normalized;
  const derived = args.moduleResult?.derived;

  return {
    primaryDimensions: {
      lengthM: nonNegativeNumberOrNull(derived?.length_m ?? normalized?.length_m ?? args.module.lengthM),
      projectionM: nonNegativeNumberOrNull(derived?.projection_m ?? normalized?.projection_m ?? args.module.projectionM),
      roofAreaM2: nonNegativeNumberOrNull(derived?.roof_surface_area_m2 ?? derived?.roof_area_total_m2 ?? derived?.area_m2),
    },
    roofPlanes: buildRoofPlanes(args.moduleResult),
    posts: {
      count: intOrNull(normalized?.post_count ?? args.module.postCount),
      cutHeightM: nonNegativeNumberOrNull(normalized?.post_cut_height_m ?? args.module.postCutHeightM),
      profile: typeof derived?.post_profile_used === 'string' ? derived.post_profile_used : null,
    },
    rafters: {
      count: intOrNull(derived?.rafter_count),
      bayCount: intOrNull(derived?.bay_count),
      spacingMm: nonNegativeNumberOrNull(derived?.rafter_spacing_mm),
      cutLengthM: nonNegativeNumberOrNull(derived?.rafter_cut_length_m),
      totalLengthM: nonNegativeNumberOrNull(derived?.total_installed_rafter_length_m),
      profile: typeof normalized?.rafter_profile === 'string' ? normalized.rafter_profile : null,
    },
    beams: {
      ledgerLengthM: nonNegativeNumberOrNull(derived?.ledger_length_m),
      frontBeamLengthM: nonNegativeNumberOrNull(derived?.front_beam_length_m),
      ridgeLengthM: nonNegativeNumberOrNull(derived?.ridge_length_m),
      tieBeamLengthM: nonNegativeNumberOrNull(derived?.tie_beam_length_m),
      totalBeamLengthM: nonNegativeNumberOrNull(derived?.front_beam_length_m),
      ledgerProfile: typeof derived?.ledger_profile_used === 'string' ? derived.ledger_profile_used : null,
      frontBeamProfile: typeof derived?.front_beam_profile_used === 'string' ? derived.front_beam_profile_used : null,
      ridgeProfile: typeof derived?.ridge_beam_profile_used === 'string' ? derived.ridge_beam_profile_used : null,
    },
    gutters: {
      ourGutterLengthM: nonNegativeNumberOrNull(derived?.our_gutter_length_m),
      houseGutterLengthM: nonNegativeNumberOrNull(derived?.house_gutter_length_m),
      totalLengthM:
        nonNegativeNumberOrNull(derived?.gutter_length_m) ??
        sumNumbersOrNull([
          nonNegativeNumberOrNull(derived?.our_gutter_length_m),
          nonNegativeNumberOrNull(derived?.house_gutter_length_m),
        ]),
      downpipeCount: intOrNull(normalized?.downpipe_count ?? args.module.downpipeCount),
      downpipeJoinCount: intOrNull(normalized?.downpipe_join_count ?? args.module.downpipeJoinCount),
      downpipeElbowCount: intOrNull(normalized?.downpipe_elbow_count ?? args.module.downpipeElbowCount),
    },
    roofCladding: {
      acrylicAreaM2: nonNegativeNumberOrNull(derived?.acrylic_area_m2),
      timberAreaM2: nonNegativeNumberOrNull(derived?.timber_area_m2),
      sheetCount: intOrNull(normalized?.acrylic_sheet_count),
      joinerRuns: intOrNull(derived?.joiner_runs_total),
      panelCount: null,
      totalAreaM2:
        sumNumbersOrNull([
          nonNegativeNumberOrNull(derived?.acrylic_area_m2),
          nonNegativeNumberOrNull(derived?.timber_area_m2),
        ]) ?? nonNegativeNumberOrNull(derived?.roof_surface_area_m2),
    },
    joiners: {
      count: intOrNull(derived?.joiner_runs_total),
      totalLengthM: productOrNull(
        intOrNull(derived?.joiner_runs_total),
        nonNegativeNumberOrNull(derived?.joiner_piece_length_m),
      ),
      averageLengthM: nonNegativeNumberOrNull(derived?.joiner_piece_length_m),
      profile: null,
    },
    flashings: {
      totalLengthM: nonNegativeNumberOrNull(derived?.flashing_total_m ?? normalized?.flashings?.total_length_m),
      count: intOrNull(derived?.flashing_startup_count),
      surfaceAreaM2: null,
      byBandM: {
        '0-200': nonNegativeNumberOrNull(derived?.flashing_0_200_total_m ?? normalized?.flashings?.totals_m_by_band?.['0-200']) ?? 0,
        '201-300':
          nonNegativeNumberOrNull(derived?.flashing_201_300_total_m ?? normalized?.flashings?.totals_m_by_band?.['201-300']) ?? 0,
        '301-400':
          nonNegativeNumberOrNull(derived?.flashing_301_400_total_m ?? normalized?.flashings?.totals_m_by_band?.['301-400']) ?? 0,
      },
    },
    infills: {
      itemCount: intOrNull(derived?.infill_instance_count ?? normalized?.infills?.length ?? args.module.infills?.items?.length),
      sheetAreaM2: nonNegativeNumberOrNull(derived?.infill_sheet_area_m2),
      stripPanelCount: intOrNull(derived?.infill_strip_panel_count),
    },
    blindsAndAccessories: {
      blindCount: args.blindCount,
      accessoryCount: 0,
      notes: args.blindCount > 0 ? ['Calculator blinds are estimate-scoped and are not prorated to modules.'] : [],
    },
  };
}

export function buildCommercialModuleInputFromCalculatorModule(args: BuildCommercialModuleInputArgs): CommercialModuleInputV1 {
  const blindCount = Array.isArray(args.blinds?.items) ? args.blinds.items.length : 0;
  const moduleDiagnostics: CommercialDiagnosticV1[] = [];
  if (!args.moduleResult) {
    moduleDiagnostics.push({
      code: 'calculator_result_missing',
      message: 'Calculator costing result was not supplied; solved geometry and quantity takeoff are incomplete.',
      severity: 'warning',
    });
  }

  return {
    id: `calculator-module-${args.moduleIndex + 1}`,
    label: `Module ${args.moduleIndex + 1}`,
    sourceModuleIndex: args.moduleIndex,
    trustStatus: 'approximate',
    designIntent: {
      pergolaStyle: args.module.pergolaStyle,
      roofMaterial: args.module.roofMaterial,
      extrusionColour: args.module.extrusionColour,
      roofType: effectiveRoofType(args.module, args.moduleResult),
      houseConnectionType: args.module.houseConnectionType,
      attachmentSide:
        args.module.houseConnectionType === 'none'
          ? DEFAULT_CALCULATOR_ATTACHMENT_SIDE
          : normalizeAttachmentSide(args.module.attachmentSide),
      postConnectionType: args.module.postConnectionType,
      ground: args.module.postConnectionType === 'pile_1m' || args.module.postConnectionType === 'pile_1_5m' ? args.module.ground : null,
      roofPitchDeg: numberOrNull(args.moduleResult?.inputs_normalized?.roof_pitch_deg ?? args.module.roofPitchDeg),
      dimensions: {
        lengthM: nonNegativeNumberOrNull(args.module.lengthM),
        projectionM: nonNegativeNumberOrNull(args.module.projectionM),
        secondaryLengthM: args.module.pergolaStyle === 'hip_corner' ? nonNegativeNumberOrNull(args.module.hipCornerLengthBM) : null,
        secondaryProjectionM: args.module.pergolaStyle === 'hip_corner' ? nonNegativeNumberOrNull(args.module.hipCornerProjectionBM) : null,
      },
      roofOptions: {
        boxPerimeterEnabled: args.module.boxPerimeterEnabled,
        gableEndFramesMode: args.module.gableEndFramesMode,
        mixedRoofMode: args.moduleResult?.inputs_normalized?.mixed_roof?.mode ?? (args.module.roofMaterial === 'mixed' ? 'acrylic_bays' : null),
        overhangEnabled: args.module.overhangEnabled,
        invertedEnabled: args.module.invertedEnabled,
      },
    },
    solvedGeometry: buildSolvedGeometry(args.module, args.moduleResult),
    quantityTakeoff: buildQuantityTakeoff({
      module: args.module,
      moduleResult: args.moduleResult,
      blindCount,
    }),
    options: {
      flashings: args.module.flashings,
      infills: args.module.infills,
      blinds: args.blinds,
      overrides: sanitizeOverrides(args.module.overrides),
      powdercoat: {
        standardColour: args.module.powdercoatStandardColour?.trim() || null,
        isCustom: args.module.powdercoatIsCustom === true,
        customColour: args.module.powdercoatCustomColour?.trim() || null,
      },
    },
    diagnostics: moduleDiagnostics,
  };
}

export function buildCommercialDesignInputFromCalculatorInputs(args: BuildCommercialDesignInputArgs): CommercialDesignInputV1 {
  const siteInputs = buildSiteInputsFromCalculatorInputs(args.inputs);
  const pergolas = normalizePergolas(args.inputs.pergolas);
  const moduleResultLookup = buildModuleResultLookup(args.inputs, args.siteResult);
  const groupedPergolas = pergolas.map(
    (pergola): CommercialPergolaInputV1 => ({
      id: pergola.id,
      label: pergola.label,
      trustStatus: 'approximate',
      modules: [],
      diagnostics: [],
    }),
  );
  const groupedById = new Map(groupedPergolas.map((pergola) => [pergola.id, pergola]));
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';

  args.inputs.modules.forEach((module, moduleIndex) => {
    const pergolaId =
      typeof module.pergolaId === 'string' && groupedById.has(module.pergolaId)
        ? module.pergolaId
        : fallbackPergolaId;
    groupedById.get(pergolaId)?.modules.push(
      buildCommercialModuleInputFromCalculatorModule({
        module,
        moduleIndex,
        moduleResult: moduleResultLookup.get(moduleIndex) ?? null,
        blinds: args.inputs.blinds,
      }),
    );
  });

  const diagnostics = [...(args.diagnostics ?? [])];
  if (Array.isArray(args.inputs.blinds?.items) && args.inputs.blinds.items.length > 0) {
    diagnostics.push({
      code: 'calculator_blinds_estimate_scoped',
      message: 'Calculator blinds are estimate-scoped shadow options and are not prorated to modules.',
      severity: 'info',
    });
  }

  return {
    schemaVersion: COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
    source: SOURCE,
    trustStatus: 'approximate',
    identity: args.identity ?? {},
    pergolas: groupedPergolas.filter((pergola) => pergola.modules.length > 0),
    siteCommercial: {
      jobType: siteInputs.job_type ?? args.inputs.jobType,
      access: args.inputs.access,
      height: args.inputs.height,
      travelExGst: siteInputs.travel_ex_gst ?? 0,
      extrasAllowanceExGst: siteInputs.extras_allowance_ex_gst ?? 0,
      quoteDiscountPct: siteInputs.quote_discount_pct ?? 0,
    },
    diagnostics,
  };
}
