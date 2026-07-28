import { calculateSiteCostV1 } from './engine/calculate';
import type { CostingConfigV1 } from './engine/config';
import type { CostInputsV1, SiteInputsV1 } from './engine/types';

export const COSTING_CONTROL_CONFIG_SCHEMA_VERSION = 'costing-control.v1' as const;

export type CostingControlCurvePointV1 = {
  length_m: number;
  minutes_per_m: number;
};

export type CostingControlActionMinutesV1 =
  | number
  | {
      type: 'by_profile';
      profile_key: string;
      minutes_by_profile: Record<string, number>;
    };

export type CostingControlConfigV1 = {
  schemaVersion: typeof COSTING_CONTROL_CONFIG_SCHEMA_VERSION;
  baseManifestVersion: string;
  materialRatesExGst: Record<string, number>;
  labour: {
    crewHourRateExGst: number;
    actionBaseMinutes: Record<string, CostingControlActionMinutesV1>;
    multiplierValues: Record<string, Record<string, number>>;
    rafterLengthLoadingCurve: CostingControlCurvePointV1[];
  };
  overheads: {
    crewDayHours: number;
    opsFixedPerJobExGst: number;
    opsVariablePerCrewDayExGst: number;
    gableStartupPerPergolaExGst: number;
    boxPerimeterStartupPerPergolaExGst: number;
    timberPerRoundedCrewDayExGst: number;
    salesPerJobExGst: number;
    salesExtraModuleFactor: number;
  };
  rules: {
    overhangDefaultM: number;
    overhangMinM: number;
    overhangMaxM: number;
    boxBeamDepthMm: number;
    boxRafterDepthMm: number;
    boxRoofAllowanceAboveRafterMm: number;
    boxMaxFallMm: number;
    boxMinPitchDeg: number;
    boxPitchedHouseSetbackMm: number;
    boxPitchedOuterSetbackMm: number;
    boxGableEaveSetbackMm: number;
    boxGableRidgeAllowanceMm: number;
    acrylicMaxSlopeM: number;
    cedarCoverM: number;
    cedarWasteFactor: number;
    stockLengthPreferenceM: number[];
  };
};

export type CostingControlValidationIssueV1 = {
  path: string;
  message: string;
};

export type CostingControlValidationResultV1 =
  | { ok: true; value: CostingControlConfigV1 }
  | { ok: false; issues: CostingControlValidationIssueV1[] };

export type CostingControlDiffEntryV1 = {
  path: string;
  before: number | string | null;
  after: number | string | null;
};

export type CostingControlImpactRowV1 = {
  id: string;
  label: string;
  beforeTotalExGst: number;
  afterTotalExGst: number;
  deltaExGst: number;
  deltaPercent: number | null;
  beforeMaterialsExGst: number;
  afterMaterialsExGst: number;
  beforeInstallExGst: number;
  afterInstallExGst: number;
  beforeOverheadExGst: number;
  afterOverheadExGst: number;
};

type UnknownRecord = Record<string, unknown>;

const MAX_CURRENCY_VALUE = 10_000_000;
const MAX_MINUTES_VALUE = 10_080;
const MAX_MULTIPLIER_VALUE = 10;
const COMPATIBLE_BASE_MANIFEST_UPGRADES: Record<string, readonly string[]> = {
  'v1.7': ['v1.8'],
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function round(value: number, digits = 6): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function numericEntries(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .map(([key, item]) => [key, item]),
  );
}

function actionMinutesSnapshot(value: unknown): CostingControlActionMinutesV1 | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!isRecord(value) || value.type !== 'by_profile' || typeof value.profile_key !== 'string') return null;
  const minutesByProfile = numericEntries(value.minutes_by_profile);
  if (Object.keys(minutesByProfile).length === 0) return null;
  return {
    type: 'by_profile',
    profile_key: value.profile_key,
    minutes_by_profile: minutesByProfile,
  };
}

