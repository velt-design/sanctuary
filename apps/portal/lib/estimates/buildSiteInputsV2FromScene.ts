import type {
  PergolaInputsV2,
  PergolaModuleCostInputV2,
  SiteInputsV2,
} from '@sp/costing';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { derivePergolaGroupsFromScene } from '@/lib/drawings/state/derivePergolaGroupsFromScene';
import { buildPergolaModuleCostFields } from './costingPayload';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function finiteOrZero(value: unknown): number {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * PR-2B.3 (2026-05-22): scene-derived cost input builder.
 *
 * Phase 2 north star (locked 2026-05-22): the cost engine consumes pergola
 * data only. Logical-pergola grouping comes from the workbench scene —
 * pergolas snapped together cost as modules of one logical pergola;
 * unconnected pergolas cost separately. All grouping is derived, never
 * stored.
 *
 * Build steps:
 * 1. Group scene pergolas by snap-derived adjacency via
 *    `derivePergolaGroupsFromScene` (PR-2B.2).
 * 2. For each pergola in a group, look up its `CalculatorModuleInputs` by
 *    `module.pergolaId === pergola.id` and produce the pergola-only cost
 *    fields via the shared `buildPergolaModuleCostFields` helper.
 * 3. Lift site-level fields (`access`, `height`, `job_type`, travel /
 *    extras / discount) to the SiteInputsV2 top level.
 *
 * Scene pergolas with no matching calc module are skipped (the cost engine
 * has nothing to cost for them). A group whose modules all skip out drops
 * from the result.
 *
 * The `accessories: []` slot is empty for now; populated when the first
 * pergola accessory family (blinds, lights, awnings) ships.
 *
 * Not yet wired into the cost engine entry point — that's PR-2B.4. This
 * builder is the canonical V2 shape source; 2B.4 makes the engine accept
 * it.
 */
export function buildSiteInputsV2FromScene(input: {
  projectModel: Pick<WorkbenchProjectModel, 'pergolas'>;
  calculatorInputs: CalculatorInputs;
}): SiteInputsV2 {
  const { projectModel, calculatorInputs } = input;

  // Index calc modules by pergolaId for O(1) lookup. First-wins if multiple
  // modules share a pergolaId (legacy multi-module setups) — V2 treats each
  // PergolaObjectModel as exactly one module.
  const moduleByPergolaId = new Map<string, CalculatorModuleInputs>();
  for (const module of calculatorInputs.modules) {
    const pergolaId = typeof module.pergolaId === 'string' ? module.pergolaId.trim() : '';
    if (!pergolaId) continue;
    if (!moduleByPergolaId.has(pergolaId)) {
      moduleByPergolaId.set(pergolaId, module);
    }
  }

  const groups = derivePergolaGroupsFromScene({ pergolas: projectModel.pergolas });

  const pergolas: PergolaInputsV2[] = [];
  for (const group of groups) {
    const modules: PergolaModuleCostInputV2[] = [];
    for (const pergolaObj of group.members) {
      const moduleInput = moduleByPergolaId.get(pergolaObj.id);
      if (!moduleInput) continue;
      modules.push({
        id: pergolaObj.id,
        ...buildPergolaModuleCostFields(moduleInput),
      });
    }
    if (modules.length === 0) continue;
    pergolas.push({
      id: group.pergolaId,
      label: group.members[0]?.label ?? group.pergolaId,
      modules,
      accessories: [],
    });
  }

  return {
    schema_version: 'v2',
    pergolas,
    job_type: calculatorInputs.jobType,
    access: calculatorInputs.access,
    height: calculatorInputs.height,
    travel_ex_gst: finiteOrZero(calculatorInputs.travelExGst),
    extras_allowance_ex_gst: finiteOrZero(calculatorInputs.extrasAllowanceExGst),
    quote_discount_pct: finiteOrZero(calculatorInputs.quoteDiscountPct),
  };
}
