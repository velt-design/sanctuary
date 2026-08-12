import type { CostingConfigV1 } from './config';
import type { InstallActionV1, InstallV1, InputsNormalizedV1 } from './types';
import { evalArithmeticExpr } from './expr';
import {
  installActionsWithInfillLabourPolicyV1,
  type InstallActionConfigV1,
} from './infillLabourPolicy';
import { normaliseProfile } from './normalise';

type ActionConfig = InstallActionConfigV1;

type InstallResultV1 = {
  install: InstallV1;
  notes_and_warnings: string[];
};

export const DAY_CYCLE_ACTION_IDS = [
  'day_cycle.setup_tools',
  'day_cycle.pack_down_tools',
  'day_cycle.daily_tidy',
] as const;

type DayCycleActionId = (typeof DAY_CYCLE_ACTION_IDS)[number];

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function roundMinutes(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

type CurvePoint = {
  length_m: number;
  minutes_per_m: number;
};

function toCurvePoints(value: unknown): CurvePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const lengthM = Number((entry as any)?.length_m);
      const minutesPerM = Number((entry as any)?.minutes_per_m);
      if (!Number.isFinite(lengthM) || !Number.isFinite(minutesPerM)) return null;
      return {
        length_m: Math.max(0, lengthM),
        minutes_per_m: Math.max(0, minutesPerM),
      };
    })
    .filter((entry): entry is CurvePoint => entry !== null)
    .sort((a, b) => a.length_m - b.length_m);
}

function interpolateCurveValue(lengthM: number, points: readonly CurvePoint[]): number {
  if (!Number.isFinite(lengthM) || points.length === 0) return 1;
  if (points.length === 1) return points[0]?.minutes_per_m ?? 1;

  const clampedLength = Math.max(0, lengthM);
  if (clampedLength <= points[0]!.length_m) return points[0]!.minutes_per_m;
  if (clampedLength >= points[points.length - 1]!.length_m) return points[points.length - 1]!.minutes_per_m;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (clampedLength > next.length_m) continue;

    const span = next.length_m - prev.length_m;
    if (span <= 0) return next.minutes_per_m;

    const t = (clampedLength - prev.length_m) / span;
    return prev.minutes_per_m + (next.minutes_per_m - prev.minutes_per_m) * t;
  }

  return points[points.length - 1]!.minutes_per_m;
}

function resolveRafterLengthLoadingRate(
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
): number {
  const reference = (config.installActions.driver_rules_reference as any)?.rafter_length_loading_curve;
  const points = toCurvePoints(reference?.points);
  if (points.length === 0) return 1;

  const roofType = String(inputs.roof_type ?? '');
  const totalPieces = asPositiveNumber((derived as any).total_rafter_pieces);
  const totalInstalledLengthM = asPositiveNumber((derived as any).total_installed_rafter_length_m);
  const representativeCutLengthM = asPositiveNumber((derived as any).rafter_cut_length_m ?? (derived as any).cut_rafter_length_m);
  const hipRafterCount = asPositiveNumber((derived as any).hip_rafter_count);
  const hipRafterCutLengthM = asPositiveNumber((derived as any).hip_rafter_cut_length_m);

  const groups: Array<{ total_length_m: number; rafter_length_m: number }> = [];

  if (
    (roofType === 'gable' || roofType === 'low_gable') &&
    Number.isFinite(Number((derived as any).rafter_cut_length_house_side_m)) &&
    Number.isFinite(Number((derived as any).rafter_cut_length_outer_side_m)) &&
    totalPieces > 0
  ) {
    const perSidePieces = totalPieces / 2;
    const houseCutLengthM = asPositiveNumber((derived as any).rafter_cut_length_house_side_m);
    const outerCutLengthM = asPositiveNumber((derived as any).rafter_cut_length_outer_side_m);
    if (perSidePieces > 0 && houseCutLengthM > 0) groups.push({ total_length_m: perSidePieces * houseCutLengthM, rafter_length_m: houseCutLengthM });
    if (perSidePieces > 0 && outerCutLengthM > 0) groups.push({ total_length_m: perSidePieces * outerCutLengthM, rafter_length_m: outerCutLengthM });
  } else if (totalPieces > 0 && representativeCutLengthM > 0) {
    groups.push({
      total_length_m: totalPieces * representativeCutLengthM,
      rafter_length_m: representativeCutLengthM,
    });
  }

  if (roofType === 'hip' && hipRafterCount > 0 && hipRafterCutLengthM > 0) {
    groups.push({
      total_length_m: hipRafterCount * hipRafterCutLengthM,
      rafter_length_m: hipRafterCutLengthM,
    });
  }

  const minutesTotal = groups.reduce(
    (acc, group) => acc + group.total_length_m * interpolateCurveValue(group.rafter_length_m, points),
    0,
  );
  const lengthTotal = groups.reduce((acc, group) => acc + group.total_length_m, 0);
  const fallbackLengthTotal = totalInstalledLengthM > 0 ? totalInstalledLengthM : lengthTotal;
  if (fallbackLengthTotal <= 0 || minutesTotal <= 0) return 1;
  return minutesTotal / fallbackLengthTotal;
}

