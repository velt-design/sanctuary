import { allocateMoneyCentsByWeightV1 } from './moneyAllocation';
import type {
  InfillCostBreakdownItemV1,
  InfillCostBreakdownV2,
  InfillCostComponentsV1,
  PergolaOutputV1,
  SiteInputsV1,
  SiteOutputV1,
} from './types';

type ComponentCents = {
  materials: number;
  install: number;
  overhead: number;
  total: number;
};

const moneyToCents = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : 0
);

const centsToMoney = (value: number) => Math.round(value) / 100;

const itemKey = (item: Pick<InfillCostBreakdownItemV1, 'module_id' | 'infill_id'>) =>
  `${item.module_id}\u0000${item.infill_id}`;

function componentsForPergola(pergola: PergolaOutputV1): ComponentCents {
  const materials = moneyToCents(pergola.materials.totals.materials_ex_gst);
  const install = moneyToCents(pergola.install.totals.install_ex_gst);
  const total = moneyToCents(pergola.totals.cost_ex_gst);
  return {
    materials,
    install,
    overhead: total - materials - install,
    total,
  };
}

function publicComponents(components: ComponentCents): InfillCostComponentsV1 {
  return {
    materials_ex_gst: centsToMoney(components.materials),
    install_ex_gst: centsToMoney(components.install),
    overhead_ex_gst: centsToMoney(components.overhead),
    total_ex_gst: centsToMoney(components.total),
  };
}

function componentShares(
  totalCents: number,
  items: InfillCostBreakdownItemV1[],
  weight: (item: InfillCostBreakdownItemV1) => number,
): Record<string, number> {
  return allocateMoneyCentsByWeightV1(
    totalCents,
    items.map((item) => ({ id: itemKey(item), weight: moneyToCents(weight(item)) })),
  );
}

export function withoutSiteInfillsV1(inputs: SiteInputsV1): SiteInputsV1 {
  return {
    ...inputs,
    pergolas: inputs.pergolas.map((pergola) => ({
      ...pergola,
      modules: pergola.modules.map((module) => ({ ...module, infills: [] })),
    })),
  };
}

export function applySiteInfillIncrementalBaselineV2(
  current: SiteOutputV1,
  baseline: SiteOutputV1,
): void {
  for (const pergola of current.pergolas) {
    const attributed = pergola.infill_cost_breakdown;
    if (!attributed || attributed.schema_version !== 'infill_cost_breakdown_v1') continue;

    const baselinePergola = baseline.pergolas.find((candidate) => candidate.id === pergola.id);
    if (!baselinePergola) {
      pergola.infill_cost_breakdown = {
        schema_version: 'infill_cost_breakdown_v2',
        source: '@sp/costing/engine/infill-incremental-baseline-v2',
        status: 'blocked',
        scope_id: pergola.id,
        allocation: {
          baseline: 'site_rerun_without_infills',
          pooled_materials: 'stock_piece_usage',
          install: 'infill_labour_drivers',
          overhead: 'proportional_direct_cost',
        },
        items: attributed.items,
        baseline: attributed.remainder,
        baseline_shared_cost_ex_gst: baseline.shared.totals.cost_ex_gst,
        baseline_customer_price_uplift_pct: baseline.pricing_policy?.customer_price_uplift_pct ?? 0,
        totals: attributed.totals,
        notes_and_warnings: [
          ...attributed.notes_and_warnings,
          'The no-infill baseline did not contain the matching pergola.',
        ],
      };
      continue;
    }

    const currentComponents = componentsForPergola(pergola);
    const baselineComponents = componentsForPergola(baselinePergola);
    const delta: ComponentCents = {
      materials: currentComponents.materials - baselineComponents.materials,
      install: currentComponents.install - baselineComponents.install,
      overhead: currentComponents.overhead - baselineComponents.overhead,
      total: currentComponents.total - baselineComponents.total,
    };
    const invalidDelta = Object.values(delta).some((value) => value < 0)
      || delta.total !== delta.materials + delta.install + delta.overhead;
    const materialShares = componentShares(
      Math.max(0, delta.materials),
      attributed.items,
      (item) => item.materials_ex_gst,
    );
    const installShares = componentShares(
      Math.max(0, delta.install),
      attributed.items,
      (item) => item.install_ex_gst,
    );
    const overheadShares = componentShares(
      Math.max(0, delta.overhead),
      attributed.items,
      (item) => item.materials_ex_gst + item.install_ex_gst,
    );
    const items = attributed.items.map((item) => {
      const key = itemKey(item);
      const materials = materialShares[key] ?? 0;
      const install = installShares[key] ?? 0;
      const overhead = overheadShares[key] ?? 0;
      return {
        ...item,
        materials_ex_gst: centsToMoney(materials),
        install_ex_gst: centsToMoney(install),
        overhead_ex_gst: centsToMoney(overhead),
        total_ex_gst: centsToMoney(materials + install + overhead),
      };
    });
    const breakdown: InfillCostBreakdownV2 = {
      schema_version: 'infill_cost_breakdown_v2',
      source: '@sp/costing/engine/infill-incremental-baseline-v2',
      status: attributed.status === 'ready' && !invalidDelta ? 'ready' : 'blocked',
      scope_id: pergola.id,
      allocation: {
        baseline: 'site_rerun_without_infills',
        pooled_materials: 'stock_piece_usage',
        install: 'infill_labour_drivers',
        overhead: 'proportional_direct_cost',
      },
      items,
      baseline: publicComponents(baselineComponents),
      baseline_shared_cost_ex_gst: baseline.shared.totals.cost_ex_gst,
      baseline_customer_price_uplift_pct: baseline.pricing_policy?.customer_price_uplift_pct ?? 0,
      totals: publicComponents(currentComponents),
      notes_and_warnings: [
        ...attributed.notes_and_warnings,
        ...(invalidDelta
          ? ['The no-infill baseline exceeded one or more current pergola cost components.']
          : []),
      ],
    };
    pergola.infill_cost_breakdown = breakdown;
  }
}
