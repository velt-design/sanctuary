'use client';

import { useMemo, useRef } from 'react';
import type { BlindPricingResult, SiteOutputV1 } from '@sp/costing';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { extractLightingTotalCents } from '@/lib/quotes/estimateAddons';
import {
  hasStructuredCalculatorLighting,
  priceCalculatorLighting,
} from '@/lib/estimates/calculatorLighting';
import {
  calculateStaffCustomerPriceFromCostEx,
  normalizeStaffQuoteDiscountPct,
  roundQuoteMoney,
} from '@/lib/quotes/pricing';
import { toCents, totalsFromIncGstCents } from '@/lib/quotes/utils';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';
import {
  buildCalculatorPergolaIncludedPriceRows,
  type CalculatorInternalTrueCost,
} from './calculatorInfillPricing';
import { buildCalculatorModulePriceRows } from './calculatorModulePricing';

type CalculatorPricingPreviewRow = {
  id: string;
  kind: 'pergola' | 'module' | 'infill' | 'aluminium' | 'shared' | 'approval' | 'blind' | 'lighting';
  parentId?: string;
  label: string;
  detail: string;
  priceIncGstCents: number | null;
  status: 'priced' | 'included' | 'unpriced';
  internalTrueCost?: CalculatorInternalTrueCost;
};

export type CalculatorPricingPreview = {
  rows: CalculatorPricingPreviewRow[];
  totalIncGstCents: number;
  totalExGstCents: number;
  undiscountedTotalIncGstCents: number | null;
  discountPct: number;
  unpricedItemCount: number;
  hasCorePricing: boolean;
};

type PricingPreviewInput = {
  result: SiteOutputV1 | null;
  inputs: CalculatorInputs;
  blindPricing: BlindPricingResult;
  estimateSnapshot?: Record<string, unknown> | null;
};

function customerPriceIncCents(
  costExGst: number,
  discountPct: number,
  customerPriceUpliftPct: number,
  customerPriceMultiplier: number | undefined,
): number {
  return toCents(
    calculateStaffCustomerPriceFromCostEx(
      costExGst,
      discountPct,
      customerPriceUpliftPct,
      customerPriceMultiplier,
    )?.incGst ?? 0,
  );
}

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function modulesForPergola(inputs: CalculatorInputs, pergolaId: string): CalculatorModuleInputs[] {
  const knownPergolaIds = new Set((inputs.pergolas ?? []).map((pergola) => pergola.id));
  const fallbackPergolaId = inputs.pergolas?.[0]?.id ?? 'pergola-1';
  return inputs.modules.filter((module) => {
    const assignedId = module.pergolaId && knownPergolaIds.has(module.pergolaId) ? module.pergolaId : fallbackPergolaId;
    return assignedId === pergolaId;
  });
}

function blindDetail(item: BlindPricingResult['items'][number]): string {
  const dimensions = item.widthMm && item.coverLengthMm
    ? `${(item.widthMm / 1000).toFixed(3).replace(/\.?0+$/, '')}m × ${(item.coverLengthMm / 1000).toFixed(3).replace(/\.?0+$/, '')}m`
    : 'Dimensions required';
  return `${titleCase(item.system)} · ${dimensions}`;
}

function standaloneInfillDetail(inputs: CalculatorInputs, itemCount: number): string {
  const state = inputs.standaloneInfills;
  const finish = state?.extrusionColour === 'Mill'
    ? state.powdercoatIsCustom
      ? state.powdercoatCustomColour?.trim() || 'Custom powdercoat'
      : state.powdercoatStandardColour?.trim() || 'Powdercoat'
    : state?.extrusionColour ?? 'Black';
  return `${itemCount} infill${itemCount === 1 ? '' : 's'} · ${finish} · Existing pergola`;
}

function additionalAluminiumDetail(inputs: CalculatorInputs, itemCount: number): string {
  const state = inputs.additionalAluminium;
  const finish = state?.extrusionColour === 'Mill'
    ? state.powdercoatIsCustom
      ? state.powdercoatCustomColour?.trim() || 'Custom powdercoat'
      : state.powdercoatStandardColour?.trim() || 'Powdercoat'
    : state?.extrusionColour ?? 'Black';
  return `${itemCount} aluminium selection${itemCount === 1 ? '' : 's'} · ${finish} · Materials only`;
}