function resolveSteepPitchMultiplier(inputs: InputsNormalizedV1, derived: Record<string, unknown>): number {
  const pitchRaw = Number((derived as any).roof_pitch_deg_used ?? inputs.roof_pitch_deg ?? 0);
  if (!Number.isFinite(pitchRaw)) return 1;
  if (pitchRaw > 30) return 1.3;
  if (pitchRaw > 20) return 1.2;
  return 1;
}

const STEEL_BEAM_INSTALL_FACTOR = 2.5;
const STEEL_BEAM_INSTALL_ACTIONS = {
  front: 'frame.install_front_beam_m',
  tie: 'frame.install_tie_beam_m',
  ridge: 'roof.install_ridge_beam_m',
  overhang: 'frame.overhang_support_beam_m',
} as const;
const STEEL_BEAM_EXTRA_LABOUR_ACTION_ID = 'frame.steel_beam_labour_m';
const STEEL_BEAM_EXTRA_LABOUR_MINUTES_PER_M = 30;
const STEEL_BEAM_EXTRA_LABOUR_LABEL = 'Steel beam labour allowance - per metre';
const STEEL_BEAM_EXTRA_LABOUR_CATEGORY = 'Frame';

function isSteelBeamProfile(profile: unknown): boolean {
  const normalized = normaliseProfile(String(profile ?? ''));
  return normalized === 'rhs150x50x3' || normalized === 'rhs150x50x3mm';
}

function resolveSteelBeamInstallFactor(actionId: string, derived: Record<string, unknown>): number {
  if (actionId === STEEL_BEAM_INSTALL_ACTIONS.front) {
    const profile = (derived as any).front_beam_profile_used;
    const beamLength = Number((derived as any).front_beam_length_m ?? 0);
    return isSteelBeamProfile(profile) && beamLength > 0 ? STEEL_BEAM_INSTALL_FACTOR : 1;
  }

  if (actionId === STEEL_BEAM_INSTALL_ACTIONS.tie) {
    const profile = (derived as any).tie_beam_profile_used;
    const beamLength = Number((derived as any).tie_beam_length_m ?? 0);
    const frameCount = Number((derived as any).gable_end_frame_count ?? 0);
    return isSteelBeamProfile(profile) && beamLength > 0 && frameCount > 0 ? STEEL_BEAM_INSTALL_FACTOR : 1;
  }

  if (actionId === STEEL_BEAM_INSTALL_ACTIONS.ridge) {
    const profile = (derived as any).ridge_beam_profile_used;
    const ridgeLength = Number((derived as any).ridge_length_m ?? 0);
    return isSteelBeamProfile(profile) && ridgeLength > 0 ? STEEL_BEAM_INSTALL_FACTOR : 1;
  }

  if (actionId === STEEL_BEAM_INSTALL_ACTIONS.overhang) {
    const profile = (derived as any).overhang_support_beam_profile_used;
    const beamLength = Number((derived as any).overhang_support_beam_length_m ?? 0);
    return isSteelBeamProfile(profile) && beamLength > 0 ? STEEL_BEAM_INSTALL_FACTOR : 1;
  }

  return 1;
}

function asPositiveNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function resolveSteelBeamInstalledLengthM(
  derived: Record<string, unknown>,
  actions: readonly Pick<InstallActionV1, 'id' | 'qty'>[],
): number {
  let totalLengthM = 0;
  for (const action of actions) {
    if (resolveSteelBeamInstallFactor(action.id, derived) <= 1) continue;
    totalLengthM += asPositiveNumber(action.qty);
  }
  return totalLengthM;
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
    gutter_assembly_modes: (derived as any).gutter_assembly_mode,
    slope_directions: (derived as any).slope_direction,
    timber_roof_above_types: (inputs as any).timber_roof_above_type,
    has_our_gutter: boolToString((derived as any).has_our_gutter),
    has_ledger: boolToString((derived as any).has_ledger),
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
    else if (key === 'pitch_steep_roof') next = resolveSteepPitchMultiplier(inputs, derived);
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
    } else if (key === 'rafter_length_loading_curve') {
      next = resolveRafterLengthLoadingRate(inputs, derived, config);
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

export function computeSiteDays(baseCrewHours: number, config: CostingConfigV1): number {
  const rawCrewDayHours = Number((config.overheads as any)?.allocation_method_v1_1?.crew_day_hours ?? 9);
  const crewDayHours = Number.isFinite(rawCrewDayHours) && rawCrewDayHours > 0 ? rawCrewDayHours : 9;
  if (!Number.isFinite(baseCrewHours) || baseCrewHours <= 0) return 1;
  return Math.max(1, Math.ceil(baseCrewHours / crewDayHours));
}

export function buildInstallV1(
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
  opts?: { scope?: 'job' | 'module' | 'all'; excludeActionIds?: readonly string[] },
): InstallResultV1 {
  const warnings: string[] = [];
  const scope = opts?.scope ?? 'all';
  const excluded = new Set(opts?.excludeActionIds ?? []);

  const crewRateExGst = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 100);
  if (!Number.isFinite(crewRateExGst) || crewRateExGst <= 0) warnings.push('Invalid crew hour rate in install actions config; defaulting to 100.');

  const actionsOut: InstallActionV1[] = [];

  for (const action of installActionsWithInfillLabourPolicyV1(config)) {
    if (excluded.has(action.id)) continue;
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
    const steelBeamFactor = resolveSteelBeamInstallFactor(action.id, derived);
    if (steelBeamFactor > 1) applied.steel_beam = roundMoney(steelBeamFactor);
    const minutes = roundMinutes(qty * baseMinutes * factor * steelBeamFactor);
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

  if (scope !== 'job') {
    const steelBeamInstalledLengthM = resolveSteelBeamInstalledLengthM(derived, actionsOut);
    if (steelBeamInstalledLengthM > 0) {
      const minutes = roundMinutes(steelBeamInstalledLengthM * STEEL_BEAM_EXTRA_LABOUR_MINUTES_PER_M);
      const cost = roundMoney((minutes / 60) * crewRateExGst);
      actionsOut.push({
        id: STEEL_BEAM_EXTRA_LABOUR_ACTION_ID,
        category: STEEL_BEAM_EXTRA_LABOUR_CATEGORY,
        label: STEEL_BEAM_EXTRA_LABOUR_LABEL,
        scope: 'module',
        unit: 'metre',
        qty: steelBeamInstalledLengthM,
        minutes,
        applied_multipliers: {},
        cost_ex_gst: cost,
      });
    }
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

export function buildDayCycleActions(
  inputs: InputsNormalizedV1,
  derived: Record<string, unknown>,
  config: CostingConfigV1,
  siteDays: number,
): InstallResultV1 {
  const warnings: string[] = [];
  const actionsOut: InstallActionV1[] = [];

  const crewRateExGst = Number(config.installActions.basis.crew_hour_rate_ex_gst ?? 100);
  if (!Number.isFinite(crewRateExGst) || crewRateExGst <= 0) warnings.push('Invalid crew hour rate in install actions config; defaulting to 100.');

  const qty = Number.isFinite(siteDays) && siteDays > 0 ? Math.round(siteDays) : 0;
  if (qty <= 0) {
    return {
      install: {
        actions: [],
        totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 },
      },
      notes_and_warnings: warnings,
    };
  }

  const actionsById = new Map<DayCycleActionId, ActionConfig>();
  for (const action of config.installActions.actions as readonly ActionConfig[]) {
    if ((DAY_CYCLE_ACTION_IDS as readonly string[]).includes(action.id)) actionsById.set(action.id as DayCycleActionId, action);
  }

  for (const id of DAY_CYCLE_ACTION_IDS) {
    const action = actionsById.get(id);
    if (!action) {
      warnings.push(`Install action '${id}' not found in config; day cycle skipped.`);
      continue;
    }

    if (!actionApplies(action, inputs, derived)) continue;

    const baseMinutes = resolveBaseMinutes(action, inputs);
    if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) {
      warnings.push(`Install action '${action.id}' has no valid base_minutes; skipped.`);
      continue;
    }

    const { factor, applied } = resolveMultipliers(action, inputs, derived, config);
    const minutes = roundMinutes(qty * baseMinutes * factor);
    const cost = roundMoney((minutes / 60) * crewRateExGst);
    const actionScope = String((action as any).scope ?? 'job');

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
