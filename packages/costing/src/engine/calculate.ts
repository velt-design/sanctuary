import { loadCostingConfigV1, type CostingConfigV1 } from './config';
import { applyGst, normalizeAndDeriveV1 } from './derive';
import { buildMaterialsV1, buildMaterialsV1Explain } from './bom';
import {
  buildTrustedLabourBreakdownV1,
  buildTrustedMaterialsBreakdownV1,
} from './breakdownExplanation';
import { poolInfillsTakeoffsV1 } from './infillTakeoff';
import { pooledInfillMaterialLines } from './infillMaterialPooling';
import { buildPergolaInfillCostBreakdownV1 } from './infillCostAttribution';
import {
  applySiteInfillIncrementalBaselineV2,
  withoutSiteInfillsV1,
} from './infillIncrementalBaseline';
import { buildDayCycleActions, buildInstallV1, computeSiteDays, DAY_CYCLE_ACTION_IDS } from './install';
import { resolveSiteDayCyclePolicyV1 } from './simpleSiteDayPolicy';
import { buildOverheadV1 } from './overheads';
import {
  buildSimpleRangeOverheadV2,
  calculateApprovalCustomerAllowanceV2,
  isCommercialPolicyV2Enabled,
  resolveSitePricingPolicyV2,
} from '../commercial/simpleRangePricing';
import type {
  CostInputsV1,
  CostOutputV1,
  InstallActionV1,
  JobInputsV1,
  JobType,
  JobOutputV1,
  MaterialsLineV1,
  PergolaInputsV1,
  PergolaOutputV1,
  SiteInputsV1,
  SiteInputsV2,
  SiteOutputV1,
  WarningLevelV1,
  WarningV1,
} from './types';
import type { MaterialsExplainOptions, MaterialsExplainV1 } from './materials_explain';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

const BOX_PERIMETER_STARTUP_ACTION_ID = 'mob.box_perimeter_startup';
const BOX_PERIMETER_STARTUP_MINUTES = 180;
const BOX_PERIMETER_STARTUP_ACTION_LABEL = 'Box perimeter startup labour';
const BOX_PERIMETER_STARTUP_ACTION_CATEGORY = 'Mob';
const SCAFFOLD_STARTUP_ACTION_ID = 'mob.scaffolding_startup';
const SCAFFOLD_STARTUP_MINUTES = 150;
const SCAFFOLD_STARTUP_LABEL = 'Scaffolding setup, packdown and load labour';
const SCAFFOLD_EXTRA_PER_PERGOLA_ACTION_ID = 'mob.scaffolding_additional_per_pergola';
const SCAFFOLD_EXTRA_PER_PERGOLA_MINUTES = 60;
const SCAFFOLD_EXTRA_PER_PERGOLA_LABEL = 'Scaffolding additional pergola labour allowance';
const SCAFFOLD_ACTION_CATEGORY = 'Mob';
const SCAFFOLD_DAY_RATE_LINE_ID = 'job.hire.scaffolding_day_rate';
const SCAFFOLD_DAY_RATE_LABEL = '[Job] Scaffolding day hire';
const SCAFFOLD_DAY_RATE_PROFILE = 'Scaffolding';

type OverheadFlags = {
  has_gable: boolean;
  has_box_perimeter: boolean;
  has_timber_or_mixed: boolean;
  has_acrylic_only: boolean;
  /**
   * PR-PE2 (2026-06-16): per-module qualifier for the flat `$2000` acrylic
   * overhead cap. True only when `pergola_style === 'pitched'` AND
   * `roof_material === 'acrylic'` AND the structure isn't `box_perimeter`.
   * Aggregated across modules with AND — every module must qualify for the
   * job to qualify.
   */
  all_pitched_acrylic: boolean;
  max_acrylic_rafter_length_m: number;
};

function deriveOverheadFlagsForModule(module: Pick<CostOutputV1, 'inputs_normalized' | 'derived'>): OverheadFlags {
  const style = String(module.inputs_normalized.pergola_style_ui ?? '');
  const structureType = String(module.inputs_normalized.structure_type ?? '');
  const roofMaterial = String(module.inputs_normalized.roof_material ?? '');
  const rafterLengthRaw = Number(module.derived?.rafter_length_m ?? 0);
  const rafterLengthM = Number.isFinite(rafterLengthRaw) && rafterLengthRaw > 0 ? rafterLengthRaw : 0;
  return {
    has_gable: style === 'gable',
    has_box_perimeter: structureType === 'box_perimeter',
    has_timber_or_mixed: roofMaterial === 'timber' || roofMaterial === 'mixed',
    has_acrylic_only: roofMaterial === 'acrylic',
    all_pitched_acrylic:
      style === 'pitched' && roofMaterial === 'acrylic' && structureType !== 'box_perimeter',
    max_acrylic_rafter_length_m: roofMaterial === 'acrylic' ? rafterLengthM : 0,
  };
}

function deriveOverheadFlagsForModules(modules: Array<Pick<CostOutputV1, 'inputs_normalized' | 'derived'>>): OverheadFlags {
  if (modules.length === 0) {
    return {
      has_gable: false,
      has_box_perimeter: false,
      has_timber_or_mixed: false,
      has_acrylic_only: false,
      all_pitched_acrylic: false,
      max_acrylic_rafter_length_m: 0,
    };
  }

  return modules.reduce<OverheadFlags>(
    (acc, module) => {
      const next = deriveOverheadFlagsForModule(module);
      return {
        has_gable: acc.has_gable || next.has_gable,
        has_box_perimeter: acc.has_box_perimeter || next.has_box_perimeter,
        has_timber_or_mixed: acc.has_timber_or_mixed || next.has_timber_or_mixed,
        has_acrylic_only: acc.has_acrylic_only && next.has_acrylic_only,
        all_pitched_acrylic: acc.all_pitched_acrylic && next.all_pitched_acrylic,
        max_acrylic_rafter_length_m: Math.max(acc.max_acrylic_rafter_length_m, next.max_acrylic_rafter_length_m),
      };
    },
    {
      has_gable: false,
      has_box_perimeter: false,
      has_timber_or_mixed: false,
      has_acrylic_only: true,
      all_pitched_acrylic: true,
      max_acrylic_rafter_length_m: 0,
    },
  );
}

function buildBoxPerimeterStartupAction(config: CostingConfigV1): InstallActionV1 {
  const crewRateRaw = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 100);
  const crewRate = Number.isFinite(crewRateRaw) && crewRateRaw > 0 ? crewRateRaw : 100;
  const minutes = BOX_PERIMETER_STARTUP_MINUTES;
  return {
    id: BOX_PERIMETER_STARTUP_ACTION_ID,
    category: BOX_PERIMETER_STARTUP_ACTION_CATEGORY,
    label: BOX_PERIMETER_STARTUP_ACTION_LABEL,
    scope: 'job',
    unit: 'job',
    qty: 1,
    minutes,
    applied_multipliers: {},
    cost_ex_gst: roundMoney((minutes / 60) * crewRate),
  };
}

function addBoxPerimeterStartupToInstall(
  install: CostOutputV1['install'],
  config: CostingConfigV1,
  hasBoxPerimeter: boolean,
): CostOutputV1['install'] {
  if (!hasBoxPerimeter) return install;
  if (install.actions.some((a) => a.id === BOX_PERIMETER_STARTUP_ACTION_ID)) return install;

  const startup = buildBoxPerimeterStartupAction(config);
  const actions = [...install.actions, startup].sort((a, b) => a.id.localeCompare(b.id));
  const crewMinutes = roundMoney(actions.reduce((acc, a) => acc + a.minutes, 0));
  const crewHours = roundMoney(crewMinutes / 60);
  const installExGst = roundMoney(actions.reduce((acc, a) => acc + a.cost_ex_gst, 0));

  return {
    actions,
    totals: {
      crew_minutes: crewMinutes,
      crew_hours: crewHours,
      install_ex_gst: installExGst,
    },
  };
}

