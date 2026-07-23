import type { CostingControlConfigV1 } from '@sp/costing';

export type CostingControlSection = 'materials' | 'labour' | 'overheads' | 'rules' | 'comparison' | 'publish';

export type ValidationIssue = {
  path?: string;
  message?: string;
};

function countLeafChanges(left: unknown, right: unknown): number {
  if (Object.is(left, right)) return 0;
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    return Array.from({ length }, (_, index) => countLeafChanges(left[index], right[index]))
      .reduce((total, count) => total + count, 0);
  }
  if (
    left && right
    && typeof left === 'object'
    && typeof right === 'object'
    && !Array.isArray(left)
    && !Array.isArray(right)
  ) {
    const keys = new Set([
      ...Object.keys(left as Record<string, unknown>),
      ...Object.keys(right as Record<string, unknown>),
    ]);
    return [...keys].reduce((total, key) => (
      total + countLeafChanges(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
      )
    ), 0);
  }
  return 1;
}

export function countCostingChangesBySection(
  config: CostingControlConfigV1,
  baseline: CostingControlConfigV1,
): Record<Exclude<CostingControlSection, 'comparison' | 'publish'>, number> {
  return {
    materials: countLeafChanges(config.materialRatesExGst, baseline.materialRatesExGst),
    labour: countLeafChanges(config.labour, baseline.labour),
    overheads: countLeafChanges(config.overheads, baseline.overheads),
    rules: countLeafChanges(config.rules, baseline.rules),
  };
}

export type NumberFieldMetadata = {
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
};

type OverheadKey = keyof CostingControlConfigV1['overheads'];
type RuleNumberKey = Exclude<keyof CostingControlConfigV1['rules'], 'stockLengthPreferenceM'>;

export const OVERHEAD_FIELDS: Array<NumberFieldMetadata & { key: OverheadKey }> = [
  {
    key: 'crewDayHours',
    label: 'Crew day length',
    description: 'Hours used to convert estimated labour time into chargeable crew days.',
    unit: 'hours',
    min: 1,
    max: 24,
    step: 0.25,
  },
  {
    key: 'opsFixedPerJobExGst',
    label: 'Operations setup per job',
    description: 'Fixed operations and delivery allowance applied once to each job.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'opsVariablePerCrewDayExGst',
    label: 'Operations per crew day',
    description: 'Variable operations and delivery allowance for each calculated crew day.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'gableStartupPerPergolaExGst',
    label: 'Gable setup per pergola',
    description: 'Additional operations allowance for every gable pergola.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'boxPerimeterStartupPerPergolaExGst',
    label: 'Box perimeter setup per pergola',
    description: 'Additional operations allowance when a box perimeter is used.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'timberPerRoundedCrewDayExGst',
    label: 'Timber allowance per crew day',
    description: 'Timber-specific operations allowance applied to each rounded crew day.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'salesPerJobExGst',
    label: 'Sales and design per job',
    description: 'Base sales and design allowance applied once to each job.',
    unit: '$ ex GST',
    min: 0,
    max: 10_000_000,
  },
  {
    key: 'salesExtraModuleFactor',
    label: 'Extra module sales factor',
    description: 'Multiplier used to scale the sales and design allowance for extra modules.',
    unit: 'multiplier',
    min: 0,
    max: 10,
    step: 0.01,
  },
];

