import {
  autoSplitByMaxWidth,
  calculateCostV1,
  calculateSiteCostV1,
  getBlindSystemLimits,
  priceAllBlinds,
  type BlindLineItemInput,
  type CostInputsV1,
  type CostOutputV1,
  type SiteInputsV1,
  type SiteOutputV1,
  isCommercialPolicyV2Enabled,
} from '@sp/costing';
import type {
  PublishedCostingConfigurationProvenanceV1,
  ResolvedPublishedCostingConfigurationV1,
} from '@sp/costing/server';
import { buildEstimateDbPayload } from '../../../apps/portal/lib/estimates/persistence';
import { buildEnquiryBudgets } from './enquiryBudgets';
import { QUOTE_MULTIPLIER, type MoneyRange } from './enquiryEstimate';
import type { FrozenSimpleCoverPricingResult } from './simpleCoverPricing.server';
import type { SimpleCoverInput } from './simpleCoverCalculator';

export type EnquiryPricingParams = {
  enquiryType: string;
  name: string;
  suburb: string;
  widthM: number | null;
  depthM: number | null;
  heightM: number | null;
  style: string;
  roofMaterials: string[];
  addOns: Record<string, unknown>;
};

type EnquiryBudgets = {
  baseRange: MoneyRange | null;
  blindsRange: MoneyRange | null;
  budgetBasis: string | null;
};

export type EnquiryPricingSnapshot = {
  costInputs: SiteInputsV1 | null;
  costResult: CostOutputV1 | SiteOutputV1 | null;
  costingConfiguration: PublishedCostingConfigurationProvenanceV1 | null;
  calculatorInputs: Record<string, unknown>;
  budgets: EnquiryBudgets;
  pricingSource:
    | 'current_published_enquiry'
    | 'simple_cover_calculator_verified'
    | 'simple_cover_unpriced'
    | 'unavailable';
  verifiedSimpleCover: {
    input: SimpleCoverInput;
    widthM: number;
    depthM: number;
    level: SimpleCoverInput['level'];
    connection: SimpleCoverInput['connection'];
    displayedEstimateIncGst: number;
  } | null;
};

export type EnquiryPricingOptions = {
  verifiedSimpleCover?: FrozenSimpleCoverPricingResult;
  suppressGenericPricing?: boolean;
};

function isTruthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function pergolaStyleForCosting(styleRaw: string): CostInputsV1['pergola_style'] {
  const style = String(styleRaw ?? '').trim().toLowerCase();
  if (style === 'gable') return 'gable';
  if (style === 'hip') return 'hip';
  if (style === 'hip_corner') return 'hip_corner';
  if (style === 'box_perimeter' || style === 'perimeter') return 'box_perimeter';
  return 'pitched';
}

function roofMaterialForCosting(roofMaterials: string[]): CostInputsV1['roof_material'] {
  const materials = roofMaterials.map((material) => String(material ?? '').trim().toLowerCase()).filter(Boolean);
  const hasAcrylic = materials.includes('acrylic');
  const hasTimber = materials.includes('timber');
  if (hasAcrylic && hasTimber) return 'mixed';
  if (hasTimber) return 'timber';
  return 'acrylic';
}

function heightCategoryForCosting(heightM: number | null): CostInputsV1['height'] {
  return typeof heightM === 'number' && Number.isFinite(heightM) && heightM >= 3 ? 'two_storey' : 'single_storey';
}

function buildCanonicalCostInputs(params: EnquiryPricingParams): SiteInputsV1 | null {
  if (!Number.isFinite(params.widthM ?? NaN) || !Number.isFinite(params.depthM ?? NaN)) return null;
  const module: CostInputsV1 = {
    length_m: Math.max(0.1, Number(params.widthM)),
    projection_m: Math.max(0.1, Number(params.depthM)),
    post_cut_height_m: Number.isFinite(params.heightM ?? NaN) ? Math.max(1, Number(params.heightM)) : 2.4,
    pergola_style: pergolaStyleForCosting(params.style),
    roof_material: roofMaterialForCosting(params.roofMaterials),
    extrusion_colour: 'Black',
    post_count: 2,
    house_connection_type: 'fascia',
    post_connection_type: 'deck_bracket',
    access: 'normal',
    height: heightCategoryForCosting(params.heightM),
    ground: 'easy',
  };
  return {
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1', modules: [module] }],
    job_type: 'residential',
    pricing_classification: 'simple',
    approval_requirement: 'neither',
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
  };
}