function normalizeJobType(jobType: JobType | undefined): JobType {
  return jobType === 'commercial' ? 'commercial' : 'residential';
}

function resolveModulePitchDeg(module: Pick<CostOutputV1, 'derived' | 'inputs_normalized'>): number {
  const pitchRaw = Number((module.derived as any).roof_pitch_deg_used ?? module.inputs_normalized.roof_pitch_deg ?? 0);
  return Number.isFinite(pitchRaw) ? pitchRaw : 0;
}

function resolveModuleAreaM2(module: Pick<CostOutputV1, 'derived' | 'inputs_normalized'>): number {
  const areaRaw = Number((module.derived as any).area_m2);
  if (Number.isFinite(areaRaw) && areaRaw > 0) return areaRaw;
  const lengthM = Number(module.inputs_normalized.length_m ?? 0);
  const projectionM = Number(module.inputs_normalized.projection_m ?? 0);
  const areaFallback = lengthM * projectionM;
  return Number.isFinite(areaFallback) && areaFallback > 0 ? areaFallback : 0;
}

function resolvePergolaPitchDeg(modules: Array<Pick<CostOutputV1, 'derived' | 'inputs_normalized'>>): number {
  let maxPitch = 0;
  for (const module of modules) {
    maxPitch = Math.max(maxPitch, resolveModulePitchDeg(module));
  }
  return maxPitch;
}

function resolvePergolaAreaM2(modules: Array<Pick<CostOutputV1, 'derived' | 'inputs_normalized'>>): number {
  return roundMoney(modules.reduce((acc, module) => acc + resolveModuleAreaM2(module), 0));
}

function requiresScaffolding(jobType: JobType, pergolaPitchDeg: number): boolean {
  if (jobType === 'commercial') return true;
  return pergolaPitchDeg >= 30;
}

function resolveScaffoldingDayRateExGst(jobType: JobType, pergolaAreaM2: number): number {
  if (jobType !== 'commercial') return 50;
  return pergolaAreaM2 >= 20 ? 200 : 100;
}

function buildScaffoldingLabourActions(config: CostingConfigV1, scaffoldPergolaCount: number): InstallActionV1[] {
  if (!Number.isFinite(scaffoldPergolaCount) || scaffoldPergolaCount <= 0) return [];

  const count = Math.max(0, Math.round(scaffoldPergolaCount));
  if (count <= 0) return [];

  const crewRateRaw = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 100);
  const crewRate = Number.isFinite(crewRateRaw) && crewRateRaw > 0 ? crewRateRaw : 100;

  const actions: InstallActionV1[] = [
    {
      id: SCAFFOLD_STARTUP_ACTION_ID,
      category: SCAFFOLD_ACTION_CATEGORY,
      label: SCAFFOLD_STARTUP_LABEL,
      scope: 'job',
      unit: 'job',
      qty: 1,
      minutes: SCAFFOLD_STARTUP_MINUTES,
      applied_multipliers: {},
      cost_ex_gst: roundMoney((SCAFFOLD_STARTUP_MINUTES / 60) * crewRate),
    },
  ];

  if (count > 1) {
    const extraQty = count - 1;
    const extraMinutes = SCAFFOLD_EXTRA_PER_PERGOLA_MINUTES * extraQty;
    actions.push({
      id: SCAFFOLD_EXTRA_PER_PERGOLA_ACTION_ID,
      category: SCAFFOLD_ACTION_CATEGORY,
      label: SCAFFOLD_EXTRA_PER_PERGOLA_LABEL,
      scope: 'job',
      unit: 'pergola',
      qty: extraQty,
      minutes: extraMinutes,
      applied_multipliers: {},
      cost_ex_gst: roundMoney((extraMinutes / 60) * crewRate),
    });
  }

  return actions.sort((a, b) => a.id.localeCompare(b.id));
}

function buildScaffoldingDayRateLine(
  id: string,
  label: string,
  siteDays: number,
  dayRateExGst: number,
): MaterialsLineV1 | null {
  const qty = Number.isFinite(siteDays) && siteDays > 0 ? Math.round(siteDays) : 0;
  if (qty <= 0) return null;
  if (!Number.isFinite(dayRateExGst) || dayRateExGst <= 0) return null;

  return {
    id,
    label,
    profile: SCAFFOLD_DAY_RATE_PROFILE,
    unit: 'day',
    qty,
    unit_cost_ex_gst: roundMoney(dayRateExGst),
    line_cost_ex_gst: roundMoney(qty * dayRateExGst),
  };
}

function classifyWarningLevel(message: string): WarningLevelV1 {
  const m = message.toLowerCase();

  // Hard failures / missing costs.
  if (m.includes('no pricebook') || m.includes('not found in materials pricebook') || m.includes('could not allocate bars')) {
    return 'critical';
  }

  if (m.includes('skipping acrylic materials')) return 'critical';
  if (m.includes('acrylic slope exceeds')) return 'critical';
  if (m.includes('hardware placeholder item') && m.includes('not found')) return 'critical';
  if (m.includes('install action') && m.includes('skipped')) return 'critical';
  if (m.includes('invalid crew hour rate')) return 'critical';
  if (m.includes('invalid')) return 'critical';

  // Required inputs missing.
  if (m.includes('is required') && m.includes('currently set to 0')) return 'critical';
  if (m.includes('must include') && m.includes('at least one module')) return 'critical';

  return 'info';
}

function toWarnings(messages: string[]): WarningV1[] {
  const warnings: WarningV1[] = [];
  const seen = new Set<string>();

  for (const raw of messages) {
    const message = String(raw ?? '').trim();
    if (!message) continue;
    if (seen.has(message)) continue;
    seen.add(message);
    warnings.push({ level: classifyWarningLevel(message), message });
  }

  return warnings;
}

function withModuleInfills(
  normalized: CostOutputV1['inputs_normalized'],
  moduleInput: Pick<CostInputsV1, 'infills'>,
): CostOutputV1['inputs_normalized'] {
  const infills = Array.isArray(moduleInput.infills) && moduleInput.infills.length > 0 ? moduleInput.infills : undefined;
  if (!infills) return normalized;
  return { ...normalized, infills };
}

type InstallResult = ReturnType<typeof buildInstallV1>;

function mergeInstallResults(base: InstallResult, extra: InstallResult): InstallResult {
  const actions = [...base.install.actions, ...extra.install.actions].sort((a, b) => a.id.localeCompare(b.id));
  const crewMinutes = roundMoney(actions.reduce((acc, a) => acc + a.minutes, 0));
  const crewHours = roundMoney(crewMinutes / 60);
  const installExGst = roundMoney(actions.reduce((acc, a) => acc + a.cost_ex_gst, 0));
  return {
    install: {
      actions,
      totals: {
        crew_minutes: crewMinutes,
        crew_hours: crewHours,
        install_ex_gst: installExGst,
      },
    },
    notes_and_warnings: [...base.notes_and_warnings, ...extra.notes_and_warnings],
  };
}

