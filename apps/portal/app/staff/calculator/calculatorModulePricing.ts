import { allocateMoneyCentsByWeightV1, type PergolaOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

type CalculatorModulePriceRow = {
  id: string;
  kind: 'module';
  parentId: string;
  label: string;
  detail: string;
  priceIncGstCents: number;
  status: 'included';
};

function moduleDetail(pergolaLabel: string, module: CalculatorModuleInputs | undefined): string {
  if (!module) return `${pergolaLabel} · Allocated share of pergola price`;
  const length = Number.parseFloat(module.lengthM);
  const projection = Number.parseFloat(module.projectionM);
  const dimensions = Number.isFinite(length) && Number.isFinite(projection)
    ? `${length.toLocaleString('en-NZ', { maximumFractionDigits: 3 })}m × ${projection.toLocaleString('en-NZ', { maximumFractionDigits: 3 })}m`
    : 'Dimensions unavailable';
  return `${pergolaLabel} · ${dimensions} · Allocated share of pergola price`;
}

export function buildCalculatorModulePriceRows({
  pergola,
  pergolaLabel,
  modules,
  parentPriceIncGstCents,
}: {
  pergola: PergolaOutputV1;
  pergolaLabel: string;
  modules: CalculatorModuleInputs[];
  parentPriceIncGstCents: number;
}): CalculatorModulePriceRow[] {
  const outputModules = pergola.modules ?? [];
  const moduleCount = Math.max(outputModules.length, modules.length, pergola.module_count);
  if (moduleCount <= 0) return [];

  const rawWeights = Array.from({ length: moduleCount }, (_, index) => {
    const costExGst = outputModules[index]?.totals?.cost_ex_gst;
    return Number.isFinite(costExGst) && Number(costExGst) > 0 ? Number(costExGst) : 0;
  });
  const weights = rawWeights.some((weight) => weight > 0)
    ? rawWeights
    : rawWeights.map(() => 1);
  const allocations = allocateMoneyCentsByWeightV1(
    parentPriceIncGstCents,
    weights.map((weight, index) => ({ id: `module-${index + 1}`, weight })),
  );

  return Array.from({ length: moduleCount }, (_, index) => ({
    id: `module:${pergola.id}:${index + 1}`,
    kind: 'module' as const,
    parentId: `pergola:${pergola.id}`,
    label: `Module ${index + 1}`,
    detail: moduleDetail(pergolaLabel, modules[index]),
    priceIncGstCents: allocations[`module-${index + 1}`] ?? 0,
    status: 'included' as const,
  }));
}