function curveSnapshot(config: CostingConfigV1): CostingControlCurvePointV1[] {
  const value = (config.installActions.driver_rules_reference as unknown as UnknownRecord)
    .rafter_length_loading_curve;
  const points = isRecord(value) && Array.isArray(value.points) ? value.points : [];
  return points.flatMap((point) => {
    if (!isRecord(point)) return [];
    const lengthM = Number(point.length_m);
    const minutesPerM = Number(point.minutes_per_m);
    if (!Number.isFinite(lengthM) || !Number.isFinite(minutesPerM)) return [];
    return [{ length_m: lengthM, minutes_per_m: minutesPerM }];
  });
}

export function snapshotCostingControlConfigV1(config: CostingConfigV1): CostingControlConfigV1 {
  const allocation = (config.overheads as unknown as UnknownRecord).allocation_method_v1_1 as UnknownRecord;
  const ops = (allocation?.ops_delivery ?? {}) as UnknownRecord;
  const sales = (allocation?.sales_design ?? {}) as UnknownRecord;
  const rules = config.rules as unknown as UnknownRecord;
  const geometry = (rules.geometry ?? {}) as UnknownRecord;
  const overhang = (geometry.overhang ?? {}) as UnknownRecord;
  const box = (geometry.box_perimeter ?? {}) as UnknownRecord;
  const pitchedSetbacks = (box.pitched_setbacks ?? {}) as UnknownRecord;
  const gableSetbacks = (box.gable_setbacks ?? {}) as UnknownRecord;
  const roofing = (rules.roofing ?? {}) as UnknownRecord;
  const acrylic = (roofing.acrylic ?? {}) as UnknownRecord;
  const timber = (roofing.timber ?? {}) as UnknownRecord;
  const cedar = (timber.cedar_sarking ?? {}) as UnknownRecord;

  const actionBaseMinutes: Record<string, CostingControlActionMinutesV1> = {};
  for (const action of config.installActions.actions as ReadonlyArray<UnknownRecord>) {
    const id = typeof action.id === 'string' ? action.id : '';
    const snapshot = actionMinutesSnapshot(action.base_minutes);
    if (id && snapshot !== null) actionBaseMinutes[id] = snapshot;
  }

  const multiplierValues: Record<string, Record<string, number>> = {};
  for (const [group, values] of Object.entries(config.installActions.multipliers as unknown as UnknownRecord)) {
    const numeric = numericEntries(values);
    if (Object.keys(numeric).length > 0) multiplierValues[group] = numeric;
  }

  return {
    schemaVersion: COSTING_CONTROL_CONFIG_SCHEMA_VERSION,
    baseManifestVersion: String(config.manifest.version),
    materialRatesExGst: Object.fromEntries(
      config.materials.items.map((item) => [item.id, Number(item.cost_ex_gst)]),
    ),
    labour: {
      crewHourRateExGst: Number(config.installActions.basis.crew_hour_rate_ex_gst),
      actionBaseMinutes,
      multiplierValues,
      rafterLengthLoadingCurve: curveSnapshot(config),
    },
    overheads: {
      crewDayHours: Number(allocation.crew_day_hours),
      opsFixedPerJobExGst: Number(ops.fixed_per_job_ex_gst),
      opsVariablePerCrewDayExGst: Number(ops.variable_per_crew_day_ex_gst),
      gableStartupPerPergolaExGst: Number(ops.gable_startup_per_pergola_ex_gst),
      boxPerimeterStartupPerPergolaExGst: Number(ops.box_perimeter_startup_per_pergola_ex_gst),
      timberPerRoundedCrewDayExGst: Number(ops.timber_per_rounded_crew_day_ex_gst),
      salesPerJobExGst: Number(sales.per_job_ex_gst),
      salesExtraModuleFactor: Number(sales.extra_module_factor),
    },
    rules: {
      overhangDefaultM: Number(overhang.default_amount_m),
      overhangMinM: Number(overhang.min_amount_m),
      overhangMaxM: Number(overhang.max_amount_m),
      boxBeamDepthMm: Number(box.box_beam_depth_mm),
      boxRafterDepthMm: Number(box.box_rafter_depth_mm),
      boxRoofAllowanceAboveRafterMm: Number(box.box_roof_allow_above_rafter_mm),
      boxMaxFallMm: Number(box.box_max_fall_mm),
      boxMinPitchDeg: Number(box.box_min_pitch_deg),
      boxPitchedHouseSetbackMm: Number(pitchedSetbacks.house_setback_mm),
      boxPitchedOuterSetbackMm: Number(pitchedSetbacks.outer_setback_mm),
      boxGableEaveSetbackMm: Number(gableSetbacks.eave_setback_mm),
      boxGableRidgeAllowanceMm: Number(gableSetbacks.ridge_allowance_mm),
      acrylicMaxSlopeM: Number(acrylic.max_slope_m),
      cedarCoverM: Number(cedar.cover_m),
      cedarWasteFactor: Number(cedar.waste_factor),
      stockLengthPreferenceM: [...config.bomStrategy.settings.stock_length_preference_m].map(Number),
    },
  };
}

