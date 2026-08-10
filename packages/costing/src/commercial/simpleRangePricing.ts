import { GST_RATE } from '../blinds';
import commercialPolicyV2Json from '../config/commercial_policy_v2_2026-08-05.json';
import commercialPolicyV3Json from '../config/commercial_policy_v3_2026-08-05.json';
import type { CostingConfigV1 } from '../engine/config';
import type { OverheadV1, SiteInputsV1 } from '../engine/types';
import { isCostingManifestAtLeast } from '../manifestVersion';

export type PricingClassificationV2 = 'simple' | 'bespoke';
export type ApprovalRequirementV2 = 'neither' | 'engineering_required' | 'full_building_consent';

export const OPEN_PERGOLA_SIMPLE_CUSTOMER_PRICE_UPLIFT_PCT = 10;

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

function commercialPolicyForConfig(config: CostingConfigV1) {
  if (isCommercialPolicyV4Enabled(config)) return config.commercialPolicy;
  if (isCommercialPolicyV3Enabled(config)) return commercialPolicyV3Json;
  return commercialPolicyV2Json;
}

function simpleCustomerPriceUpliftForConfig(config: CostingConfigV1, inputs: SiteInputsV1): number {
  const modules = inputs.pergolas.flatMap((pergola) => pergola.modules);
  const isOpenPergola = modules.length === 1 && modules[0]?.roof_material === 'none';
  if (isOpenPergola && isCommercialPolicyV4Enabled(config)) {
    return OPEN_PERGOLA_SIMPLE_CUSTOMER_PRICE_UPLIFT_PCT;
  }
  if (isCommercialPolicyV4Enabled(config)) {
    return Number(config.commercialPolicy.simple_range.customer_price_uplift_pct);
  }
  if (isCommercialPolicyV3Enabled(config)) {
    return Number(commercialPolicyV3Json.simple_range.customer_price_uplift_pct);
  }
  return 0;
}

export function evaluateSimpleRangeEligibilityV2(inputs: SiteInputsV1): {
  eligible: boolean;
  reason_codes: SimpleRangeReasonCodeV2[];
} {
  const reasons: SimpleRangeReasonCodeV2[] = [];
  const pergolas = Array.isArray(inputs.pergolas) ? inputs.pergolas : [];
  const modules = pergolas.flatMap((pergola) => Array.isArray(pergola.modules) ? pergola.modules : []);

  if (pergolas.length !== 1) reasons.push('MULTIPLE_PERGOLAS');
  if (modules.length !== 1) reasons.push('MULTIPLE_MODULES');
  if ((inputs.job_type ?? 'residential') !== 'residential') reasons.push('NON_RESIDENTIAL');

  for (const module of modules) {
    const hasSimpleRoofMaterial = module.roof_material === 'acrylic' || module.roof_material === 'none';
    if (module.pergola_style !== 'pitched' || !hasSimpleRoofMaterial || module.box_perimeter_enabled) {
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
  const eligibility = evaluateSimpleRangeEligibilityV2(inputs);
  const reasons = [...eligibility.reason_codes];
  if (requested === 'bespoke') reasons.unshift('MANUALLY_BESPOKE');
  if (approval !== 'neither') reasons.unshift('APPROVAL_REQUIRED');
  const reasonCodes = [...new Set(reasons)];
  const simpleEligible = eligibility.eligible && approval === 'neither';
  const resolvedClassification = requested === 'simple' && simpleEligible ? 'simple' : 'bespoke';
  const customerPriceUpliftPct = config
    && resolvedClassification === 'simple'
    ? simpleCustomerPriceUpliftForConfig(config, inputs)
    : 0;
  return {
    requested_classification: requested,
    resolved_classification: resolvedClassification,
    simple_eligible: simpleEligible,
    reason_codes: reasonCodes,
    customer_price_uplift_pct: Number.isFinite(customerPriceUpliftPct) ? customerPriceUpliftPct : 0,
  };
}

export function buildSimpleRangeOverheadV2(config: CostingConfigV1, totalCrewHours: number): OverheadV1 {
  const policy = commercialPolicyForConfig(config).simple_range;
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