export function buildCalculatorPricingPreview({
  result,
  inputs,
  blindPricing,
  estimateSnapshot,
}: PricingPreviewInput): CalculatorPricingPreview {
  const rows: CalculatorPricingPreviewRow[] = [];
  const pricedAmounts: number[] = [];
  const undiscountedAmounts: number[] = [];
  const discountPct = normalizeStaffQuoteDiscountPct(inputs.quoteDiscountPct);
  const customerPriceUpliftPct = result?.pricing_policy?.customer_price_uplift_pct ?? 0;
  const customerPriceMultiplier = result?.pricing_policy?.customer_price_multiplier;
  const pergolas = result?.pergolas ?? [];
  const pricedPergolas = pergolas.filter((pergola) => Number.isFinite(pergola.totals?.cost_ex_gst) && pergola.totals.cost_ex_gst >= 0);
  const sharedCostEx = result?.shared?.totals?.cost_ex_gst;
  const hasSharedCost = typeof sharedCostEx === 'number' && Number.isFinite(sharedCostEx) && sharedCostEx >= 0;
  const showSharedLine = hasSharedCost && pergolas.length > 1 && pricedPergolas.length > 0;

  pricedPergolas.forEach((pergola, pergolaIndex) => {
    const pergolaLabel = pergola.label?.trim() || `Pergola ${pergolaIndex + 1}`;
    const lineCostEx = !showSharedLine && hasSharedCost && pergolaIndex === 0
      ? roundQuoteMoney(pergola.totals.cost_ex_gst + sharedCostEx)
      : pergola.totals.cost_ex_gst;
    const priceIncGstCents = customerPriceIncCents(lineCostEx, discountPct, customerPriceUpliftPct, customerPriceMultiplier);
    rows.push({
      id: `pergola:${pergola.id}`,
      kind: 'pergola',
      label: pergolaLabel,
      detail: `${pergola.module_count} module${pergola.module_count === 1 ? '' : 's'}${!showSharedLine && hasSharedCost ? ' · Includes shared site costs' : ''}`,
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(lineCostEx, 0, customerPriceUpliftPct, customerPriceMultiplier));

    const pergolaModules = modulesForPergola(inputs, pergola.id);
    rows.push(...buildCalculatorModulePriceRows({
      pergola,
      pergolaLabel,
      modules: pergolaModules,
      parentPriceIncGstCents: priceIncGstCents,
    }));

    const infillBreakdown = pergola.infill_cost_breakdown;
    const baselineLineCostEx = infillBreakdown?.schema_version === 'infill_cost_breakdown_v2'
      ? roundQuoteMoney(
          infillBreakdown.baseline.total_ex_gst
          + (!showSharedLine && hasSharedCost && pergolaIndex === 0
            ? infillBreakdown.baseline_shared_cost_ex_gst
            : 0),
        )
      : null;
    rows.push(...buildCalculatorPergolaIncludedPriceRows({
      pergola,
      pergolaLabel,
      modules: pergolaModules,
      parentPriceIncGstCents: priceIncGstCents,
      baselinePriceIncGstCents: baselineLineCostEx === null
        ? null
        : customerPriceIncCents(
            baselineLineCostEx,
            discountPct,
            infillBreakdown?.schema_version === 'infill_cost_breakdown_v2'
              ? infillBreakdown.baseline_customer_price_uplift_pct ?? customerPriceUpliftPct
              : customerPriceUpliftPct,
            infillBreakdown?.schema_version === 'infill_cost_breakdown_v2'
              ? infillBreakdown.baseline_customer_price_multiplier ?? customerPriceMultiplier
              : customerPriceMultiplier,
          ),
    }));
  });

  if (showSharedLine && typeof sharedCostEx === 'number') {
    const priceIncGstCents = customerPriceIncCents(sharedCostEx, discountPct, customerPriceUpliftPct, customerPriceMultiplier);
    rows.push({
      id: 'shared-site-costs',
      kind: 'shared',
      label: 'Shared site costs',
      detail: 'Shared install, travel and extras',
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(sharedCostEx, 0, customerPriceUpliftPct, customerPriceMultiplier));
  }

  const additionalAluminium = result?.additional_aluminium;
  if (additionalAluminium && Number.isFinite(additionalAluminium.totals.cost_ex_gst)) {
    const priceIncGstCents = customerPriceIncCents(
      additionalAluminium.totals.cost_ex_gst,
      discountPct,
      customerPriceUpliftPct,
      customerPriceMultiplier,
    );
    rows.push({
      id: 'additional-aluminium',
      kind: 'aluminium',
      label: 'Additional aluminium',
      detail: additionalAluminiumDetail(inputs, additionalAluminium.item_count),
      priceIncGstCents,
      status: 'priced',
      internalTrueCost: {
        materialsExGstCents: toCents(additionalAluminium.materials.totals.materials_ex_gst),
        labourExGstCents: 0,
        overheadExGstCents: 0,
        totalExGstCents: toCents(additionalAluminium.totals.cost_ex_gst),
      },
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(
      additionalAluminium.totals.cost_ex_gst,
      0,
      customerPriceUpliftPct,
      customerPriceMultiplier,
    ));
  }


  const standaloneInfills = result?.standalone_infills;
  if (standaloneInfills && Number.isFinite(standaloneInfills.totals.cost_ex_gst)) {
    const priceIncGstCents = customerPriceIncCents(
      standaloneInfills.totals.cost_ex_gst,
      discountPct,
      customerPriceUpliftPct,
      customerPriceMultiplier,
    );
    rows.push({
      id: 'standalone-infills',
      kind: 'infill',
      label: 'Existing pergola infills',
      detail: standaloneInfillDetail(inputs, standaloneInfills.item_count),
      priceIncGstCents,
      status: 'priced',
      internalTrueCost: {
        materialsExGstCents: toCents(standaloneInfills.materials.totals.materials_ex_gst),
        labourExGstCents: toCents(standaloneInfills.install.totals.install_ex_gst),
        overheadExGstCents: toCents(standaloneInfills.overhead.total_ex_gst),
        totalExGstCents: toCents(standaloneInfills.totals.cost_ex_gst),
      },
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(
      standaloneInfills.totals.cost_ex_gst,
      0,
      customerPriceUpliftPct,
      customerPriceMultiplier,
    ));
  }

  if (pergolas.length === 0 && hasSharedCost && typeof sharedCostEx === 'number' && sharedCostEx > 0 && !showSharedLine) {
    const priceIncGstCents = customerPriceIncCents(sharedCostEx, discountPct, customerPriceUpliftPct, customerPriceMultiplier);
    rows.push({
      id: 'add-on-site-costs',
      kind: 'shared',
      label: 'Site costs',
      detail: 'Travel and extras',
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(sharedCostEx, 0, customerPriceUpliftPct, customerPriceMultiplier));
  }

  const approval = result?.customer_add_ons?.approval;
  if (approval) {
    const priceIncGstCents = toCents(approval.sell_inc_gst);
    rows.push({
      id: 'approval',
      kind: 'approval',
      label: approval.requirement === 'full_building_consent' ? 'Full building consent' : 'Engineering',
      detail: 'Customer allowance · Markup included · Not discountable',
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(priceIncGstCents);
  }

  blindPricing.items.forEach((blind, index) => {
    const isPriced = blind.errors.length === 0;
    rows.push({
      id: `blind:${blind.id}`,
      kind: 'blind',
      label: blind.label?.trim() || `Blind ${index + 1}`,
      detail: blindDetail(blind),
      priceIncGstCents: isPriced ? blind.blindSellIncCents : null,
      status: isPriced ? 'priced' : 'unpriced',
    });
    if (isPriced) {
      pricedAmounts.push(blind.blindSellIncCents);
      undiscountedAmounts.push(blind.blindSellIncCents);
    }
  });

  if (hasStructuredCalculatorLighting(inputs)) {
    priceCalculatorLighting(inputs).items.forEach((lighting) => {
      if (lighting.lightCount <= 0 && lighting.errors.length === 0) return;
      const isPriced = lighting.errors.length === 0;
      const priceIncGstCents = isPriced ? lighting.lightingSellIncCents : null;
      rows.push({
        id: `lighting:${lighting.pergolaId}`,
        kind: 'lighting',
        label: `${lighting.label?.trim() || 'Pergola'} lighting`,
        detail: isPriced
          ? `${lighting.lightCount} rafter light${lighting.lightCount === 1 ? '' : 's'} · ${lighting.driverCount} driver${lighting.driverCount === 1 ? '' : 's'}${lighting.dimmer ? ' · Dimmer' : ''}`
          : lighting.errors[0] ?? 'Lighting needs review',
        priceIncGstCents,
        status: isPriced ? 'priced' : 'unpriced',
      });
      if (priceIncGstCents !== null) {
        pricedAmounts.push(priceIncGstCents);
        undiscountedAmounts.push(priceIncGstCents);
      }
    });
  } else {
    const lightingTotalCents = extractLightingTotalCents(estimateSnapshot);
    if (lightingTotalCents !== null) {
      rows.push({
        id: 'lighting',
        kind: 'lighting',
        label: 'Lighting',
        detail: 'Preserved historical lighting allowance',
        priceIncGstCents: lightingTotalCents,
        status: 'priced',
      });
      pricedAmounts.push(lightingTotalCents);
      undiscountedAmounts.push(lightingTotalCents);
    }
  }

  const totals = totalsFromIncGstCents(pricedAmounts);
  const undiscountedTotals = discountPct > 0 ? totalsFromIncGstCents(undiscountedAmounts) : null;

  return {
    rows,
    totalIncGstCents: totals.totalIncGstCents,
    totalExGstCents: totals.totalExGstCents,
    undiscountedTotalIncGstCents: undiscountedTotals?.totalIncGstCents ?? null,
    discountPct,
    unpricedItemCount: rows.filter((row) => row.status === 'unpriced').length,
    hasCorePricing: pricedAmounts.length > 0,
  };
}

export function useCalculatorPricingPreview(
  input: PricingPreviewInput & { resultFreshness: CalculatorResultFreshness },
): CalculatorPricingPreview {
  const computed = useMemo(
    () => buildCalculatorPricingPreview(input),
    [input.blindPricing, input.estimateSnapshot, input.inputs, input.result],
  );
  const lastCurrentRef = useRef<CalculatorPricingPreview | null>(null);

  if (input.resultFreshness === 'current') lastCurrentRef.current = computed;
  return input.resultFreshness === 'current' ? computed : lastCurrentRef.current ?? computed;
}