function computeDayCycle(
  inputs: CostOutputV1['inputs_normalized'],
  derived: Record<string, unknown>,
  config: CostingConfigV1,
  baseCrewHours: number,
): { siteDays: number; dayCycle: InstallResult } {
  const siteDays0 = computeSiteDays(baseCrewHours, config);
  let dayCycle = buildDayCycleActions(inputs, derived, config, siteDays0);
  let siteDays = siteDays0;

  const siteDays1 = computeSiteDays(baseCrewHours + dayCycle.install.totals.crew_hours, config);
  if (siteDays1 > siteDays0) {
    siteDays = siteDays1;
    dayCycle = buildDayCycleActions(inputs, derived, config, siteDays);
  }

  return { siteDays, dayCycle };
}

export function calculateCostV1(inputs: CostInputsV1, config?: CostingConfigV1): CostOutputV1 {
  const cfg = config ?? loadCostingConfigV1();

  const derivedResult = normalizeAndDeriveV1(inputs, cfg);
  const inputsForMaterials = withModuleInfills(derivedResult.inputs_normalized, inputs);

  const materialsResult = buildMaterialsV1(inputsForMaterials, derivedResult.derived, cfg);
  const derivedWithPatch = { ...derivedResult.derived, ...(materialsResult.derived_patch ?? {}) };
  const overheadFlags = deriveOverheadFlagsForModule({
    inputs_normalized: derivedResult.inputs_normalized,
    derived: derivedWithPatch,
  });

  const baseInstall = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
    excludeActionIds: DAY_CYCLE_ACTION_IDS,
  });
  const baseInstallWithStartup: InstallResult = {
    install: addBoxPerimeterStartupToInstall(baseInstall.install, cfg, overheadFlags.has_box_perimeter),
    notes_and_warnings: baseInstall.notes_and_warnings,
  };
  const { siteDays, dayCycle } = computeDayCycle(
    derivedResult.inputs_normalized,
    derivedWithPatch as any,
    cfg,
    baseInstallWithStartup.install.totals.crew_hours,
  );
  const installResult = mergeInstallResults(baseInstallWithStartup, dayCycle);

  derivedWithPatch.site_days = siteDays;

  const overheadResult = buildOverheadV1(cfg, {
    module_count: 1,
    total_crew_hours: installResult.install.totals.crew_hours,
    has_gable: overheadFlags.has_gable,
    has_box_perimeter: overheadFlags.has_box_perimeter,
    has_timber_or_mixed: overheadFlags.has_timber_or_mixed,
    has_acrylic_only: overheadFlags.has_acrylic_only,
    all_pitched_acrylic: overheadFlags.all_pitched_acrylic,
    max_acrylic_rafter_length_m: overheadFlags.max_acrylic_rafter_length_m,
  });

  const notes_and_warnings = [
    ...derivedResult.notes_and_warnings,
    ...materialsResult.notes_and_warnings,
    ...installResult.notes_and_warnings,
    ...overheadResult.notes_and_warnings,
  ];
  const warnings = toWarnings(notes_and_warnings);

  const addOnsBase: CostOutputV1['add_ons'] = {
    travel_ex_gst: roundMoney(derivedResult.inputs_normalized.travel_ex_gst),
    extras_allowance_ex_gst: roundMoney(derivedResult.inputs_normalized.extras_allowance_ex_gst),
  };

  const overheadExGst = cfg.overheads.include_in_total_cost ? overheadResult.overhead.total_ex_gst : 0;

  const costExGst = roundMoney(
    materialsResult.materials.totals.materials_ex_gst +
      installResult.install.totals.install_ex_gst +
      overheadExGst +
      addOnsBase.travel_ex_gst +
      addOnsBase.extras_allowance_ex_gst,
  );

  const costIncGst = roundMoney(applyGst(costExGst));

  return {
    inputs_normalized: derivedResult.inputs_normalized,
    derived: derivedWithPatch,
    materials: materialsResult.materials,
    infill_takeoff: materialsResult.infill_takeoff,
    install: installResult.install,
    overhead: overheadResult.overhead,
    add_ons: addOnsBase,
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: costIncGst,
      warnings,
      notes_and_warnings,
    },
  };
}

export function calculateCostV1WithMaterialsExplain(
  inputs: CostInputsV1,
  opts?: MaterialsExplainOptions,
  config?: CostingConfigV1,
): { output: CostOutputV1; materials_explain: MaterialsExplainV1 } {
  const cfg = config ?? loadCostingConfigV1();

  const derivedResult = normalizeAndDeriveV1(inputs, cfg);
  const inputsForMaterials = withModuleInfills(derivedResult.inputs_normalized, inputs);

  const materialsResult = buildMaterialsV1Explain(inputsForMaterials, derivedResult.derived, cfg, opts);
  const derivedWithPatch = { ...derivedResult.derived, ...(materialsResult.result.derived_patch ?? {}) };
  const overheadFlags = deriveOverheadFlagsForModule({
    inputs_normalized: derivedResult.inputs_normalized,
    derived: derivedWithPatch,
  });

  const baseInstall = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
    excludeActionIds: DAY_CYCLE_ACTION_IDS,
  });
  const baseInstallWithStartup: InstallResult = {
    install: addBoxPerimeterStartupToInstall(baseInstall.install, cfg, overheadFlags.has_box_perimeter),
    notes_and_warnings: baseInstall.notes_and_warnings,
  };
  const { siteDays, dayCycle } = computeDayCycle(
    derivedResult.inputs_normalized,
    derivedWithPatch as any,
    cfg,
    baseInstallWithStartup.install.totals.crew_hours,
  );
  const installResult = mergeInstallResults(baseInstallWithStartup, dayCycle);

  derivedWithPatch.site_days = siteDays;

  const overheadResult = buildOverheadV1(cfg, {
    module_count: 1,
    total_crew_hours: installResult.install.totals.crew_hours,
    has_gable: overheadFlags.has_gable,
    has_box_perimeter: overheadFlags.has_box_perimeter,
    has_timber_or_mixed: overheadFlags.has_timber_or_mixed,
    has_acrylic_only: overheadFlags.has_acrylic_only,
    all_pitched_acrylic: overheadFlags.all_pitched_acrylic,
    max_acrylic_rafter_length_m: overheadFlags.max_acrylic_rafter_length_m,
  });

  const notes_and_warnings = [
    ...derivedResult.notes_and_warnings,
    ...materialsResult.result.notes_and_warnings,
    ...installResult.notes_and_warnings,
    ...overheadResult.notes_and_warnings,
  ];
  const warnings = toWarnings(notes_and_warnings);

  const addOnsBase: CostOutputV1['add_ons'] = {
    travel_ex_gst: roundMoney(derivedResult.inputs_normalized.travel_ex_gst),
    extras_allowance_ex_gst: roundMoney(derivedResult.inputs_normalized.extras_allowance_ex_gst),
  };

  const overheadExGst = cfg.overheads.include_in_total_cost ? overheadResult.overhead.total_ex_gst : 0;

  const costExGst = roundMoney(
    materialsResult.result.materials.totals.materials_ex_gst +
      installResult.install.totals.install_ex_gst +
      overheadExGst +
      addOnsBase.travel_ex_gst +
      addOnsBase.extras_allowance_ex_gst,
  );

  const costIncGst = roundMoney(applyGst(costExGst));

  const output: CostOutputV1 = {
    inputs_normalized: derivedResult.inputs_normalized,
    derived: derivedWithPatch,
    materials: materialsResult.result.materials,
    infill_takeoff: materialsResult.result.infill_takeoff,
    install: installResult.install,
    overhead: overheadResult.overhead,
    add_ons: addOnsBase,
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: costIncGst,
      warnings,
      notes_and_warnings,
    },
  };

  return {
    output,
    materials_explain: materialsResult.explain,
  };
}

