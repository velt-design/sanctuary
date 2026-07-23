'use client';

import { useMemo, useRef } from 'react';
import type { BlindPricingResult, SiteOutputV1 } from '@sp/costing';
import type { CalculatorInputs, CalculatorModuleInputs, InfillLineItem } from '@/lib/types/calculator';
import { extractLightingTotalCents } from '@/lib/quotes/estimateAddons';
import {
  calculateStaffCustomerPriceFromCostEx,
  normalizeStaffQuoteDiscountPct,
  roundQuoteMoney,
} from '@/lib/quotes/pricing';
import { toCents, totalsFromIncGstCents } from '@/lib/quotes/utils';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';

type CalculatorPricingPreviewRow = {
  id: string;
  kind: 'pergola' | 'infill' | 'shared' | 'blind' | 'lighting';
  label: string;
  detail: string;
  priceIncGstCents: number | null;
  status: 'priced' | 'included' | 'unpriced';
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

function customerPriceIncCents(costExGst: number, discountPct: number): number {
  return toCents(calculateStaffCustomerPriceFromCostEx(costExGst, discountPct)?.incGst ?? 0);
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

function infillDetail(pergolaLabel: string, moduleIndex: number, infill: InfillLineItem): string {
  const qty = Number.parseInt(infill.qty, 10);
  const quantity = Number.isFinite(qty) && qty > 1 ? ` · Qty ${qty}` : '';
  return `${pergolaLabel} · Module ${moduleIndex + 1} · ${titleCase(infill.location)}${quantity}`;
}

function blindDetail(item: BlindPricingResult['items'][number]): string {
  const dimensions = item.widthMm && item.coverLengthMm
    ? `${(item.widthMm / 1000).toFixed(3).replace(/\.?0+$/, '')}m × ${(item.coverLengthMm / 1000).toFixed(3).replace(/\.?0+$/, '')}m`
    : 'Dimensions required';
  return `${titleCase(item.system)} · ${dimensions}`;
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
    const priceIncGstCents = customerPriceIncCents(lineCostEx, discountPct);
    rows.push({
      id: `pergola:${pergola.id}`,
      kind: 'pergola',
      label: pergolaLabel,
      detail: `${pergola.module_count} module${pergola.module_count === 1 ? '' : 's'}${!showSharedLine && hasSharedCost ? ' · Includes shared site costs' : ''}`,
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(lineCostEx, 0));

    modulesForPergola(inputs, pergola.id).forEach((module, moduleIndex) => {
      const infills = module.infills?.items ?? [];
      infills.forEach((infill, infillIndex) => {
        rows.push({
          id: `infill:${pergola.id}:${moduleIndex}:${infill.id}`,
          kind: 'infill',
          label: infill.label?.trim() || `Infill ${infillIndex + 1}`,
          detail: infillDetail(pergolaLabel, moduleIndex, infill),
          priceIncGstCents: null,
          status: 'included',
        });
      });
    });
  });

  if (showSharedLine && typeof sharedCostEx === 'number') {
    const priceIncGstCents = customerPriceIncCents(sharedCostEx, discountPct);
    rows.push({
      id: 'shared-site-costs',
      kind: 'shared',
      label: 'Shared site costs',
      detail: 'Shared install, travel and extras',
      priceIncGstCents,
      status: 'priced',
    });
    pricedAmounts.push(priceIncGstCents);
    undiscountedAmounts.push(customerPriceIncCents(sharedCostEx, 0));
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

  const lightingTotalCents = extractLightingTotalCents(estimateSnapshot);
  if (lightingTotalCents !== null) {
    rows.push({
      id: 'lighting',
      kind: 'lighting',
      label: 'Lighting',
      detail: 'Hardware, wiring and electrical',
      priceIncGstCents: lightingTotalCents,
      status: 'priced',
    });
    pricedAmounts.push(lightingTotalCents);
    undiscountedAmounts.push(lightingTotalCents);
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
    hasCorePricing: pricedPergolas.length > 0,
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
