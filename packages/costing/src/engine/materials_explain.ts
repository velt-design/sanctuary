import type { DerivedV1, InputsNormalizedV1 } from './types';

export type MaterialsExplainDetail = 'summary' | 'full';

export type TruncationEvent = {
  scope: string;
  reason: string;
  dropped_count?: number;
};

export type ExplainValue = {
  label: string;
  formula: string;
  deps: Record<string, unknown>;
  result: unknown;
  units?: string;
};

export type ExplainDecision = {
  label: string;
  condition: string;
  deps: Record<string, unknown>;
  result: boolean;
  branch_taken?: string;
};

export type CutItemExplain = {
  origin_id: string;
  component: string;
  join_policy: 'single' | 'joinable';
  origin_len_m: number;
  length_m: number;
  segment_index: number;
  source_call_index?: number;
};

export type AddCutsExplain = {
  component: string;
  profile: string;
  colour: string;
  finish: 'default' | 'raw_mill';
  join_policy: 'single' | 'joinable';
  origin_prefix: string;
  formula: string;
  deps: Record<string, unknown>;
  generated_count: number;
  generated_length_mode: 'uniform' | 'list';
  uniform_length_m?: number;
  list_sample_m?: number[];
};

export type StockCandidateExplain = {
  item_id: string;
  name: string;
  stock_length_m: number;
  unit_cost_ex_gst: number;
  powdercoat?: {
    applied: boolean;
    base_cost_ex_gst: number;
    powdercoat_cost_ex_gst: number;
    multiplier: number;
    colour_used: string;
    effective_cost_ex_gst: number;
    formula: string;
  };
};

export type StockSelectionExplain = {
  preferred_stock_lengths_m: number[];
  has_continuous_run: boolean;
  continuous_run_targets_m: number[];
  evaluated: Array<{
    stock_length_m: number;
    unit_cost_ex_gst: number;
    expanded_cuts_count: number;
    bars_used: number;
    waste_m: number;
    total_cost_ex_gst: number;
    cost_per_m: number;
    is_exact_fit: boolean;
    splice_joins?: number;
    rejected_reason?: string;
  }>;
  chosen: { item_id: string; stock_length_m: number; bars_used: number; waste_m: number; splice_joins?: number };
  rule: string;
};

export type BinPackPlanExplain = {
  algorithm: 'first_fit_descending';
  stock_length_m: number;
  bars: Array<{
    index: number;
    used_m: number;
    remaining_m: number;
    cuts: Array<{ origin_id: string; component: string; segment_index: number; length_m: number }>;
  }>;
  totals: { total_cut_m: number; total_stock_m: number; waste_m: number };
  truncated: boolean;
};

export type CutGroupExplain = {
  profile: string;
  colour: string;
  finish: 'default' | 'raw_mill';
  components: string[];
  add_cuts_calls: AddCutsExplain[];
  cuts_summary: {
    count: number;
    total_cut_m: number;
    min_m: number;
    max_m: number;
    histogram?: Array<{ bucket_m: number; count: number }>;
    sample?: Array<CutItemExplain>;
  };
  cuts_full?: Array<CutItemExplain>;
  joinable_originals_summary: {
    count: number;
    max_origin_len_m: number;
    origins_exceeding_stock_count?: number;
    sample?: Array<{ origin_id: string; origin_len_m: number; joins_needed?: number }>;
  };
  joinable_originals_full?: Array<{ origin_id: string; origin_len_m: number; joins_needed?: number }>;
  stock_candidates: StockCandidateExplain[];
  selection: StockSelectionExplain | null;
  pack_plan?: BinPackPlanExplain;
  output_line_index?: number;
  output_line_id?: string;
  totals?: {
    bars_used: number;
    stock_length_m: number;
    waste_m: number;
    unit_cost_ex_gst: number;
    line_cost_ex_gst: number;
    splice_joins_in_group: number;
  };
};

type MaterialsLineExplainBase = {
  line_index: number;
  line_id: string;
  label: string;
  unit: string;
  qty: number;
  unit_cost_ex_gst: number;
  line_cost_ex_gst: number;
};

export type MaterialsLineExplain =
  | (MaterialsLineExplainBase & { kind: 'extrusion_bar'; cut_group_key: string; notes_formula?: string })
  | (MaterialsLineExplainBase & { kind: 'acrylic_sheet_or_strip'; formula: string; deps: Record<string, unknown> })
  | (MaterialsLineExplainBase & {
      kind: 'rule_hardware';
      rule_id: string;
      applies_when: Record<string, unknown>;
      applied: boolean;
      expr: string;
      vars_used: Record<string, number>;
      result_qty: number;
    })
  | (MaterialsLineExplainBase & { kind: 'simple'; formula: string; deps: Record<string, unknown> });