function mergeWasteMaps(maps: Array<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      const next = (out[k] ?? 0) + (Number.isFinite(v) ? v : 0);
      out[k] = roundMoney(next);
    }
  }
  return out;
}

function mergeBarsMaps(
  maps: Array<Record<string, { stock_length_m: number; bars_used: number }>>,
): Record<string, { stock_length_m: number; bars_used: number }> {
  const out: Record<string, { stock_length_m: number; bars_used: number }> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      const barsUsed = Number(v?.bars_used ?? 0);
      const stockLen = Number(v?.stock_length_m ?? 0);
      const prev = out[k];
      if (!prev) {
        out[k] = {
          stock_length_m: Number.isFinite(stockLen) ? stockLen : 0,
          bars_used: Number.isFinite(barsUsed) ? barsUsed : 0,
        };
        continue;
      }
      out[k] = {
        stock_length_m: Math.max(prev.stock_length_m, Number.isFinite(stockLen) ? stockLen : 0),
        bars_used: roundMoney(prev.bars_used + (Number.isFinite(barsUsed) ? barsUsed : 0)),
      };
    }
  }
  return out;
}

export function calculateJobCostV1(inputs: JobInputsV1, config?: CostingConfigV1): JobOutputV1 {
  const cfg = config ?? loadCostingConfigV1();
  if (!Array.isArray(inputs.modules) || inputs.modules.length === 0) {
    throw new Error('Job inputs must include at least one module.');
  }

  const jobType = normalizeJobType(inputs.job_type);
  const jobTravel = roundMoney(Number(inputs.travel_ex_gst ?? 0));
  const jobExtras = roundMoney(Number(inputs.extras_allowance_ex_gst ?? 0));

  const modules: CostOutputV1[] = [];
  const jobMaterialsLines: MaterialsLineV1[] = [];
  const jobInstallActions: InstallActionV1[] = [];
  const warnings: string[] = [];

  for (let idx = 0; idx < inputs.modules.length; idx += 1) {
    const moduleInput = inputs.modules[idx] as CostInputsV1;
    const derivedResult = normalizeAndDeriveV1(
      {
        ...moduleInput,
        travel_ex_gst: 0,
        extras_allowance_ex_gst: 0,
        quote_discount_pct: 0,
      },
      cfg,
    );
    const inputsForMaterials = withModuleInfills(derivedResult.inputs_normalized, moduleInput);

    const materialsResult = buildMaterialsV1(inputsForMaterials, derivedResult.derived, cfg, {
      module_id: `module-${idx + 1}`,
      scope_id: `module-${idx + 1}`,
    });
    const derivedWithPatch = { ...derivedResult.derived, ...(materialsResult.derived_patch ?? {}) };
    const installResult = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
      scope: 'module',
      excludeActionIds: DAY_CYCLE_ACTION_IDS,
    });

    const moduleWarnings = [
      ...derivedResult.notes_and_warnings,
      ...materialsResult.notes_and_warnings,
      ...installResult.notes_and_warnings,
    ];
    const moduleWarningsTyped = toWarnings(moduleWarnings);

    const moduleCostExGst = roundMoney(materialsResult.materials.totals.materials_ex_gst + installResult.install.totals.install_ex_gst);

    const moduleCostIncGst = roundMoney(applyGst(moduleCostExGst));

    const moduleOutput: CostOutputV1 = {
      inputs_normalized: derivedResult.inputs_normalized,
      derived: derivedWithPatch,
      materials: materialsResult.materials,
      infill_takeoff: materialsResult.infill_takeoff,
      install: installResult.install,
      overhead: {
        method: 'job_rollup',
        ops_ex_gst: 0,
        sales_ex_gst: 0,
        total_ex_gst: 0,
      },
      add_ons: {
        travel_ex_gst: 0,
        extras_allowance_ex_gst: 0,
      },
      totals: {
        cost_ex_gst: moduleCostExGst,
        cost_inc_gst: moduleCostIncGst,
        warnings: moduleWarningsTyped,
        notes_and_warnings: moduleWarnings,
      },
    };

    modules.push(moduleOutput);

    for (const line of materialsResult.materials.lines) {
      jobMaterialsLines.push({
        ...line,
        id: `m${idx + 1}.${line.id}`,
        label: `[M${idx + 1}] ${line.label}`,
      });
    }

    for (const action of installResult.install.actions) {
      jobInstallActions.push({
        ...action,
        id: `m${idx + 1}.${action.id}`,
        label: `[M${idx + 1}] ${action.label}`,
      });
    }

    if (moduleWarnings.length) {
      warnings.push(...moduleWarnings.map((w) => `[Module ${idx + 1}] ${w}`));
    }
  }

  const jobInfillTakeoff = poolInfillsTakeoffsV1(
    modules.map((module) => module.infill_takeoff),
    { scope_id: 'job' },
    cfg,
  );

  const overheadFlags = deriveOverheadFlagsForModules(modules);
  const jobPergolaPitchDeg = resolvePergolaPitchDeg(modules);
  const jobPergolaAreaM2 = resolvePergolaAreaM2(modules);
  const jobRequiresScaffolding = requiresScaffolding(jobType, jobPergolaPitchDeg);
  const jobScaffoldingDayRateExGst = jobRequiresScaffolding ? resolveScaffoldingDayRateExGst(jobType, jobPergolaAreaM2) : 0;
  const jobScaffoldingActions = buildScaffoldingLabourActions(cfg, jobRequiresScaffolding ? 1 : 0);

  const pooledJobInfillLines = pooledInfillMaterialLines(jobMaterialsLines, jobInfillTakeoff, cfg);
  jobMaterialsLines.length = 0;
  jobMaterialsLines.push(...pooledJobInfillLines);

  // Job-scoped actions run once (if configured).
  const jobScopedActions = new Map<string, InstallActionV1>();
  const jobHasOurGutter = modules.some((module) => Boolean((module.derived as any).has_our_gutter));
  for (const module of modules) {
    const jobDerived = { ...module.derived, module_count: modules.length, has_our_gutter: jobHasOurGutter };
    const jobInstall = buildInstallV1(module.inputs_normalized, jobDerived as any, cfg, {
      scope: 'job',
      excludeActionIds: DAY_CYCLE_ACTION_IDS,
    });
    for (const action of jobInstall.install.actions) {
      const existing = jobScopedActions.get(action.id);
      if (!existing || action.minutes > existing.minutes) jobScopedActions.set(action.id, action);
    }
    warnings.push(...jobInstall.notes_and_warnings.map((w) => `[Job] ${w}`));
  }

  const jobActions = Array.from(jobScopedActions.values()).sort((a, b) => a.id.localeCompare(b.id));
  for (const action of jobScaffoldingActions) {
    if (!jobActions.some((existing) => existing.id === action.id)) jobActions.push(action);
  }
  if (overheadFlags.has_box_perimeter && !jobActions.some((a) => a.id === BOX_PERIMETER_STARTUP_ACTION_ID)) {
    jobActions.push(buildBoxPerimeterStartupAction(cfg));
  }
  jobActions.sort((a, b) => a.id.localeCompare(b.id));
  for (const action of jobActions) {
    jobInstallActions.push({ ...action, id: `job.${action.id}`, label: `[Job] ${action.label}` });
  }

  const baseCrewMinutes = roundMoney(
    modules.reduce((acc, m) => acc + m.install.totals.crew_minutes, 0) + jobActions.reduce((acc, a) => acc + a.minutes, 0),
  );
  const baseCrewHours = roundMoney(baseCrewMinutes / 60);

  const buildJobDayCycle = (siteDays: number) => {
    const dayCycleActions = new Map<string, InstallActionV1>();
    const dayWarnings: string[] = [];

    for (const module of modules) {
      const jobDerived = { ...module.derived, module_count: modules.length };
      const dayResult = buildDayCycleActions(module.inputs_normalized, jobDerived as any, cfg, siteDays);
      for (const action of dayResult.install.actions) {
        const existing = dayCycleActions.get(action.id);
        if (!existing || action.minutes > existing.minutes) dayCycleActions.set(action.id, action);
      }
      dayWarnings.push(...dayResult.notes_and_warnings.map((w) => `[Job] ${w}`));
    }

    const actions = Array.from(dayCycleActions.values()).sort((a, b) => a.id.localeCompare(b.id));
    const crewMinutes = roundMoney(actions.reduce((acc, a) => acc + a.minutes, 0));
    const crewHours = roundMoney(crewMinutes / 60);
    const installExGst = roundMoney(actions.reduce((acc, a) => acc + a.cost_ex_gst, 0));

    return { actions, crewMinutes, crewHours, installExGst, warnings: dayWarnings };
  };

  let siteDays = computeSiteDays(baseCrewHours, cfg);
  let dayCycle = buildJobDayCycle(siteDays);
  const siteDaysRecalc = computeSiteDays(baseCrewHours + dayCycle.crewHours, cfg);
  if (siteDaysRecalc > siteDays) {
    siteDays = siteDaysRecalc;
    dayCycle = buildJobDayCycle(siteDays);
  }

  warnings.push(...dayCycle.warnings);

  for (const action of dayCycle.actions) {
    jobInstallActions.push({ ...action, id: `job.${action.id}`, label: `[Job] ${action.label}` });
  }

  for (const module of modules) {
    module.derived = { ...module.derived, site_days: siteDays };
  }

  if (jobRequiresScaffolding) {
    const scaffoldingLine = buildScaffoldingDayRateLine(
      SCAFFOLD_DAY_RATE_LINE_ID,
      SCAFFOLD_DAY_RATE_LABEL,
      siteDays,
      jobScaffoldingDayRateExGst,
    );
    if (scaffoldingLine) {
      jobMaterialsLines.push(scaffoldingLine);
    }
  }

  const crewMinutesTotal = roundMoney(baseCrewMinutes + dayCycle.crewMinutes);
  const crewHoursTotal = roundMoney(crewMinutesTotal / 60);

  const materialsTotal = roundMoney(jobMaterialsLines.reduce((acc, line) => acc + Number(line.line_cost_ex_gst ?? 0), 0));
  const installTotal = roundMoney(
    modules.reduce((acc, m) => acc + m.install.totals.install_ex_gst, 0) +
      jobActions.reduce((acc, a) => acc + a.cost_ex_gst, 0) +
      dayCycle.installExGst,
  );

  const overheadResult = buildOverheadV1(cfg, {
    module_count: modules.length,
    total_crew_hours: crewHoursTotal,
    has_gable: overheadFlags.has_gable,
    has_box_perimeter: overheadFlags.has_box_perimeter,
    has_timber_or_mixed: overheadFlags.has_timber_or_mixed,
    has_acrylic_only: overheadFlags.has_acrylic_only,
    all_pitched_acrylic: overheadFlags.all_pitched_acrylic,
    max_acrylic_rafter_length_m: overheadFlags.max_acrylic_rafter_length_m,
  });
  warnings.push(...overheadResult.notes_and_warnings.map((w) => `[Overhead] ${w}`));

  const overheadExGst = cfg.overheads.include_in_total_cost ? overheadResult.overhead.total_ex_gst : 0;

  const costExGst = roundMoney(materialsTotal + installTotal + overheadExGst + jobTravel + jobExtras);
  const costIncGst = roundMoney(applyGst(costExGst));

  jobMaterialsLines.sort((a, b) => a.id.localeCompare(b.id));
  jobInstallActions.sort((a, b) => a.id.localeCompare(b.id));

  return {
    module_count: modules.length,
    modules,
    infill_takeoff: jobInfillTakeoff,
    materials: {
      lines: jobMaterialsLines,
      totals: {
        materials_ex_gst: materialsTotal,
        waste_m_by_profile: mergeWasteMaps(modules.map((m) => m.materials.totals.waste_m_by_profile)),
        bars_by_profile: mergeBarsMaps(modules.map((m) => m.materials.totals.bars_by_profile)),
      },
    },
    install: {
      actions: jobInstallActions,
      totals: {
        crew_minutes: crewMinutesTotal,
        crew_hours: crewHoursTotal,
        install_ex_gst: installTotal,
      },
    },
    overhead: overheadResult.overhead,
    add_ons: {
      travel_ex_gst: jobTravel,
      extras_allowance_ex_gst: jobExtras,
    },
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: costIncGst,
      warnings: toWarnings(warnings),
      notes_and_warnings: warnings,
    },
  };
}

