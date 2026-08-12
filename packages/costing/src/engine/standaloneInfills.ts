import {
  buildCommercialOverheadV5,
  isCommercialPolicyV2Enabled,
  isCommercialPolicyV5Enabled,
  resolveSitePricingPolicyV2,
} from '../commercial/simpleRangePricing';
import { applyGst } from './derive';
import { buildTrustedLabourBreakdownV1, buildTrustedMaterialsBreakdownV1 } from './breakdownExplanation';
import type { CostingConfigV1 } from './config';
import { pooledInfillMaterialLines } from './infillMaterialPooling';
import { INFILL_JOB_SETUP_ACTION_ID } from './infillLabourPolicy';
import { buildOverheadV1 } from './overheads';
import { applyProductiveInstallTimePolicyV5 } from './simpleSiteDayPolicy';
import type {
  CostInputsV1,
  CostOutputV1,
  InstallActionV1,
  SiteInputsV1,
  SiteOutputV1,
  StandaloneInfillsOutputV1,
  WarningV1,
} from './types';

const roundMoney = (value: number) => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

function installTotals(actions: InstallActionV1[]): CostOutputV1['install']['totals'] {
  const crewMinutes = roundMoney(actions.reduce((sum, action) => sum + Number(action.minutes ?? 0), 0));
  return {
    crew_minutes: crewMinutes,
    crew_hours: roundMoney(crewMinutes / 60),
    install_ex_gst: roundMoney(actions.reduce((sum, action) => sum + Number(action.cost_ex_gst ?? 0), 0)),
  };
}

export function calculateStandaloneInfillsV1(args: {
  inputs: SiteInputsV1;
  config: CostingConfigV1;
  calculateModule: (inputs: CostInputsV1, config: CostingConfigV1) => CostOutputV1;
  toWarnings: (messages: string[]) => WarningV1[];
  includeJobSetup: boolean;
}): StandaloneInfillsOutputV1 | undefined {
  const { inputs, config } = args;
  const accessory = inputs.standalone_infills;
  if (!accessory?.infills.length) return undefined;

  const moduleResult = args.calculateModule({
    length_m: 1,
    projection_m: 1,
    post_cut_height_m: 2.4,
    roof_pitch_deg: 0,
    post_count: 0,
    pergola_style: 'pitched',
    roof_material: 'none',
    extrusion_colour: accessory.extrusion_colour,
    powdercoat_standard_colour: accessory.powdercoat_standard_colour,
    powdercoat_is_custom: accessory.powdercoat_is_custom,
    powdercoat_custom_colour: accessory.powdercoat_custom_colour,
    house_connection_type: 'none',
    post_connection_type: 'deck_bracket',
    access: accessory.access,
    height: accessory.height,
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
    infills: accessory.infills,
  }, config);
  const takeoff = moduleResult.infill_takeoff;
  if (!takeoff) return undefined;

  const materialLines = pooledInfillMaterialLines(moduleResult.materials.lines, takeoff, config)
    .filter((line) => String(line.id ?? '').startsWith('job.infill.')
      || /for canonical infill joiner cuts/i.test(String(line.notes ?? '')))
    .map((line) => ({ ...line, label: `[Existing pergola infills] ${line.label}` }));
  const materialsExGst = roundMoney(materialLines.reduce((sum, line) => sum + Number(line.line_cost_ex_gst ?? 0), 0));
  const pricingPolicy = isCommercialPolicyV2Enabled(config) ? resolveSitePricingPolicyV2(inputs, config) : undefined;
  const installActions = applyProductiveInstallTimePolicyV5(
    moduleResult.install.actions.filter((action) => action.id.startsWith('infill.')
      && (args.includeJobSetup || action.id !== INFILL_JOB_SETUP_ACTION_ID)),
    config,
    pricingPolicy,
  ).map((action) => ({ ...action, label: `[Existing pergola infills] ${action.label}` }));
  const resolvedInstallTotals = installTotals(installActions);

  const overhead = isCommercialPolicyV5Enabled(config) && pricingPolicy
    ? (() => {
        const current = buildCommercialOverheadV5(config, inputs, resolvedInstallTotals.crew_hours, pricingPolicy.resolved_classification);
        const baseline = buildCommercialOverheadV5(config, inputs, 0, pricingPolicy.resolved_classification);
        return {
          method: 'standalone_infill_incremental',
          ops_ex_gst: roundMoney(current.ops_ex_gst - baseline.ops_ex_gst),
          sales_ex_gst: roundMoney(current.sales_ex_gst - baseline.sales_ex_gst),
          total_ex_gst: roundMoney(current.total_ex_gst - baseline.total_ex_gst),
        };
      })()
    : (() => {
        const current = buildOverheadV1(config, { module_count: 1, total_crew_hours: resolvedInstallTotals.crew_hours }).overhead;
        const baseline = buildOverheadV1(config, { module_count: 1, total_crew_hours: 0 }).overhead;
        return {
          method: 'standalone_infill_incremental',
          ops_ex_gst: roundMoney(current.ops_ex_gst - baseline.ops_ex_gst),
          sales_ex_gst: roundMoney(current.sales_ex_gst - baseline.sales_ex_gst),
          total_ex_gst: roundMoney(current.total_ex_gst - baseline.total_ex_gst),
        };
      })();
  const overheadExGst = config.overheads.include_in_total_cost ? overhead.total_ex_gst : 0;
  const costExGst = roundMoney(materialsExGst + resolvedInstallTotals.install_ex_gst + overheadExGst);
  const notes = takeoff.warnings.map((warning) => warning.level === 'critical' ? `INVALID: ${warning.message}` : warning.message);

  return {
    item_count: takeoff.totals.instance_count,
    infill_takeoff: takeoff,
    materials: {
      lines: materialLines,
      totals: { materials_ex_gst: materialsExGst, waste_m_by_profile: {}, bars_by_profile: {} },
      trusted_breakdown: buildTrustedMaterialsBreakdownV1(materialLines),
    },
    install: {
      actions: installActions,
      totals: resolvedInstallTotals,
      trusted_breakdown: buildTrustedLabourBreakdownV1(installActions, resolvedInstallTotals),
    },
    overhead,
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: roundMoney(applyGst(costExGst)),
      warnings: args.toWarnings(notes),
      notes_and_warnings: notes,
    },
  };
}