function buildBlindItems(params: EnquiryPricingParams): BlindLineItemInput[] {
  if (!isTruthy(params.addOns.blinds) || !Number.isFinite(params.widthM ?? NaN) || !Number.isFinite(params.depthM ?? NaN)) {
    return [];
  }
  const system: BlindLineItemInput['system'] = 'ZIPTRAK';
  const { maxWidthMm, maxCoverLengthMm } = getBlindSystemLimits(system);
  const heightMm = Number.isFinite(params.heightM ?? NaN) ? Math.round(Math.max(1, Number(params.heightM)) * 1000) : 2400;
  const coverLengthMm = Math.min(Math.max(1000, heightMm), maxCoverLengthMm);
  const facesMm = [
    Math.round(Number(params.widthM) * 1000),
    Math.round(Number(params.depthM) * 1000),
    Math.round(Number(params.depthM) * 1000),
  ].filter((value) => Number.isFinite(value) && value > 0);

  const items: BlindLineItemInput[] = [];
  let id = 1;
  for (const faceWidthMm of facesMm) {
    const panels = autoSplitByMaxWidth(faceWidthMm, maxWidthMm) ?? [faceWidthMm];
    for (const widthMm of panels) {
      items.push({
        id: `enquiry-blind-${id}`,
        label: `Blind ${id}`,
        system,
        widthMm,
        coverLengthMm,
        fabric: 'MESH',
        motorised: false,
        rollCover: 'NONE',
      });
      id += 1;
    }
  }
  return items;
}

function calculatorInputsFromSnapshot(
  params: EnquiryPricingParams,
  costInputs: SiteInputsV1 | null,
  blindItems: BlindLineItemInput[],
): Record<string, unknown> {
  const module = costInputs?.pergolas?.[0]?.modules?.[0];
  const lengthM = module?.length_m ?? 6;
  const projectionM = module?.roof_span_m ?? module?.projection_m ?? 3;
  const postCutHeightM = module?.post_cut_height_m ?? 2.4;
  const roofMaterial = module?.roof_material ?? roofMaterialForCosting(params.roofMaterials);
  const pergolaStyle = module?.pergola_style ?? pergolaStyleForCosting(params.style);

  return {
    schemaVersion: 'v2',
    projectName: `${params.name} - ${params.suburb || 'Enquiry'}`.trim(),
    quoteRef: '',
    access: module?.access ?? 'normal',
    height: module?.height ?? heightCategoryForCosting(params.heightM),
    jobType: 'residential',
    pricingClassification: 'simple',
    approvalRequirement: 'neither',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [{
      pergolaId: 'pergola-1',
      pergolaStyle,
      roofMaterial,
      extrusionColour: module?.extrusion_colour ?? 'Black',
      powdercoatStandardColour: '',
      powdercoatIsCustom: false,
      powdercoatCustomColour: '',
      boxPerimeterEnabled: false,
      internalRoofType: pergolaStyle === 'box_perimeter' ? 'flat' : 'pitched',
      fallDistanceMm: '0',
      roofPitchDeg: '',
      gableEndFramesMode: 'outer_end_only',
      gableHouseEdgeGutter: 'house',
      gableOuterEdgeGutter: 'our',
      boxGutterHouseEdge: 'house',
      boxGutterFarEdge: 'our',
      downpipeCount: '0',
      downpipeJoinCount: '0',
      downpipeElbowCount: '0',
      separateGutterEnabled: false,
      overhangEnabled: false,
      overhangAmountM: '0.2',
      overhangSupportBeamProfile: '150x50',
      invertedEnabled: false,
      invertedHouseGutter: true,
      mixedSkylightStripCount: '1',
      mixedSkylightStripWidthM: '0.62',
      mixedAcrylicBaysMain: roofMaterial === 'mixed' ? '2' : '',
      mixedAcrylicBaysA: '',
      mixedAcrylicBaysB: '',
      timberRoofAboveType: 'insulated_panels',
      timberInsulatedPanelThicknessMm: '50',
      timberTrayWidthMm: '500',
      postCount: String(module?.post_count ?? 2),
      houseConnectionType: module?.house_connection_type ?? 'fascia',
      postConnectionType: module?.post_connection_type ?? 'deck_bracket',
      ground: module?.ground ?? 'easy',
      lengthM: String(lengthM),
      projectionM: String(projectionM),
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
      postCutHeightM: String(postCutHeightM),
      timberRoofAllowanceExGst: '0',
      flashings: { rows: [] },
      overrides: {},
      infills: { items: [] },
    }],
    blinds: {
      items: blindItems.map((item) => ({
        ...item,
        widthMm: String(item.widthMm),
        coverLengthMm: String(item.coverLengthMm),
        motorised: item.motorised ? 'YES' : 'NONE',
      })),
    },
  };
}

