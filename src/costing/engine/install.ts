import type { CostingConfigV1 } from './config';
import type { InstallActionV1, InstallV1, InputsNormalizedV1 } from './types';
import { evalArithmeticExpr } from './expr';

type ActionConfig = CostingConfigV1['installActions']['actions'][number];

type InstallResultV1 = {
  install: InstallV1;
  notes_and_warnings: string[];
};

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function roundMinutes(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function getDriverValue(
  key: string,
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
): number {
  if (key.startsWith('inputs.')) {
    const k = key.slice('inputs.'.length);
    const v = (inputs as any)[k];
    return typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  }
  if (key.startsWith('derived.')) {
    const k = key.slice('derived.'.length);
    const v = (derived as any)[k];
    return typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  }
  const v = (derived as any)[key] ?? (inputs as any)[key];
  return typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
}

function actionApplies(action: ActionConfig, inputs: InputsNormalizedV1, derived: Record<string, unknown>): boolean {
  const appliesTo = (action as any).applies_to as Record<string, unknown> | undefined;
  if (!appliesTo) return true;

  const boolToString = (value: unknown): string => (value === true ? 'true' : 'false');

  // Context values are keyed to match applies_to keys (plural).
  // If a context value is missing, the action must not apply.
  const ctx: Record<string, string | string[] | null | undefined> = {
    structure_types: inputs.structure_type,
    roof_types: inputs.roof_type,
    roof_materials: inputs.roof_material === 'mixed' ? ['acrylic', 'timber'] : [inputs.roof_material],
    post_connection_types: inputs.post_connection_type,
    house_connection_types: inputs.house_connection_type,
    box_beam_profiles: inputs.box_beam_profile,
    gutter_types: inputs.gutter_type,
    overhang_enabled: boolToString((derived as any).overhang_enabled ?? inputs.overhang_enabled),
    inverted_enabled: boolToString((derived as any).inverted_enabled ?? inputs.inverted_enabled),
    inverted_house_gutter: boolToString((derived as any).inverted_house_gutter),
    gutter_modes: (derived as any).gutter_mode,
    slope_directions: (derived as any).slope_direction,
  };

  for (const [key, allowedRaw] of Object.entries(appliesTo)) {
    if (!Array.isArray(allowedRaw)) return false;
    const allowed = allowedRaw.filter((v): v is string => typeof v === 'string');
    if (allowed.length === 0) return false;

    const actual = ctx[key];
    if (actual == null) return false;

    if (Array.isArray(actual)) {
      const ok = actual.some((value) => allowed.includes(value));
      if (!ok) return false;
    } else {
      if (!allowed.includes(actual)) return false;
    }
  }

  return true;
}

function resolveBaseMinutes(action: ActionConfig, inputs: InputsNormalizedV1): number {
  const base = (action as any).base_minutes as any;
  if (typeof base === 'number') return base;
  if (!base || typeof base !== 'object') return 0;

  if (base.type === 'by_profile') {
    const key = String(base.profile_key ?? '');
    const profileKey = key.startsWith('inputs.') ? key.slice('inputs.'.length) : key;
    const profile = String((inputs as any)[profileKey] ?? '');
    const table = base.minutes_by_profile as Record<string, number> | undefined;
    if (!table) return 0;
    const minutes = table[profile];
    if (typeof minutes === 'number') return minutes;
    const fallback = table.custom;
    return typeof fallback === 'number' ? fallback : 0;
  }

  return 0;
}

function resolveMultipliers(
  action: ActionConfig,
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
): { factor: number; applied: Record<string, number> } {
  const applied: Record<string, number> = {};

  const list = ((action as any).apply_multipliers as string[] | undefined) ?? [];
  let factor = 1;

  const mult = config.installActions.multipliers as any;

  for (const key of list) {
    let next = 1;

    if (key === 'access') next = Number(mult.access?.[inputs.access] ?? 1);
    else if (key === 'access_logistics') next = Number(mult.access_logistics?.[inputs.access] ?? 1);
    else if (key === 'height') next = Number(mult.height?.[inputs.height] ?? 1);
    else if (key === 'ground') next = Number(mult.ground?.[inputs.ground] ?? 1);
    else if (key === 'structure_type') next = Number(mult.structure_type?.[inputs.structure_type] ?? 1);
    else if (key === 'roof_type') next = Number(mult.roof_type?.[inputs.roof_type] ?? 1);
    else if (key === 'rafter_length_multiplier') {
      const ref = Number(config.installActions.driver_rules_reference.rafter_length_multiplier.reference_length_m ?? 3);
      const exp = Number(config.installActions.driver_rules_reference.rafter_length_multiplier.exponent ?? 0.25);
      const derivedLength = Number((derived as any).rafter_length_m ?? (derived as any).rafter_length_m_assumed);
      const fallbackLength =
        inputs.roof_type === 'low_gable' || inputs.roof_type === 'gable' || inputs.roof_type === 'hip'
          ? inputs.projection_m / 2
          : inputs.projection_m;
      const lengthM = Number.isFinite(derivedLength) && derivedLength > 0 ? derivedLength : fallbackLength;
      next = Math.pow(Math.max(lengthM, 0.1) / Math.max(ref, 0.1), exp);
    } else {
      // Unknown multipliers shouldn't break costing; keep 1.
      next = 1;
    }

    if (!Number.isFinite(next) || next <= 0) next = 1;
    applied[key] = roundMoney(next);
    factor *= next;
  }

  return { factor, applied };
}

function resolveQty(action: ActionConfig, inputs: InputsNormalizedV1, derived: Record<string, unknown>): number {
  const qtyCfg = (action as any).quantity as any;
  if (!qtyCfg || typeof qtyCfg !== 'object') return 0;

  if (qtyCfg.type === 'fixed') {
    const v = Number(qtyCfg.value ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  if (qtyCfg.type === 'driver') {
    const key = String(qtyCfg.key ?? '');
    let v = getDriverValue(key, inputs, derived);
    if (!Number.isFinite(v) && qtyCfg.fallback) {
      v = getDriverValue(String(qtyCfg.fallback), inputs, derived);
    }
    const mult = Number(qtyCfg.multiplier ?? 1);
    const qty = v * (Number.isFinite(mult) ? mult : 1);
    return Number.isFinite(qty) ? qty : 0;
  }

  if (typeof qtyCfg.driver === 'string') {
    const v = getDriverValue(String(qtyCfg.driver), inputs, derived);
    const fallback = Number(qtyCfg.default ?? 0);
    const qty = Number.isFinite(v) ? v : fallback;
    return Number.isFinite(qty) ? qty : 0;
  }

  if (typeof qtyCfg.expr === 'string') {
    let v = NaN;
    try {
      v = evalArithmeticExpr(String(qtyCfg.expr), (id) => getDriverValue(id, inputs, derived));
    } catch {
      v = NaN;
    }
    const fallback = Number(qtyCfg.default ?? 0);
    const qty = Number.isFinite(v) ? v : fallback;
    return Number.isFinite(qty) ? qty : 0;
  }

  return 0;
}

export function buildInstallV1(
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
  opts?: { scope?: 'job' | 'module' | 'all' },
): InstallResultV1 {
  const warnings: string[] = [];
  const scope = opts?.scope ?? 'all';

  const crewRateExGst = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 110);
  if (!Number.isFinite(crewRateExGst) || crewRateExGst <= 0) warnings.push('Invalid crew hour rate in install actions config; defaulting to 110.');

  const actionsOut: InstallActionV1[] = [];

  for (const action of config.installActions.actions) {
    const actionScope = String((action as any).scope ?? 'module');
    if (scope !== 'all' && actionScope !== scope) continue;

    if (!actionApplies(action, inputs, derived)) continue;

    const qty = resolveQty(action, inputs, derived);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const baseMinutes = resolveBaseMinutes(action, inputs);
    if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) {
      warnings.push(`Install action '${action.id}' has no valid base_minutes; skipped.`);
      continue;
    }

    const { factor, applied } = resolveMultipliers(action, inputs, derived, config);
    const minutes = roundMinutes(qty * baseMinutes * factor);
    const cost = roundMoney((minutes / 60) * crewRateExGst);

    actionsOut.push({
      id: action.id,
      category: action.category,
      label: action.label,
      scope: actionScope === 'job' ? 'job' : 'module',
      unit: action.unit,
      qty,
      minutes,
      applied_multipliers: applied,
      cost_ex_gst: cost,
    });
  }

  actionsOut.sort((a, b) => a.id.localeCompare(b.id));

  const crewMinutes = roundMinutes(actionsOut.reduce((acc, a) => acc + a.minutes, 0));
  const crewHours = roundMinutes(crewMinutes / 60);
  const installExGst = roundMoney(actionsOut.reduce((acc, a) => acc + a.cost_ex_gst, 0));

  return {
    install: {
      actions: actionsOut,
      totals: {
        crew_minutes: crewMinutes,
        crew_hours: crewHours,
        install_ex_gst: installExGst,
      },
    },
    notes_and_warnings: warnings,
  };
}
