import { loadCostingConfigV1, type CostingConfigV1 } from './config';
import { applyGst, normalizeAndDeriveV1 } from './derive';
import { buildMaterialsV1, buildMaterialsV1Explain } from './bom';
import { buildDayCycleActions, buildInstallV1, computeSiteDays, DAY_CYCLE_ACTION_IDS } from './install';
import { buildOverheadV1 } from './overheads';
import type { CostInputsV1, CostOutputV1, JobInputsV1, JobOutputV1, InstallActionV1, MaterialsLineV1, WarningLevelV1, WarningV1 } from './types';
import type { MaterialsExplainOptions, MaterialsExplainV1 } from './materials_explain';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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

  const baseInstall = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
    excludeActionIds: DAY_CYCLE_ACTION_IDS,
  });
  const { siteDays, dayCycle } = computeDayCycle(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, baseInstall.install.totals.crew_hours);
  const installResult = mergeInstallResults(baseInstall, dayCycle);

  derivedWithPatch.site_days = siteDays;

  const overheadResult = buildOverheadV1(cfg, { module_count: 1, total_crew_hours: installResult.install.totals.crew_hours });

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

  const baseInstall = buildInstallV1(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, {
    excludeActionIds: DAY_CYCLE_ACTION_IDS,
  });
  const { siteDays, dayCycle } = computeDayCycle(derivedResult.inputs_normalized, derivedWithPatch as any, cfg, baseInstall.install.totals.crew_hours);
  const installResult = mergeInstallResults(baseInstall, dayCycle);

  derivedWithPatch.site_days = siteDays;

  const overheadResult = buildOverheadV1(cfg, { module_count: 1, total_crew_hours: installResult.install.totals.crew_hours });

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

    const materialsResult = buildMaterialsV1(inputsForMaterials, derivedResult.derived, cfg);
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

  const infillSheetLinePattern = /^m\d+\.infill\.acrylic_sheet_clear$/;
  const infillSheetLines = jobMaterialsLines.filter((line) => infillSheetLinePattern.test(String(line.id ?? '')));
  if (infillSheetLines.length > 0) {
    const unitCost = Number(infillSheetLines[0]?.unit_cost_ex_gst ?? NaN);
    const costsConsistent =
      Number.isFinite(unitCost) &&
      infillSheetLines.every((line) => Math.abs(Number(line.unit_cost_ex_gst ?? NaN) - unitCost) <= 0.01);

    if (costsConsistent) {
      const pooledQty = roundMoney(infillSheetLines.reduce((acc, line) => acc + Number(line.qty ?? 0), 0));
      if (pooledQty > 0) {
        const filtered = jobMaterialsLines.filter((line) => !infillSheetLinePattern.test(String(line.id ?? '')));
        jobMaterialsLines.length = 0;
        jobMaterialsLines.push(...filtered);
        jobMaterialsLines.push({
          id: 'job.infill.acrylic_sheet_clear',
          label: '[Job] Acrylic sheets (infills pooled)',
          profile: 'Plexi sheet 3050x2030',
          unit: 'sheet',
          qty: pooledQty,
          unit_cost_ex_gst: roundMoney(unitCost),
          line_cost_ex_gst: roundMoney(pooledQty * unitCost),
        });
      }
    }
  }

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

  const crewMinutesTotal = roundMoney(baseCrewMinutes + dayCycle.crewMinutes);
  const crewHoursTotal = roundMoney(crewMinutesTotal / 60);

  const materialsTotal = roundMoney(modules.reduce((acc, m) => acc + m.materials.totals.materials_ex_gst, 0));
  const installTotal = roundMoney(
    modules.reduce((acc, m) => acc + m.install.totals.install_ex_gst, 0) +
      jobActions.reduce((acc, a) => acc + a.cost_ex_gst, 0) +
      dayCycle.installExGst,
  );

  const overheadResult = buildOverheadV1(cfg, { module_count: modules.length, total_crew_hours: crewHoursTotal });
  warnings.push(...overheadResult.notes_and_warnings.map((w) => `[Overhead] ${w}`));

  const overheadExGst = cfg.overheads.include_in_total_cost ? overheadResult.overhead.total_ex_gst : 0;

  const costExGst = roundMoney(materialsTotal + installTotal + overheadExGst + jobTravel + jobExtras);
  const costIncGst = roundMoney(applyGst(costExGst));

  jobMaterialsLines.sort((a, b) => a.id.localeCompare(b.id));
  jobInstallActions.sort((a, b) => a.id.localeCompare(b.id));

  return {
    module_count: modules.length,
    modules,
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