export function buildEnquiryPricingSnapshot(
  params: EnquiryPricingParams,
  resolved: ResolvedPublishedCostingConfigurationV1 | null,
  options: EnquiryPricingOptions = {},
): EnquiryPricingSnapshot {
  const verified = options.verifiedSimpleCover;
  const effectiveParams: EnquiryPricingParams = verified
    ? {
        ...params,
        widthM: verified.input.widthMm / 1_000,
        depthM: verified.input.projectionMm / 1_000,
        heightM: null,
        style: 'pitched',
        roofMaterials: ['acrylic'],
      }
    : params;
  const costInputs = verified?.siteInputs ?? buildCanonicalCostInputs(effectiveParams);
  let costResult: CostOutputV1 | SiteOutputV1 | null = null;
  if (verified) {
    costResult = verified.siteOutput;
  } else if (costInputs && resolved && !options.suppressGenericPricing) {
    try {
      costResult = isCommercialPolicyV2Enabled(resolved.config)
        ? calculateSiteCostV1(costInputs, resolved.config)
        : calculateCostV1(costInputs.pergolas[0]!.modules[0]!, resolved.config);
    } catch {
      // Pricing is best-effort and must never block an enquiry submission.
    }
  }

  const blindItems = buildBlindItems(effectiveParams);
  const blindPricing = blindItems.length && (!options.suppressGenericPricing || Boolean(verified))
    ? priceAllBlinds(blindItems)
    : null;
  const blindsQuoteIncGst = blindPricing && blindPricing.totals.totalIncCents > 0
    ? blindPricing.totals.totalIncCents / 100
    : null;
  const baseTrueCostIncGst = costResult?.totals?.cost_inc_gst;
  let budgets = buildEnquiryBudgets({
    enquiryType: effectiveParams.enquiryType,
    baseTrueCostIncGst: typeof baseTrueCostIncGst === 'number' && Number.isFinite(baseTrueCostIncGst) && baseTrueCostIncGst > 0
      ? baseTrueCostIncGst
      : null,
    blindsQuoteIncGst,
  });
  if (verified) {
    const displayed = verified.customerPrice.displayedFromIncGst;
    budgets = {
      ...budgets,
      baseRange: { lowIncGst: displayed, highIncGst: displayed },
      budgetBasis: budgets.blindsRange
        ? 'verified Simple cover calculator estimate; blinds priced separately'
        : 'verified Simple cover calculator estimate',
    };
  } else if (options.suppressGenericPricing) {
    budgets = { baseRange: null, blindsRange: null, budgetBasis: null };
  }

  const verifiedSimpleCover = verified
    ? {
        input: verified.input,
        widthM: verified.input.widthMm / 1_000,
        depthM: verified.input.projectionMm / 1_000,
        level: verified.input.level,
        connection: verified.input.connection,
        displayedEstimateIncGst: verified.customerPrice.displayedFromIncGst,
      }
    : null;
  const pricingSource: EnquiryPricingSnapshot['pricingSource'] = verified
    ? 'simple_cover_calculator_verified'
    : options.suppressGenericPricing
      ? 'simple_cover_unpriced'
      : costResult
        ? 'current_published_enquiry'
        : 'unavailable';
  const calculatorInputs = calculatorInputsFromSnapshot(effectiveParams, costInputs, blindItems);
  if (verified) {
    calculatorInputs.frozenSimpleCoverSiteInputs = verified.siteInputs;
  }

  return {
    costInputs,
    costResult,
    costingConfiguration: verified?.costingConfiguration
      ?? (costResult ? resolved?.provenance ?? null : null),
    calculatorInputs,
    budgets,
    pricingSource,
    verifiedSimpleCover,
  };
}