export function mergeStandaloneInfillsIntoSiteV1(args: {
  output: SiteOutputV1;
  standalone?: StandaloneInfillsOutputV1;
  toWarnings: (messages: string[]) => WarningV1[];
}): SiteOutputV1 {
  const { output, standalone } = args;
  if (!standalone) return output;
  const materialsLines = [...output.materials.lines, ...standalone.materials.lines];
  const installActions = [...output.install.actions, ...standalone.install.actions];
  const resolvedInstallTotals = installTotals(installActions);
  const overhead = {
    method: output.pergola_count > 0 ? 'site_rollup' : standalone.overhead.method,
    ops_ex_gst: roundMoney(output.overhead.ops_ex_gst + standalone.overhead.ops_ex_gst),
    sales_ex_gst: roundMoney(output.overhead.sales_ex_gst + standalone.overhead.sales_ex_gst),
    total_ex_gst: roundMoney(output.overhead.total_ex_gst + standalone.overhead.total_ex_gst),
  };
  const costExGst = roundMoney(output.totals.cost_ex_gst + standalone.totals.cost_ex_gst);
  const notes = [...output.totals.notes_and_warnings, ...standalone.totals.notes_and_warnings];
  return {
    ...output,
    standalone_infills: standalone,
    materials: {
      lines: materialsLines,
      totals: {
        ...output.materials.totals,
        materials_ex_gst: roundMoney(output.materials.totals.materials_ex_gst + standalone.materials.totals.materials_ex_gst),
      },
      trusted_breakdown: buildTrustedMaterialsBreakdownV1(materialsLines),
    },
    install: {
      actions: installActions,
      totals: resolvedInstallTotals,
      trusted_breakdown: buildTrustedLabourBreakdownV1(installActions, resolvedInstallTotals),
    },
    overhead,
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: roundMoney(applyGst(costExGst)),
      warnings: args.toWarnings(notes),
      notes_and_warnings: notes,
    },
  };
}
