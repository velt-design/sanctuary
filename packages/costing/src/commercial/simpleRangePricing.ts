import { GST_RATE } from '../blinds';
import commercialPolicyV2Json from '../config/commercial_policy_v2_2026-08-05.json';
import commercialPolicyV3Json from '../config/commercial_policy_v3_2026-08-05.json';
import commercialPolicyV4Json from '../config/commercial_policy_v4_2026-08-05.json';
import commercialPolicyV5Json from '../config/commercial_policy_v5_2026-08-11.json';
import type { CostingConfigV1 } from '../engine/config';
import type { OverheadV1, SiteInputsV1 } from '../engine/types';
import { isCostingManifestAtLeast } from '../manifestVersion';

export type PricingClassificationV2 = 'simple' | 'bespoke';
export type ApprovalRequirementV2 = 'neither' | 'engineering_required' | 'full_building_consent';

export type SimpleRangeReasonCodeV2 =
  | 'MANUALLY_BESPOKE'
  | 'APPROVAL_REQUIRED'
  | 'MULTIPLE_PERGOLAS'
  | 'MULTIPLE_MODULES'
  | 'NON_RESIDENTIAL'
  | 'NON_PITCHED_ACRYLIC'
  | 'AREA_LIMIT_EXCEEDED'
  | 'NON_STANDARD_CONNECTION'
  | 'NON_STANDARD_POST_CONNECTION'
  | 'NON_STANDARD_ACCESS'
  | 'NON_STANDARD_GROUND'
  | 'NON_STANDARD_COLOUR'
  | 'CUSTOM_POWDERCOAT'
  | 'INFILLS_INCLUDED';

export type SitePricingPolicyV2 = {
  requested_classification: PricingClassificationV2;
  resolved_classification: PricingClassificationV2;
  simple_eligible: boolean;
  reason_codes: SimpleRangeReasonCodeV2[];
  customer_price_multiplier?: number;
  customer_price_uplift_pct: number;
};

export type ApprovalCustomerAllowanceV2 = {
  requirement: Exclude<ApprovalRequirementV2, 'neither'>;
  pergola_count: number;
  module_count: number;
  additional_pergola_count: number;
  additional_module_count: number;
  sell_ex_gst: number;
  gst: number;
  sell_inc_gst: number;
  markup_included: true;
  discount_eligible: false;
};