export function buildEnquiryDraftEstimateRow(params: EnquiryPricingParams & {
  projectId: string;
  createdBy: string;
  email: string;
  phoneRaw: string;
  message: string;
  pricing: EnquiryPricingSnapshot;
}): Record<string, unknown> {
  const verifiedSimple = params.pricing.verifiedSimpleCover;
  const enquiryWidthM = verifiedSimple?.widthM ?? params.widthM;
  const enquiryDepthM = verifiedSimple?.depthM ?? params.depthM;
  const enquiryHeightM = verifiedSimple ? null : params.heightM;
  const enquiryStyle = verifiedSimple ? 'pitched' : params.style;
  const enquiryRoofMaterials = verifiedSimple ? ['acrylic'] : params.roofMaterials;
  const warnings = ['Draft design created automatically from website enquiry.'];
  if (isTruthy(params.addOns.lighting) || isTruthy(params.addOns.heating) || isTruthy(params.addOns.slats)) {
    warnings.push('Some enquiry add-ons are captured as notes only and still need staff review in the calculator.');
  }

  let derived: Record<string, unknown> = {
    source: 'marketing_enquiry',
    enquiryType: params.enquiryType,
    budgetBasis: params.pricing.budgets.budgetBasis,
    ...(params.pricing.pricingSource.startsWith('simple_cover_')
      ? { pricingSource: params.pricing.pricingSource }
      : {}),
  };
  let outputs: Record<string, unknown>;
  if (params.pricing.costResult) {
    const result = params.pricing.costResult;
    outputs = {
      cost_snapshot_version: 'v2',
      materials: result.materials,
      install: result.install,
      overhead: result.overhead,
      totals: result.totals,
      warnings: (result as { warnings?: unknown[] }).warnings ?? warnings,
      pergolas: (result as { pergolas?: unknown[] }).pergolas ?? [],
      siteShared: (result as { shared?: unknown }).shared ?? null,
      shared: (result as { shared?: unknown }).shared ?? null,
      pricing_policy: 'pricing_policy' in result ? result.pricing_policy : undefined,
      customer_add_ons: 'customer_add_ons' in result ? result.customer_add_ons : undefined,
      ...(verifiedSimple ? { frozenSimpleCoverSiteOutput: result } : {}),
    };
    derived = { ...derived, pricingMode: 'full_costing' };
  } else {
    const baseRange = params.pricing.budgets.baseRange;
    const costIncGst = baseRange ? Math.round(baseRange.lowIncGst / QUOTE_MULTIPLIER) : 0;
    outputs = {
      cost_snapshot_version: 'v2',
      totals: {
        cost_inc_gst: costIncGst,
        cost_ex_gst: Math.round((costIncGst / 1.15) * 100) / 100,
        warnings,
        notes_and_warnings: warnings,
      },
      warnings,
    };
    derived = { ...derived, pricingMode: params.pricing.costInputs ? 'indicative_fallback' : 'placeholder' };
  }

  return {
    project_id: params.projectId,
    ...buildEstimateDbPayload({
      status: 'draft',
      inputs: params.pricing.calculatorInputs,
      outputs,
      derived,
      projectSnapshot: {
        name: `${params.name} - ${params.suburb || 'Enquiry'}`.trim(),
        siteAddress: params.suburb || null,
        region: null,
        quoteRef: null,
        source: 'marketing_enquiry',
      },
      snapshot: {
        source: 'marketing_enquiry',
        contact: { displayName: params.name, email: params.email || null, phone: params.phoneRaw || null },
        project: {
          projectName: `${params.name} - ${params.suburb || 'Enquiry'}`.trim(),
          region: null,
          siteAddress: params.suburb || null,
          quoteRef: null,
        },
        enquiry: {
          enquiryType: params.enquiryType,
          widthM: enquiryWidthM,
          depthM: enquiryDepthM,
          heightM: enquiryHeightM,
          style: enquiryStyle || null,
          roofMaterials: enquiryRoofMaterials,
          addOns: params.addOns,
          message: params.message || null,
        },
      },
      version: 1,
      createdBy: params.createdBy,
      configVersions: params.pricing.costingConfiguration
        ? { costingControl: params.pricing.costingConfiguration }
        : null,
    }),
  };
}
