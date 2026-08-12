import { isCostingManifestAtLeast } from '../manifestVersion';
import type { CostingConfigV1 } from './config';
import type { InstallActionV1, InstallV1 } from './types';

export const INFILL_JOB_SETUP_ACTION_ID = 'infill.job_setup_once';
export const INFILL_SHAPED_OPENING_ACTION_ID = 'infill.shaped_opening_each';

export type InstallActionConfigV1 = {
  id: string;
  category: string;
  label: string;
  unit: string;
  quantity: Record<string, unknown>;
  base_minutes: number | Record<string, unknown>;
  applies_to?: Record<string, string[]>;
  apply_multipliers?: string[];
  notes?: string;
  scope?: 'job' | 'module';
};

const INFILL_LABOUR_ALLOWANCE_ACTIONS: readonly InstallActionConfigV1[] = [
  {
    id: INFILL_SHAPED_OPENING_ACTION_ID,
    category: 'Infill',
    label: 'Sloping or triangular infill opening allowance (each)',
    unit: 'each',
    quantity: {
      driver: 'derived.infill_shaped_opening_count',
      default: 0,
    },
    base_minutes: 30,
    applies_to: {
      structure_types: ['pitched', 'box_perimeter'],
    },
    apply_multipliers: [],
    notes: 'Additional templating and fitting time for each genuinely sloping or triangular opening.',
    scope: 'module',
  },
];

const round = (value: number) => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

export function addInfillJobSetupToInstallV1(
  install: InstallV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
  include: boolean,
): InstallV1 {
  if (
    !include
    || !isCostingManifestAtLeast(config, 2, 6)
    || Number(derived.infill_instance_count ?? 0) <= 0
    || install.actions.some((action) => action.id === INFILL_JOB_SETUP_ACTION_ID)
  ) {
    return install;
  }

  const minutes = 60;
  const crewRateExGst = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 100);
  const action: InstallActionV1 = {
    id: INFILL_JOB_SETUP_ACTION_ID,
    category: 'Infill',
    label: 'Infill job setup and small-work allowance',
    scope: 'module',
    unit: 'job',
    qty: 1,
    minutes,
    applied_multipliers: {},
    cost_ex_gst: round((minutes / 60) * crewRateExGst),
  };
  const actions = [...install.actions, action].sort((left, right) => left.id.localeCompare(right.id));
  const crewMinutes = round(actions.reduce((total, item) => total + item.minutes, 0));
  return {
    actions,
    totals: {
      crew_minutes: crewMinutes,
      crew_hours: round(crewMinutes / 60),
      install_ex_gst: round(actions.reduce((total, item) => total + item.cost_ex_gst, 0)),
    },
  };
}

/**
 * The shaped-opening action is a package-owned commercial semantic rather than
 * an editable base-rate control. The manifest gate keeps published estimates reproducible.
 */
export function installActionsWithInfillLabourPolicyV1(
  config: CostingConfigV1,
): readonly InstallActionConfigV1[] {
  const configured = config.installActions.actions as readonly InstallActionConfigV1[];
  return isCostingManifestAtLeast(config, 2, 6)
    ? [...configured, ...INFILL_LABOUR_ALLOWANCE_ACTIONS]
    : configured;
}