function normalizePergolaId(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : fallback;
}

function normalizePergolaLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function calculateSiteCostV1Internal(
  inputs: SiteInputsV1,
  config: CostingConfigV1 | undefined,
  includeInfillBaseline: boolean,
): SiteOutputV1 {
  const cfg = config ?? loadCostingConfigV1();
  if (!Array.isArray(inputs.pergolas) || inputs.pergolas.length === 0) {
    throw new Error('Site inputs must include at least one pergola.');
  }

  const jobType = normalizeJobType(inputs.job_type);
  const jobTravel = roundMoney(Number(inputs.travel_ex_gst ?? 0));
  const jobExtras = roundMoney(Number(inputs.extras_allowance_ex_gst ?? 0));
  const commercialPolicyEnabled = isCommercialPolicyV2Enabled(cfg);
  const pricingPolicy = commercialPolicyEnabled ? resolveSitePricingPolicyV2(inputs, cfg) : undefined;

  const warnings: string[] = [];

  const pergolasNormalized = inputs.pergolas.map((raw, idx) => {
    const baseId = normalizePergolaId((raw as any)?.id, `pergola-${idx + 1}`);
    return {
      id: baseId,
      label: normalizePergolaLabel((raw as any)?.label),
      modules: (raw as PergolaInputsV1)?.modules ?? [],
    };
  });

  // Ensure unique IDs.
  const seenPergolaIds = new Set<string>();
  for (const p of pergolasNormalized) {
    if (!seenPergolaIds.has(p.id)) {
      seenPergolaIds.add(p.id);
      continue;
    }
    let n = 2;
    while (seenPergolaIds.has(`${p.id}-${n}`)) n += 1;
    p.id = `${p.id}-${n}`;
    seenPergolaIds.add(p.id);
  }

  const modulesAll: CostOutputV1[] = [];
  const siteMaterialsLines: MaterialsLineV1[] = [];
  const siteInstallActions: InstallActionV1[] = [];
  const pergolaOutputs: PergolaOutputV1[] = [];

  let globalModuleIdx = 0;

  for (let pIdx = 0; pIdx < pergolasNormalized.length; pIdx += 1) {
    const pergola = pergolasNormalized[pIdx];
    if (!Array.isArray(pergola.modules) || pergola.modules.length === 0) {
      throw new Error(`Pergola ${pIdx + 1} must include at least one module.`);
    }

    const pergolaModules: CostOutputV1[] = [];
    const pergolaMaterialsLines: MaterialsLineV1[] = [];
    const pergolaInstallActions: InstallActionV1[] = [];
    const pergolaNotes: string[] = [];

    for (let mIdx = 0; mIdx < pergola.modules.length; mIdx += 1) {
      const moduleInput = pergola.modules[mIdx] as CostInputsV1;
      const derivedResult = normalizeAndDeriveV1(
        {
          ...moduleInput,
          travel_ex_gst: 0,
          extras_allowance_ex_gst: 0,
          quote_discount_pct: 0,
        },
        cfg,
      );
      const inputsForMaterials = withModuleInfills(derivedResult.inputs_normalized, moduleInput);

      const scopedModuleId = `${pergola.id}.module-${mIdx + 1}`;
      const materialsResult = buildMaterialsV1(inputsForMaterials, derivedResult.derived, cfg, {
        module_id: scopedModuleId,
        scope_id: scopedModuleId,
      });
      const derivedWithPatch = { ...derivedResult.derived, ...(materialsResult.derived_patch ?? {}) };
      const installResult = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
        scope: 'module',
        excludeActionIds: DAY_CYCLE_ACTION_IDS,
      });

      const moduleNotes = [...derivedResult.notes_and_warnings, ...materialsResult.notes_and_warnings, ...installResult.notes_and_warnings];
      if (moduleNotes.length) {
        warnings.push(...moduleNotes.map((w) => `[Pergola ${pIdx + 1} Module ${mIdx + 1}] ${w}`));
        pergolaNotes.push(...moduleNotes.map((w) => `[Module ${mIdx + 1}] ${w}`));
      }
      const moduleWarningsTyped = toWarnings(moduleNotes);

      const moduleCostExGst = roundMoney(materialsResult.materials.totals.materials_ex_gst + installResult.install.totals.install_ex_gst);
      const moduleCostIncGst = roundMoney(applyGst(moduleCostExGst));

      const moduleOutput: CostOutputV1 = {
        inputs_normalized: derivedResult.inputs_normalized,
        derived: derivedWithPatch,
        materials: materialsResult.materials,
        infill_takeoff: materialsResult.infill_takeoff,
        install: installResult.install,
        overhead: {
          method: 'site_rollup',
          ops_ex_gst: 0,
          sales_ex_gst: 0,
          total_ex_gst: 0,
        },
        add_ons: {
          travel_ex_gst: 0,
          extras_allowance_ex_gst: 0,
        },
        totals: {
          cost_ex_gst: moduleCostExGst,
          cost_inc_gst: moduleCostIncGst,
          warnings: moduleWarningsTyped,
          notes_and_warnings: moduleNotes,
        },
      };

      pergolaModules.push(moduleOutput);
      modulesAll.push(moduleOutput);

      for (const line of materialsResult.materials.lines) {
        const labelPrefix = pergola.label ? `[${pergola.label} M${mIdx + 1}]` : `[P${pIdx + 1} M${mIdx + 1}]`;
        const globalPrefix = `m${globalModuleIdx + 1}`;
        pergolaMaterialsLines.push({
          ...line,
          id: `m${mIdx + 1}.${line.id}`,
          label: `[M${mIdx + 1}] ${line.label}`,
        });
        siteMaterialsLines.push({
          ...line,
          id: `${globalPrefix}.${line.id}`,
          label: `${labelPrefix} ${line.label}`,
        });
      }

      for (const action of installResult.install.actions) {
        const labelPrefix = pergola.label ? `[${pergola.label} M${mIdx + 1}]` : `[P${pIdx + 1} M${mIdx + 1}]`;
        const globalPrefix = `m${globalModuleIdx + 1}`;
        pergolaInstallActions.push({
          ...action,
          id: `m${mIdx + 1}.${action.id}`,
          label: `[M${mIdx + 1}] ${action.label}`,
        });
        siteInstallActions.push({
          ...action,
          id: `${globalPrefix}.${action.id}`,
          label: `${labelPrefix} ${action.label}`,
        });
      }

      globalModuleIdx += 1;
    }

    const pergolaOverheadFlags = deriveOverheadFlagsForModules(pergolaModules);
    if (pergolaOverheadFlags.has_box_perimeter) {
      const startupAction = buildBoxPerimeterStartupAction(cfg);
      const scopedPergolaAction = {
        ...startupAction,
        id: `job.${startupAction.id}`,
        label: `[Job] ${startupAction.label}`,
      };
      const sitePrefix = pergola.label ? `[${pergola.label}]` : `[P${pIdx + 1}]`;
      const scopedSiteAction = {
        ...startupAction,
        id: `p${pIdx + 1}.job.${startupAction.id}`,
        label: `${sitePrefix} [Job] ${startupAction.label}`,
      };
      pergolaInstallActions.push(scopedPergolaAction);
      siteInstallActions.push(scopedSiteAction);
    }

    const pergolaCrewMinutes = roundMoney(pergolaInstallActions.reduce((acc, a) => acc + a.minutes, 0));
    const pergolaCrewHours = roundMoney(pergolaCrewMinutes / 60);
    const pergolaInfillTakeoff = poolInfillsTakeoffsV1(
      pergolaModules.map((module) => module.infill_takeoff),
      { scope_id: pergola.id },
      cfg,
    );
    const pooledPergolaLines = pooledInfillMaterialLines(pergolaMaterialsLines, pergolaInfillTakeoff, cfg);
    pergolaMaterialsLines.length = 0;
    pergolaMaterialsLines.push(...pooledPergolaLines);
    const pergolaMaterialsTotal = roundMoney(pergolaMaterialsLines.reduce((acc, line) => acc + Number(line.line_cost_ex_gst ?? 0), 0));
    const pergolaInstallTotal = roundMoney(pergolaInstallActions.reduce((acc, a) => acc + a.cost_ex_gst, 0));

    pergolaMaterialsLines.sort((a, b) => a.id.localeCompare(b.id));
    pergolaInstallActions.sort((a, b) => a.id.localeCompare(b.id));

    // Placeholder overhead; computed after we know site shared crew hours to allocate.
    pergolaOutputs.push({
      id: pergola.id,
      ...(pergola.label ? { label: pergola.label } : null),
      module_count: pergolaModules.length,
      modules: pergolaModules,
      infill_takeoff: pergolaInfillTakeoff,
      materials: {
        lines: pergolaMaterialsLines,
        totals: {
          materials_ex_gst: pergolaMaterialsTotal,
          waste_m_by_profile: mergeWasteMaps(pergolaModules.map((m) => m.materials.totals.waste_m_by_profile)),
          bars_by_profile: mergeBarsMaps(pergolaModules.map((m) => m.materials.totals.bars_by_profile)),
        },
      },
      install: {
        actions: pergolaInstallActions,
        totals: {
          crew_minutes: pergolaCrewMinutes,
          crew_hours: pergolaCrewHours,
          install_ex_gst: pergolaInstallTotal,
        },
      },
      overhead: { method: 'pending', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: {
        cost_ex_gst: roundMoney(pergolaMaterialsTotal + pergolaInstallTotal),
        cost_inc_gst: roundMoney(applyGst(pergolaMaterialsTotal + pergolaInstallTotal)),
        warnings: toWarnings(pergolaNotes),
        notes_and_warnings: pergolaNotes,
      },
    });
  }

  if (modulesAll.length === 0) {
    throw new Error('Site inputs must include at least one module.');
  }

  const scaffoldingPergolas = pergolaOutputs
    .map((pergola, idx) => {
      const pergolaPitchDeg = resolvePergolaPitchDeg(pergola.modules);
      const pergolaAreaM2 = resolvePergolaAreaM2(pergola.modules);
      const scaffoldRequired = requiresScaffolding(jobType, pergolaPitchDeg);
      const dayRateExGst = scaffoldRequired ? resolveScaffoldingDayRateExGst(jobType, pergolaAreaM2) : 0;
      return {
        pergolaIdx: idx,
        dayRateExGst,
      };
    })
    .filter((target) => target.dayRateExGst > 0);

  const scaffoldingLabourActions = buildScaffoldingLabourActions(cfg, scaffoldingPergolas.length);

  const siteInfillTakeoff = poolInfillsTakeoffsV1(
    modulesAll.map((module) => module.infill_takeoff),
    { scope_id: 'site' },
    cfg,
  );
  const pooledSiteInfillLines = pooledInfillMaterialLines(siteMaterialsLines, siteInfillTakeoff, cfg);
  siteMaterialsLines.length = 0;
  siteMaterialsLines.push(...pooledSiteInfillLines);

  // Site-scoped actions run once (if configured).
  const jobScopedActions = new Map<string, InstallActionV1>();
  const sharedNotes: string[] = [];
  const jobHasOurGutter = modulesAll.some((module) => Boolean((module.derived as any).has_our_gutter));
  for (const module of modulesAll) {
    const jobDerived = { ...module.derived, module_count: modulesAll.length, has_our_gutter: jobHasOurGutter };
    const jobInstall = buildInstallV1(module.inputs_normalized, jobDerived as any, cfg, {
      scope: 'job',
      excludeActionIds: DAY_CYCLE_ACTION_IDS,
    });
    for (const action of jobInstall.install.actions) {
      const existing = jobScopedActions.get(action.id);
      if (!existing || action.minutes > existing.minutes) jobScopedActions.set(action.id, action);
    }
    sharedNotes.push(...jobInstall.notes_and_warnings.map((w) => `[Site] ${w}`));
    warnings.push(...jobInstall.notes_and_warnings.map((w) => `[Site] ${w}`));
  }

  const sharedInstallActions: InstallActionV1[] = [];
  const jobActions = Array.from(jobScopedActions.values()).sort((a, b) => a.id.localeCompare(b.id));
  for (const action of scaffoldingLabourActions) {
    if (!jobActions.some((existing) => existing.id === action.id)) jobActions.push(action);
  }
  jobActions.sort((a, b) => a.id.localeCompare(b.id));
  for (const action of jobActions) {
    const scoped = { ...action, id: `job.${action.id}`, label: `[Job] ${action.label}` };
    siteInstallActions.push(scoped);
    sharedInstallActions.push(scoped);
  }

  const baseCrewMinutes = roundMoney(
    pergolaOutputs.reduce((acc, pergola) => acc + pergola.install.totals.crew_minutes, 0) + jobActions.reduce((acc, a) => acc + a.minutes, 0),
  );
  const baseCrewHours = roundMoney(baseCrewMinutes / 60);
  const siteDayPolicy = resolveSiteDayCyclePolicyV1({
    config: cfg,
    pricingPolicy,
    baseCrewHours,
    installActions: siteInstallActions,
    modules: modulesAll,
  });
  const { siteDays, dayCycle } = siteDayPolicy;

  sharedNotes.push(...dayCycle.warnings);
  warnings.push(...dayCycle.warnings);

  for (const action of dayCycle.actions) {
    const scoped = { ...action, id: `job.${action.id}`, label: `[Job] ${action.label}` };
    siteInstallActions.push(scoped);
    sharedInstallActions.push(scoped);
  }

  for (const module of modulesAll) {
    module.derived = { ...module.derived, site_days: siteDays };
  }

  let scaffoldingMaterialsTotal = 0;
  for (const target of scaffoldingPergolas) {
    const pergola = pergolaOutputs[target.pergolaIdx];
    if (!pergola) continue;
    const pergolaLine = buildScaffoldingDayRateLine(
      SCAFFOLD_DAY_RATE_LINE_ID,
      SCAFFOLD_DAY_RATE_LABEL,
      siteDays,
      target.dayRateExGst,
    );
    if (!pergolaLine) continue;

    pergola.materials.lines.push(pergolaLine);
    pergola.materials.lines.sort((a, b) => a.id.localeCompare(b.id));
    pergola.materials.totals.materials_ex_gst = roundMoney(
      Number(pergola.materials.totals.materials_ex_gst ?? 0) + Number(pergolaLine.line_cost_ex_gst ?? 0),
    );

    const pergolaPrefix = pergola.label ? `[${pergola.label}]` : `[P${target.pergolaIdx + 1}]`;
    siteMaterialsLines.push({
      ...pergolaLine,
      id: `p${target.pergolaIdx + 1}.${SCAFFOLD_DAY_RATE_LINE_ID}`,
      label: `${pergolaPrefix} ${SCAFFOLD_DAY_RATE_LABEL}`,
    });

    scaffoldingMaterialsTotal = roundMoney(scaffoldingMaterialsTotal + Number(pergolaLine.line_cost_ex_gst ?? 0));
  }

  const crewMinutesTotal = roundMoney(baseCrewMinutes + dayCycle.crewMinutes);
  const crewHoursTotal = roundMoney(crewMinutesTotal / 60);

  const materialsTotal = roundMoney(siteMaterialsLines.reduce((acc, line) => acc + Number(line.line_cost_ex_gst ?? 0), 0));
  const moduleInstallTotal = roundMoney(pergolaOutputs.reduce((acc, pergola) => acc + pergola.install.totals.install_ex_gst, 0));
  const jobActionsTotal = roundMoney(jobActions.reduce((acc, a) => acc + a.cost_ex_gst, 0));
  const sharedInstallTotal = roundMoney(jobActionsTotal + dayCycle.installExGst);
  const installTotal = roundMoney(moduleInstallTotal + sharedInstallTotal);

  const sharedCrewMinutes = roundMoney(jobActions.reduce((acc, a) => acc + a.minutes, 0) + dayCycle.crewMinutes);
  const sharedCrewHours = roundMoney(sharedCrewMinutes / 60);

  let overheadOpsSum = 0;
  let overheadSalesSum = 0;
  let overheadTotalSum = 0;

  for (let idx = 0; idx < pergolaOutputs.length; idx += 1) {
    const pergola = pergolaOutputs[idx];
    const pergolaFlags = deriveOverheadFlagsForModules(pergola.modules);
    const overheadResult = pricingPolicy?.resolved_classification === 'simple'
      ? { overhead: buildSimpleRangeOverheadV2(cfg, siteDayPolicy.productiveCrewHours ?? crewHoursTotal), notes_and_warnings: [] }
      : buildOverheadV1(cfg, {
          module_count: pergola.module_count,
          total_crew_hours: Number(pergola.install.totals.crew_hours ?? 0),
          has_gable: pergolaFlags.has_gable,
          has_box_perimeter: pergolaFlags.has_box_perimeter,
          has_timber_or_mixed: pergolaFlags.has_timber_or_mixed,
          has_acrylic_only: pergolaFlags.has_acrylic_only,
          all_pitched_acrylic: pergolaFlags.all_pitched_acrylic,
          max_acrylic_rafter_length_m: pergolaFlags.max_acrylic_rafter_length_m,
        });

    if (overheadResult.notes_and_warnings.length) {
      const prefix = pergola.label ? `[Pergola ${pergola.label}]` : `[Pergola ${idx + 1}]`;
      const overheadNotes = overheadResult.notes_and_warnings.map((w) => `${prefix} ${w}`);
      warnings.push(...overheadNotes);
      pergola.totals.notes_and_warnings.push(...overheadNotes);
      pergola.totals.warnings = toWarnings(pergola.totals.notes_and_warnings);
    }

    pergola.overhead = overheadResult.overhead;

    const overheadExGst = cfg.overheads.include_in_total_cost ? overheadResult.overhead.total_ex_gst : 0;
    pergola.totals.cost_ex_gst = roundMoney(pergola.materials.totals.materials_ex_gst + pergola.install.totals.install_ex_gst + overheadExGst);
    pergola.totals.cost_inc_gst = roundMoney(applyGst(pergola.totals.cost_ex_gst));
    pergola.infill_cost_breakdown = buildPergolaInfillCostBreakdownV1(pergola);

    overheadOpsSum += Number(overheadResult.overhead.ops_ex_gst ?? 0);
    overheadSalesSum += Number(overheadResult.overhead.sales_ex_gst ?? 0);
    overheadTotalSum += Number(overheadResult.overhead.total_ex_gst ?? 0);
  }

  const overhead: SiteOutputV1['overhead'] = {
    method: pergolaOutputs.length === 1 ? pergolaOutputs[0].overhead.method : 'site_rollup',
    ops_ex_gst: roundMoney(overheadOpsSum),
    sales_ex_gst: roundMoney(overheadSalesSum),
    total_ex_gst: roundMoney(overheadTotalSum),
  };

  const overheadExGstUsed = cfg.overheads.include_in_total_cost ? overhead.total_ex_gst : 0;

  const addOns: SiteOutputV1['add_ons'] = {
    travel_ex_gst: jobTravel,
    extras_allowance_ex_gst: jobExtras,
  };

  const sharedCostExGst = roundMoney(sharedInstallTotal + addOns.travel_ex_gst + addOns.extras_allowance_ex_gst);
  const sharedCostIncGst = roundMoney(applyGst(sharedCostExGst));

  const costExGst = roundMoney(materialsTotal + installTotal + overheadExGstUsed + addOns.travel_ex_gst + addOns.extras_allowance_ex_gst);
  const costIncGst = roundMoney(applyGst(costExGst));

  siteMaterialsLines.sort((a, b) => a.id.localeCompare(b.id));
  siteInstallActions.sort((a, b) => a.id.localeCompare(b.id));
  sharedInstallActions.sort((a, b) => a.id.localeCompare(b.id));
  const siteMaterialsTotals: SiteOutputV1['materials']['totals'] = {
    materials_ex_gst: materialsTotal,
    waste_m_by_profile: mergeWasteMaps(modulesAll.map((m) => m.materials.totals.waste_m_by_profile)),
    bars_by_profile: mergeBarsMaps(modulesAll.map((m) => m.materials.totals.bars_by_profile)),
  };
  const siteInstallTotals: SiteOutputV1['install']['totals'] = {
    crew_minutes: crewMinutesTotal,
    crew_hours: crewHoursTotal,
    install_ex_gst: installTotal,
  };

  const output: SiteOutputV1 = {
    pergola_count: pergolaOutputs.length,
    pergolas: pergolaOutputs,
    infill_takeoff: siteInfillTakeoff,
    shared: {
      install: {
        actions: sharedInstallActions,
        totals: {
          crew_minutes: sharedCrewMinutes,
          crew_hours: sharedCrewHours,
          install_ex_gst: sharedInstallTotal,
        },
      },
      add_ons: addOns,
      totals: {
        cost_ex_gst: sharedCostExGst,
        cost_inc_gst: sharedCostIncGst,
        warnings: toWarnings(sharedNotes),
        notes_and_warnings: sharedNotes,
      },
    },
    materials: {
      lines: siteMaterialsLines,
      totals: siteMaterialsTotals,
      trusted_breakdown: buildTrustedMaterialsBreakdownV1(siteMaterialsLines),
    },
    install: {
      actions: siteInstallActions,
      totals: siteInstallTotals,
      trusted_breakdown: buildTrustedLabourBreakdownV1(siteInstallActions, siteInstallTotals),
    },
    overhead,
    add_ons: addOns,
    totals: {
      cost_ex_gst: costExGst,
      cost_inc_gst: costIncGst,
      warnings: toWarnings(warnings),
      notes_and_warnings: warnings,
    },
    ...(pricingPolicy
      ? {
          pricing_policy: pricingPolicy,
          customer_add_ons: {
            approval: calculateApprovalCustomerAllowanceV2(inputs, cfg),
          },
        }
      : null),
  };

  if (includeInfillBaseline && siteInfillTakeoff.items.length > 0) {
    const baseline = calculateSiteCostV1Internal(withoutSiteInfillsV1(inputs), cfg, false);
    applySiteInfillIncrementalBaselineV2(output, baseline);
  }

  return output;
}