function addNumberIssue(
  issues: CostingControlValidationIssueV1[],
  path: string,
  value: unknown,
  min: number,
  max: number,
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    issues.push({ path, message: `Must be a finite number between ${min} and ${max}.` });
    return false;
  }
  return true;
}

function compareExactKeys(
  issues: CostingControlValidationIssueV1[],
  path: string,
  candidate: UnknownRecord,
  expected: UnknownRecord,
): void {
  const candidateKeys = Object.keys(candidate).sort();
  const expectedKeys = Object.keys(expected).sort();
  const missing = expectedKeys.filter((key) => !candidateKeys.includes(key));
  const unknown = candidateKeys.filter((key) => !expectedKeys.includes(key));
  for (const key of missing) issues.push({ path: `${path}.${key}`, message: 'Required configured key is missing.' });
  for (const key of unknown) issues.push({ path: `${path}.${key}`, message: 'Unknown configured key is not supported.' });
}

function isCompatibleBaseManifestUpgrade(candidate: unknown, active: string): boolean {
  return typeof candidate === 'string'
    && (COMPATIBLE_BASE_MANIFEST_UPGRADES[candidate]?.includes(active) ?? false);
}

export function validateCostingControlConfigV1(
  value: unknown,
  baseConfig: CostingConfigV1,
): CostingControlValidationResultV1 {
  const issues: CostingControlValidationIssueV1[] = [];
  const expected = snapshotCostingControlConfigV1(baseConfig);
  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', message: 'Configuration must be an object.' }] };
  if (value.schemaVersion !== COSTING_CONTROL_CONFIG_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `Must equal ${COSTING_CONTROL_CONFIG_SCHEMA_VERSION}.` });
  }
  if (
    value.baseManifestVersion !== expected.baseManifestVersion
    && !isCompatibleBaseManifestUpgrade(value.baseManifestVersion, expected.baseManifestVersion)
  ) {
    issues.push({
      path: 'baseManifestVersion',
      message: `Must match, or be explicitly compatible with, the active package manifest ${expected.baseManifestVersion}.`,
    });
  }

  const materialRates = isRecord(value.materialRatesExGst) ? value.materialRatesExGst : {};
  compareExactKeys(issues, 'materialRatesExGst', materialRates, expected.materialRatesExGst);
  for (const [id, rate] of Object.entries(materialRates)) {
    addNumberIssue(issues, `materialRatesExGst.${id}`, rate, 0, MAX_CURRENCY_VALUE);
  }

  const labour = isRecord(value.labour) ? value.labour : {};
  addNumberIssue(issues, 'labour.crewHourRateExGst', labour.crewHourRateExGst, 0.01, 10_000);

  const actionMinutes = isRecord(labour.actionBaseMinutes) ? labour.actionBaseMinutes : {};
  compareExactKeys(issues, 'labour.actionBaseMinutes', actionMinutes, expected.labour.actionBaseMinutes);
  for (const [id, candidate] of Object.entries(actionMinutes)) {
    const expectedValue = expected.labour.actionBaseMinutes[id];
    if (typeof expectedValue === 'number') {
      addNumberIssue(issues, `labour.actionBaseMinutes.${id}`, candidate, 0, MAX_MINUTES_VALUE);
      continue;
    }
    if (!isRecord(candidate) || candidate.type !== 'by_profile' || candidate.profile_key !== expectedValue?.profile_key) {
      issues.push({ path: `labour.actionBaseMinutes.${id}`, message: 'Must preserve the package-owned by-profile action shape.' });
      continue;
    }
    const candidateProfiles = isRecord(candidate.minutes_by_profile) ? candidate.minutes_by_profile : {};
    compareExactKeys(
      issues,
      `labour.actionBaseMinutes.${id}.minutes_by_profile`,
      candidateProfiles,
      expectedValue.minutes_by_profile,
    );
    for (const [profile, minutes] of Object.entries(candidateProfiles)) {
      addNumberIssue(
        issues,
        `labour.actionBaseMinutes.${id}.minutes_by_profile.${profile}`,
        minutes,
        0,
        MAX_MINUTES_VALUE,
      );
    }
  }

  const multipliers = isRecord(labour.multiplierValues) ? labour.multiplierValues : {};
  compareExactKeys(issues, 'labour.multiplierValues', multipliers, expected.labour.multiplierValues);
  for (const [group, candidateValues] of Object.entries(multipliers)) {
    const values = isRecord(candidateValues) ? candidateValues : {};
    compareExactKeys(
      issues,
      `labour.multiplierValues.${group}`,
      values,
      expected.labour.multiplierValues[group] ?? {},
    );
    for (const [key, multiplier] of Object.entries(values)) {
      addNumberIssue(issues, `labour.multiplierValues.${group}.${key}`, multiplier, 0.01, MAX_MULTIPLIER_VALUE);
    }
  }

  const curve = Array.isArray(labour.rafterLengthLoadingCurve) ? labour.rafterLengthLoadingCurve : [];
  if (curve.length < 2 || curve.length > 20) {
    issues.push({ path: 'labour.rafterLengthLoadingCurve', message: 'Must contain between 2 and 20 points.' });
  }
  let previousLength = -Infinity;
  curve.forEach((point, index) => {
    const candidate = isRecord(point) ? point : {};
    const lengthValid = addNumberIssue(
      issues,
      `labour.rafterLengthLoadingCurve.${index}.length_m`,
      candidate.length_m,
      0,
      50,
    );
    addNumberIssue(
      issues,
      `labour.rafterLengthLoadingCurve.${index}.minutes_per_m`,
      candidate.minutes_per_m,
      0,
      1_000,
    );
    if (lengthValid && Number(candidate.length_m) <= previousLength) {
      issues.push({
        path: `labour.rafterLengthLoadingCurve.${index}.length_m`,
        message: 'Curve lengths must be strictly increasing.',
      });
    }
    if (lengthValid) previousLength = Number(candidate.length_m);
  });

  const overheads = isRecord(value.overheads) ? value.overheads : {};
  const overheadBounds: Record<keyof CostingControlConfigV1['overheads'], [number, number]> = {
    crewDayHours: [1, 24],
    opsFixedPerJobExGst: [0, MAX_CURRENCY_VALUE],
    opsVariablePerCrewDayExGst: [0, MAX_CURRENCY_VALUE],
    gableStartupPerPergolaExGst: [0, MAX_CURRENCY_VALUE],
    boxPerimeterStartupPerPergolaExGst: [0, MAX_CURRENCY_VALUE],
    timberPerRoundedCrewDayExGst: [0, MAX_CURRENCY_VALUE],
    salesPerJobExGst: [0, MAX_CURRENCY_VALUE],
    salesExtraModuleFactor: [0, 10],
  };
  compareExactKeys(issues, 'overheads', overheads, expected.overheads);
  for (const [key, bounds] of Object.entries(overheadBounds)) {
    addNumberIssue(issues, `overheads.${key}`, overheads[key], bounds[0], bounds[1]);
  }

  const rules = isRecord(value.rules) ? value.rules : {};
  const ruleBounds: Record<keyof CostingControlConfigV1['rules'], [number, number] | null> = {
    overhangDefaultM: [0, 10],
    overhangMinM: [0, 10],
    overhangMaxM: [0, 10],
    boxBeamDepthMm: [1, 2_000],
    boxRafterDepthMm: [1, 1_000],
    boxRoofAllowanceAboveRafterMm: [0, 1_000],
    boxMaxFallMm: [0, 5_000],
    boxMinPitchDeg: [0, 89],
    boxPitchedHouseSetbackMm: [0, 5_000],
    boxPitchedOuterSetbackMm: [0, 5_000],
    boxGableEaveSetbackMm: [0, 5_000],
    boxGableRidgeAllowanceMm: [0, 5_000],
    acrylicMaxSlopeM: [0.1, 50],
    cedarCoverM: [0.001, 5],
    cedarWasteFactor: [0, 5],
    stockLengthPreferenceM: null,
  };
  compareExactKeys(issues, 'rules', rules, expected.rules);
  for (const [key, bounds] of Object.entries(ruleBounds)) {
    if (bounds) addNumberIssue(issues, `rules.${key}`, rules[key], bounds[0], bounds[1]);
  }
  const stockLengths = Array.isArray(rules.stockLengthPreferenceM) ? rules.stockLengthPreferenceM : [];
  if (stockLengths.length < 1 || stockLengths.length > 12) {
    issues.push({ path: 'rules.stockLengthPreferenceM', message: 'Must contain between 1 and 12 stock lengths.' });
  }
  const uniqueStockLengths = new Set<number>();
  stockLengths.forEach((length, index) => {
    if (addNumberIssue(issues, `rules.stockLengthPreferenceM.${index}`, length, 0.1, 50)) {
      uniqueStockLengths.add(Number(length));
    }
  });
  if (uniqueStockLengths.size !== stockLengths.length) {
    issues.push({ path: 'rules.stockLengthPreferenceM', message: 'Stock lengths must be unique.' });
  }
  if (
    typeof rules.overhangMinM === 'number' &&
    typeof rules.overhangDefaultM === 'number' &&
    typeof rules.overhangMaxM === 'number' &&
    !(rules.overhangMinM <= rules.overhangDefaultM && rules.overhangDefaultM <= rules.overhangMaxM)
  ) {
    issues.push({
      path: 'rules.overhangDefaultM',
      message: 'Overhang values must satisfy min <= default <= max.',
    });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: deepClone(value) as CostingControlConfigV1 };
}