function roundMoney(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export function isCommercialPolicyV2Enabled(config: CostingConfigV1): boolean {
  return isCostingManifestAtLeast(config, 1, 9);
}

export function isCommercialPolicyV3Enabled(config: CostingConfigV1): boolean {
  return isCostingManifestAtLeast(config, 2, 1);
}

export function isCommercialPolicyV4Enabled(config: CostingConfigV1): boolean {
  return isCostingManifestAtLeast(config, 2, 2);
}

export function isCommercialPolicyV5Enabled(config: CostingConfigV1): boolean {
  return isCostingManifestAtLeast(config, 2, 4);
}

export function isCommercialPolicyV6Enabled(config: CostingConfigV1): boolean {
  return isCostingManifestAtLeast(config, 2, 5);
}

function commercialPolicyForConfig(config: CostingConfigV1) {
  if (isCommercialPolicyV6Enabled(config)) return config.commercialPolicy;
  if (isCommercialPolicyV5Enabled(config)) return commercialPolicyV5Json;
  if (isCommercialPolicyV4Enabled(config)) return commercialPolicyV4Json;
  if (isCommercialPolicyV3Enabled(config)) return commercialPolicyV3Json;
  return commercialPolicyV2Json;
}

function commercialPolicyV5OrLaterForConfig(config: CostingConfigV1) {
  return isCommercialPolicyV6Enabled(config) ? config.commercialPolicy : commercialPolicyV5Json;
}

function simpleCustomerPriceUpliftForConfig(config: CostingConfigV1): number {
  if (isCommercialPolicyV6Enabled(config)) {
    return Number(config.commercialPolicy.simple_range.customer_price_uplift_pct);
  }
  if (isCommercialPolicyV5Enabled(config)) {
    return Number(commercialPolicyV5Json.simple_range.customer_price_uplift_pct);
  }
  if (isCommercialPolicyV4Enabled(config)) {
    return Number(commercialPolicyV4Json.simple_range.customer_price_uplift_pct);
  }
  if (isCommercialPolicyV3Enabled(config)) {
    return Number(commercialPolicyV3Json.simple_range.customer_price_uplift_pct);
  }
  return 0;
}

function customerPriceMultiplierForConfig(config?: CostingConfigV1): number {
  if (!config || !isCommercialPolicyV5Enabled(config)) return 1.25;
  const multiplier = Number(commercialPolicyV5OrLaterForConfig(config).customer_pricing.multiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1.25;
}

export function evaluateSimpleRangeEligibilityV2(inputs: SiteInputsV1, config?: CostingConfigV1): {
  eligible: boolean;
  reason_codes: SimpleRangeReasonCodeV2[];
} {
  const reasons: SimpleRangeReasonCodeV2[] = [];
  const pergolas = Array.isArray(inputs.pergolas) ? inputs.pergolas : [];
  const modules = pergolas.flatMap((pergola) => Array.isArray(pergola.modules) ? pergola.modules : []);

  if ((inputs.standalone_infills?.infills.length ?? 0) > 0) reasons.push('INFILLS_INCLUDED');

  if (pergolas.length !== 1) reasons.push('MULTIPLE_PERGOLAS');
  if (modules.length !== 1) reasons.push('MULTIPLE_MODULES');
  if ((inputs.job_type ?? 'residential') !== 'residential') reasons.push('NON_RESIDENTIAL');

  for (const module of modules) {
    const hasSimpleRoofMaterial = module.roof_material === 'acrylic' || module.roof_material === 'none';
    const hasSimpleStructure = !config || isCommercialPolicyV5Enabled(config)
      ? ['pitched', 'gable', 'box_perimeter'].includes(module.pergola_style)
      : module.pergola_style === 'pitched' && !module.box_perimeter_enabled;
    if (!hasSimpleStructure || !hasSimpleRoofMaterial) {
      reasons.push('NON_PITCHED_ACRYLIC');
    }
    const projection = Number(module.roof_span_m ?? module.projection_m ?? 0);
    const area = Math.max(0, Number(module.length_m ?? 0)) * Math.max(0, projection);
    const maxArea = module.height === 'two_storey' ? 20 : 30;
    if (area > maxArea) reasons.push('AREA_LIMIT_EXCEEDED');
    if (!['fascia', 'facade', 'soffit'].includes(module.house_connection_type)) reasons.push('NON_STANDARD_CONNECTION');
    if (module.post_connection_type !== 'deck_bracket') reasons.push('NON_STANDARD_POST_CONNECTION');
    if (module.access !== 'normal') reasons.push('NON_STANDARD_ACCESS');
    if ((module.ground ?? 'easy') !== 'easy') reasons.push('NON_STANDARD_GROUND');
    if (module.extrusion_colour !== 'Black') reasons.push('NON_STANDARD_COLOUR');
    if (module.powdercoat_is_custom) reasons.push('CUSTOM_POWDERCOAT');
    if ((module.infills?.length ?? 0) > 0) reasons.push('INFILLS_INCLUDED');
  }

  const reasonCodes = [...new Set(reasons)];
  return { eligible: reasonCodes.length === 0, reason_codes: reasonCodes };
}

export function resolveSitePricingPolicyV2(
  inputs: SiteInputsV1,
  config?: CostingConfigV1,
): SitePricingPolicyV2 {
  const requested = inputs.pricing_classification === 'simple' ? 'simple' : 'bespoke';
  const approval = inputs.approval_requirement ?? 'neither';
  const eligibility = evaluateSimpleRangeEligibilityV2(inputs, config);
  const reasons = [...eligibility.reason_codes];
  if (requested === 'bespoke') reasons.unshift('MANUALLY_BESPOKE');
  if (approval !== 'neither') reasons.unshift('APPROVAL_REQUIRED');
  const reasonCodes = [...new Set(reasons)];
  const simpleEligible = eligibility.eligible && approval === 'neither';
  const resolvedClassification = requested === 'simple' && simpleEligible ? 'simple' : 'bespoke';
  const customerPriceUpliftPct = config
    && resolvedClassification === 'simple'
    ? simpleCustomerPriceUpliftForConfig(config)
    : 0;
  return {
    requested_classification: requested,
    resolved_classification: resolvedClassification,
    simple_eligible: simpleEligible,
    reason_codes: reasonCodes,
    customer_price_multiplier: customerPriceMultiplierForConfig(config),
    customer_price_uplift_pct: Number.isFinite(customerPriceUpliftPct) ? customerPriceUpliftPct : 0,
  };
}

export function productiveInstallTimeMultiplierV5(
  config: CostingConfigV1,
  pricingPolicy: SitePricingPolicyV2 | undefined,
): number {
  if (!isCommercialPolicyV5Enabled(config) || pricingPolicy?.resolved_classification !== 'bespoke') return 1;
  const multiplier = Number(commercialPolicyV5OrLaterForConfig(config).bespoke.productive_install_time_multiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function buildCommercialOverheadV5(
  config: CostingConfigV1,
  inputs: SiteInputsV1,
  productiveCrewHours: number,
  resolvedClassification: PricingClassificationV2,
): OverheadV1 {
  const policy = commercialPolicyV5OrLaterForConfig(config);
  const pergolaCount = Math.max(0, inputs.pergolas.length);
  const moduleCount = inputs.pergolas.reduce((sum, pergola) => sum + pergola.modules.length, 0);
  const additionalPergolaCount = Math.max(0, pergolaCount - 1);
  const additionalModuleCount = Math.max(0, moduleCount - pergolaCount);
  const crewDayHours = Math.max(0.01, Number(policy.operational_overhead.productive_crew_day_hours));
  const crewDays = Math.max(0, Number(productiveCrewHours) || 0) / crewDayHours;
  const ops = roundMoney(
    Number(policy.operational_overhead.startup_per_job_ex_gst)
      + crewDays * Number(policy.operational_overhead.variable_per_productive_crew_day_ex_gst),
  );
  const sales = resolvedClassification === 'bespoke'
    ? roundMoney(
        Number(policy.bespoke.design_base_per_job_ex_gst)
          + additionalPergolaCount * Number(policy.bespoke.design_additional_pergola_ex_gst)
          + additionalModuleCount * Number(policy.bespoke.design_additional_module_ex_gst),
      )
    : 0;
  return {
    method: 'unified_commercial_v5',
    ops_ex_gst: ops,
    sales_ex_gst: sales,
    total_ex_gst: roundMoney(ops + sales),
  };
}

export function buildSimpleRangeOverheadV2(config: CostingConfigV1, totalCrewHours: number): OverheadV1 {
  const policy = (isCommercialPolicyV5Enabled(config)
    ? commercialPolicyV4Json.simple_range
    : commercialPolicyForConfig(config).simple_range) as {
    base_overhead_ex_gst: number;
    included_crew_days: number;
    additional_crew_day_ex_gst: number;
  };
  const allocation = (config.overheads as unknown as {
    allocation_method_v1_1?: { crew_day_hours?: number };
  }).allocation_method_v1_1;
  const crewDayHours = Math.max(0.01, Number(allocation?.crew_day_hours ?? 9));
  const crewDays = Math.max(0, Number(totalCrewHours) || 0) / crewDayHours;
  const excessCrewDays = Math.max(0, crewDays - Number(policy.included_crew_days));
  const total = roundMoney(
    Number(policy.base_overhead_ex_gst)
      + excessCrewDays * Number(policy.additional_crew_day_ex_gst),
  );
  return {
    method: 'simple_progressive',
    ops_ex_gst: total,
    sales_ex_gst: 0,
    total_ex_gst: total,
  };
}

export function calculateApprovalCustomerAllowanceV2(
  inputs: SiteInputsV1,
  config: CostingConfigV1,
): ApprovalCustomerAllowanceV2 | null {
  const requirement = inputs.approval_requirement ?? 'neither';
  if (requirement === 'neither') return null;
  const pergolaCount = Math.max(0, inputs.pergolas.length);
  const moduleCount = inputs.pergolas.reduce((sum, pergola) => sum + pergola.modules.length, 0);
  const additionalPergolaCount = Math.max(0, pergolaCount - 1);
  const additionalModuleCount = Math.max(0, moduleCount - pergolaCount);
  const policy = commercialPolicyForConfig(config).approval_allowances;
  const base = requirement === 'full_building_consent'
    ? Number(policy.building_consent_base_sell_ex_gst)
    : Number(policy.engineering_base_sell_ex_gst);
  const sellExGst = roundMoney(
    base
      + additionalPergolaCount * Number(policy.additional_pergola_sell_ex_gst)
      + additionalModuleCount * Number(policy.additional_module_sell_ex_gst),
  );
  const sellIncGst = roundMoney(sellExGst * (1 + GST_RATE));
  return {
    requirement,
    pergola_count: pergolaCount,
    module_count: moduleCount,
    additional_pergola_count: additionalPergolaCount,
    additional_module_count: additionalModuleCount,
    sell_ex_gst: sellExGst,
    gst: roundMoney(sellIncGst - sellExGst),
    sell_inc_gst: sellIncGst,
    markup_included: true,
    discount_eligible: false,
  };
}