export type MaterialsExplainV1 = {
  version: 'materials_explain_v1';
  created_at: string;
  inputs_normalized_snapshot: Record<string, unknown>;
  derived_snapshot: Record<string, unknown>;
  decisions: ExplainDecision[];
  globals: Record<string, ExplainValue>;
  cut_groups: Record<string, CutGroupExplain>;
  lines: Record<string, MaterialsLineExplain>;
  warnings: string[];
  truncation: TruncationEvent[];
  stats: {
    detail: MaterialsExplainDetail;
    focus_line_index?: number;
    focus_cut_group_key?: string;
    total_cut_groups: number;
    total_lines: number;
    payload_truncated: boolean;
  };
};

export type MaterialsExplainOptions = {
  detail?: MaterialsExplainDetail;
  focus_line_index?: number;
  focus_cut_group_key?: string;
  caps?: {
    max_cut_items_per_group?: number;
    sample_cut_items_per_group?: number;
    max_histogram_buckets?: number;
    max_binpack_bars?: number;
  };
};

export type MaterialsExplainCaps = Required<NonNullable<MaterialsExplainOptions['caps']>>;

const DEFAULT_CAPS: MaterialsExplainCaps = {
  max_cut_items_per_group: 4000,
  sample_cut_items_per_group: 50,
  max_histogram_buckets: 20,
  max_binpack_bars: 200,
};

export function resolveMaterialsExplainCaps(opts?: MaterialsExplainOptions): MaterialsExplainCaps {
  return {
    max_cut_items_per_group: Math.max(1, Math.round(Number(opts?.caps?.max_cut_items_per_group ?? DEFAULT_CAPS.max_cut_items_per_group))),
    sample_cut_items_per_group: Math.max(
      1,
      Math.round(Number(opts?.caps?.sample_cut_items_per_group ?? DEFAULT_CAPS.sample_cut_items_per_group)),
    ),
    max_histogram_buckets: Math.max(1, Math.round(Number(opts?.caps?.max_histogram_buckets ?? DEFAULT_CAPS.max_histogram_buckets))),
    max_binpack_bars: Math.max(1, Math.round(Number(opts?.caps?.max_binpack_bars ?? DEFAULT_CAPS.max_binpack_bars))),
  };
}

export type MaterialsExplainCollector = {
  value(key: string, v: ExplainValue): void;
  decision(d: ExplainDecision): void;
  addCuts(groupKey: string, call: AddCutsExplain): void;
  cutGroupCuts(groupKey: string, cuts: CutItemExplain[], mode: 'append'): void;
  cutGroupMeta(groupKey: string, meta: { profile: string; colour: string; finish: 'default' | 'raw_mill'; component?: string }): void;
  joinableOriginals(groupKey: string, originals: Array<{ origin_id: string; origin_len_m: number; joins_needed?: number }>): void;
  stockCandidates(groupKey: string, candidates: StockCandidateExplain[]): void;
  stockSelection(groupKey: string, selection: StockSelectionExplain): void;
  binPackPlan(groupKey: string, plan: BinPackPlanExplain): void;
  cutGroupTotals(
    groupKey: string,
    totals: {
      bars_used: number;
      stock_length_m: number;
      waste_m: number;
      unit_cost_ex_gst: number;
      line_cost_ex_gst: number;
      splice_joins_in_group: number;
    },
  ): void;
  linkLine(lineIndex: number, explain: MaterialsLineExplain): void;
  warn(msg: string): void;
  truncate(ev: TruncationEvent): void;
  focusGroup(groupKey: string): void;
  isFocusedGroup(groupKey: string): boolean;
  shouldCollectFullGroup(groupKey: string): boolean;
  finalize(meta: { total_cut_groups: number; total_lines: number; focus_cut_group_key?: string }): void;
};