export function calculateSiteCostV1(inputs: SiteInputsV1, config?: CostingConfigV1): SiteOutputV1 {
  return calculateSiteCostV1Internal(inputs, config, true);
}

// ============================================================================
// V2 entry point (PR-2B.4, 2026-05-22)
// ============================================================================
//
// Workbench scene-derived cost input. Per the Phase 2 north star:
// - Cost engine receives pergola data only (no house/deck/opening fields)
// - Logical-pergola grouping comes from scene adjacency (snapped pergolas =
//   modules of same logical pergola); the workbench builder
//   (`buildSiteInputsV2FromScene`) does this derivation
// - Site-level fields (`access`, `height`, `job_type`, travel/extras/discount)
//   lift to the SiteInputsV2 top level
//
// The pricing logic is untouched — we adapt V2 inputs to the existing V1
// shape inside the engine and delegate to `calculateSiteCostV1`. Workbench
// switches to V2 in PR-2B.5; marketing form stays on V1 (per Phase 2 plan
// Q5 "Marketing path stays independent").

/**
 * Adapt a SiteInputsV2 to SiteInputsV1 for the legacy pricing pipeline.
 *
 * Per-module: V2's `id` field is dropped (V1 has no `id` on modules); V2's
 * site-level `access`/`height` lift onto each module (V1 carries them
 * per-module); V1's `travel_ex_gst`/`extras_allowance_ex_gst`/`quote_discount_pct`
 * site-dummy fields zero out per-module (legacy contract carries them but
 * the engine reads them at the site level).
 *
 * Per-pergola: V2's `accessories` slot is dropped (currently always `[]`;
 * pricing wiring lands when the first accessory family ships).
 */