export const RULE_FIELDS: Array<NumberFieldMetadata & { key: RuleNumberKey }> = [
  {
    key: 'overhangDefaultM',
    label: 'Default roof overhang',
    description: 'Default overhang used when the calculator has no explicit value.',
    unit: 'm',
    min: 0,
    max: 10,
    step: 0.01,
  },
  {
    key: 'overhangMinM',
    label: 'Minimum roof overhang',
    description: 'Smallest overhang accepted by the supported package-owned rule.',
    unit: 'm',
    min: 0,
    max: 10,
    step: 0.01,
  },
  {
    key: 'overhangMaxM',
    label: 'Maximum roof overhang',
    description: 'Largest overhang accepted by the supported package-owned rule.',
    unit: 'm',
    min: 0,
    max: 10,
    step: 0.01,
  },
  {
    key: 'boxBeamDepthMm',
    label: 'Box beam depth',
    description: 'Beam depth used by the box-perimeter geometry rule.',
    unit: 'mm',
    min: 1,
    max: 2_000,
  },
  {
    key: 'boxRafterDepthMm',
    label: 'Box rafter depth',
    description: 'Rafter depth used by the box-perimeter geometry rule.',
    unit: 'mm',
    min: 1,
    max: 1_000,
  },
  {
    key: 'boxRoofAllowanceAboveRafterMm',
    label: 'Roof allowance above rafter',
    description: 'Vertical allowance above the rafter in box-perimeter calculations.',
    unit: 'mm',
    min: 0,
    max: 1_000,
  },
  {
    key: 'boxMaxFallMm',
    label: 'Maximum box fall',
    description: 'Maximum supported vertical fall for a box-perimeter roof.',
    unit: 'mm',
    min: 0,
    max: 5_000,
  },
  {
    key: 'boxMinPitchDeg',
    label: 'Minimum box roof pitch',
    description: 'Minimum supported pitch used by box-perimeter geometry.',
    unit: 'degrees',
    min: 0,
    max: 89,
    step: 0.1,
  },
  {
    key: 'boxPitchedHouseSetbackMm',
    label: 'Pitched roof house setback',
    description: 'House-side setback used for pitched box-perimeter roofs.',
    unit: 'mm',
    min: 0,
    max: 5_000,
  },
  {
    key: 'boxPitchedOuterSetbackMm',
    label: 'Pitched roof outer setback',
    description: 'Outer-side setback used for pitched box-perimeter roofs.',
    unit: 'mm',
    min: 0,
    max: 5_000,
  },
  {
    key: 'boxGableEaveSetbackMm',
    label: 'Gable eave setback',
    description: 'Eave setback used for gable box-perimeter roofs.',
    unit: 'mm',
    min: 0,
    max: 5_000,
  },
  {
    key: 'boxGableRidgeAllowanceMm',
    label: 'Gable ridge allowance',
    description: 'Additional ridge allowance used for gable box-perimeter roofs.',
    unit: 'mm',
    min: 0,
    max: 5_000,
  },
  {
    key: 'acrylicMaxSlopeM',
    label: 'Maximum acrylic slope length',
    description: 'Maximum supported sheet length measured along an acrylic roof slope.',
    unit: 'm',
    min: 0.1,
    max: 50,
    step: 0.1,
  },
  {
    key: 'cedarCoverM',
    label: 'Cedar board cover',
    description: 'Effective cover width used when calculating cedar sarking quantities.',
    unit: 'm',
    min: 0.001,
    max: 5,
    step: 0.001,
  },
  {
    key: 'cedarWasteFactor',
    label: 'Cedar wastage factor',
    description: 'Additional cedar quantity allowance. For example, 0.10 represents 10%.',
    unit: 'factor',
    min: 0,
    max: 5,
    step: 0.01,
  },
];

export const LABOUR_FIELD_METADATA = {
  crewHourRateExGst: {
    label: 'Crew hourly rate',
    description: 'Base charge for one crew hour before action time and allowance multipliers.',
    unit: '$ ex GST / hour',
    min: 0.01,
    max: 10_000,
    step: 0.01,
  },
  actionMinutes: {
    description: 'Base crew time used for this installation action before supported multipliers.',
    unit: 'minutes',
    min: 0,
    max: 10_080,
    step: 1,
  },
  multiplier: {
    description: 'Named multiplier consumed by a package-owned installation rule.',
    unit: 'multiplier',
    min: 0.01,
    max: 10,
    step: 0.01,
  },
  curveLength: {
    description: 'Rafter length threshold for this point in the loading curve.',
    unit: 'm',
    min: 0,
    max: 50,
    step: 0.1,
  },
  curveMinutes: {
    description: 'Crew minutes per metre used at this point in the loading curve.',
    unit: 'minutes / m',
    min: 0,
    max: 1_000,
    step: 0.1,
  },
} satisfies Record<string, Omit<NumberFieldMetadata, 'label'> | NumberFieldMetadata>;

