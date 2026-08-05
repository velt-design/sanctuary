import type { SitePricingPolicyV2 } from '../commercial/simpleRangePricing';
import { isCostingManifestAtLeast } from '../manifestVersion';
import type { CostingConfigV1 } from './config';
import { buildDayCycleActions, computeSiteDays } from './install';
import type { CostOutputV1, InstallActionV1 } from './types';

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isProductiveSimpleSiteDayPolicyEnabled(
  config: CostingConfigV1,
  pricingPolicy: SitePricingPolicyV2 | undefined,
): boolean {
  return pricingPolicy?.resolved_classification === 'simple'
    && isCostingManifestAtLeast(config, 2, 1);
}

export function productiveCrewHoursFromInstallActions(
  actions: ReadonlyArray<Pick<InstallActionV1, 'category' | 'minutes'>>,
): number {
  const minutes = actions.reduce((sum, action) => {
    const category = String(action.category).trim().toLowerCase();
    if (category === 'mobilisation' || category === 'demobilisation') return sum;
    const actionMinutes = Number(action.minutes);
    return Number.isFinite(actionMinutes) && actionMinutes > 0 ? sum + actionMinutes : sum;
  }, 0);
  return roundHours(minutes / 60);
}

type SiteDayCycle = {
  actions: InstallActionV1[];
  crewMinutes: number;
  crewHours: number;
  installExGst: number;
  warnings: string[];
};

function buildSiteDayCycle(
  modules: ReadonlyArray<Pick<CostOutputV1, 'inputs_normalized' | 'derived'>>,
  config: CostingConfigV1,
  siteDays: number,
): SiteDayCycle {
  const actionsById = new Map<string, InstallActionV1>();
  const warnings: string[] = [];
  for (const module of modules) {
    const result = buildDayCycleActions(
      module.inputs_normalized,
      { ...module.derived, module_count: modules.length },
      config,
      siteDays,
    );
    for (const action of result.install.actions) {
      const existing = actionsById.get(action.id);
      if (!existing || action.minutes > existing.minutes) actionsById.set(action.id, action);
    }
    warnings.push(...result.notes_and_warnings.map((warning) => `[Site] ${warning}`));
  }
  const actions = Array.from(actionsById.values()).sort((left, right) => left.id.localeCompare(right.id));
  const crewMinutes = Math.round(actions.reduce((sum, action) => sum + action.minutes, 0) * 100) / 100;
  return {
    actions,
    crewMinutes,
    crewHours: roundHours(crewMinutes / 60),
    installExGst: Math.round(actions.reduce((sum, action) => sum + action.cost_ex_gst, 0) * 100) / 100,
    warnings,
  };
}

export function resolveSiteDayCyclePolicyV1(params: {
  config: CostingConfigV1;
  pricingPolicy: SitePricingPolicyV2 | undefined;
  baseCrewHours: number;
  installActions: InstallActionV1[];
  modules: CostOutputV1[];
}): {
  siteDays: number;
  dayCycle: SiteDayCycle;
  productiveCrewHours: number | null;
} {
  const productiveCrewHours = productiveCrewHoursFromInstallActions(params.installActions);
  const usesProductiveHours = isProductiveSimpleSiteDayPolicyEnabled(params.config, params.pricingPolicy);
  let siteDays = computeSiteDays(usesProductiveHours ? productiveCrewHours : params.baseCrewHours, params.config);
  let dayCycle = buildSiteDayCycle(params.modules, params.config, siteDays);
  if (!usesProductiveHours) {
    const recalculatedDays = computeSiteDays(params.baseCrewHours + dayCycle.crewHours, params.config);
    if (recalculatedDays > siteDays) {
      siteDays = recalculatedDays;
      dayCycle = buildSiteDayCycle(params.modules, params.config, siteDays);
    }
  }
  return { siteDays, dayCycle, productiveCrewHours: usesProductiveHours ? productiveCrewHours : null };
}