export function applyCostingControlConfigV1(
  baseConfig: CostingConfigV1,
  controlConfig: CostingControlConfigV1,
): CostingConfigV1 {
  const validated = validateCostingControlConfigV1(controlConfig, baseConfig);
  if (!validated.ok) {
    throw new Error(validated.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  const control = validated.value;
  const config = deepClone(baseConfig);

  config.materials.items = config.materials.items.map((item) => ({
    ...item,
    cost_ex_gst: control.materialRatesExGst[item.id]!,
  }));
  config.installActions.basis.crew_hour_rate_ex_gst = control.labour.crewHourRateExGst;
  config.installActions.basis.crew_hour_rate_inc_gst = round(control.labour.crewHourRateExGst * 1.15, 2);
  config.installActions.actions = config.installActions.actions.map((action) => {
    const baseMinutes = control.labour.actionBaseMinutes[action.id];
    return baseMinutes === undefined ? action : ({ ...action, base_minutes: deepClone(baseMinutes) } as typeof action);
  }) as CostingConfigV1['installActions']['actions'];

  const multiplierTarget = config.installActions.multipliers as unknown as UnknownRecord;
  for (const [group, values] of Object.entries(control.labour.multiplierValues)) {
    multiplierTarget[group] = { ...(multiplierTarget[group] as UnknownRecord), ...values };
  }
  const curveTarget = (config.installActions.driver_rules_reference as unknown as UnknownRecord)
    .rafter_length_loading_curve as UnknownRecord;
  curveTarget.points = control.labour.rafterLengthLoadingCurve.map((point) => ({ ...point }));

  const allocation = (config.overheads as unknown as UnknownRecord).allocation_method_v1_1 as UnknownRecord;
  const ops = allocation.ops_delivery as UnknownRecord;
  const sales = allocation.sales_design as UnknownRecord;
  allocation.crew_day_hours = control.overheads.crewDayHours;
  ops.fixed_per_job_ex_gst = control.overheads.opsFixedPerJobExGst;
  ops.variable_per_crew_day_ex_gst = control.overheads.opsVariablePerCrewDayExGst;
  ops.gable_startup_per_pergola_ex_gst = control.overheads.gableStartupPerPergolaExGst;
  ops.box_perimeter_startup_per_pergola_ex_gst = control.overheads.boxPerimeterStartupPerPergolaExGst;
  ops.timber_per_rounded_crew_day_ex_gst = control.overheads.timberPerRoundedCrewDayExGst;
  sales.per_job_ex_gst = control.overheads.salesPerJobExGst;
  sales.extra_module_factor = control.overheads.salesExtraModuleFactor;

  const ruleTarget = config.rules as unknown as UnknownRecord;
  const geometry = ruleTarget.geometry as UnknownRecord;
  const overhang = geometry.overhang as UnknownRecord;
  const box = geometry.box_perimeter as UnknownRecord;
  const pitched = box.pitched_setbacks as UnknownRecord;
  const gable = box.gable_setbacks as UnknownRecord;
  const roofing = ruleTarget.roofing as UnknownRecord;
  const acrylic = roofing.acrylic as UnknownRecord;
  const timber = roofing.timber as UnknownRecord;
  const cedar = timber.cedar_sarking as UnknownRecord;
  overhang.default_amount_m = control.rules.overhangDefaultM;
  overhang.min_amount_m = control.rules.overhangMinM;
  overhang.max_amount_m = control.rules.overhangMaxM;
  box.box_beam_depth_mm = control.rules.boxBeamDepthMm;
  box.box_rafter_depth_mm = control.rules.boxRafterDepthMm;
  box.box_roof_allow_above_rafter_mm = control.rules.boxRoofAllowanceAboveRafterMm;
  box.box_max_fall_mm = control.rules.boxMaxFallMm;
  box.box_min_pitch_deg = control.rules.boxMinPitchDeg;
  pitched.house_setback_mm = control.rules.boxPitchedHouseSetbackMm;
  pitched.outer_setback_mm = control.rules.boxPitchedOuterSetbackMm;
  gable.eave_setback_mm = control.rules.boxGableEaveSetbackMm;
  gable.ridge_allowance_mm = control.rules.boxGableRidgeAllowanceMm;
  acrylic.max_slope_m = control.rules.acrylicMaxSlopeM;
  cedar.cover_m = control.rules.cedarCoverM;
  cedar.waste_factor = control.rules.cedarWasteFactor;
  config.bomStrategy.settings.stock_length_preference_m = [...control.rules.stockLengthPreferenceM] as typeof config.bomStrategy.settings.stock_length_preference_m;

  return config;
}

function flattenComparable(value: unknown, path = '', out: Record<string, number | string | null> = {}) {
  if (typeof value === 'number' || typeof value === 'string' || value === null) {
    out[path] = value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenComparable(item, path ? `${path}.${index}` : String(index), out));
    return out;
  }
  if (isRecord(value)) {
    Object.keys(value)
      .sort()
      .forEach((key) => flattenComparable(value[key], path ? `${path}.${key}` : key, out));
  }
  return out;
}

export function diffCostingControlConfigsV1(
  before: CostingControlConfigV1,
  after: CostingControlConfigV1,
): CostingControlDiffEntryV1[] {
  const left = flattenComparable(before);
  const right = flattenComparable(after);
  const paths = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return paths.flatMap((path) => (left[path] === right[path] ? [] : [{ path, before: left[path] ?? null, after: right[path] ?? null }]));
}

const BASE_PREVIEW_INPUT: CostInputsV1 = {
  length_m: 6,
  projection_m: 3,
  post_cut_height_m: 2.4,
  post_count: 4,
  pergola_style: 'pitched',
  box_perimeter_enabled: false,
  roof_material: 'acrylic',
  extrusion_colour: 'Black',
  house_connection_type: 'soffit',
  post_connection_type: 'deck_bracket',
  access: 'normal',
  height: 'single_storey',
  ground: 'easy',
  travel_ex_gst: 0,
  extras_allowance_ex_gst: 0,
  quote_discount_pct: 0,
};

export const COSTING_CONTROL_PREVIEW_SCENARIOS_V1: ReadonlyArray<{
  id: string;
  label: string;
  inputs: SiteInputsV1;
}> = [
  {
    id: 'standard-pitched-acrylic',
    label: 'Standard pitched acrylic 6m x 3m',
    inputs: { pergolas: [{ id: 'preview-1', modules: [{ ...BASE_PREVIEW_INPUT }] }] },
  },
  {
    id: 'gable-acrylic-hard-access',
    label: 'Gable acrylic 7m x 6m, hard access',
    inputs: {
      pergolas: [{
        id: 'preview-1',
        modules: [{
          ...BASE_PREVIEW_INPUT,
          length_m: 7,
          projection_m: 6,
          roof_span_m: 6,
          pergola_style: 'gable',
          roof_pitch_deg: 25,
          access: 'hard',
          house_connection_type: 'fascia',
          post_connection_type: 'slab_anchors',
        }],
      }],
    },
  },
  {
    id: 'box-perimeter-timber',
    label: 'Box perimeter timber 6m x 4m',
    inputs: {
      pergolas: [{
        id: 'preview-1',
        modules: [{
          ...BASE_PREVIEW_INPUT,
          length_m: 6,
          projection_m: 4,
          roof_span_m: 4,
          pergola_style: 'box_perimeter',
          box_perimeter_enabled: true,
          roof_material: 'timber',
          timber_roof_above_type: 'insulated_panels',
          house_connection_type: 'facade',
        }],
      }],
    },
  },
  {
    id: 'two-pergola-site',
    label: 'Two-pergola residential site',
    inputs: {
      travel_ex_gst: 350,
      extras_allowance_ex_gst: 500,
      pergolas: [
        { id: 'preview-1', modules: [{ ...BASE_PREVIEW_INPUT }] },
        {
          id: 'preview-2',
          modules: [{
            ...BASE_PREVIEW_INPUT,
            length_m: 5,
            projection_m: 3.5,
            roof_span_m: 3.5,
            post_count: 2,
            house_connection_type: 'fascia',
            post_connection_type: 'slab_anchors',
          }],
        },
      ],
    },
  },
];

export function previewCostingControlImpactV1(
  beforeConfig: CostingConfigV1,
  afterConfig: CostingConfigV1,
): CostingControlImpactRowV1[] {
  return COSTING_CONTROL_PREVIEW_SCENARIOS_V1.map((scenario) => (
    previewCostingControlSiteImpactV1(
      scenario.id,
      scenario.label,
      scenario.inputs,
      beforeConfig,
      afterConfig,
    )
  ));
}

export function previewCostingControlSiteImpactV1(
  id: string,
  label: string,
  inputs: SiteInputsV1,
  beforeConfig: CostingConfigV1,
  afterConfig: CostingConfigV1,
): CostingControlImpactRowV1 {
  const before = calculateSiteCostV1(deepClone(inputs), beforeConfig);
  const after = calculateSiteCostV1(deepClone(inputs), afterConfig);
  const beforeTotal = before.totals.cost_ex_gst;
  const afterTotal = after.totals.cost_ex_gst;
  const delta = round(afterTotal - beforeTotal, 2);
  return {
    id,
    label,
    beforeTotalExGst: beforeTotal,
    afterTotalExGst: afterTotal,
    deltaExGst: delta,
    deltaPercent: beforeTotal === 0 ? null : round((delta / beforeTotal) * 100, 2),
    beforeMaterialsExGst: before.materials.totals.materials_ex_gst,
    afterMaterialsExGst: after.materials.totals.materials_ex_gst,
    beforeInstallExGst: before.install.totals.install_ex_gst,
    afterInstallExGst: after.install.totals.install_ex_gst,
    beforeOverheadExGst: before.overhead.total_ex_gst,
    afterOverheadExGst: after.overhead.total_ex_gst,
  };
}
