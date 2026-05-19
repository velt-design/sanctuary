import type { CostingConfigV1 } from './config';
import type { OverheadV1 } from './types';

type OverheadResultV1 = { overhead: OverheadV1; notes_and_warnings: string[] };
const FLAT_ACRYLIC_MAX_RAFTER_LENGTH_M = 3;

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function buildOverheadV1(
  config: CostingConfigV1,
  opts?: {
    module_count?: number;
    total_crew_hours?: number;
    has_gable?: boolean;
    has_box_perimeter?: boolean;
    has_timber_or_mixed?: boolean;
    has_acrylic_only?: boolean;
    max_acrylic_rafter_length_m?: number;
  },
): OverheadResultV1 {
  const warnings: string[] = [];

  const moduleCountRaw = Number(opts?.module_count ?? 1);
  const moduleCount = Number.isFinite(moduleCountRaw) && moduleCountRaw > 0 ? Math.round(moduleCountRaw) : 1;

  const crewHoursRaw = Number(opts?.total_crew_hours ?? 0);
  const totalCrewHours = Number.isFinite(crewHoursRaw) && crewHoursRaw >= 0 ? crewHoursRaw : 0;
  const hasGable = opts?.has_gable === true;
  const hasBoxPerimeter = opts?.has_box_perimeter === true;
  const hasTimberOrMixed = opts?.has_timber_or_mixed === true;
  const hasAcrylicOnly = opts?.has_acrylic_only === true;
  const maxAcrylicRafterLengthRaw = Number(opts?.max_acrylic_rafter_length_m ?? 0);
  const maxAcrylicRafterLengthM =
    Number.isFinite(maxAcrylicRafterLengthRaw) && maxAcrylicRafterLengthRaw >= 0 ? maxAcrylicRafterLengthRaw : 0;

  const v11 = (config.overheads as any).allocation_method_v1_1 as any;
  const hasV11 = v11 && typeof v11 === 'object' && v11.type === 'fixed_plus_variable';

  let method = String(config.overheads.allocation_method.type ?? 'unknown');
  let ops = 0;
  let sales = 0;
  let total = 0;

  if (hasAcrylicOnly && maxAcrylicRafterLengthM <= FLAT_ACRYLIC_MAX_RAFTER_LENGTH_M) {
    method = 'flat_acrylic_total';
    ops = 2000;
    sales = 0;
    total = 2000;
  } else if (hasV11) {
    method = 'fixed_plus_variable';

    const crewDayHours = Number(v11.crew_day_hours ?? 9);
    const dayHours = Number.isFinite(crewDayHours) && crewDayHours > 0 ? crewDayHours : 9;

    const opsFixed = Number(v11.ops_delivery?.fixed_per_job_ex_gst ?? 500);
    const opsPerDay = Number(v11.ops_delivery?.variable_per_crew_day_ex_gst ?? 1000);
    const gableStartup = Number(v11.ops_delivery?.gable_startup_per_pergola_ex_gst ?? 500);
    const boxPerimeterStartup = Number(v11.ops_delivery?.box_perimeter_startup_per_pergola_ex_gst ?? 500);
    const timberPerRoundedCrewDay = Number(v11.ops_delivery?.timber_per_rounded_crew_day_ex_gst ?? 500);

    let startup = 0;
    if (hasGable) startup = Math.max(startup, Number.isFinite(gableStartup) ? gableStartup : 0);
    if (hasBoxPerimeter) startup = Math.max(startup, Number.isFinite(boxPerimeterStartup) ? boxPerimeterStartup : 0);

    const roundedCrewDaysRaw = Math.round(totalCrewHours / dayHours);
    const roundedCrewDays = Number.isFinite(roundedCrewDaysRaw) ? Math.max(0, roundedCrewDaysRaw) : 0;
    const timberSurcharge = hasTimberOrMixed ? (Number.isFinite(timberPerRoundedCrewDay) ? timberPerRoundedCrewDay : 0) * roundedCrewDays : 0;

    const opsComputed = opsFixed + opsPerDay * (totalCrewHours / dayHours) + startup + timberSurcharge;

    const salesPerJob = Number(v11.sales_design?.per_job_ex_gst ?? 0);
    const extraModuleFactor = Number(v11.sales_design?.extra_module_factor ?? 0);
    const salesComputed = salesPerJob * (1 + extraModuleFactor * Math.max(0, moduleCount - 1));

    ops = Number.isFinite(opsComputed) ? opsComputed : 0;
    sales = Number.isFinite(salesComputed) ? salesComputed : 0;
    total = ops + sales;
  } else {
    const computed = config.overheads.computed_per_won_job as any;
    method = String(config.overheads.allocation_method.type ?? 'unknown');
    ops = Number(computed?.ops_delivery ?? 0);
    sales = Number(computed?.sales_design ?? 0);
    total = Number(computed?.total ?? ops + sales);
  }

  if (!config.overheads.include_in_total_cost) warnings.push('Overheads config is set to exclude overheads from total cost.');

  return {
    overhead: {
      method,
      ops_ex_gst: roundMoney(ops),
      sales_ex_gst: roundMoney(sales),
      total_ex_gst: roundMoney(total),
    },
    notes_and_warnings: warnings,
  };
}