function round(n: number, digits = 4): number {
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function keyToDefaultGroupMeta(groupKey: string): { profile: string; colour: string; finish: 'default' | 'raw_mill' } {
  const [profile = '', colour = '', finish = 'default'] = String(groupKey).split('__');
  return {
    profile,
    colour,
    finish: finish === 'raw_mill' ? 'raw_mill' : 'default',
  };
}

function createCutGroup(groupKey: string): CutGroupExplain {
  const parsed = keyToDefaultGroupMeta(groupKey);
  return {
    profile: parsed.profile,
    colour: parsed.colour,
    finish: parsed.finish,
    components: [],
    add_cuts_calls: [],
    cuts_summary: {
      count: 0,
      total_cut_m: 0,
      min_m: 0,
      max_m: 0,
      histogram: [],
      sample: [],
    },
    joinable_originals_summary: {
      count: 0,
      max_origin_len_m: 0,
      sample: [],
    },
    stock_candidates: [],
    selection: null,
  };
}

export function createMaterialsExplainCollector(options?: MaterialsExplainOptions): {
  collector: MaterialsExplainCollector;
  output: MaterialsExplainV1;
  caps: MaterialsExplainCaps;
} {
  const detail: MaterialsExplainDetail = options?.detail === 'full' ? 'full' : 'summary';
  const caps = resolveMaterialsExplainCaps(options);
  const focusedGroups = new Set<string>(options?.focus_cut_group_key ? [options.focus_cut_group_key] : []);
  const bucketMaps = new Map<string, Map<number, number>>();
  let payloadTruncated = false;

  const output: MaterialsExplainV1 = {
    version: 'materials_explain_v1',
    created_at: new Date().toISOString(),
    inputs_normalized_snapshot: {},
    derived_snapshot: {},
    decisions: [],
    globals: {},
    cut_groups: {},
    lines: {},
    warnings: [],
    truncation: [],
    stats: {
      detail,
      focus_line_index: typeof options?.focus_line_index === 'number' ? options.focus_line_index : undefined,
      focus_cut_group_key: options?.focus_cut_group_key,
      total_cut_groups: 0,
      total_lines: 0,
      payload_truncated: false,
    },
  };

  const ensureGroup = (groupKey: string): CutGroupExplain => {
    const key = String(groupKey);
    if (!output.cut_groups[key]) output.cut_groups[key] = createCutGroup(key);
    if (!bucketMaps.has(key)) bucketMaps.set(key, new Map<number, number>());
    return output.cut_groups[key];
  };

  const truncate = (event: TruncationEvent) => {
    payloadTruncated = true;
    output.truncation.push(event);
  };

  const isFocusedGroup = (groupKey: string): boolean => focusedGroups.has(String(groupKey));

  const shouldCollectFullGroup = (groupKey: string): boolean => detail === 'full' || isFocusedGroup(groupKey);

  const collector: MaterialsExplainCollector = {
    value(key, value) {
      output.globals[String(key)] = value;
    },
    decision(decision) {
      output.decisions.push(decision);
    },
    addCuts(groupKey, call) {
      const group = ensureGroup(groupKey);
      group.profile = call.profile;
      group.colour = call.colour;
      group.finish = call.finish;
      if (!group.components.includes(call.component)) group.components.push(call.component);
      group.add_cuts_calls.push(call);
    },
    cutGroupMeta(groupKey, meta) {
      const group = ensureGroup(groupKey);
      group.profile = meta.profile;
      group.colour = meta.colour;
      group.finish = meta.finish;
      if (meta.component && !group.components.includes(meta.component)) group.components.push(meta.component);
    },
    cutGroupCuts(groupKey, cuts) {
      const key = String(groupKey);
      if (!cuts.length) return;
      const group = ensureGroup(key);
      const bucketMap = bucketMaps.get(key) as Map<number, number>;
      for (const cut of cuts) {
        const len = Number(cut.length_m ?? 0);
        if (!Number.isFinite(len) || len <= 0) continue;

        const summary = group.cuts_summary;
        summary.count += 1;
        summary.total_cut_m = round(summary.total_cut_m + len, 6);
        summary.min_m = summary.count === 1 ? len : Math.min(summary.min_m, len);
        summary.max_m = summary.count === 1 ? len : Math.max(summary.max_m, len);

        const bucket = round(Math.round(len * 20) / 20, 3);
        bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);

        const sample = summary.sample ?? [];
        if (sample.length < caps.sample_cut_items_per_group) {
          sample.push(cut);
          summary.sample = sample;
        }

        if (shouldCollectFullGroup(key)) {
          if (!group.cuts_full) group.cuts_full = [];
          if (group.cuts_full.length < caps.max_cut_items_per_group) {
            group.cuts_full.push(cut);
          } else {
            truncate({
              scope: `cut_groups.${key}.cuts_full`,
              reason: 'max_cut_items_per_group',
              dropped_count: 1,
            });
          }
        }
      }

      const sortedBuckets = [...bucketMap.entries()].sort((a, b) => a[0] - b[0]);
      const limited = sortedBuckets.slice(0, caps.max_histogram_buckets);
      if (sortedBuckets.length > caps.max_histogram_buckets) {
        truncate({
          scope: `cut_groups.${key}.cuts_summary.histogram`,
          reason: 'max_histogram_buckets',
          dropped_count: sortedBuckets.length - limited.length,
        });
      }
      group.cuts_summary.histogram = limited.map(([bucket, count]) => ({ bucket_m: bucket, count }));
    },
    joinableOriginals(groupKey, originals) {
      const key = String(groupKey);
      const group = ensureGroup(key);
      const summary = group.joinable_originals_summary;
      let exceedingCount = Number(summary.origins_exceeding_stock_count ?? 0);

      for (const original of originals) {
        const len = Number(original.origin_len_m ?? 0);
        if (!Number.isFinite(len) || len <= 0) continue;
        summary.count += 1;
        summary.max_origin_len_m = Math.max(summary.max_origin_len_m, len);
        if (Number(original.joins_needed ?? 0) > 0) exceedingCount += 1;

        const sample = summary.sample ?? [];
        if (sample.length < caps.sample_cut_items_per_group) {
          sample.push({ origin_id: original.origin_id, origin_len_m: len, joins_needed: original.joins_needed });
          summary.sample = sample;
        }

        if (shouldCollectFullGroup(key)) {
          if (!group.joinable_originals_full) group.joinable_originals_full = [];
          if (group.joinable_originals_full.length < caps.max_cut_items_per_group) {
            group.joinable_originals_full.push({
              origin_id: original.origin_id,
              origin_len_m: len,
              joins_needed: original.joins_needed,
            });
          } else {
            truncate({
              scope: `cut_groups.${key}.joinable_originals_full`,
              reason: 'max_cut_items_per_group',
              dropped_count: 1,
            });
          }
        }
      }
      summary.origins_exceeding_stock_count = exceedingCount;
    },
    stockCandidates(groupKey, candidates) {
      const group = ensureGroup(groupKey);
      group.stock_candidates = candidates;
    },
    stockSelection(groupKey, selection) {
      const group = ensureGroup(groupKey);
      group.selection = selection;
    },
    binPackPlan(groupKey, plan) {
      const key = String(groupKey);
      const group = ensureGroup(key);
      if (plan.bars.length > caps.max_binpack_bars) {
        truncate({
          scope: `cut_groups.${key}.pack_plan`,
          reason: 'max_binpack_bars',
          dropped_count: plan.bars.length - caps.max_binpack_bars,
        });
        group.pack_plan = {
          ...plan,
          bars: plan.bars.slice(0, caps.max_binpack_bars),
          truncated: true,
        };
        return;
      }
      group.pack_plan = plan;
    },
    cutGroupTotals(groupKey, totals) {
      const group = ensureGroup(groupKey);
      group.totals = totals;
    },
    linkLine(lineIndex, explain) {
      const key = String(lineIndex);
      output.lines[key] = explain;
      if (explain.kind === 'extrusion_bar') {
        const group = ensureGroup(explain.cut_group_key);
        group.output_line_index = lineIndex;
        group.output_line_id = explain.line_id;
      }
    },
    warn(msg) {
      output.warnings.push(msg);
    },
    truncate(event) {
      truncate(event);
    },
    focusGroup(groupKey) {
      const key = String(groupKey);
      focusedGroups.add(key);
      output.stats.focus_cut_group_key = key;
    },
    isFocusedGroup,
    shouldCollectFullGroup,
    finalize(meta) {
      output.stats.total_cut_groups = Math.max(0, Math.round(Number(meta.total_cut_groups ?? 0)));
      output.stats.total_lines = Math.max(0, Math.round(Number(meta.total_lines ?? 0)));
      if (meta.focus_cut_group_key) output.stats.focus_cut_group_key = meta.focus_cut_group_key;
      output.stats.payload_truncated = payloadTruncated || output.truncation.length > 0;

      for (const group of Object.values(output.cut_groups)) {
        group.components = [...new Set(group.components)].sort((a, b) => a.localeCompare(b));
        if (group.cuts_summary.count === 0) {
          group.cuts_summary.min_m = 0;
          group.cuts_summary.max_m = 0;
        } else {
          group.cuts_summary.total_cut_m = round(group.cuts_summary.total_cut_m, 6);
          group.cuts_summary.min_m = round(group.cuts_summary.min_m, 6);
          group.cuts_summary.max_m = round(group.cuts_summary.max_m, 6);
        }
      }
    },
  };

  return { collector, output, caps };
}

export function snapshotInputs(inputs: InputsNormalizedV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(inputs)) as Record<string, unknown>;
}

export function snapshotDerived(derived: DerivedV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(derived)) as Record<string, unknown>;
}
