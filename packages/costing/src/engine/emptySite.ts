import {
  calculateApprovalCustomerAllowanceV2,
  isCommercialPolicyV2Enabled,
  resolveSitePricingPolicyV2,
} from '../commercial/simpleRangePricing';
import { buildTrustedLabourBreakdownV1, buildTrustedMaterialsBreakdownV1 } from './breakdownExplanation';
import type { CostingConfigV1 } from './config';
import { applyGst } from './derive';
import type { SiteInputsV1, SiteOutputV1, StandaloneInfillsOutputV1 } from './types';

function roundMoney(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

/**
 * A calculator add-on may contain only standalone customer items, such as
 * blinds, or manual travel/extras allowances. Those estimates have no
 * pergola geometry but still need a current, persistable costing snapshot.
 */
export function buildEmptySiteCostV1(
  inputs: SiteInputsV1,
  config: CostingConfigV1,
  standaloneInfills?: StandaloneInfillsOutputV1,
): SiteOutputV1 {
  const travelExGst = roundMoney(Number(inputs.travel_ex_gst ?? 0));
  const extrasExGst = roundMoney(Number(inputs.extras_allowance_ex_gst ?? 0));
  const sharedCostExGst = roundMoney(travelExGst + extrasExGst);
  const sharedCostIncGst = roundMoney(applyGst(sharedCostExGst));
  const emptyInstallTotals = {
    crew_minutes: 0,
    crew_hours: 0,
    install_ex_gst: 0,
  };
  const addOns = {
    travel_ex_gst: travelExGst,
    extras_allowance_ex_gst: extrasExGst,
  };
  const pricingPolicy = isCommercialPolicyV2Enabled(config)
    ? resolveSitePricingPolicyV2(inputs, config)
    : undefined;

  return {
    pergola_count: 0,
    pergolas: [],
    shared: {
      install: {
        actions: [],
        totals: emptyInstallTotals,
      },
      add_ons: addOns,
      totals: {
        cost_ex_gst: sharedCostExGst,
        cost_inc_gst: sharedCostIncGst,
        warnings: [],
        notes_and_warnings: [],
      },
    },
    materials: standaloneInfills?.materials ?? {
      lines: [],
      totals: { materials_ex_gst: 0, waste_m_by_profile: {}, bars_by_profile: {} },
      trusted_breakdown: buildTrustedMaterialsBreakdownV1([]),
    },
    install: standaloneInfills?.install ?? {
      actions: [], totals: emptyInstallTotals, trusted_breakdown: buildTrustedLabourBreakdownV1([], emptyInstallTotals),
    },
    overhead: standaloneInfills?.overhead ?? {
      method: 'no_pergola_add_on',
      ops_ex_gst: 0,
      sales_ex_gst: 0,
      total_ex_gst: 0,
    },
    add_ons: addOns,
    totals: {
      cost_ex_gst: roundMoney(sharedCostExGst + (standaloneInfills?.totals.cost_ex_gst ?? 0)),
      cost_inc_gst: roundMoney(applyGst(sharedCostExGst + (standaloneInfills?.totals.cost_ex_gst ?? 0))),
      warnings: standaloneInfills?.totals.warnings ?? [],
      notes_and_warnings: standaloneInfills?.totals.notes_and_warnings ?? [],
    },
    ...(standaloneInfills?.infill_takeoff ? { infill_takeoff: standaloneInfills.infill_takeoff } : null),
    ...(standaloneInfills ? { standalone_infills: standaloneInfills } : null),
    ...(pricingPolicy
      ? {
          pricing_policy: pricingPolicy,
          customer_add_ons: {
            approval: calculateApprovalCustomerAllowanceV2(inputs, config),
          },
        }
      : null),
  };
}
