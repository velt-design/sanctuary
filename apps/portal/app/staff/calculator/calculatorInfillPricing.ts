import {
  allocateMoneyCentsByWeightV1,
  type InfillCostBreakdownItemV1,
  type PergolaOutputV1,
} from '@sp/costing';
import type { CalculatorModuleInputs, InfillLineItem } from '@/lib/types/calculator';
import { toCents } from '@/lib/quotes/utils';

export type CalculatorInternalTrueCost = {
  materialsExGstCents: number;
  labourExGstCents: number;
  overheadExGstCents: number;
  totalExGstCents: number;
};

type CalculatorIncludedPriceRow = {
  id: string;
  kind: 'pergola_component' | 'infill';
  parentId: string;
  label: string;
  detail: string;
  priceIncGstCents: number | null;
  status: 'included';
  internalTrueCost?: CalculatorInternalTrueCost;
};

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function infillDetail(
  pergolaLabel: string,
  moduleIndex: number,
  infill: InfillLineItem | undefined,
  quantity: number,
): string {
  const location = infill ? titleCase(infill.location) : 'Configured opening';
  const qty = quantity > 1 ? ` · Qty ${quantity}` : '';
  return `${pergolaLabel} · Module ${moduleIndex + 1} · ${location}${qty}`;
}

function engineItemKey(moduleId: string, infillId: string) {
  return `${moduleId}\u0000${infillId}`;
}

function internalTrueCost(item: InfillCostBreakdownItemV1): CalculatorInternalTrueCost {
  return {
    materialsExGstCents: toCents(item.materials_ex_gst),
    labourExGstCents: toCents(item.install_ex_gst),
    overheadExGstCents: toCents(item.overhead_ex_gst),
    totalExGstCents: toCents(item.total_ex_gst),
  };
}

function fallbackRows(
  pergolaId: string,
  pergolaLabel: string,
  modules: CalculatorModuleInputs[],
): CalculatorIncludedPriceRow[] {
  return modules.flatMap((module, moduleIndex) =>
    (module.infills?.items ?? []).map((infill, infillIndex) => {
      const parsedQuantity = Number.parseInt(infill.qty, 10);
      const quantity = Number.isFinite(parsedQuantity) ? Math.max(1, parsedQuantity) : 1;
      return {
        id: `infill:${pergolaId}:${moduleIndex}:${infill.id}`,
        kind: 'infill' as const,
        parentId: `pergola:${pergolaId}`,
        label: infill.label?.trim() || `Infill ${infillIndex + 1}`,
        detail: infillDetail(pergolaLabel, moduleIndex, infill, quantity),
        priceIncGstCents: null,
        status: 'included' as const,
      };
    }),
  );
}

export function buildCalculatorPergolaIncludedPriceRows({
  pergola,
  pergolaLabel,
  modules,
  parentPriceIncGstCents,
  baselinePriceIncGstCents,
}: {
  pergola: PergolaOutputV1;
  pergolaLabel: string;
  modules: CalculatorModuleInputs[];
  parentPriceIncGstCents: number;
  baselinePriceIncGstCents: number | null;
}): CalculatorIncludedPriceRow[] {
  const breakdown = pergola.infill_cost_breakdown;
  if (
    breakdown?.schema_version !== 'infill_cost_breakdown_v2'
    || breakdown.status !== 'ready'
    || breakdown.items.length === 0
    || baselinePriceIncGstCents === null
    || baselinePriceIncGstCents > parentPriceIncGstCents
  ) {
    return fallbackRows(pergola.id, pergolaLabel, modules);
  }

  const inputByEngineKey = new Map<string, { infill: InfillLineItem; moduleIndex: number; infillIndex: number }>();
  modules.forEach((module, moduleIndex) => {
    const moduleId = `${pergola.id}.module-${moduleIndex + 1}`;
    (module.infills?.items ?? []).forEach((infill, infillIndex) => {
      inputByEngineKey.set(engineItemKey(moduleId, infill.id), { infill, moduleIndex, infillIndex });
    });
  });

  const baseId = `pergola-component:${pergola.id}`;
  const contributionIds = breakdown.items.map((item) => ({
    id: `infill-contribution:${item.module_id}:${item.infill_id}`,
    weight: toCents(item.total_ex_gst),
  }));
  const contributions = allocateMoneyCentsByWeightV1(
    parentPriceIncGstCents - baselinePriceIncGstCents,
    contributionIds,
  );
  const rows: CalculatorIncludedPriceRow[] = [{
    id: baseId,
    kind: 'pergola_component',
    parentId: `pergola:${pergola.id}`,
    label: 'Base pergola without infills',
    detail: `Starting price for ${pergolaLabel}`,
    priceIncGstCents: baselinePriceIncGstCents,
    status: 'included',
  }];

  breakdown.items.forEach((item, fallbackIndex) => {
    const input = inputByEngineKey.get(engineItemKey(item.module_id, item.infill_id));
    const moduleMatch = item.module_id.match(/\.module-(\d+)$/);
    const moduleIndex = input?.moduleIndex ?? Math.max(0, Number(moduleMatch?.[1] ?? 1) - 1);
    const contributionId = `infill-contribution:${item.module_id}:${item.infill_id}`;
    rows.push({
      id: `infill:${pergola.id}:${moduleIndex}:${item.infill_id}`,
      kind: 'infill',
      parentId: `pergola:${pergola.id}`,
      label: input?.infill.label?.trim() || item.label?.trim() || `Infill ${(input?.infillIndex ?? fallbackIndex) + 1}`,
      detail: infillDetail(pergolaLabel, moduleIndex, input?.infill, item.quantity),
      priceIncGstCents: contributions[contributionId] ?? 0,
      status: 'included',
      internalTrueCost: internalTrueCost(item),
    });
  });

  return rows;
}