function adaptSiteInputsV2ToV1(inputs: SiteInputsV2): SiteInputsV1 {
  return {
    pergolas: inputs.pergolas.map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
      modules: pergola.modules.map((moduleV2) => {
        // Strip V2-only `id` field via destructure; spread the rest into V1.
        const { id: _moduleId, ...pergolaFields } = moduleV2;
        const moduleV1: CostInputsV1 = {
          ...pergolaFields,
          access: inputs.access,
          height: inputs.height,
          travel_ex_gst: 0,
          extras_allowance_ex_gst: 0,
          quote_discount_pct: 0,
        };
        return moduleV1;
      }),
    })),
    job_type: inputs.job_type,
    travel_ex_gst: inputs.travel_ex_gst,
    extras_allowance_ex_gst: inputs.extras_allowance_ex_gst,
    quote_discount_pct: inputs.quote_discount_pct,
  };
}

/**
 * Scene-derived cost-engine entry. Equivalent to `calculateSiteCostV1` in
 * output shape and pricing logic — just accepts the leaner V2 input shape
 * the workbench produces from the scene. Returns `SiteOutputV1` because
 * the output contract is unchanged (only the input layer is migrating).
 */
export function calculateSiteCostV2(inputs: SiteInputsV2, config?: CostingConfigV1): SiteOutputV1 {
  return calculateSiteCostV1(adaptSiteInputsV2ToV1(inputs), config);
}