export const STOCK_LENGTH_METADATA: Omit<NumberFieldMetadata, 'label'> = {
  description: 'Preferred purchasable stock length used by the package-owned BOM strategy.',
  unit: 'm',
  min: 0.1,
  max: 50,
  step: 0.1,
};

export function findIssue(issues: ValidationIssue[], path: string): ValidationIssue | undefined {
  return issues.find((issue) => (
    issue.path === path
    || issue.path?.startsWith(`${path}.`)
    || path.startsWith(`${issue.path}.`)
  ));
}

export function sectionForIssuePath(path: string | undefined): CostingControlSection | null {
  if (!path) return null;
  if (path.startsWith('materialRatesExGst.')) return 'materials';
  if (path.startsWith('labour.')) return 'labour';
  if (path.startsWith('overheads.')) return 'overheads';
  if (path.startsWith('rules.')) return 'rules';
  return null;
}

export function titleCaseKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatSettingPath(
  path: string,
  materialLabels: Map<string, string>,
  actionLabels: Map<string, string>,
): string {
  if (path.startsWith('materialRatesExGst.')) {
    const id = path.slice('materialRatesExGst.'.length);
    return `${materialLabels.get(id) ?? titleCaseKey(id)} — material rate`;
  }
  if (path === 'labour.crewHourRateExGst') return LABOUR_FIELD_METADATA.crewHourRateExGst.label;
  if (path.startsWith('labour.actionBaseMinutes.')) {
    const remainder = path.slice('labour.actionBaseMinutes.'.length);
    const actionId = [...actionLabels.keys()].find((id) => remainder === id || remainder.startsWith(`${id}.`));
    if (actionId) {
      const profile = remainder
        .slice(actionId.length)
        .replace(/^\.minutes_by_profile\./, '');
      return profile
        ? `${actionLabels.get(actionId)} — ${titleCaseKey(profile)} time`
        : `${actionLabels.get(actionId)} — base time`;
    }
  }
  if (path.startsWith('labour.multiplierValues.')) {
    return `${titleCaseKey(path.slice('labour.multiplierValues.'.length).replace('.', ' — '))} multiplier`;
  }
  const curveMatch = /^labour\.rafterLengthLoadingCurve\.(\d+)\.(length_m|minutes_per_m)$/.exec(path);
  if (curveMatch) {
    return `Rafter loading point ${Number(curveMatch[1]) + 1} — ${
      curveMatch[2] === 'length_m' ? 'length' : 'minutes per metre'
    }`;
  }
  const overhead = OVERHEAD_FIELDS.find((field) => path === `overheads.${field.key}`);
  if (overhead) return overhead.label;
  const rule = RULE_FIELDS.find((field) => path === `rules.${field.key}`);
  if (rule) return rule.label;
  const stockMatch = /^rules\.stockLengthPreferenceM\.(\d+)$/.exec(path);
  if (stockMatch) return `Stock length preference ${Number(stockMatch[1]) + 1}`;
  return titleCaseKey(path.split('.').at(-1) ?? path);
}

export function formatSettingValue(path: string, value: number | string | null): string {
  if (value === null) return 'Not set';
  if (typeof value === 'string') return value;
  const isCurrency = path.startsWith('materialRatesExGst.')
    || path === 'labour.crewHourRateExGst'
    || (
      path.startsWith('overheads.')
      && path !== 'overheads.crewDayHours'
      && path !== 'overheads.salesExtraModuleFactor'
    );
  if (isCurrency) {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 4 }).format(value);
}

export function formatCostingDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not recorded';
}
