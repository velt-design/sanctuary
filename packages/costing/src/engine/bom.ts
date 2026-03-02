import type { CostingConfigV1 } from './config';
import type { DerivedV1, FlashingBandV1, InputsNormalizedV1, MaterialsLineV1, MaterialsV1 } from './types';
import { evalArithmeticExpr } from './expr';
import { normaliseColour, normaliseProfile } from './normalise';
import {
  createMaterialsExplainCollector,
  type AddCutsExplain,
  type BinPackPlanExplain,
  type CutItemExplain,
  type MaterialsExplainCollector,
  type MaterialsExplainOptions,
  type MaterialsExplainV1,
  snapshotDerived,
  snapshotInputs,
} from './materials_explain';

type PricebookItem = CostingConfigV1['materials']['items'][number];

type BuildMaterialsResultV1 = {
  materials: MaterialsV1;
  notes_and_warnings: string[];
  derived_patch?: Partial<DerivedV1>;
};

type JoinPolicy = 'joinable' | 'single';
type FinishMode = 'default' | 'raw_mill';

type CutItem = {
  length_m: number;
  origin_id: string;
  origin_len_m: number;
  join_policy: JoinPolicy;
  segment_index: number;
  component: string;
  finish: FinishMode;
  source_call_index?: number;
};

type CutGroup = {
  profile: string;
  colour: InputsNormalizedV1['extrusion_colour'];
  finish: FinishMode;
  cuts: CutItem[];
  originals_joinable: Map<string, number>;
  components: Set<string>;
};

function evalQtyExpression(expr: string, vars: Record<string, number>): number {
  return evalArithmeticExpr(expr, (id) => {
    if (!Object.prototype.hasOwnProperty.call(vars, id)) throw new Error(`Unknown variable '${id}'`);
    return vars[id];
  });
}

function evalQtyExpressionExplain(
  expr: string,
  vars: Record<string, number>,
): { result: number; accessed: Record<string, number> } {
  const accessed: Record<string, number> = {};
  const result = evalArithmeticExpr(expr, (id) => {
    if (!Object.prototype.hasOwnProperty.call(vars, id)) throw new Error(`Unknown variable '${id}'`);
    const value = vars[id];
    accessed[id] = value;
    return value;
  });
  return { result, accessed };
}

function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

const ACRYLIC_JOINER_BOTTOM_FIXING_SPACING_M = 0.3;
const FLASHING_BAND_0_200: FlashingBandV1 = '0-200';
const FLASHING_BAND_201_300: FlashingBandV1 = '201-300';
const FLASHING_BAND_301_400: FlashingBandV1 = '301-400';
const FLASHING_BAND_ORDER: readonly FlashingBandV1[] = [FLASHING_BAND_0_200, FLASHING_BAND_201_300, FLASHING_BAND_301_400];
const FLASHING_MATERIALS_BY_BAND: Record<FlashingBandV1, { id: string; label: string; unit_cost_ex_gst: number }> = {
  [FLASHING_BAND_0_200]: {
    id: 'roof.flashing_0_200_m',
    label: 'Flashing 0-200mm',
    unit_cost_ex_gst: 15,
  },
  [FLASHING_BAND_201_300]: {
    id: 'roof.flashing_201_300_m',
    label: 'Flashing 201-300mm',
    unit_cost_ex_gst: 25,
  },
  [FLASHING_BAND_301_400]: {
    id: 'roof.flashing_301_400_m',
    label: 'Flashing 301-400mm',
    unit_cost_ex_gst: 35,
  },
};

function joinerBottomFixingsForRun(runLengthM: number): number {
  if (!Number.isFinite(runLengthM) || runLengthM <= 0) return 0;
  return Math.ceil(runLengthM / ACRYLIC_JOINER_BOTTOM_FIXING_SPACING_M) + 1;
}

const isContinuousRunComponent = (component?: string) => /gutter|ledger|beam|stringer/i.test(String(component ?? ''));
const STEEL_HIAB_ITEM_ID = 'hire.hiab_day';

function isSteelBeamProfile(profile: unknown): boolean {
  const normalized = normaliseProfile(String(profile ?? ''));
  return normalized === 'rhs150x50x3' || normalized === 'rhs150x50x3mm';
}

function resolveSteelBeamUsage(derived: DerivedV1): {
  front: boolean;
  tie: boolean;
  ridge: boolean;
  overhang: boolean;
  any: boolean;
} {
  const frontLength = Number((derived as any).front_beam_length_m ?? 0);
  const tieLength = Number((derived as any).tie_beam_length_m ?? 0);
  const gableFrameCount = Number((derived as any).gable_end_frame_count ?? 0);
  const ridgeLength = Number((derived as any).ridge_length_m ?? 0);
  const overhangLength = Number((derived as any).overhang_support_beam_length_m ?? 0);

  const front = isSteelBeamProfile((derived as any).front_beam_profile_used) && frontLength > 0;
  const tie = isSteelBeamProfile((derived as any).tie_beam_profile_used) && tieLength > 0 && gableFrameCount > 0;
  const ridge = isSteelBeamProfile((derived as any).ridge_beam_profile_used) && ridgeLength > 0;
  const overhang = isSteelBeamProfile((derived as any).overhang_support_beam_profile_used) && overhangLength > 0;

  return {
    front,
    tie,
    ridge,
    overhang,
    any: front || tie || ridge || overhang,
  };
}

function findRubberItem(config: CostingConfigV1, name: string): PricebookItem | null {
  return (
    config.materials.items.find(
      (it) => it.category === 'rubber' && it.unit === 'metre' && typeof it.name === 'string' && it.name.trim() === name,
    ) ?? null
  );
}

function findCrystalite620Item(
  config: CostingConfigV1,
  opts: { length_m: number; colour: 'Clear' | 'Opal' | 'Grey' },
): PricebookItem | null {
  return (
    config.materials.items.find((it) => {
      if (it.category !== 'roofing_sheet' || it.unit !== 'bar') return false;
      const attrs = it.attributes as Record<string, unknown> | undefined;
      if (!attrs) return false;
      return attrs.product === 'Crystalite 620mm' && attrs.colour === opts.colour && attrs.length_m === opts.length_m;
    }) ?? null
  );
}

function findPricebookItemById(config: CostingConfigV1, id: string): PricebookItem | null {
  const needle = String(id ?? '').trim();
  if (!needle) return null;
  return config.materials.items.find((it) => it.id === needle) ?? null;
}

function findPowdercoatBar(config: CostingConfigV1, profile: string, stockLengthM: number): PricebookItem | null {
  const targetProfile = normaliseProfile(profile);
  return (
    config.materials.items.find((item) => {
      if (item.category !== 'powdercoating' || item.unit !== 'bar') return false;
      const attrs = item.attributes as Record<string, unknown> | undefined;
      if (!attrs) return false;
      const itemProfile = attrs.profile;
      const itemLength = attrs.length_m;
      return (
        typeof itemProfile === 'string' &&
        normaliseProfile(itemProfile) === targetProfile &&
        typeof itemLength === 'number' &&
        Math.abs(itemLength - stockLengthM) < 1e-6
      );
    }) ?? null
  );
}

function splitIntoStockCuts(cut: CutItem, stockLengthM: number): CutItem[] {
  const originLen = Number(cut.origin_len_m ?? cut.length_m ?? 0);
  if (!Number.isFinite(originLen) || originLen <= 0) return [];
  if (!Number.isFinite(stockLengthM) || stockLengthM <= 0) {
    return [{ ...cut, length_m: originLen, segment_index: 0 }];
  }

  if (originLen <= stockLengthM + 1e-6) {
    return [{ ...cut, length_m: originLen, segment_index: 0 }];
  }

  if (cut.join_policy === 'single') {
    return [{ ...cut, length_m: originLen, segment_index: 0 }];
  }

  const segments: CutItem[] = [];
  let remaining = originLen;
  let segmentIndex = 0;
  while (remaining > stockLengthM + 1e-6) {
    segments.push({ ...cut, length_m: stockLengthM, segment_index: segmentIndex });
    remaining -= stockLengthM;
    segmentIndex += 1;
  }
  if (remaining > 1e-6) {
    segments.push({ ...cut, length_m: remaining, segment_index: segmentIndex });
  }
  return segments;
}

function pickBarsForProfile(
  config: CostingConfigV1,
  profile: string,
  colour: InputsNormalizedV1['extrusion_colour'],
): Array<PricebookItem & { stock_length_m: number }> {
  const targetProfile = normaliseProfile(profile);
  const targetColour = normaliseColour(colour);

  return config.materials.items
    .filter((item) => item.category === 'aluminium_extrusion' && item.unit === 'bar')
    .filter((item) => {
      const attrs = item.attributes as Record<string, unknown> | undefined;
      const itemProfile = attrs?.profile;
      const itemColour = attrs?.colour;
      const itemLength = attrs?.length_m;
      return (
        typeof itemProfile === 'string' &&
        normaliseProfile(itemProfile) === targetProfile &&
        typeof itemColour === 'string' &&
        normaliseColour(itemColour) === targetColour &&
        typeof itemLength === 'number' &&
        Number.isFinite(itemLength)
      );
    })
    .map((item) => ({
      ...item,
      stock_length_m: (item.attributes as any).length_m as number,
    }));
}

function greedyBinPack(cutsDesc: number[], stockLengthM: number): { barsUsed: number; wasteM: number } {
  const bars: number[] = [];

  for (const cut of cutsDesc) {
    if (!Number.isFinite(cut) || cut <= 0) continue;
    let placed = false;
    for (let i = 0; i < bars.length; i += 1) {
      if (bars[i] + 1e-6 >= cut) {
        bars[i] -= cut;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push(stockLengthM - cut);
  }

  const barsUsed = bars.length;
  const totalCut = sum(cutsDesc);
  const totalStock = barsUsed * stockLengthM;
  const wasteM = Math.max(0, totalStock - totalCut);
  return { barsUsed, wasteM };
}

function greedyBinPackPlan(cutsDesc: CutItem[], stockLengthM: number): BinPackPlanExplain {
  const cuts = [...cutsDesc]
    .filter((cut) => Number.isFinite(cut.length_m) && cut.length_m > 0)
    .sort((a, b) => b.length_m - a.length_m);
  const bars: Array<{
    used_m: number;
    remaining_m: number;
    cuts: Array<{ origin_id: string; component: string; segment_index: number; length_m: number }>;
  }> = [];

  for (const cut of cuts) {
    let placed = false;
    for (let i = 0; i < bars.length; i += 1) {
      if (bars[i].remaining_m + 1e-6 >= cut.length_m) {
        bars[i].remaining_m -= cut.length_m;
        bars[i].used_m += cut.length_m;
        bars[i].cuts.push({
          origin_id: cut.origin_id,
          component: cut.component,
          segment_index: cut.segment_index,
          length_m: cut.length_m,
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({
        used_m: cut.length_m,
        remaining_m: stockLengthM - cut.length_m,
        cuts: [
          {
            origin_id: cut.origin_id,
            component: cut.component,
            segment_index: cut.segment_index,
            length_m: cut.length_m,
          },
        ],
      });
    }
  }

  const totalCutM = sum(cuts.map((cut) => cut.length_m));
  const totalStockM = bars.length * stockLengthM;
  const wasteM = Math.max(0, totalStockM - totalCutM);
  return {
    algorithm: 'first_fit_descending',
    stock_length_m: stockLengthM,
    bars: bars.map((bar, idx) => ({
      index: idx,
      used_m: roundMoney(bar.used_m),
      remaining_m: roundMoney(Math.max(0, bar.remaining_m)),
      cuts: bar.cuts.map((cut) => ({
        origin_id: cut.origin_id,
        component: cut.component,
        segment_index: cut.segment_index,
        length_m: roundMoney(cut.length_m),
      })),
    })),
    totals: {
      total_cut_m: roundMoney(totalCutM),
      total_stock_m: roundMoney(totalStockM),
      waste_m: roundMoney(wasteM),
    },
    truncated: false,
  };
}

function expandCutsForStock(cuts: CutItem[], stockLengthM: number): CutItem[] | null {
  if (!Number.isFinite(stockLengthM) || stockLengthM <= 0) return null;
  const expanded: CutItem[] = [];

  for (const cut of cuts) {
    const originLen = Number(cut.origin_len_m ?? cut.length_m ?? 0);
    if (!Number.isFinite(originLen) || originLen <= 0) continue;
    if (originLen <= stockLengthM + 1e-6) {
      expanded.push({ ...cut, length_m: originLen, segment_index: 0 });
      continue;
    }
    if (cut.join_policy === 'single') return null;
    expanded.push(...splitIntoStockCuts(cut, stockLengthM));
  }

  return expanded;
}

function selectBestStock(
  bars: Array<PricebookItem & { stock_length_m: number }>,
  cuts: CutItem[],
  preferred: number[],
  opts?: { trace?: MaterialsExplainCollector; groupKey?: string },
): {
  bar: (PricebookItem & { stock_length_m: number }) | null;
  barsUsed: number;
  wasteM: number;
} {
  const EPS = 1e-6;
  const hasContinuousRun = cuts.some((cut) => isContinuousRunComponent(cut.component));
  const targets = new Set<number>();
  if (hasContinuousRun) {
    for (const cut of cuts) {
      if (!isContinuousRunComponent(cut.component)) continue;
      const len = Number(cut.length_m);
      if (!Number.isFinite(len) || len <= 0) continue;
      targets.add(len);
    }
  }

  type Candidate = {
    bar: PricebookItem & { stock_length_m: number };
    barsUsed: number;
    wasteM: number;
    totalCost: number;
    costPerM: number;
    isExactFit: boolean;
    spliceJoins: number;
  };
  const evaluated: Candidate[] = [];
  const computeSpliceJoins = (stockLen: number): number => {
    if (!Number.isFinite(stockLen) || stockLen <= 0) return 0;
    let joins = 0;
    for (const cut of cuts) {
      if (cut.join_policy !== 'joinable') continue;
      const originLen = Number(cut.origin_len_m ?? cut.length_m ?? 0);
      if (!Number.isFinite(originLen) || originLen <= 0) continue;
      if (originLen > stockLen + EPS) joins += Math.max(0, Math.ceil(originLen / stockLen) - 1);
    }
    return joins;
  };

  const candidates = bars
    .filter((b) => preferred.includes(b.stock_length_m))
    .sort((a, b) => preferred.indexOf(a.stock_length_m) - preferred.indexOf(b.stock_length_m));

  for (const bar of candidates) {
    const unitCost = (bar as any).cost_ex_gst as number;
    if (!Number.isFinite(unitCost)) continue;
    const expanded = expandCutsForStock(cuts, bar.stock_length_m);
    if (!expanded || expanded.length === 0) {
      continue;
    }
    const cutsDesc = [...expanded]
      .map((cut) => cut.length_m)
      .filter((len) => Number.isFinite(len) && len > 0)
      .sort((a, b) => b - a);
    const { barsUsed, wasteM } = greedyBinPack(cutsDesc, bar.stock_length_m);
    const totalCost = barsUsed * unitCost;
    const costPerM = unitCost / Math.max(bar.stock_length_m, 0.0001);
    const isExactFit = hasContinuousRun && Array.from(targets).some((t) => Math.abs(t - bar.stock_length_m) <= EPS);
    const spliceJoins = computeSpliceJoins(bar.stock_length_m);

    evaluated.push({ bar, barsUsed, wasteM, totalCost, costPerM, isExactFit, spliceJoins });
  }

  if (!evaluated.length) return { bar: null, barsUsed: 0, wasteM: 0 };

  const anyExactFit = hasContinuousRun && evaluated.some((candidate) => candidate.isExactFit);
  let best = evaluated[0];

  for (let i = 1; i < evaluated.length; i += 1) {
    const candidate = evaluated[i];

    if (hasContinuousRun) {
      if (candidate.spliceJoins < best.spliceJoins) {
        best = candidate;
        continue;
      }
      if (candidate.spliceJoins > best.spliceJoins) continue;

      if (anyExactFit) {
        if (candidate.isExactFit && !best.isExactFit) {
          best = candidate;
          continue;
        }
        if (!candidate.isExactFit && best.isExactFit) continue;
      }

      if (candidate.totalCost < best.totalCost - EPS) {
        best = candidate;
        continue;
      }
      if (Math.abs(candidate.totalCost - best.totalCost) <= EPS) {
        if (candidate.barsUsed < best.barsUsed) {
          best = candidate;
          continue;
        }
        if (candidate.barsUsed === best.barsUsed) {
          if (candidate.wasteM < best.wasteM - EPS) {
            best = candidate;
            continue;
          }
          if (Math.abs(candidate.wasteM - best.wasteM) <= EPS && candidate.costPerM < best.costPerM - EPS) {
            best = candidate;
          }
        }
      }
      continue;
    }

    const bestCostPerM = best.costPerM;
    if (candidate.costPerM < bestCostPerM - EPS) {
      best = candidate;
      continue;
    }
    if (Math.abs(candidate.costPerM - bestCostPerM) <= EPS) {
      if (candidate.wasteM < best.wasteM - EPS) {
        best = candidate;
        continue;
      }
      if (Math.abs(candidate.wasteM - best.wasteM) <= EPS && candidate.barsUsed < best.barsUsed) {
        best = candidate;
      }
    }
  }

  if (opts?.trace && opts.groupKey) {
    const preferredStockLengths = preferred.filter((n) => Number.isFinite(n) && n > 0);
    const targetLengths = Array.from(targets).sort((a, b) => a - b);
    opts.trace.stockSelection(opts.groupKey, {
      preferred_stock_lengths_m: preferredStockLengths,
      has_continuous_run: hasContinuousRun,
      continuous_run_targets_m: targetLengths,
      evaluated: evaluated.map((candidate) => ({
        stock_length_m: candidate.bar.stock_length_m,
        unit_cost_ex_gst: roundMoney(Number((candidate.bar as any).cost_ex_gst ?? 0)),
        expanded_cuts_count: expandCutsForStock(cuts, candidate.bar.stock_length_m)?.length ?? 0,
        bars_used: candidate.barsUsed,
        waste_m: roundMoney(candidate.wasteM),
        total_cost_ex_gst: roundMoney(candidate.totalCost),
        cost_per_m: roundMoney(candidate.costPerM),
        is_exact_fit: candidate.isExactFit,
        splice_joins: candidate.spliceJoins,
      })),
      chosen: {
        item_id: String(best.bar.id),
        stock_length_m: best.bar.stock_length_m,
        bars_used: best.barsUsed,
        waste_m: roundMoney(best.wasteM),
        splice_joins: best.spliceJoins,
      },
      rule: hasContinuousRun
        ? 'continuous-run: prefer least splice-joins, then exact-fit, then total-cost, then bars-used, then waste, then cost-per-m'
        : 'non-continuous: prefer lowest cost-per-m, then waste, then bars-used',
    });
  }

  return { bar: best.bar, barsUsed: best.barsUsed, wasteM: best.wasteM };
}

function findAcrylicSheetItem(config: CostingConfigV1): PricebookItem | null {
  const item = config.materials.items.find(
    (it) =>
      it.category === 'roofing_sheet' &&
      it.unit === 'sheet' &&
      typeof it.name === 'string' &&
      it.name.toLowerCase().includes('plexi sheet') &&
      it.name.toLowerCase().includes('clear'),
  );
  return item ?? null;
}

function findFoamItem(config: CostingConfigV1, colour: InputsNormalizedV1['extrusion_colour']): PricebookItem | null {
  const foamName = colour === 'Black' ? 'Foam 12mm (Black)' : 'Foam 12mm (White)';
  return (
    config.materials.items.find(
      (it) => it.category === 'consumable' && it.unit === 'metre' && typeof it.name === 'string' && it.name.trim() === foamName,
    ) ?? null
  );
}

function resolveFlashingBandTotals(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
): Record<FlashingBandV1, number> {
  const totals: Record<FlashingBandV1, number> = {
    '0-200': 0,
    '201-300': 0,
    '301-400': 0,
  };

  const fromInputs = (inputs as any).flashings?.totals_m_by_band as Record<string, unknown> | undefined;
  if (fromInputs && typeof fromInputs === 'object') {
    for (const band of FLASHING_BAND_ORDER) {
      const n = Number(fromInputs[band] ?? 0);
      totals[band] = Number.isFinite(n) && n > 0 ? n : 0;
    }
  }

  if (totals[FLASHING_BAND_0_200] + totals[FLASHING_BAND_201_300] + totals[FLASHING_BAND_301_400] <= 1e-9) {
    const d0 = Number((derived as any).flashing_0_200_total_m ?? 0);
    const d1 = Number((derived as any).flashing_201_300_total_m ?? 0);
    const d2 = Number((derived as any).flashing_301_400_total_m ?? 0);
    totals[FLASHING_BAND_0_200] = Number.isFinite(d0) && d0 > 0 ? d0 : 0;
    totals[FLASHING_BAND_201_300] = Number.isFinite(d1) && d1 > 0 ? d1 : 0;
    totals[FLASHING_BAND_301_400] = Number.isFinite(d2) && d2 > 0 ? d2 : 0;
  }

  if (totals[FLASHING_BAND_0_200] + totals[FLASHING_BAND_201_300] + totals[FLASHING_BAND_301_400] <= 1e-9) {
    const fallbackLength = Number(inputs.flashing_length_m ?? 0);
    if (Number.isFinite(fallbackLength) && fallbackLength > 0) {
      // Back-compat for older saved inputs that only have total flashing length.
      totals[FLASHING_BAND_0_200] = fallbackLength;
    }
  }

  return totals;
}

function pushFlashingMaterialLines(lines: MaterialsLineV1[], bandTotals: Record<FlashingBandV1, number>): void {
  for (const band of FLASHING_BAND_ORDER) {
    const qty = Math.max(0, Number(bandTotals[band] ?? 0));
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const item = FLASHING_MATERIALS_BY_BAND[band];
    lines.push({
      id: item.id,
      label: item.label,
      profile: null,
      unit: 'metre',
      qty: roundMoney(qty),
      unit_cost_ex_gst: roundMoney(item.unit_cost_ex_gst),
      line_cost_ex_gst: roundMoney(roundMoney(qty) * item.unit_cost_ex_gst),
      notes: `Flashing material (${band}mm band).`,
    });
  }
}

function rafterDepthM(profile: string): number {
  const normalized = normaliseProfile(profile);
  if (normalized === '80x50') return 0.08;
  if (normalized === '100x50') return 0.1;
  if (normalized === '150x50') return 0.15;
  return 0.1;
}

const TIMBER_EDGE_RAFTER_PROFILE = '150x50';
const TIMBER_PURLIN_PROFILE = '50x50';
const INFILL_SHEET_MAX_RUN_M = 3.05;
const INFILL_STRIP_MAX_RUN_M = 6.0;
const INFILL_SHEET_MAX_SHORT_SIDE_M = 1.2;
const INFILL_STRIP_MAX_SHORT_SIDE_M = 0.64;
const INFILL_SHEET_WASTE_FACTOR_DEFAULT = 0.15;

function clampPos(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function splitWidths(totalW: number, targetW: number): number[] {
  const total = Math.max(0, totalW);
  const target = Math.max(0.05, targetW);
  if (total <= 0) return [];
  const panelCount = Math.max(1, Math.ceil(total / target));
  const widths: number[] = [];
  const base = total / panelCount;
  for (let i = 0; i < panelCount; i += 1) widths.push(base);
  return widths;
}

function infillRunLimitForSource(source: 'strip_620' | 'sheet_panels'): number {
  return source === 'strip_620' ? INFILL_STRIP_MAX_RUN_M : INFILL_SHEET_MAX_RUN_M;
}

function pickInfillSourceForRun(
  preferred: 'strip_620' | 'sheet_panels',
  runSideM: number,
): { source: 'strip_620' | 'sheet_panels' | null; switched: boolean; runLimitM: number } {
  const preferredLimit = infillRunLimitForSource(preferred);
  if (runSideM <= preferredLimit + 1e-6) {
    return { source: preferred, switched: false, runLimitM: preferredLimit };
  }
  const fallback: 'strip_620' | 'sheet_panels' = preferred === 'sheet_panels' ? 'strip_620' : 'sheet_panels';
  const fallbackLimit = infillRunLimitForSource(fallback);
  if (runSideM <= fallbackLimit + 1e-6) {
    return { source: fallback, switched: true, runLimitM: fallbackLimit };
  }
  return { source: null, switched: false, runLimitM: Math.max(preferredLimit, fallbackLimit) };
}

function infillCentreLimitForSource(source: 'strip_620' | 'sheet_panels'): number {
  return source === 'strip_620' ? INFILL_STRIP_MAX_SHORT_SIDE_M : INFILL_SHEET_MAX_SHORT_SIDE_M;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type PendingLineExplain =
  | { kind: 'extrusion_bar'; cut_group_key: string; notes_formula?: string }
  | { kind: 'acrylic_sheet_or_strip'; formula: string; deps: Record<string, unknown> }
  | {
      kind: 'rule_hardware';
      rule_id: string;
      applies_when: Record<string, unknown>;
      applied: boolean;
      expr: string;
      vars_used: Record<string, number>;
      result_qty: number;
    }
  | { kind: 'simple'; formula: string; deps: Record<string, unknown> };

function buildMaterialsV1Internal(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
  config: CostingConfigV1,
  trace?: MaterialsExplainCollector,
  explainOpts?: MaterialsExplainOptions,
): BuildMaterialsResultV1 {
  const warnings: string[] = [];
  const lines: MaterialsLineV1[] = [];
  const lineExplainByRef = trace ? new Map<MaterialsLineV1, PendingLineExplain>() : null;
  const selectedExpandedCutsByGroup = trace ? new Map<string, { expandedCuts: CutItem[]; stockLengthM: number }>() : null;

  const pushWarning = (message: string) => {
    warnings.push(message);
    trace?.warn(message);
  };

  const annotateLine = (line: MaterialsLineV1, explain?: PendingLineExplain) => {
    if (!trace || !lineExplainByRef || !explain) return;
    lineExplainByRef.set(line, explain);
  };

  const preferredStockLengths = config.bomStrategy.settings.stock_length_preference_m;
  const powdercoatColourUsed = String((derived as any).powdercoat_colour_used ?? '');
  const powdercoatMultiplier = Number((derived as any).powdercoat_multiplier ?? 1);
  const steelBeamUsage = resolveSteelBeamUsage(derived);

  const cutGroups = new Map<string, CutGroup>();
  const originIdCounters = new Map<string, number>();
  const addCutsCallCounters = new Map<string, number>();

  const normaliseOriginPrefix = (value: string) => {
    const safe = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safe || 'member';
  };

  const nextOriginId = (prefix: string) => {
    const safePrefix = normaliseOriginPrefix(prefix);
    const current = originIdCounters.get(safePrefix) ?? 0;
    originIdCounters.set(safePrefix, current + 1);
    return `${safePrefix}_${current}`;
  };

  const addCuts = (
    profile: string,
    cutsM: number[],
    component: string,
    joinPolicy: JoinPolicy,
    opts?: {
      colour?: InputsNormalizedV1['extrusion_colour'];
      finish?: FinishMode;
      origin_prefix?: string;
      group_key?: string;
      explain?: { formula: string; deps: Record<string, unknown> };
    },
  ) => {
    if (!cutsM.length) return;
    const colour = opts?.colour ?? inputs.extrusion_colour;
    const finish: FinishMode = opts?.finish ?? 'default';
    const originPrefix = opts?.origin_prefix ?? component;
    const groupKeyRaw = opts?.group_key ?? opts?.origin_prefix ?? component;
    const componentKey = normaliseOriginPrefix(groupKeyRaw);
    const key = `${profile}__${colour}__${finish}__${componentKey}`;
    const nextCallIdx = addCutsCallCounters.get(key) ?? 0;
    addCutsCallCounters.set(key, nextCallIdx + 1);
    const generatedLengthMode: AddCutsExplain['generated_length_mode'] =
      cutsM.length > 1 && cutsM.some((len) => Math.abs(len - cutsM[0]) > 1e-6) ? 'list' : 'uniform';
    const addCutsExplain: AddCutsExplain = {
      component,
      profile,
      colour,
      finish,
      join_policy: joinPolicy,
      origin_prefix: originPrefix,
      formula: opts?.explain?.formula ?? `cuts = [${cutsM.slice(0, 6).map((n) => roundMoney(n)).join(', ')}${cutsM.length > 6 ? ', ...' : ''}]`,
      deps: {
        ...(opts?.explain?.deps ?? {}),
        generated_count: cutsM.length,
      },
      generated_count: cutsM.length,
      generated_length_mode: generatedLengthMode,
      uniform_length_m: generatedLengthMode === 'uniform' ? cutsM[0] : undefined,
      list_sample_m: generatedLengthMode === 'list' ? cutsM.slice(0, 12).map((n) => roundMoney(n)) : undefined,
    };
    trace?.cutGroupMeta(key, { profile, colour, finish, component });
    trace?.addCuts(key, addCutsExplain);

    const generatedCutExplain: CutItemExplain[] = [];
    const existing = cutGroups.get(key);
    if (existing) {
      cutsM.forEach((c) => {
        const originId = nextOriginId(originPrefix);
        const cutItem: CutItem = {
          length_m: c,
          origin_id: originId,
          origin_len_m: c,
          join_policy: joinPolicy,
          segment_index: 0,
          component,
          finish,
          source_call_index: nextCallIdx,
        };
        existing.cuts.push(cutItem);
        generatedCutExplain.push({
          origin_id: originId,
          component,
          join_policy: joinPolicy,
          origin_len_m: c,
          length_m: c,
          segment_index: 0,
          source_call_index: nextCallIdx,
        });
        if (joinPolicy === 'joinable' && Number.isFinite(c) && c > 0) {
          existing.originals_joinable.set(originId, c);
        }
      });
      existing.components.add(component);
      if (generatedCutExplain.length) trace?.cutGroupCuts(key, generatedCutExplain, 'append');
      return;
    }
    const groupCuts = cutsM.map((c) => {
      const originId = nextOriginId(originPrefix);
      generatedCutExplain.push({
        origin_id: originId,
        component,
        join_policy: joinPolicy,
        origin_len_m: c,
        length_m: c,
        segment_index: 0,
        source_call_index: nextCallIdx,
      });
      return {
        length_m: c,
        origin_id: originId,
        origin_len_m: c,
        join_policy: joinPolicy,
        segment_index: 0,
        component,
        finish,
        source_call_index: nextCallIdx,
      };
    });
    cutGroups.set(key, {
      profile,
      colour,
      finish,
      cuts: groupCuts,
      originals_joinable: new Map<string, number>(),
      components: new Set([component]),
    });
    if (generatedCutExplain.length) trace?.cutGroupCuts(key, generatedCutExplain, 'append');
    if (joinPolicy === 'joinable') {
      const group = cutGroups.get(key);
      if (group) {
        group.cuts.forEach((cut) => {
          if (Number.isFinite(cut.origin_len_m) && cut.origin_len_m > 0) {
            group.originals_joinable.set(cut.origin_id, cut.origin_len_m);
          }
        });
      }
    }
  };

  // === Extrusions (v1 assumptions) ===
  const waste_m_by_profile: Record<string, number> = {};
  const bars_by_profile: Record<string, { stock_length_m: number; bars_used: number }> = {};
  const waste_m_by_cut_group: Record<string, number> = {};
  const bars_by_cut_group: Record<string, { stock_length_m: number; bars_used: number }> = {};
  const bars_used_by_profile: Record<string, number> = {};
  const bars_used_by_profile_by_len: Record<string, Record<string, number>> = {};

  const addProfileWaste = (profile: string, wasteM: number) => {
    const waste = Number.isFinite(wasteM) ? wasteM : 0;
    waste_m_by_profile[profile] = roundMoney((waste_m_by_profile[profile] ?? 0) + waste);
  };

  const addProfileBars = (profile: string, stockLengthM: number, barsUsed: number) => {
    const used = Number.isFinite(barsUsed) ? barsUsed : 0;
    const stockLen = Number.isFinite(stockLengthM) ? stockLengthM : 0;
    if (used <= 0 || stockLen <= 0) return;
    bars_used_by_profile[profile] = (bars_used_by_profile[profile] ?? 0) + used;
    if (!bars_used_by_profile_by_len[profile]) bars_used_by_profile_by_len[profile] = {};
    const lenKey = String(stockLen);
    bars_used_by_profile_by_len[profile][lenKey] = (bars_used_by_profile_by_len[profile][lenKey] ?? 0) + used;
  };

  const addProfileTotals = (profile: string, stockLengthM: number, barsUsed: number, wasteM: number) => {
    addProfileWaste(profile, wasteM);
    addProfileBars(profile, stockLengthM, barsUsed);
  };

  const isHipCorner = inputs.roof_type === 'hip_corner';
  const hipCornerLengthB = Number(inputs.hip_corner_length_b_m ?? 0);
  const hipCornerProjectionB = Number(inputs.hip_corner_projection_b_m ?? 0);
  const roofPlaneCount = Math.max(1, Math.round(Number((derived as any).roof_plane_count ?? 1)));

  const roofPitchDegUsed = Number((derived as any).roof_pitch_deg_used ?? 0);
  const effectiveCos = Math.max(0.02, Math.cos((roofPitchDegUsed * Math.PI) / 180));
  const roofSetbackTotalM = 0.15;

  const rafterCountA = Math.max(0, Math.round(Number((derived as any).hip_corner_rafter_count_a ?? derived.rafter_count)));
  const rafterCountB = isHipCorner ? Math.max(0, Math.round(Number((derived as any).hip_corner_rafter_count_b ?? 0))) : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);
  const bayCountB = isHipCorner ? Math.max(0, rafterCountB - 1) : 0;

  const effectiveRunA = Math.max(0, inputs.projection_m - roofSetbackTotalM);
  const effectiveRunB = isHipCorner ? Math.max(0, hipCornerProjectionB - roofSetbackTotalM) : 0;

  const cutRafterLengthA = effectiveRunA / effectiveCos;
  const cutRafterLengthB = isHipCorner ? effectiveRunB / effectiveCos : 0;

  const joinerPieceLengthA = cutRafterLengthA + 0.02;
  const joinerPieceLengthB = isHipCorner ? cutRafterLengthB + 0.02 : 0;

  const rafterMultiplier = inputs.roof_type === 'low_gable' || inputs.roof_type === 'gable' || inputs.roof_type === 'hip' ? 2 : 1;
  const rafterPieceCount = Math.max(0, Math.round(derived.rafter_count * rafterMultiplier));
  const rafterLength = Number((derived as any).rafter_cut_length_m ?? (derived as any).rafter_length_m ?? (derived as any).rafter_length_m_assumed ?? inputs.projection_m);
  const isGableLike = inputs.roof_type === 'gable' || inputs.roof_type === 'low_gable';
  const gableHouseLen = Number((derived as any).rafter_cut_length_house_side_m ?? 0);
  const gableOuterLen = Number((derived as any).rafter_cut_length_outer_side_m ?? 0);
  const gableRafterCount = Math.max(0, Math.round(Number(derived.rafter_count ?? 0)));
  const isTimberRoof = inputs.roof_material === 'timber';
  const isMixedRoof = inputs.roof_material === 'mixed';
  const timberSlopeLenPerPlaneM = Number((derived as any).timber_slope_len_per_plane_m ?? rafterLength);
  const timberCommonRafterCountTotal = Math.max(0, Math.round(Number((derived as any).timber_common_rafter_count_total ?? 0)));
  const timberEdgeRafterCountTotal = Math.max(0, Math.round(Number((derived as any).timber_edge_rafter_count_total ?? 0)));
  const timberPurlinLinesPerPlane = Math.max(0, Math.round(Number((derived as any).timber_purlin_lines_per_plane ?? 0)));
  const timberPlaneCount = Math.max(1, Math.round(Number((derived as any).timber_plane_count ?? 1)));
  const timberPurlinTotalM = Math.max(0, Number((derived as any).timber_purlin_total_m ?? 0));
  const timberEdgeRafterProfileUsed = String((derived as any).timber_edge_rafter_profile_used ?? TIMBER_EDGE_RAFTER_PROFILE);
  const timberEdgeRafterFinishRaw = String((derived as any).timber_edge_rafter_finish_used ?? 'default');
  const timberEdgeRafterFinish: FinishMode = timberEdgeRafterFinishRaw === 'raw_mill' ? 'raw_mill' : 'default';

  const ledgerProfile = String((derived as any).ledger_profile_used ?? '100x50');
  const ledgerLengthM = Math.max(0, Number((derived as any).ledger_length_m ?? 0));
  const frontBeamProfile = String((derived as any).front_beam_profile_used ?? '');
  const tieBeamProfile = String((derived as any).tie_beam_profile_used ?? '');
  const strutProfile = String((derived as any).strut_profile_used ?? '');
  const ridgeBeamProfile = String((derived as any).ridge_beam_profile_used ?? '');
  const boxBeamProfile = String((derived as any).box_perimeter_beam_profile_used ?? '300x50');
  const postProfile = String((derived as any).post_profile_used ?? '100x100');
  const gableEndFrameCount = Math.max(0, Math.round(Number((derived as any).gable_end_frame_count ?? 0)));
  const tieBeamLength = Number((derived as any).tie_beam_length_m ?? 0);
  const kingpostStrutLength = Number((derived as any).kingpost_strut_length_m ?? 0);
  const gutterMode = String((derived as any).gutter_mode ?? 'default');
  const gutterAssemblyMode = String((derived as any).gutter_assembly_mode ?? 'none');
  const integratedGutterBeam = Boolean((derived as any).integrated_gutter_beam);
  const separateGutterLengthM = Number((derived as any).separate_gutter_length_m ?? 0);
  const overhangEnabled = Boolean((derived as any).overhang_enabled);
  const overhangSupportBeamProfile = (derived as any).overhang_support_beam_profile_used as string | undefined;
  const overhangSupportBeamLength = Number((derived as any).overhang_support_beam_length_m ?? 0);
  const overhangStringerProfile = (derived as any).overhang_stringer_profile_used as string | undefined;
  const overhangStringerLength = Number((derived as any).overhang_stringer_length_m ?? 0);

  if (trace) {
    trace.value('roofSetbackTotalM', {
      label: 'Roof setback total',
      formula: '0.15',
      deps: {},
      result: roofSetbackTotalM,
      units: 'm',
    });
    trace.value('joinerPieceLengthA', {
      label: 'Joiner piece length A',
      formula: 'cutRafterLengthA + 0.02',
      deps: { cutRafterLengthA },
      result: joinerPieceLengthA,
      units: 'm',
    });
    trace.value('joinerPieceLengthB', {
      label: 'Joiner piece length B',
      formula: 'cutRafterLengthB + 0.02',
      deps: { cutRafterLengthB, isHipCorner },
      result: joinerPieceLengthB,
      units: 'm',
    });
    trace.decision({
      label: 'Rafter multiplier rule',
      condition: "inputs.roof_type in {'low_gable','gable','hip'}",
      deps: { 'inputs.roof_type': inputs.roof_type },
      result: rafterMultiplier === 2,
      branch_taken: rafterMultiplier === 2 ? 'double-rafters' : 'single-rafters',
    });
    trace.value('rafterMultiplier', {
      label: 'Rafter multiplier',
      formula: "inputs.roof_type in {'low_gable','gable','hip'} ? 2 : 1",
      deps: { 'inputs.roof_type': inputs.roof_type },
      result: rafterMultiplier,
    });
    trace.value('rafterPieceCount', {
      label: 'Rafter piece count',
      formula: 'round(derived.rafter_count * rafterMultiplier)',
      deps: { 'derived.rafter_count': derived.rafter_count, rafterMultiplier },
      result: rafterPieceCount,
      units: 'count',
    });
    trace.value('rafterLength', {
      label: 'Rafter cut length fallback',
      formula: 'derived.rafter_cut_length_m ?? derived.rafter_length_m ?? derived.rafter_length_m_assumed ?? inputs.projection_m',
      deps: {
        'derived.rafter_cut_length_m': (derived as any).rafter_cut_length_m,
        'derived.rafter_length_m': (derived as any).rafter_length_m,
        'derived.rafter_length_m_assumed': (derived as any).rafter_length_m_assumed,
        'inputs.projection_m': inputs.projection_m,
      },
      result: rafterLength,
      units: 'm',
    });
  }

  if (isTimberRoof) {
    if (timberCommonRafterCountTotal > 0) {
      addCuts(
        inputs.rafter_profile,
        Array.from({ length: timberCommonRafterCountTotal }).map(() => timberSlopeLenPerPlaneM),
        'Timber common rafters',
        'single',
        {
          colour: 'Mill',
          finish: 'raw_mill',
          origin_prefix: 'timber_common_rafter',
          group_key: 'rafters',
          explain: {
            formula: 'cuts = repeat(timberCommonRafterCountTotal, timberSlopeLenPerPlaneM)',
            deps: { timberCommonRafterCountTotal, timberSlopeLenPerPlaneM },
          },
        },
      );
    }
  } else if (isHipCorner) {
    addCuts(
      inputs.rafter_profile,
      [
        ...Array.from({ length: rafterCountA }).map(() => cutRafterLengthA),
        ...Array.from({ length: rafterCountB }).map(() => cutRafterLengthB),
      ],
      'Rafters',
      'single',
      {
        origin_prefix: 'rafter',
        group_key: 'rafters',
        explain: {
          formula: 'cuts = repeat(rafterCountA, cutRafterLengthA) + repeat(rafterCountB, cutRafterLengthB)',
          deps: { rafterCountA, cutRafterLengthA, rafterCountB, cutRafterLengthB },
        },
      },
    );
  } else if (isGableLike && gableHouseLen > 0 && gableOuterLen > 0 && gableRafterCount > 0) {
    addCuts(
      inputs.rafter_profile,
      Array.from({ length: gableRafterCount }).map(() => gableHouseLen),
      'Rafters (house side)',
      'single',
      { origin_prefix: 'rafter_house' },
    );
    addCuts(
      inputs.rafter_profile,
      Array.from({ length: gableRafterCount }).map(() => gableOuterLen),
      'Rafters (outer side)',
      'single',
      { origin_prefix: 'rafter_outer' },
    );
  } else {
    addCuts(
      inputs.rafter_profile,
      Array.from({ length: rafterPieceCount }).map(() => rafterLength),
      'Rafters',
      'single',
      {
        origin_prefix: 'rafter',
        group_key: 'rafters',
        explain: {
          formula:
            "rafterMultiplier = roof_type in {low_gable,gable,hip} ? 2 : 1; rafterPieceCount = round(derived.rafter_count * rafterMultiplier); cuts = repeat(rafterPieceCount, rafterLength)",
          deps: {
            'inputs.roof_type': inputs.roof_type,
            'derived.rafter_count': derived.rafter_count,
            rafterMultiplier,
            rafterPieceCount,
            rafterLength,
          },
        },
      },
    );
  }

  if (ledgerLengthM > 0) {
    if (isHipCorner) {
      addCuts(
        ledgerProfile,
        [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0),
        'Ledger',
        'joinable',
        {
          origin_prefix: 'ledger',
          group_key: 'ledger',
          explain: {
            formula: 'cuts = [inputs.length_m, hipCornerLengthB] filtered > 0',
            deps: { 'inputs.length_m': inputs.length_m, hipCornerLengthB },
          },
        },
      );
    } else {
      addCuts(ledgerProfile, [ledgerLengthM], 'Ledger', 'joinable', {
        origin_prefix: 'ledger',
        group_key: 'ledger',
        explain: {
          formula: 'cuts = [ledgerLengthM]',
          deps: { ledgerLengthM },
        },
      });
    }
  }

  if ((isTimberRoof || isMixedRoof) && timberEdgeRafterCountTotal > 0) {
    addCuts(
      timberEdgeRafterProfileUsed,
      Array.from({ length: timberEdgeRafterCountTotal }).map(() => timberSlopeLenPerPlaneM),
      'Timber edge rafters',
      'single',
      {
        colour: inputs.extrusion_colour,
        finish: timberEdgeRafterFinish,
        origin_prefix: 'timber_edge_rafter',
        group_key: 'timber_edge_rafters',
        explain: {
          formula: 'cuts = repeat(timberEdgeRafterCountTotal, timberSlopeLenPerPlaneM)',
          deps: { timberEdgeRafterCountTotal, timberSlopeLenPerPlaneM },
        },
      },
    );
  }

  if ((isTimberRoof || isMixedRoof) && timberPurlinLinesPerPlane > 0 && timberPurlinTotalM > 0) {
    const purlinPieces = timberPurlinLinesPerPlane * timberPlaneCount;
    const pieceLengthM = timberPurlinTotalM / Math.max(1, purlinPieces);
    if (!Number.isFinite(pieceLengthM) || pieceLengthM <= 0) {
      pushWarning('Invalid timber purlin length derived; skipping timber purlins.');
    } else {
      addCuts(
        TIMBER_PURLIN_PROFILE,
        Array.from({ length: purlinPieces }).map(() => pieceLengthM),
        'Timber purlins',
        'joinable',
        {
          colour: 'Mill',
          finish: 'raw_mill',
          origin_prefix: 'timber_purlin',
          group_key: 'timber_purlins',
          explain: {
            formula: 'purlinPieces = timberPurlinLinesPerPlane * timberPlaneCount; pieceLengthM = timberPurlinTotalM / purlinPieces; cuts = repeat(purlinPieces, pieceLengthM)',
            deps: { timberPurlinLinesPerPlane, timberPlaneCount, timberPurlinTotalM, purlinPieces, pieceLengthM },
          },
        },
      );
    }
  }

  addCuts(
    postProfile,
    Array.from({ length: inputs.post_count }).map(() => inputs.post_cut_height_m),
    'Posts',
    'single',
    {
      origin_prefix: 'post',
      group_key: 'posts',
      explain: {
        formula: 'cuts = repeat(inputs.post_count, inputs.post_cut_height_m)',
        deps: { 'inputs.post_count': inputs.post_count, 'inputs.post_cut_height_m': inputs.post_cut_height_m },
      },
    },
  );

  if (inputs.structure_type === 'pitched') {
    if (gutterMode === 'overhang_gutter_front_edge') {
      if (Number.isFinite(inputs.length_m) && inputs.length_m > 0) {
        addCuts(
          'Overhang Gutter 100x100',
          [inputs.length_m, inputs.length_m],
          'Overhang gutter (2× stock)',
          'joinable',
          { origin_prefix: 'overhang_gutter_run', group_key: 'overhang_gutter' },
        );
      }
    } else if (gutterAssemblyMode === 'separate') {
      if (Number.isFinite(separateGutterLengthM) && separateGutterLengthM > 0) {
        addCuts(
          'Box Gutter 100x100x3',
          [separateGutterLengthM, separateGutterLengthM],
          'Separate gutter (2× stock)',
          'joinable',
          { origin_prefix: 'separate_gutter_run', group_key: 'separate_gutter' },
        );
        pushWarning('Separate gutter uses 100x100 cut‑down stock; length doubled to allow for waste.');
      }
    } else if (inputs.gutter_type === 'sp_gutter') {
      if (isHipCorner) {
        addCuts(
          'SP Gutter',
          [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0),
          'SP gutter',
          'joinable',
          { origin_prefix: 'sp_gutter_run', group_key: 'sp_gutter' },
        );
      } else {
        const runCountRaw = Number((derived as any).sp_gutter_run_count ?? NaN);
        const runCount =
          Number.isFinite(runCountRaw) && runCountRaw >= 0 ? Math.round(runCountRaw) : 1;
        if (runCount === 1) {
          addCuts(
            'SP Gutter',
            [inputs.length_m],
            gutterMode === 'sp_gutter_house_edge' ? 'SP gutter (house edge)' : 'SP gutter',
            'joinable',
            { origin_prefix: 'sp_gutter_run', group_key: 'sp_gutter' },
          );
        } else if (runCount >= 2) {
          addCuts(
            'SP Gutter',
            [inputs.length_m, inputs.length_m],
            'SP gutter (2 eaves)',
            'joinable',
            { origin_prefix: 'sp_gutter_run', group_key: 'sp_gutter' },
          );
        }
      }
    }
  }

  if (inputs.structure_type === 'box_perimeter') {
    addCuts(
      boxBeamProfile,
      [inputs.length_m, inputs.length_m],
      'Box perimeter beams',
      'joinable',
      { origin_prefix: 'box_beam_sidea', group_key: 'box_perimeter_beams' },
    );
    addCuts(
      boxBeamProfile,
      [inputs.projection_m, inputs.projection_m],
      'Box perimeter beams',
      'joinable',
      { origin_prefix: 'box_beam_sideb', group_key: 'box_perimeter_beams' },
    );
    if (inputs.roof_type === 'gable' && Number.isFinite(derived.ridge_length_m) && derived.ridge_length_m > 0 && ridgeBeamProfile) {
      addCuts(ridgeBeamProfile, [derived.ridge_length_m], 'Ridge beam (box gable)', 'joinable', {
        origin_prefix: 'ridge_beam',
        group_key: 'ridge_beam',
      });
    }
    if (inputs.gutter_type === 'box_gutter_100x100_cut') {
      const gutterLength = Math.max(0, Number(inputs.gutter_length_m ?? 0));
      if (gutterLength > 0) {
        addCuts('Box Gutter 100x100x3', [gutterLength], 'Box perimeter gutter', 'joinable', {
          origin_prefix: 'box_gutter_run',
          group_key: 'box_perimeter_gutter',
        });
      }
    }
  }

  if (inputs.structure_type === 'pitched' && frontBeamProfile && !integratedGutterBeam) {
    if (isHipCorner) {
      addCuts(
        frontBeamProfile,
        [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0),
        'Front beam',
        'joinable',
        { origin_prefix: 'front_beam', group_key: 'front_beam' },
      );
    } else if (Number.isFinite(inputs.length_m) && inputs.length_m > 0) {
      addCuts(frontBeamProfile, [inputs.length_m], 'Front beam', 'joinable', {
        origin_prefix: 'front_beam',
        group_key: 'front_beam',
      });
    }
  }

  if (inputs.roof_type === 'gable' && gableEndFrameCount > 0) {
    if (tieBeamProfile && tieBeamLength > 0) {
      addCuts(
        tieBeamProfile,
        Array.from({ length: gableEndFrameCount }).map(() => tieBeamLength),
        'Gable tie beam',
        'joinable',
        { origin_prefix: 'tie_beam', group_key: 'tie_beam' },
      );
    }
    if (strutProfile && kingpostStrutLength > 0) {
      addCuts(
        strutProfile,
        Array.from({ length: gableEndFrameCount }).map(() => kingpostStrutLength),
        'King-post strut',
        'joinable',
        { origin_prefix: 'kingpost_strut', group_key: 'kingpost_strut' },
      );
    }
  }

  if (overhangEnabled) {
    if (overhangSupportBeamProfile && overhangSupportBeamLength > 0) {
      addCuts(overhangSupportBeamProfile, [overhangSupportBeamLength], 'Overhang support beam', 'joinable', {
        origin_prefix: 'overhang_support_beam',
        group_key: 'overhang_support_beam',
      });
    }
    if (overhangStringerProfile && overhangStringerLength > 0) {
      addCuts(overhangStringerProfile, [overhangStringerLength], 'Overhang end stringer', 'joinable', {
        origin_prefix: 'overhang_stringer',
        group_key: 'overhang_end_stringer',
      });
    }
  }

  // === Joiner system / acrylic components ===
  const acrylicRules = (config.rules as any)?.roofing?.acrylic as any;
  const acrylicMaxSlopeM = Number(acrylicRules?.max_slope_m ?? 6);
  const sheetCfg = acrylicRules?.formats?.sheet_2x3 as any;
  const stripCfg = acrylicRules?.formats?.strip_620 as any;

  const sheetLengthM = Number(sheetCfg?.sheet_length_m ?? 3.05);
  const sheetWidthM = Number(sheetCfg?.sheet_width_m ?? 2.03);
  const bayWidthM = Number(sheetCfg?.bay_width_m ?? 0.62);

  const plexiSheetIdClear = String(sheetCfg?.pricebook_sheet_ids?.Clear ?? '');
  const plexiSheetClear =
    findPricebookItemById(config, plexiSheetIdClear) ??
    config.materials.items.find((it) => it.category === 'roofing_sheet' && it.unit === 'sheet' && String(it.name ?? '').includes('(Clear)')) ??
    null;

  // Acrylic 620mm strips are costed separately (category roofing_sheet, unit bar).
  const stripLengths: number[] = Array.isArray(stripCfg?.available_strip_lengths_m)
    ? stripCfg.available_strip_lengths_m.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
    : [4, 5, 6];

  const pickStripStockLen = (requiredLen: number): number => {
    if (!Number.isFinite(requiredLen) || requiredLen <= 0) return Math.max(...stripLengths, 6);
    return stripLengths.find((l) => l >= requiredLen) ?? Math.max(...stripLengths, 6);
  };

  const recordCrystalite = (stockLen: number, barsUsed: number, wasteM: number) => {
    addProfileTotals('Crystalite 620mm', stockLen, barsUsed, wasteM);
  };

  const addCrystaliteLine = (opts: { requiredLen: number; qty: number; note: string; idSuffix?: string; cutCount?: number }) => {
    const requiredLen = Math.max(0, opts.requiredLen);
    const qty = Math.max(0, Math.round(opts.qty));
    const cutCount = Math.max(0, Math.round(opts.cutCount ?? qty));
    if (!qty || requiredLen <= 0 || !cutCount) return;

    const selectedLen = pickStripStockLen(requiredLen);
    const stripItem = findCrystalite620Item(config, { length_m: selectedLen, colour: 'Clear' });
    if (!stripItem) {
      pushWarning(`Crystalite 620mm (Clear) ${selectedLen}m not found in materials pricebook.`);
      return;
    }

    const unitCost = (stripItem as any).cost_ex_gst as number;
    const totalWaste = Math.max(0, qty * selectedLen - cutCount * requiredLen);
    recordCrystalite(selectedLen, qty, totalWaste);

    const id = opts.idSuffix ? `${stripItem.id}.${opts.idSuffix}` : stripItem.id;
    const line: MaterialsLineV1 = {
      id,
      label: stripItem.name,
      profile: 'Crystalite 620mm',
      unit: stripItem.unit,
      qty,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(qty * unitCost),
      notes: opts.note,
    };
    lines.push(line);
    annotateLine(line, {
      kind: 'acrylic_sheet_or_strip',
      formula: 'selectedLen = next available strip >= requiredLen; cutsPerBar = floor(selectedLen/requiredLen); barsNeeded = ceil(totalBays/cutsPerBar)',
      deps: {
        requiredLen: roundMoney(requiredLen),
        selectedLen: roundMoney(selectedLen),
        qty,
        cutCount,
        totalWaste: roundMoney(totalWaste),
      },
    });
  };

  const addAcrylicRoofingPanels = (opts: {
    requiredLen: number;
    bayCount: number;
    note: string;
    idSuffix?: string;
    lengthAlongM?: number;
    sheetQtyMode?: 'plan' | 'bays';
    planeCount?: number;
    totalAreaM2?: number;
    debugSpanM?: number;
    debugSetbackM?: number;
    debugPitchDeg?: number;
  }) => {
    const requiredLen = Math.max(0, opts.requiredLen);
    const bayCount = Math.max(0, Math.round(opts.bayCount));
    const planeCount = Math.max(1, Math.round(Number(opts.planeCount ?? 1)));
    const totalBays = bayCount * planeCount;
    if (!totalBays || requiredLen <= 0) return;

    if (Number.isFinite(acrylicMaxSlopeM) && requiredLen > acrylicMaxSlopeM + 1e-6) {
      const spanM = Number(opts.debugSpanM ?? inputs.projection_m);
      const setbacksM = Number(opts.debugSetbackM ?? roofSetbackTotalM);
      const pitchDeg = Number(opts.debugPitchDeg ?? roofPitchDegUsed);
      const debug = `computed=${roundMoney(requiredLen)}m, pitch=${roundMoney(pitchDeg)}°, span=${roundMoney(spanM)}m, setbacks=${roundMoney(
        setbacksM,
      )}m`;
      pushWarning(
        `Acrylic slope exceeds ${roundMoney(acrylicMaxSlopeM)}m. Max supported acrylic slope is ${roundMoney(
          acrylicMaxSlopeM,
        )}m (use design change or timber). (${debug})`,
      );
    }

    const sheetMode = requiredLen <= sheetLengthM + 1e-6;
    trace?.decision({
      label: 'Acrylic sheet mode gate',
      condition: 'requiredLen <= sheetLengthM',
      deps: { requiredLen, sheetLengthM, totalBays },
      result: sheetMode,
      branch_taken: sheetMode ? 'sheet' : 'strip',
    });
    if (sheetMode) {
      if (!plexiSheetClear) {
        pushWarning('Plexi sheet 3050mm x2030mm (Clear) not found in materials pricebook; falling back to 620mm strips.');
      } else {
        const sheetQtyMode: 'plan' | 'bays' = opts.sheetQtyMode === 'plan' ? 'plan' : 'bays';

        let sheetsNeeded = 0;
        let sheetNote = '';

        const forceStripYield = requiredLen > sheetWidthM + 1e-6;
        trace?.decision({
          label: 'Acrylic forced strip-yield',
          condition: 'requiredLen > sheetWidthM',
          deps: { requiredLen, sheetWidthM, totalBays },
          result: forceStripYield,
          branch_taken: forceStripYield ? 'forced-strip-yield' : sheetQtyMode,
        });

        if (forceStripYield) {
          const STRIP_WIDTH_M = 0.62;
          const stripsPerSheet = Math.floor(sheetWidthM / STRIP_WIDTH_M);
          if (stripsPerSheet < 1) {
            pushWarning('INVALID: Acrylic sheet strip yield invalid (sheet width too small for 620mm strips).');
            return;
          }
          sheetsNeeded = Math.max(0, Math.ceil(totalBays / stripsPerSheet));
          sheetNote = `forced strip-yield: ${totalBays} bay(s), ${stripsPerSheet} strips/sheet → ${sheetsNeeded} sheet(s)`;
        } else if (sheetQtyMode === 'plan') {
          const totalAreaM2 = Number(opts.totalAreaM2);
          if (Number.isFinite(totalAreaM2) && totalAreaM2 > 0) {
            const sheetAreaM2 = Math.max(0.01, sheetLengthM * sheetWidthM);
            sheetsNeeded = Math.max(0, Math.ceil(totalAreaM2 / sheetAreaM2));
            sheetNote = `total area ${roundMoney(totalAreaM2)}m² ÷ sheet area ${roundMoney(sheetAreaM2)}m² → ${sheetsNeeded} sheet(s)`;
          } else {
            const lengthAlongM = Math.max(0, Number(opts.lengthAlongM ?? inputs.length_m));
            const sheetsAlongLength = Math.max(0, Math.ceil(lengthAlongM / Math.max(0.01, sheetWidthM)));
            const sheetsDownSlope = Math.max(0, Math.ceil(requiredLen / Math.max(0.01, sheetLengthM)));
            const perPlane = sheetsAlongLength * sheetsDownSlope;
            sheetsNeeded = perPlane * planeCount;
            sheetNote = `length ${roundMoney(lengthAlongM)}m → ${sheetsAlongLength} sheet(s) (2.03m); slope ${roundMoney(
              requiredLen,
            )}m → ${sheetsDownSlope} sheet(s) (${roundMoney(sheetLengthM)}m); per plane ${perPlane}; total ${sheetsNeeded} sheet(s)`;
          }
        } else {
          // Mixed roof / partial acrylic: approximate sheets by acrylic bay count (strip yield).
          const acrossDim = requiredLen <= sheetWidthM + 1e-6 ? sheetLengthM : sheetWidthM;
          const stripsPerSheet = Math.max(1, Math.floor(acrossDim / Math.max(0.01, bayWidthM)));
          sheetsNeeded = Math.max(0, Math.ceil(totalBays / stripsPerSheet));
          sheetNote = `${totalBays} bay(s), ${stripsPerSheet} strips/sheet → ${sheetsNeeded} sheet(s)`;
        }

        if (sheetsNeeded > 0) {
          const unitCost = (plexiSheetClear as any).cost_ex_gst as number;
          const id = opts.idSuffix ? `${plexiSheetClear.id}.${opts.idSuffix}` : plexiSheetClear.id;
          const sheetQtyModeLabel = forceStripYield ? 'forced strip-yield' : sheetQtyMode;
          const line: MaterialsLineV1 = {
            id,
            label: plexiSheetClear.name,
            profile: 'Plexi sheet 3050×2030',
            unit: plexiSheetClear.unit,
            qty: sheetsNeeded,
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(sheetsNeeded * unitCost),
            notes: `${opts.note} Using sheet mode (${sheetQtyModeLabel}): plane_downslope ${roundMoney(
              requiredLen,
            )}m ≤ ${roundMoney(sheetLengthM)}m; ${sheetNote}.`,
          };
          lines.push(line);
          annotateLine(line, {
            kind: 'acrylic_sheet_or_strip',
            formula: forceStripYield
              ? 'sheetsNeeded = ceil(totalBays / stripsPerSheet)'
              : sheetQtyMode === 'plan'
                ? 'sheetsNeeded = ceil(totalAreaM2 / (sheetLengthM * sheetWidthM))'
                : 'sheetsNeeded = ceil(totalBays / stripsPerSheet)',
            deps: {
              requiredLen: roundMoney(requiredLen),
              totalBays,
              sheetLengthM,
              sheetWidthM,
              sheetQtyMode,
              forceStripYield,
              sheetsNeeded,
            },
          });
          return;
        }
      }
    }

    const selectedLen = pickStripStockLen(requiredLen);
    const cutsPerBar = Math.max(1, Math.floor(selectedLen / Math.max(0.01, requiredLen)));
    const barsNeeded = Math.max(0, Math.ceil(totalBays / cutsPerBar));
    trace?.value(`acrylic.strip.${opts.idSuffix ?? 'default'}`, {
      label: 'Acrylic strip mode',
      formula: 'cutsPerBar = floor(selectedLen/requiredLen); barsNeeded = ceil(totalBays/cutsPerBar)',
      deps: { selectedLen, requiredLen, totalBays, cutsPerBar },
      result: barsNeeded,
      units: 'bars',
    });

    addCrystaliteLine({
      requiredLen,
      qty: barsNeeded,
      cutCount: totalBays,
      note: `${opts.note} Using strip mode: ${totalBays} bay(s) × ${roundMoney(requiredLen)}m = ${roundMoney(
        totalBays * requiredLen,
      )}m total; using ${barsNeeded}×${selectedLen}m (${cutsPerBar} cut(s)/bar).`,
      idSuffix: opts.idSuffix,
    });
  };

  let acrylicJoinerBottomTotalM = 0;
  let acrylicJoinerTopTotalM = 0;
  let acrylicJoinerBottomFixingsEach = 0;
  let acrylicInstallAreaM2 = 0;

  if (inputs.roof_material === 'acrylic') {
    const joinerRunsTotal = Math.max(0, Math.round(Number((derived as any).joiner_runs_total ?? derived.rafter_count)));
    const joinerCountA = isHipCorner ? rafterCountA : joinerRunsTotal;
    const joinerLengthA = isHipCorner ? joinerPieceLengthA : Math.max(0, Number((derived as any).joiner_piece_length_m ?? rafterLength));
    const joinerCountB = isHipCorner ? rafterCountB : 0;
    const joinerLengthB = isHipCorner ? joinerPieceLengthB : 0;
    const totalJoinerMetres = joinerCountA * joinerLengthA + joinerCountB * joinerLengthB;

    acrylicJoinerBottomTotalM += totalJoinerMetres;
    acrylicJoinerTopTotalM += totalJoinerMetres;
    acrylicJoinerBottomFixingsEach +=
      joinerCountA * joinerBottomFixingsForRun(joinerLengthA) + joinerCountB * joinerBottomFixingsForRun(joinerLengthB);
    acrylicInstallAreaM2 += Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0));

    if (joinerCountA > 0 && joinerLengthA > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountA }).map(() => joinerLengthA), 'Joiners', 'joinable', {
        origin_prefix: 'joiner',
        group_key: 'joiners_roof',
      });
    }
    if (joinerCountB > 0 && joinerLengthB > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountB }).map(() => joinerLengthB), 'Joiners', 'joinable', {
        origin_prefix: 'joiner',
        group_key: 'joiners_roof',
      });
    }

    const rubberMultiplier = 2; // both sides
    const rubberMetres = (joinerCountA * joinerLengthA + joinerCountB * joinerLengthB) * rubberMultiplier;
    if (rubberMetres > 0) {
      const topRubber = findRubberItem(config, 'Top V Rubber');
      const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

      if (!topRubber) pushWarning('Top V Rubber item not found in materials pricebook.');
      else {
        lines.push({
          id: topRubber.id,
          label: topRubber.name,
          unit: topRubber.unit,
          qty: roundMoney(rubberMetres),
          unit_cost_ex_gst: roundMoney((topRubber as any).cost_ex_gst as number),
          line_cost_ex_gst: roundMoney(rubberMetres * ((topRubber as any).cost_ex_gst as number)),
          notes: 'Top V rubber for joiner system (per metre).',
        });
      }

      if (!bottomRubber) pushWarning('Bottom Flat Rubbers item not found in materials pricebook.');
      else {
        lines.push({
          id: bottomRubber.id,
          label: bottomRubber.name,
          unit: bottomRubber.unit,
          qty: roundMoney(rubberMetres),
          unit_cost_ex_gst: roundMoney((bottomRubber as any).cost_ex_gst as number),
          line_cost_ex_gst: roundMoney(rubberMetres * ((bottomRubber as any).cost_ex_gst as number)),
          notes: 'Bottom flat rubbers for joiner system (per metre).',
        });
      }
    }

    const foamMetres = Math.max(0, inputs.foam_length_m);
    if (foamMetres > 0) {
      const foam = findFoamItem(config, inputs.extrusion_colour);
      if (!foam) pushWarning(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
      else {
        const unitCost = (foam as any).cost_ex_gst as number;
        lines.push({
          id: foam.id,
          label: foam.name,
          unit: foam.unit,
          qty: roundMoney(foamMetres),
          unit_cost_ex_gst: roundMoney(unitCost),
          line_cost_ex_gst: roundMoney(foamMetres * unitCost),
          notes: 'Foam/weather seal allowance (per metre).',
        });
      }
    }

    if (isHipCorner) {
      addAcrylicRoofingPanels({
        requiredLen: joinerPieceLengthA,
        bayCount: bayCountA,
        note: 'Acrylic roofing (wing A).',
        idSuffix: 'wingA',
        lengthAlongM: inputs.length_m,
        sheetQtyMode: 'plan',
        debugSpanM: inputs.projection_m,
        debugSetbackM: roofSetbackTotalM,
        debugPitchDeg: roofPitchDegUsed,
      });
      addAcrylicRoofingPanels({
        requiredLen: joinerPieceLengthB,
        bayCount: bayCountB,
        note: 'Acrylic roofing (wing B).',
        idSuffix: 'wingB',
        lengthAlongM: hipCornerLengthB,
        sheetQtyMode: 'plan',
        debugSpanM: hipCornerProjectionB,
        debugSetbackM: roofSetbackTotalM,
        debugPitchDeg: roofPitchDegUsed,
      });
    } else {
      const bayCount = Math.max(0, Math.round((derived as any).bay_count ?? derived.rafter_count - 1));
      addAcrylicRoofingPanels({
        requiredLen: Math.max(0, Number((derived as any).acrylic_required_downslope_m ?? (derived as any).joiner_piece_length_m ?? 0)),
        bayCount,
        note: 'Acrylic roofing.',
        sheetQtyMode: 'plan',
        planeCount: roofPlaneCount,
        totalAreaM2: Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0)),
        debugSpanM: inputs.projection_m,
        debugSetbackM: roofSetbackTotalM,
        debugPitchDeg: roofPitchDegUsed,
      });
    }
  } else if (inputs.roof_material === 'mixed') {
    if (!inputs.mixed_roof) {
      pushWarning('Mixed roof selected but no mixed_roof details provided; skipping acrylic materials.');
    } else if (inputs.mixed_roof.mode === 'acrylic_bays') {
      const roofPlanes = Array.isArray((derived as any).roof_planes) ? ((derived as any).roof_planes as any[]) : [];
      const acrylicBaysByPlane =
        inputs.mixed_roof.acrylic_bays_by_plane && typeof inputs.mixed_roof.acrylic_bays_by_plane === 'object'
          ? inputs.mixed_roof.acrylic_bays_by_plane
          : null;

      if (!roofPlanes.length) {
        pushWarning('Mixed roof acrylic bays mode requires roof plane geometry; skipping acrylic materials.');
      } else if (!acrylicBaysByPlane) {
        pushWarning('Mixed roof acrylic bays mode selected but no acrylic_bays_by_plane provided; skipping acrylic materials.');
      } else {
        let totalJoinerM = 0;
        let totalBottomFixingsEach = 0;
        acrylicInstallAreaM2 += Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0));

        for (const plane of roofPlanes) {
          const planeId = typeof plane?.id === 'string' ? plane.id : '';
          const planeLabel = typeof plane?.label === 'string' ? plane.label : planeId || 'Plane';
          const planeBayCount = Math.max(0, Math.round(Number(plane?.bay_count ?? 0)));
          const acrylicBays = Math.max(0, Math.min(planeBayCount, Math.round(Number((acrylicBaysByPlane as any)[planeId] ?? 0))));

          if (!acrylicBays) continue;

          const joinerRuns = acrylicBays + 1;
          const planeRafterLen = Math.max(0, Number(plane?.rafter_length_m ?? 0));
          const planeRunM = planeRafterLen * effectiveCos;
          const planeEffectiveRunM = Math.max(0, planeRunM - 0.15);
          const planeRequiredDownslopeM = planeEffectiveRunM / effectiveCos;
          const planeJoinerPieceLenM = planeRequiredDownslopeM + 0.02;

          if (joinerRuns > 0 && planeJoinerPieceLenM > 0) {
            const planeOriginPrefix = `joiner_mixed_${planeId || planeLabel || 'plane'}`;
            addCuts(
              'Joiners',
              Array.from({ length: joinerRuns }).map(() => planeJoinerPieceLenM),
              `Joiners (${planeLabel}, mixed acrylic bays)`,
              'joinable',
              { origin_prefix: planeOriginPrefix, group_key: 'joiners_mixed' },
            );
            totalJoinerM += joinerRuns * planeJoinerPieceLenM;
            totalBottomFixingsEach += joinerRuns * joinerBottomFixingsForRun(planeJoinerPieceLenM);
          }

          addAcrylicRoofingPanels({
            requiredLen: planeJoinerPieceLenM,
            bayCount: acrylicBays,
            note: `Acrylic roofing (${planeLabel}, mixed roof).`,
            idSuffix: planeId || undefined,
            debugSpanM: planeRunM,
            debugSetbackM: roofSetbackTotalM,
            debugPitchDeg: roofPitchDegUsed,
          });
        }

        const rubberMultiplier = 2; // both sides
        const rubberMetres = totalJoinerM * rubberMultiplier;
        acrylicJoinerBottomTotalM += totalJoinerM;
        acrylicJoinerTopTotalM += totalJoinerM;
        acrylicJoinerBottomFixingsEach += totalBottomFixingsEach;
        if (rubberMetres > 0) {
          const topRubber = findRubberItem(config, 'Top V Rubber');
          const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

          if (!topRubber) pushWarning('Top V Rubber item not found in materials pricebook.');
          else {
            lines.push({
              id: topRubber.id,
              label: topRubber.name,
              unit: topRubber.unit,
              qty: roundMoney(rubberMetres),
              unit_cost_ex_gst: roundMoney((topRubber as any).cost_ex_gst as number),
              line_cost_ex_gst: roundMoney(rubberMetres * ((topRubber as any).cost_ex_gst as number)),
              notes: 'Top V rubber for mixed roof joiner system (per metre).',
            });
          }

          if (!bottomRubber) pushWarning('Bottom Flat Rubbers item not found in materials pricebook.');
          else {
            lines.push({
              id: bottomRubber.id,
              label: bottomRubber.name,
              unit: bottomRubber.unit,
              qty: roundMoney(rubberMetres),
              unit_cost_ex_gst: roundMoney((bottomRubber as any).cost_ex_gst as number),
              line_cost_ex_gst: roundMoney(rubberMetres * ((bottomRubber as any).cost_ex_gst as number)),
              notes: 'Bottom flat rubbers for mixed roof joiner system (per metre).',
            });
          }
        }

        const foamMetres = Math.max(0, inputs.foam_length_m);
        if (foamMetres > 0) {
          const foam = findFoamItem(config, inputs.extrusion_colour);
          if (!foam) pushWarning(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
          else {
            const unitCost = (foam as any).cost_ex_gst as number;
            lines.push({
              id: foam.id,
              label: foam.name,
              unit: foam.unit,
              qty: roundMoney(foamMetres),
              unit_cost_ex_gst: roundMoney(unitCost),
              line_cost_ex_gst: roundMoney(foamMetres * unitCost),
              notes: 'Foam/weather seal allowance (per metre).',
            });
          }
        }

      }
    } else if (inputs.mixed_roof.mode === 'area_override') {
      pushWarning('Mixed roof area override is excluded from acrylic split labour; using 0 acrylic/joiner labour drivers.');
      if (isHipCorner) {
        pushWarning('Mixed roof area override is not costed for hip corner yet; skipping acrylic materials.');
      } else {
        const totalRoofAreaM2 = Math.max(0, Number((derived as any).roof_surface_area_m2 ?? derived.roof_surface_area_m2));
        const acrylicAreaM2 = Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0));
        const bayCount = Math.max(0, Math.round((derived as any).bay_count ?? derived.rafter_count - 1));

        const fractionRaw = totalRoofAreaM2 > 1e-6 ? acrylicAreaM2 / totalRoofAreaM2 : 0;
        const fraction = Math.min(1, Math.max(0, fractionRaw));
        const acrylicBays = Math.min(bayCount, Math.max(0, Math.round(bayCount * fraction)));

        if (acrylicBays > 0) {
          const joinerCount = Math.min(Math.max(0, Math.round(derived.rafter_count)), acrylicBays + 1);
          const joinerLength = Math.max(0, rafterLength);
          if (joinerCount > 0 && joinerLength > 0) {
            addCuts(
              'Joiners',
              Array.from({ length: joinerCount }).map(() => joinerLength),
              'Joiners (mixed roof area override; acrylic bays)',
              'joinable',
              { origin_prefix: 'joiner_mixed_override', group_key: 'joiners_mixed' },
            );
          }

          const rubberMultiplier = 2; // both sides
          const rubberMetres = joinerCount * joinerLength * rubberMultiplier;
          if (rubberMetres > 0) {
            const topRubber = findRubberItem(config, 'Top V Rubber');
            const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

            if (!topRubber) pushWarning('Top V Rubber item not found in materials pricebook.');
            else {
              lines.push({
                id: topRubber.id,
                label: topRubber.name,
                unit: topRubber.unit,
                qty: roundMoney(rubberMetres),
                unit_cost_ex_gst: roundMoney((topRubber as any).cost_ex_gst as number),
                line_cost_ex_gst: roundMoney(rubberMetres * ((topRubber as any).cost_ex_gst as number)),
                notes: 'Top V rubber for mixed roof area override joiners (per metre).',
              });
            }

            if (!bottomRubber) pushWarning('Bottom Flat Rubbers item not found in materials pricebook.');
            else {
              lines.push({
                id: bottomRubber.id,
                label: bottomRubber.name,
                unit: bottomRubber.unit,
                qty: roundMoney(rubberMetres),
                unit_cost_ex_gst: roundMoney((bottomRubber as any).cost_ex_gst as number),
                line_cost_ex_gst: roundMoney(rubberMetres * ((bottomRubber as any).cost_ex_gst as number)),
                notes: 'Bottom flat rubbers for mixed roof area override joiners (per metre).',
              });
            }
          }

          const foamMetres = Math.max(0, inputs.foam_length_m);
          if (foamMetres > 0) {
            const foam = findFoamItem(config, inputs.extrusion_colour);
            if (!foam) pushWarning(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
            else {
              const unitCost = (foam as any).cost_ex_gst as number;
              lines.push({
                id: foam.id,
                label: foam.name,
                unit: foam.unit,
                qty: roundMoney(foamMetres),
                unit_cost_ex_gst: roundMoney(unitCost),
                line_cost_ex_gst: roundMoney(foamMetres * unitCost),
                notes: 'Foam/weather seal allowance (per metre).',
              });
            }
          }

          addAcrylicRoofingPanels({
            requiredLen: Math.max(0, Number((derived as any).acrylic_required_downslope_m ?? (derived as any).joiner_piece_length_m ?? joinerLength)),
            bayCount: acrylicBays,
            note: `Mixed roof area override: acrylic bays ≈ ${acrylicBays}/${bayCount} (${Math.round(fraction * 100)}%).`,
            debugSpanM: inputs.projection_m,
            debugSetbackM: roofSetbackTotalM,
            debugPitchDeg: roofPitchDegUsed,
          });
        }
      }
    } else if (inputs.mixed_roof.mode !== 'ridge_skylight' || !inputs.mixed_roof.ridge_skylight) {
      pushWarning('Mixed roof mode not supported for acrylic materials yet; skipping acrylic materials.');
    } else {
      const stripCount = Math.max(0, Math.round(inputs.mixed_roof.ridge_skylight.strip_count));
      const ridgeLen = isHipCorner ? inputs.length_m + Math.max(0, hipCornerLengthB) : inputs.length_m;
      const requiredLen = Math.max(0, ridgeLen);
      const maxLen = 6;
      acrylicInstallAreaM2 += Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0));

      const selectedLen = requiredLen <= maxLen ? stripLengths.find((l) => l >= requiredLen) ?? maxLen : maxLen;
      const barsUsed = requiredLen <= maxLen ? stripCount : stripCount * Math.max(1, Math.ceil(requiredLen / maxLen));

      const stripItem = findCrystalite620Item(config, { length_m: selectedLen, colour: 'Clear' });
      if (!stripItem) {
        pushWarning(`Crystalite 620mm (Clear) ${selectedLen}m not found in materials pricebook.`);
      } else if (stripCount > 0) {
        const unitCost = (stripItem as any).cost_ex_gst as number;
        const totalRequired = stripCount * requiredLen;
        const totalStock = barsUsed * selectedLen;
        const totalWaste = Math.max(0, totalStock - totalRequired);

        addProfileTotals('Crystalite 620mm', selectedLen, barsUsed, totalWaste);

        lines.push({
          id: stripItem.id,
          label: stripItem.name,
          profile: 'Crystalite 620mm',
          unit: stripItem.unit,
          qty: barsUsed,
          unit_cost_ex_gst: roundMoney(unitCost),
          line_cost_ex_gst: roundMoney(barsUsed * unitCost),
          notes: `Mixed roof ridge skylight: ${stripCount} strip(s) × ${roundMoney(requiredLen)}m; using ${barsUsed}×${selectedLen}m.`,
        });
      }

      if (stripCount > 0 && requiredLen > 0) {
        const joinerLines = stripCount * 2;
        const joinerCuts = Array.from({ length: joinerLines }).map(() => requiredLen);
        acrylicJoinerBottomTotalM += joinerLines * requiredLen;
        acrylicJoinerTopTotalM += joinerLines * requiredLen;
        acrylicJoinerBottomFixingsEach += joinerLines * joinerBottomFixingsForRun(requiredLen);
        if (joinerCuts.length)
          addCuts('Joiners', joinerCuts, 'Joiners (skylight edges)', 'joinable', {
            origin_prefix: 'joiner_skylight_edge',
            group_key: 'joiners_skylight_edges',
          });

        const rubberMultiplier = 2; // both sides
        const rubberMetres = joinerLines * requiredLen * rubberMultiplier;
        if (rubberMetres > 0) {
          const topRubber = findRubberItem(config, 'Top V Rubber');
          const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

          if (!topRubber) pushWarning('Top V Rubber item not found in materials pricebook.');
          else {
            lines.push({
              id: topRubber.id,
              label: topRubber.name,
              unit: topRubber.unit,
              qty: roundMoney(rubberMetres),
              unit_cost_ex_gst: roundMoney((topRubber as any).cost_ex_gst as number),
              line_cost_ex_gst: roundMoney(rubberMetres * ((topRubber as any).cost_ex_gst as number)),
              notes: 'Top V rubber for ridge skylight joiner edges (per metre).',
            });
          }

          if (!bottomRubber) pushWarning('Bottom Flat Rubbers item not found in materials pricebook.');
          else {
            lines.push({
              id: bottomRubber.id,
              label: bottomRubber.name,
              unit: bottomRubber.unit,
              qty: roundMoney(rubberMetres),
              unit_cost_ex_gst: roundMoney((bottomRubber as any).cost_ex_gst as number),
              line_cost_ex_gst: roundMoney(rubberMetres * ((bottomRubber as any).cost_ex_gst as number)),
              notes: 'Bottom flat rubbers for ridge skylight joiner edges (per metre).',
            });
          }
        }

        const foamMetres = Math.max(0, inputs.foam_length_m);
        if (foamMetres > 0) {
          const foam = findFoamItem(config, inputs.extrusion_colour);
          if (!foam) pushWarning(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
          else {
            const unitCost = (foam as any).cost_ex_gst as number;
            lines.push({
              id: foam.id,
              label: foam.name,
              unit: foam.unit,
              qty: roundMoney(foamMetres),
              unit_cost_ex_gst: roundMoney(unitCost),
              line_cost_ex_gst: roundMoney(foamMetres * unitCost),
              notes: 'Foam/weather seal allowance (per metre).',
            });
          }
        }

      }
    }
  }

  if (inputs.roof_material === 'timber' || inputs.roof_material === 'mixed') {
    const timberRules = (config.rules as any)?.roofing?.timber?.cedar_sarking as any;
    const cedarItemId = String(timberRules?.pricebook_item_id ?? 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm');
    const coverM = Number(timberRules?.cover_m ?? 0.11);
    const wasteFactor = Number(timberRules?.waste_factor ?? 0.1);

    const totalRoofAreaM2 = Math.max(0, Number((derived as any).roof_surface_area_m2 ?? derived.roof_surface_area_m2));
    const acrylicAreaM2 = Math.max(0, Number((derived as any).acrylic_area_m2 ?? 0));
    const timberAreaDerived = Number((derived as any).timber_area_m2 ?? NaN);
    const timberAreaM2 = Number.isFinite(timberAreaDerived)
      ? Math.max(0, timberAreaDerived)
      : inputs.roof_material === 'mixed'
        ? Math.max(0, totalRoofAreaM2 - acrylicAreaM2)
        : totalRoofAreaM2;

    if (timberAreaM2 > 0) {
      if (!Number.isFinite(coverM) || coverM <= 0) {
        pushWarning('Invalid cedar sarking cover_m in rules; skipping timber roofing takeoff.');
      } else {
        const cedarLm = (timberAreaM2 / coverM) * (1 + (Number.isFinite(wasteFactor) ? wasteFactor : 0));
        const cedarItem = findPricebookItemById(config, cedarItemId);
        if (!cedarItem) {
          pushWarning(`Cedar sarking item '${cedarItemId}' not found in materials pricebook.`);
        } else {
          const unitCost = (cedarItem as any).cost_ex_gst as number;
          lines.push({
            id: cedarItem.id,
            label: cedarItem.name,
            profile: 'Roofing timber',
            unit: cedarItem.unit,
            qty: roundMoney(cedarLm),
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(roundMoney(cedarLm) * unitCost),
            notes:
              inputs.roof_material === 'mixed'
                ? `Cedar takeoff (mixed roof timber area): ${roundMoney(timberAreaM2)}m² / ${coverM}m cover × (1 + ${Math.round(
                    (Number.isFinite(wasteFactor) ? wasteFactor : 0) * 100,
                  )}%)`
                : `Cedar takeoff: ${roundMoney(timberAreaM2)}m² / ${coverM}m cover × (1 + ${Math.round(
                    (Number.isFinite(wasteFactor) ? wasteFactor : 0) * 100,
                  )}%)`,
          });
        }
      }
    }
  }

  if (inputs.roof_material === 'timber' || inputs.roof_material === 'mixed') {
    const roofAboveArea = Math.max(0, Number((derived as any).timber_roof_above_area_m2 ?? 0));
    const roofAboveType = inputs.timber_roof_above_type ?? 'insulated_panels';
    if (roofAboveArea > 0) {
      if (roofAboveType === 'insulated_panels') {
        const panelItem = findPricebookItemById(config, 'roof.insulated_panel_50mm_m2');
        if (!panelItem) pushWarning("Roof above item 'roof.insulated_panel_50mm_m2' not found in materials pricebook.");
        else {
          const unitCost = Number((panelItem as any).cost_ex_gst ?? 0);
          lines.push({
            id: panelItem.id,
            label: panelItem.name,
            unit: panelItem.unit,
            qty: roundMoney(roofAboveArea),
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(roundMoney(roofAboveArea) * unitCost),
            notes: `Timber roof above: insulated panels (${inputs.timber_insulated_panel_thickness_mm}mm).`,
          });
        }
      } else if (roofAboveType === 'steel_corrugated') {
        const steelItem = findPricebookItemById(config, 'roof.steel_corrugated_m2');
        if (!steelItem) pushWarning("Roof above item 'roof.steel_corrugated_m2' not found in materials pricebook.");
        else {
          const unitCost = Number((steelItem as any).cost_ex_gst ?? 0);
          lines.push({
            id: steelItem.id,
            label: steelItem.name,
            unit: steelItem.unit,
            qty: roundMoney(roofAboveArea),
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(roundMoney(roofAboveArea) * unitCost),
            notes: 'Timber roof above: steel corrugated (m²).',
          });
        }
      } else if (roofAboveType === 'steel_tray') {
        const steelItem = findPricebookItemById(config, 'roof.steel_tray_m2');
        if (!steelItem) pushWarning("Roof above item 'roof.steel_tray_m2' not found in materials pricebook.");
        else {
          const unitCost = Number((steelItem as any).cost_ex_gst ?? 0);
          lines.push({
            id: steelItem.id,
            label: steelItem.name,
            unit: steelItem.unit,
            qty: roundMoney(roofAboveArea),
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(roundMoney(roofAboveArea) * unitCost),
            notes: `Timber roof above: steel tray (tray width ${inputs.timber_tray_width_mm}mm).`,
          });
        }
      }
    }

    if (roofAboveType === 'steel_corrugated' || roofAboveType === 'steel_tray') {
      const covertekArea = Math.max(0, Number((derived as any).covertek_area_m2 ?? 0));
      const covertekItem = findPricebookItemById(config, 'underlay.covertek_407_m2');
      if (!covertekItem) pushWarning("Underlay item 'underlay.covertek_407_m2' not found in materials pricebook.");
      else if (covertekArea > 0) {
        const unitCost = Number((covertekItem as any).cost_ex_gst ?? 0);
        lines.push({
          id: covertekItem.id,
          label: covertekItem.name,
          unit: covertekItem.unit,
          qty: roundMoney(covertekArea),
          unit_cost_ex_gst: roundMoney(unitCost),
          line_cost_ex_gst: roundMoney(roundMoney(covertekArea) * unitCost),
          notes: 'Covertek 407 underlay (10% allowance).',
        });
      }

      const polyArea = Math.max(0, Number((derived as any).polystyrene_area_m2 ?? 0));
      const polyItem = findPricebookItemById(config, 'insulation.polystyrene_m2');
      if (!polyItem) pushWarning("Insulation item 'insulation.polystyrene_m2' not found in materials pricebook.");
      else if (polyArea > 0) {
        const unitCost = Number((polyItem as any).cost_ex_gst ?? 0);
        lines.push({
          id: polyItem.id,
          label: polyItem.name,
          unit: polyItem.unit,
          qty: roundMoney(polyArea),
          unit_cost_ex_gst: roundMoney(unitCost),
          line_cost_ex_gst: roundMoney(roundMoney(polyArea) * unitCost),
          notes: 'Polystyrene insulation between rafters.',
        });
      }
    }
  }

  // Flashings are banded and apply across roof material modes.
  const flashingBandTotals = resolveFlashingBandTotals(inputs, derived);
  pushFlashingMaterialLines(lines, flashingBandTotals);

  // === INFILLS (orientation-aware acrylic + joiners) ===
  const infills = Array.isArray((inputs as any).infills) ? ((inputs as any).infills as NonNullable<InputsNormalizedV1['infills']>) : [];
  let infillSheetAreaM2 = 0;
  const infillSheetWasteFactor = INFILL_SHEET_WASTE_FACTOR_DEFAULT;
  let infillJoinerTotalM = 0;
  let infillInstanceCount = 0;
  let infillJoinerFixingsEach = 0;
  let infillStripPanelCount = 0;
  let infillExtraSupportsEach = 0;

  const isSupportedInternal = (mode: string | undefined, x: number, spanM: number, positions?: number[]) => {
    if (mode === 'match_roof_rafters') return true;
    if (mode === 'center') return Math.abs(x - spanM / 2) < 0.02;
    if (mode === 'custom' && Array.isArray(positions)) return positions.some((p) => Math.abs(x - Number(p)) < 0.02);
    return false;
  };

  for (const infillRaw of infills) {
    const qty = Math.max(1, Math.round(Number((infillRaw as any).qty ?? 1)));
    const infillLabel = String((infillRaw as any).label ?? (infillRaw as any).id ?? 'infill');
    const locationRaw = String((infillRaw as any).location ?? 'custom');
    const isFrontOrHouse = locationRaw === 'front' || locationRaw === 'house';
    const preferredAcrylicSource = String((infillRaw as any).acrylic_source ?? 'sheet_panels') as 'strip_620' | 'sheet_panels';
    const panelOrientation = String((infillRaw as any).panel_orientation ?? 'vertical') === 'horizontal' ? 'horizontal' : 'vertical';
    const widthMode = String((infillRaw as any).width_mode ?? 'target_width') as 'match_roof_rafters' | 'target_width';

    const support = (infillRaw as any).support ?? {};
    const hasTop = support.has_top !== false;
    const hasBottom = support.has_bottom !== false;
    const hasLeft = support.has_left !== false;
    const hasRight = support.has_right !== false;
    const internalMode = String(support.internal_support_mode ?? 'none');
    const internalPositions = Array.isArray(support.internal_support_positions_m)
      ? support.internal_support_positions_m
          .map((p: unknown) => Number(p))
          .filter((p: number) => Number.isFinite(p) && p >= 0)
      : undefined;

    const shape = (infillRaw as any).shape ?? {};
    const shapeType = String(shape.type ?? 'rect');

    let widthM = 0;
    let avgHeightM = 0;
    let maxHeightM = 0;
    let heightAt = (_t01: number): number => 0;
    if (shapeType === 'rect') {
      widthM = Math.max(0, Number(shape.width_m ?? 0));
      const h = Math.max(0, Number(shape.height_m ?? 0));
      heightAt = () => h;
      avgHeightM = h;
      maxHeightM = h;
    } else if (shapeType === 'mono_slope') {
      widthM = Math.max(0, Number(shape.width_m ?? 0));
      const h0 = Math.max(0, Number(shape.height_low_m ?? 0));
      const h1 = Math.max(0, Number(shape.height_high_m ?? 0));
      heightAt = (t01: number) => lerp(h0, h1, clampPos(t01, 0, 1));
      avgHeightM = (h0 + h1) / 2;
      maxHeightM = Math.max(h0, h1);
    } else {
      pushWarning(`Unsupported infill shape '${shapeType}'; skipping infill.`);
      continue;
    }

    if (widthM <= 0 || maxHeightM <= 0) continue;

    const runSideM = panelOrientation === 'vertical' ? maxHeightM : widthM;
    const acrossSideM = panelOrientation === 'vertical' ? widthM : maxHeightM;
    if (runSideM <= 0 || acrossSideM <= 0) continue;

    const sourceSelection = pickInfillSourceForRun(preferredAcrylicSource, runSideM);
    if (!sourceSelection.source) {
      pushWarning(
        `Infill '${infillLabel}': run side ${roundMoney(runSideM)}m exceeds sheet (${roundMoney(
          INFILL_SHEET_MAX_RUN_M,
        )}m) and strip (${roundMoney(INFILL_STRIP_MAX_RUN_M)}m) limits; skipping infill.`,
      );
      continue;
    }
    const acrylicSource = sourceSelection.source;
    if (sourceSelection.switched) {
      pushWarning(
        `Infill '${infillLabel}': auto-switched acrylic source from ${preferredAcrylicSource} to ${acrylicSource} because run side ${roundMoney(
          runSideM,
        )}m exceeds ${roundMoney(infillRunLimitForSource(preferredAcrylicSource))}m.`,
      );
    }

    const panelWidthsAcross = splitWidths(acrossSideM, infillCentreLimitForSource(acrylicSource));
    if (!panelWidthsAcross.length) continue;
    infillInstanceCount += qty;

    const boundaryAcross: number[] = [0];
    for (const span of panelWidthsAcross) boundaryAcross.push(boundaryAcross[boundaryAcross.length - 1] + span);

    const boundaryJoinerLens: number[] = [];
    if (panelOrientation === 'vertical') {
      for (const x of boundaryAcross) {
        const t = widthM > 0 ? x / widthM : 0;
        boundaryJoinerLens.push(Math.max(0, heightAt(t)));
      }
    } else {
      for (let i = 0; i < boundaryAcross.length; i += 1) boundaryJoinerLens.push(Math.max(0, widthM));
    }

    const leftEdgeLen = Math.max(0, heightAt(0));
    const rightEdgeLen = Math.max(0, heightAt(1));
    const bottomEdgeLen = panelOrientation === 'vertical' ? Math.max(0, widthM) : Math.max(0, boundaryJoinerLens[0] ?? widthM);
    const topEdgeLen =
      panelOrientation === 'vertical'
        ? Math.max(0, shapeType === 'mono_slope' ? widthM / Math.max(0.02, effectiveCos) : widthM)
        : Math.max(0, boundaryJoinerLens[boundaryJoinerLens.length - 1] ?? widthM);
    const sideEdgeA = panelOrientation === 'vertical' ? Math.max(0, boundaryJoinerLens[0] ?? leftEdgeLen) : leftEdgeLen;
    const sideEdgeB =
      panelOrientation === 'vertical'
        ? Math.max(0, boundaryJoinerLens[boundaryJoinerLens.length - 1] ?? rightEdgeLen)
        : rightEdgeLen;
    const joinerTotalEach =
      boundaryJoinerLens.reduce((acc, len) => acc + Math.max(0, len), 0) + Math.max(0, topEdgeLen) + Math.max(0, bottomEdgeLen);
    if (joinerTotalEach > 0) {
      infillJoinerFixingsEach += Math.ceil(joinerTotalEach / ACRYLIC_JOINER_BOTTOM_FIXING_SPACING_M) * qty;
    }
    const missingJambsEach =
      panelOrientation === 'vertical' ? (hasLeft ? 0 : 1) + (hasRight ? 0 : 1) : (hasBottom ? 0 : 1) + (hasTop ? 0 : 1);

    for (const len of boundaryJoinerLens) {
      if (len <= 0) continue;
      for (let q = 0; q < qty; q += 1)
        addCuts('Joiners', [len], 'Infill joiners (panel boundaries)', 'joinable', { origin_prefix: 'infill_joiner_boundary' });
      infillJoinerTotalM += len * qty;
    }
    if (topEdgeLen > 0) {
      for (let q = 0; q < qty; q += 1) addCuts('Joiners', [topEdgeLen], 'Infill joiners (top edge)', 'joinable', { origin_prefix: 'infill_joiner_top' });
      infillJoinerTotalM += topEdgeLen * qty;
    }
    if (bottomEdgeLen > 0) {
      for (let q = 0; q < qty; q += 1)
        addCuts('Joiners', [bottomEdgeLen], 'Infill joiners (bottom edge)', 'joinable', { origin_prefix: 'infill_joiner_bottom' });
      infillJoinerTotalM += bottomEdgeLen * qty;
    }

    if (!hasLeft && sideEdgeA > 0) {
      for (let q = 0; q < qty; q += 1) addCuts('50x50', [sideEdgeA], 'Infill support 50x50 (left jamb)', 'joinable', { origin_prefix: 'infill_5050_left' });
    }
    if (!hasRight && sideEdgeB > 0) {
      for (let q = 0; q < qty; q += 1) addCuts('50x50', [sideEdgeB], 'Infill support 50x50 (right jamb)', 'joinable', { origin_prefix: 'infill_5050_right' });
    }
    if (!hasTop && topEdgeLen > 0) {
      for (let q = 0; q < qty; q += 1) addCuts('50x50', [topEdgeLen], 'Infill support 50x50 (top rail)', 'joinable', { origin_prefix: 'infill_5050_top' });
    }
    if (!hasBottom && bottomEdgeLen > 0) {
      for (let q = 0; q < qty; q += 1) addCuts('50x50', [bottomEdgeLen], 'Infill support 50x50 (bottom rail)', 'joinable', { origin_prefix: 'infill_5050_bottom' });
    }

    let unsupportedInternalEach = 0;
    for (let i = 1; i < boundaryAcross.length - 1; i += 1) {
      const x = boundaryAcross[i];
      const supported =
        isSupportedInternal(internalMode, x, acrossSideM, internalPositions) ||
        (panelOrientation === 'vertical' && widthMode === 'match_roof_rafters' && isFrontOrHouse);
      if (supported) continue;
      const len = boundaryJoinerLens[i];
      if (len <= 0) continue;
      unsupportedInternalEach += 1;
      for (let q = 0; q < qty; q += 1)
        addCuts('50x50', [len], 'Infill support 50x50 (internal mullion)', 'joinable', { origin_prefix: 'infill_5050_internal' });
    }
    infillExtraSupportsEach += (unsupportedInternalEach + missingJambsEach) * qty;

    if (acrylicSource === 'strip_620') {
      const cuts: number[] = [];
      for (let p = 0; p < panelWidthsAcross.length; p += 1) {
        if (panelOrientation === 'vertical') {
          const x0 = boundaryAcross[p];
          const x1 = boundaryAcross[p + 1];
          const t0 = widthM > 0 ? x0 / widthM : 0;
          const t1 = widthM > 0 ? x1 / widthM : 0;
          const requiredLen = Math.max(heightAt(t0), heightAt(t1));
          if (requiredLen <= 0) continue;
          for (let q = 0; q < qty; q += 1) cuts.push(requiredLen);
        } else {
          const requiredLen = Math.max(0, widthM);
          if (requiredLen <= 0) continue;
          for (let q = 0; q < qty; q += 1) cuts.push(requiredLen);
        }
      }
      infillStripPanelCount += cuts.length;

      if (cuts.length) {
        const stripLenOptions = [4, 5, 6];
        let best: { len: number; bars: number; waste: number; cost: number } | null = null;
        for (const stockLen of stripLenOptions) {
          if (!cuts.every((c) => c <= stockLen + 1e-6)) continue;
          const { barsUsed, wasteM } = greedyBinPack([...cuts].sort((a, b) => b - a), stockLen);
          const item = findCrystalite620Item(config, { length_m: stockLen, colour: 'Clear' });
          if (!item) {
            pushWarning(`Crystalite 620mm (Clear) ${stockLen}m not found in materials pricebook.`);
            continue;
          }
          const unitCost = Number((item as any).cost_ex_gst ?? 0);
          const totalCost = barsUsed * unitCost;
          if (!best || totalCost < best.cost - 1e-6 || (Math.abs(totalCost - best.cost) < 1e-6 && wasteM < best.waste - 1e-6)) {
            best = { len: stockLen, bars: barsUsed, waste: wasteM, cost: totalCost };
          }
        }

        if (best) {
          const item = findCrystalite620Item(config, { length_m: best.len, colour: 'Clear' });
          if (item) {
            const unitCost = Number((item as any).cost_ex_gst ?? 0);
            lines.push({
              id: `infill.crystalite_620_${best.len}m`,
              label: `Crystalite 620mm (Clear) ${best.len}m`,
              profile: 'Crystalite 620mm',
              unit: 'bar',
              qty: best.bars,
              unit_cost_ex_gst: roundMoney(unitCost),
              line_cost_ex_gst: roundMoney(best.bars * unitCost),
              notes: `Infills (strip mode): ${cuts.length} panel(s) cut; packed into ${best.bars}x${best.len}m; waste ${roundMoney(best.waste)}m.`,
            });
            addProfileTotals('Crystalite 620mm', best.len, best.bars, best.waste);
          }
        } else {
          pushWarning('Infills (strip mode): could not price Crystalite 620mm bars (no valid stock length / missing SKUs).');
        }
      }
    } else {
      infillSheetAreaM2 += Math.max(0, widthM * avgHeightM) * qty;
    }
  }

  if (infillJoinerTotalM > 0) {
    const rubberMetres = roundMoney(infillJoinerTotalM * 2);
    const topRubber = findRubberItem(config, 'Top V Rubber');
    const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');
    if (!topRubber) pushWarning('Top V Rubber item not found in materials pricebook.');
    else {
      const unitCost = Number((topRubber as any).cost_ex_gst ?? 0);
      lines.push({
        id: topRubber.id,
        label: topRubber.name,
        unit: topRubber.unit,
        qty: rubberMetres,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(rubberMetres * unitCost),
        notes: 'Top V rubber for infill joiners (per metre).',
      });
    }
    if (!bottomRubber) pushWarning('Bottom Flat Rubbers item not found in materials pricebook.');
    else {
      const unitCost = Number((bottomRubber as any).cost_ex_gst ?? 0);
      lines.push({
        id: bottomRubber.id,
        label: bottomRubber.name,
        unit: bottomRubber.unit,
        qty: rubberMetres,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(rubberMetres * unitCost),
        notes: 'Bottom flat rubbers for infill joiners (per metre).',
      });
    }
  }

  if (infillSheetAreaM2 > 0) {
    const sheetAreaM2 = 3.05 * 2.03;
    const effectiveAreaM2 = infillSheetAreaM2 * (1 + infillSheetWasteFactor);
    const sheetsNeeded = Math.max(1, Math.ceil(effectiveAreaM2 / Math.max(sheetAreaM2, 0.01)));
    const plexiSheetIdClearInfill = String(sheetCfg?.pricebook_sheet_ids?.Clear ?? '');
    const plexiSheetClearInfill =
      findPricebookItemById(config, plexiSheetIdClearInfill) ??
      config.materials.items.find((it) => it.category === 'roofing_sheet' && it.unit === 'sheet' && String(it.name ?? '').includes('(Clear)')) ??
      null;
    if (!plexiSheetClearInfill) {
      pushWarning('Infills (sheet mode): Plexi sheet 3050x2030 (Clear) not found in materials pricebook.');
    } else {
      const unitCost = Number((plexiSheetClearInfill as any).cost_ex_gst ?? 0);
      lines.push({
        id: 'infill.acrylic_sheet_clear',
        label: plexiSheetClearInfill.name,
        profile: 'Plexi sheet 3050x2030',
        unit: plexiSheetClearInfill.unit,
        qty: sheetsNeeded,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(sheetsNeeded * unitCost),
        notes: `Infills (sheet mode pooled): area ${roundMoney(infillSheetAreaM2)}m2 x (1+${Math.round(
          infillSheetWasteFactor * 100,
        )}%) = ${roundMoney(effectiveAreaM2)}m2; sheets ${sheetsNeeded} (sheet area ${roundMoney(sheetAreaM2)}m2).`,
      });
    }
  }

  let spliceJoinCount = 0;

  for (const [groupKey, group] of cutGroups.entries()) {
    trace?.cutGroupMeta(groupKey, {
      profile: group.profile,
      colour: group.colour,
      finish: group.finish,
    });
    const rawBars = pickBarsForProfile(config, group.profile, group.colour);
    const applyPowdercoatOverlay =
      group.finish !== 'raw_mill' && inputs.extrusion_colour === 'Mill' && group.colour === 'Mill' && !!powdercoatColourUsed;
    const bars = applyPowdercoatOverlay
      ? rawBars.map((bar) => {
          const baseCost = Number((bar as any).cost_ex_gst ?? 0);
          const powderItem = findPowdercoatBar(config, group.profile, bar.stock_length_m);
          if (!powderItem) {
            pushWarning(
              `INVALID: Powdercoat pricebook item not found for profile '${group.profile}' (${bar.stock_length_m}m).`,
            );
          }
          const powderCost = powderItem ? Number((powderItem as any).cost_ex_gst ?? 0) : 0;
          const effectiveCost = baseCost + powderCost * powdercoatMultiplier;
          return {
            ...bar,
            cost_ex_gst: effectiveCost,
            __powdercoat_base_cost_ex_gst: baseCost,
            __powdercoat_cost_ex_gst: powderCost,
            __powdercoat_multiplier: powdercoatMultiplier,
            __powdercoat_colour_used: powdercoatColourUsed,
          };
        })
      : rawBars;
    trace?.stockCandidates(
      groupKey,
      bars.map((bar) => {
        const powderBase = Number((bar as any).__powdercoat_base_cost_ex_gst ?? Number((bar as any).cost_ex_gst ?? 0));
        const powderCost = Number((bar as any).__powdercoat_cost_ex_gst ?? 0);
        const powderMult = Number((bar as any).__powdercoat_multiplier ?? 1);
        const powderColour = String((bar as any).__powdercoat_colour_used ?? '');
        const effectiveCost = Number((bar as any).cost_ex_gst ?? 0);
        return {
          item_id: String(bar.id),
          name: String(bar.name),
          stock_length_m: Number(bar.stock_length_m),
          unit_cost_ex_gst: roundMoney(effectiveCost),
          powdercoat: applyPowdercoatOverlay
            ? {
                applied: true,
                base_cost_ex_gst: roundMoney(powderBase),
                powdercoat_cost_ex_gst: roundMoney(powderCost),
                multiplier: roundMoney(powderMult),
                colour_used: powderColour,
                effective_cost_ex_gst: roundMoney(effectiveCost),
                formula: 'base + powder * multiplier',
              }
            : undefined,
        };
      }),
    );
    if (!bars.length) {
      const candidates = config.materials.items
        .filter((it) => it.category === 'aluminium_extrusion' && it.unit === 'bar')
        .filter((it) => {
          const attrs = it.attributes as Record<string, unknown> | undefined;
          if (!attrs) return false;
          const c = typeof attrs.colour === 'string' ? normaliseColour(attrs.colour) : null;
          return c === normaliseColour(group.colour);
        })
        .map((it) => {
          const attrs = it.attributes as Record<string, unknown> | undefined;
          const p = typeof attrs?.profile === 'string' ? attrs.profile : '';
          const l = typeof attrs?.length_m === 'number' ? attrs.length_m : null;
          return `${p}${typeof l === 'number' ? ` (${l}m)` : ''}`;
        });
      const unique = Array.from(new Set(candidates)).slice(0, 12);
      pushWarning(
        `No pricebook bars found for requested profile '${group.profile}' (colour '${group.colour}').` +
          (unique.length ? ` Available for colour: ${unique.join(', ')}.` : ''),
      );
      continue;
    }

    const singleCuts = group.cuts.filter((cut) => cut.join_policy === 'single');
    const maxSingleCut = Math.max(
      0,
      ...singleCuts.map((cut) => cut.length_m).filter((n) => Number.isFinite(n) && n > 0),
    );
    const maxStock = Math.max(0, ...bars.map((b) => b.stock_length_m).filter((n) => Number.isFinite(n) && n > 0));
    if (singleCuts.length && maxSingleCut > maxStock + 1e-6) {
      pushWarning(
        `Required cut length ${roundMoney(maxSingleCut)}m exceeds max stock length ${roundMoney(maxStock)}m for profile '${group.profile}' (colour '${group.colour}').`,
      );
    }

    const selection = selectBestStock(bars, group.cuts, preferredStockLengths, { trace, groupKey });
    if (!selection.bar || selection.barsUsed <= 0) {
      if (trace) {
        trace.joinableOriginals(
          groupKey,
          Array.from(group.originals_joinable.entries()).map(([originId, originLen]) => ({
            origin_id: originId,
            origin_len_m: originLen,
          })),
        );
      }
      if (singleCuts.length) {
        const lengths = Array.from(new Set(bars.map((b) => b.stock_length_m))).sort((a, b) => b - a);
        pushWarning(
          `Could not allocate bars for requested profile '${group.profile}' (colour '${group.colour}'). Available stock lengths: ${lengths.join(
            ', ',
          )}.`,
        );
      }
      continue;
    }

    const unitCost = (selection.bar as any).cost_ex_gst as number;
    const lineCost = selection.barsUsed * unitCost;
    const powderBase = (selection.bar as any).__powdercoat_base_cost_ex_gst as number | undefined;
    const powderCost = (selection.bar as any).__powdercoat_cost_ex_gst as number | undefined;
    const powderMult = (selection.bar as any).__powdercoat_multiplier as number | undefined;
    const powderColour = (selection.bar as any).__powdercoat_colour_used as string | undefined;

    let joinCountForGroup = 0;
    const joinableExplainRows: Array<{ origin_id: string; origin_len_m: number; joins_needed: number }> = [];
    for (const [originId, originLen] of group.originals_joinable.entries()) {
      if (!Number.isFinite(originLen)) continue;
      const joinsNeeded = originLen > selection.bar.stock_length_m + 1e-6 ? Math.max(0, Math.ceil(originLen / selection.bar.stock_length_m) - 1) : 0;
      joinableExplainRows.push({
        origin_id: originId,
        origin_len_m: originLen,
        joins_needed: joinsNeeded,
      });
      joinCountForGroup += joinsNeeded;
    }
    trace?.joinableOriginals(groupKey, joinableExplainRows);
    spliceJoinCount += joinCountForGroup;

    waste_m_by_cut_group[groupKey] = roundMoney(selection.wasteM);
    bars_by_cut_group[groupKey] = {
      stock_length_m: selection.bar.stock_length_m,
      bars_used: selection.barsUsed,
    };
    addProfileTotals(group.profile, selection.bar.stock_length_m, selection.barsUsed, selection.wasteM);

    const components = Array.from(group.components).join(', ');
    const totalCutM = roundMoney(sum(group.cuts.map((cut) => cut.length_m).filter((n) => Number.isFinite(n) && n > 0)));
    const wasteM = roundMoney(selection.wasteM);
    let notes = `Cuts ${totalCutM}m from ${selection.barsUsed}×${selection.bar.stock_length_m}m; waste ${wasteM}m (${components})`;
    let label = selection.bar.name;

    if (applyPowdercoatOverlay && powderColour) {
      const colourLabel = powderMult && powderMult > 1.01 ? `Custom: ${powderColour}` : powderColour;
      if (label.toLowerCase().includes('mill')) {
        label = label.replace(/mill/gi, `Powdercoated ${colourLabel}`);
      } else {
        label = `${label} (Powdercoated ${colourLabel})`;
      }
      const baseCost = roundMoney(typeof powderBase === 'number' ? powderBase : unitCost);
      const coatCost = roundMoney(typeof powderCost === 'number' ? powderCost : 0);
      const mult = typeof powderMult === 'number' && Number.isFinite(powderMult) ? powderMult : 1;
      const effective = roundMoney(unitCost);
      const powderNote = `Mill base $${baseCost} + powdercoat $${coatCost} × ${roundMoney(mult)} = $${effective} (powdercoat: ${colourLabel})`;
      notes = `${notes} | ${powderNote}`;
    }

    const extrusionLine: MaterialsLineV1 = {
      id: selection.bar.id,
      label,
      profile: group.profile,
      unit: 'bar',
      qty: selection.barsUsed,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(lineCost),
      notes,
    };
    lines.push(extrusionLine);
    annotateLine(extrusionLine, {
      kind: 'extrusion_bar',
      cut_group_key: groupKey,
      notes_formula: notes,
    });

    const expandedForChosen = expandCutsForStock(group.cuts, selection.bar.stock_length_m) ?? [];
    selectedExpandedCutsByGroup?.set(groupKey, {
      expandedCuts: expandedForChosen,
      stockLengthM: selection.bar.stock_length_m,
    });
    if (trace?.shouldCollectFullGroup(groupKey) && expandedForChosen.length > 0) {
      trace.binPackPlan(groupKey, greedyBinPackPlan(expandedForChosen, selection.bar.stock_length_m));
    }
    trace?.cutGroupTotals(groupKey, {
      bars_used: selection.barsUsed,
      stock_length_m: selection.bar.stock_length_m,
      waste_m: roundMoney(selection.wasteM),
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(lineCost),
      splice_joins_in_group: joinCountForGroup,
    });
  }

  if (spliceJoinCount > 0) {
    const joinQty = Math.max(0, Math.round(spliceJoinCount));
    const bracketItem = findPricebookItemById(config, 'hardware.splice_join_bracket');
    if (!bracketItem) pushWarning("Splice join bracket item 'hardware.splice_join_bracket' not found in materials pricebook.");
    else {
      const unitCost = Number((bracketItem as any).cost_ex_gst ?? 0);
      lines.push({
        id: bracketItem.id,
        label: bracketItem.name,
        unit: bracketItem.unit,
        qty: joinQty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(joinQty * unitCost),
        notes: bracketItem.notes ?? undefined,
      });
    }

    const screwQty = joinQty * 6;
    const screwItem = findPricebookItemById(config, 'fixing.splice_join_screw_each');
    if (!screwItem) pushWarning("Splice join screw item 'fixing.splice_join_screw_each' not found in materials pricebook.");
    else {
      const unitCost = Number((screwItem as any).cost_ex_gst ?? 0);
      lines.push({
        id: screwItem.id,
        label: screwItem.name,
        unit: screwItem.unit,
        qty: screwQty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(screwQty * unitCost),
        notes: screwItem.notes ?? undefined,
      });
    }
  }

  // === House connection: soffit bracket pricebook items ===
  if (inputs.house_connection_type === 'soffit' && derived.bracket_count > 0) {
    const soffitBracketQty = Math.max(0, derived.bracket_count);

    const bracketItem = findPricebookItemById(config, 'bracket_3f6d3c53fa');
    if (!bracketItem) pushWarning("Soffit bracket pricebook item 'bracket_3f6d3c53fa' not found.");
    else {
      const unitCost = Number((bracketItem as any).cost_ex_gst ?? 0);
      lines.push({
        id: bracketItem.id,
        label: bracketItem.name,
        unit: bracketItem.unit,
        qty: soffitBracketQty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(soffitBracketQty * unitCost),
        notes: bracketItem.notes ?? undefined,
      });
    }

    const powderItem = findPricebookItemById(config, 'powdercoating_199231d91b');
    if (!powderItem) pushWarning("Powdercoating pricebook item 'powdercoating_199231d91b' not found.");
    else {
      const unitCost = Number((powderItem as any).cost_ex_gst ?? 0);
      lines.push({
        id: powderItem.id,
        label: powderItem.name,
        unit: powderItem.unit,
        qty: soffitBracketQty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(soffitBracketQty * unitCost),
        notes: powderItem.notes ?? undefined,
      });
    }
  }

  // === Hardware rules (resolved via materials pricebook) ===
  const materialItems = new Map(config.materials.items.map((it) => [it.id, it]));
  const qtyVars: Record<string, number> = {
    post_count: inputs.post_count,
    bracket_count: derived.bracket_count,
    stringer_fixing_count: derived.stringer_fixing_count,
    rafter_count: derived.rafter_count,
    total_rafter_pieces: Number((derived as any).total_rafter_pieces ?? derived.rafter_count),
    joiner_runs_total: Number((derived as any).joiner_runs_total ?? derived.rafter_count),
    splice_join_count: spliceJoinCount,
    overhang_mid_bracket_count: inputs.overhang_enabled ? Math.max(0, derived.rafter_count) : 0,
    overhang_end_cap_count: inputs.overhang_enabled ? 4 : 0,
    acrylic_sheet_count: inputs.acrylic_sheet_count,
    acrylic_bays_total: Number((derived as any).acrylic_bays_total ?? 0) || 0,
    acrylic_plane_count_used: Number((derived as any).acrylic_plane_count_used ?? 0) || 0,
    length_m: inputs.length_m,
    projection_m: inputs.projection_m,
    gutter_length_m: Number(inputs.gutter_length_m ?? 0) || 0,
    timber_plane_count: Number((derived as any).timber_plane_count ?? 0) || 0,
    timber_purlin_lines_per_plane: Number((derived as any).timber_purlin_lines_per_plane ?? 0) || 0,
    timber_common_rafter_count_per_plane: Number((derived as any).timber_common_rafter_count_per_plane ?? 0) || 0,
    timber_roof_above_area_m2: Number((derived as any).timber_roof_above_area_m2 ?? 0) || 0,
    covertek_area_m2: Number((derived as any).covertek_area_m2 ?? 0) || 0,
    polystyrene_area_m2: Number((derived as any).polystyrene_area_m2 ?? 0) || 0,
    timber_roofing_screws_steel_count: Number((derived as any).timber_roofing_screws_steel_count ?? 0) || 0,
    timber_roofing_screws_insulated_count: Number((derived as any).timber_roofing_screws_insulated_count ?? 0) || 0,
    acrylic_joiner_bottom_fixings_each: acrylicJoinerBottomFixingsEach,
  };

  for (const rule of config.hardware.rules) {
    const applies = Object.entries(rule.applies_when).every(([k, v]) => (inputs as any)[k] === v);
    trace?.decision({
      label: `Hardware rule ${rule.id}`,
      condition: 'all applies_when entries match normalized inputs',
      deps: { ...rule.applies_when },
      result: applies,
      branch_taken: applies ? 'applied' : 'skipped',
    });
    if (!applies) continue;

    for (const line of rule.lines) {
      const item = materialItems.get(line.item_id);
      if (!item) {
        pushWarning(`Hardware rule item '${line.item_id}' not found in materials pricebook (rule ${rule.id}).`);
        continue;
      }

      let qty = 0;
      let varsUsed: Record<string, number> = {};
      try {
        if (trace) {
          const evaluated = evalQtyExpressionExplain(String(line.qty), qtyVars);
          qty = evaluated.result;
          varsUsed = evaluated.accessed;
        } else {
          qty = evalQtyExpression(String(line.qty), qtyVars);
        }
      } catch (err) {
        pushWarning(`Failed to evaluate qty '${line.qty}' for '${line.item_id}' (rule ${rule.id}).`);
        continue;
      }

      qty = Math.max(0, qty);

      const unitCost = Number((item as any).cost_ex_gst ?? 0);
      const hardwareLine: MaterialsLineV1 = {
        id: item.id,
        label: item.name,
        unit: item.unit,
        qty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(qty * unitCost),
        notes: rule.notes || undefined,
      };
      lines.push(hardwareLine);
      annotateLine(hardwareLine, {
        kind: 'rule_hardware',
        rule_id: String(rule.id),
        applies_when: { ...rule.applies_when },
        applied: true,
        expr: String(line.qty),
        vars_used: varsUsed,
        result_qty: qty,
      });
    }
  }

  if (steelBeamUsage.any) {
    const hiabItem = findPricebookItemById(config, STEEL_HIAB_ITEM_ID);
    if (!hiabItem) {
      pushWarning(`Steel beam selected but '${STEEL_HIAB_ITEM_ID}' is missing from materials pricebook.`);
    } else {
      const unitCost = Number((hiabItem as any).cost_ex_gst ?? 0);
      const hiabLine: MaterialsLineV1 = {
        id: hiabItem.id,
        label: hiabItem.name,
        unit: hiabItem.unit,
        qty: 1,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(unitCost),
        notes: 'Steel beam handling: 1 day Hiab hire per module.',
      };
      lines.push(hiabLine);
      annotateLine(hiabLine, {
        kind: 'simple',
        formula: 'qty = 1 when any steel beam profile is active (front, tie, ridge, overhang)',
        deps: {
          steel_front_beam: steelBeamUsage.front,
          steel_tie_beam: steelBeamUsage.tie,
          steel_ridge_beam: steelBeamUsage.ridge,
          steel_overhang_support_beam: steelBeamUsage.overhang,
        },
      });
    }
  }

  // Stable ordering for UI + snapshots.
  lines.sort((a, b) => a.id.localeCompare(b.id));

  if (trace) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const explainMeta = lineExplainByRef?.get(line);
      const base = {
        line_index: i,
        line_id: line.id,
        label: line.label,
        unit: line.unit,
        qty: line.qty,
        unit_cost_ex_gst: line.unit_cost_ex_gst,
        line_cost_ex_gst: line.line_cost_ex_gst,
      };

      if (explainMeta?.kind === 'extrusion_bar') {
        const key = explainMeta.cut_group_key;
        const shouldIncludePlan = trace.shouldCollectFullGroup(key);
        const selected = selectedExpandedCutsByGroup?.get(key);
        if (shouldIncludePlan && selected && selected.expandedCuts.length > 0) {
          trace.binPackPlan(key, greedyBinPackPlan(selected.expandedCuts, selected.stockLengthM));
        }
        trace.linkLine(i, {
          ...base,
          kind: 'extrusion_bar',
          cut_group_key: key,
          notes_formula: explainMeta.notes_formula,
        });
        continue;
      }

      if (explainMeta?.kind === 'acrylic_sheet_or_strip') {
        trace.linkLine(i, {
          ...base,
          kind: 'acrylic_sheet_or_strip',
          formula: explainMeta.formula,
          deps: explainMeta.deps,
        });
        continue;
      }

      if (explainMeta?.kind === 'rule_hardware') {
        trace.linkLine(i, {
          ...base,
          kind: 'rule_hardware',
          rule_id: explainMeta.rule_id,
          applies_when: explainMeta.applies_when,
          applied: explainMeta.applied,
          expr: explainMeta.expr,
          vars_used: explainMeta.vars_used,
          result_qty: explainMeta.result_qty,
        });
        continue;
      }

      trace.linkLine(i, {
        ...base,
        kind: 'simple',
        formula: line.notes ? String(line.notes) : 'qty from fixed BOM line',
        deps: {
          qty: line.qty,
          unit: line.unit,
        },
      });
    }

    trace.finalize({
      total_cut_groups: cutGroups.size,
      total_lines: lines.length,
      focus_cut_group_key: explainOpts?.focus_cut_group_key,
    });
  }

  for (const [profile, totalBarsUsed] of Object.entries(bars_used_by_profile)) {
    const byLen = bars_used_by_profile_by_len[profile] ?? {};
    let dominantLen = 0;
    let dominantBars = -1;

    for (const [lenKey, barsUsedAtLen] of Object.entries(byLen)) {
      const stockLen = Number(lenKey);
      const barsUsed = Number(barsUsedAtLen);
      if (!Number.isFinite(stockLen) || stockLen <= 0 || !Number.isFinite(barsUsed) || barsUsed <= 0) continue;
      if (barsUsed > dominantBars || (barsUsed === dominantBars && stockLen > dominantLen)) {
        dominantBars = barsUsed;
        dominantLen = stockLen;
      }
    }

    if (dominantLen <= 0) continue;
    bars_by_profile[profile] = {
      stock_length_m: dominantLen,
      bars_used: roundMoney(totalBarsUsed),
    };
  }

  const materialsExGst = roundMoney(lines.reduce((acc, l) => acc + l.line_cost_ex_gst, 0));

  return {
    materials: {
      lines,
      totals: {
        materials_ex_gst: materialsExGst,
        waste_m_by_profile,
        bars_by_profile,
        waste_m_by_cut_group,
        bars_by_cut_group,
      },
    },
    notes_and_warnings: warnings,
    derived_patch: {
      splice_join_count: spliceJoinCount,
      acrylic_joiner_bottom_total_m: roundMoney(acrylicJoinerBottomTotalM),
      acrylic_joiner_top_total_m: roundMoney(acrylicJoinerTopTotalM),
      acrylic_joiner_bottom_fixings_each: Math.max(0, Math.round(acrylicJoinerBottomFixingsEach)),
      acrylic_install_area_m2: roundMoney(acrylicInstallAreaM2),
      infill_instance_count: Math.max(0, Math.round(infillInstanceCount)),
      infill_joiner_total_m: roundMoney(infillJoinerTotalM),
      infill_joiner_fixings_each: Math.max(0, Math.round(infillJoinerFixingsEach)),
      infill_sheet_area_m2: roundMoney(infillSheetAreaM2),
      infill_strip_panel_count: Math.max(0, Math.round(infillStripPanelCount)),
      infill_extra_supports_each: Math.max(0, Math.round(infillExtraSupportsEach)),
    },
  };
}

export function buildMaterialsV1(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
  config: CostingConfigV1,
): BuildMaterialsResultV1 {
  return buildMaterialsV1Internal(inputs, derived, config);
}

export function buildMaterialsV1Explain(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
  config: CostingConfigV1,
  opts?: MaterialsExplainOptions,
): { result: BuildMaterialsResultV1; explain: MaterialsExplainV1 } {
  const run = (runOpts?: MaterialsExplainOptions): { result: BuildMaterialsResultV1; explain: MaterialsExplainV1 } => {
    const { collector, output } = createMaterialsExplainCollector(runOpts);
    output.inputs_normalized_snapshot = snapshotInputs(inputs);
    output.derived_snapshot = snapshotDerived(derived);
    const result = buildMaterialsV1Internal(inputs, derived, config, collector, runOpts);
    return { result, explain: output };
  };

  const first = run(opts);
  const focusLineIndex = typeof opts?.focus_line_index === 'number' ? Math.max(0, Math.round(opts.focus_line_index)) : null;
  if (focusLineIndex === null || opts?.focus_cut_group_key) return first;

  const focusedLine = first.explain.lines[String(focusLineIndex)];
  if (!focusedLine || focusedLine.kind !== 'extrusion_bar') return first;

  const focusGroupKey = focusedLine.cut_group_key;
  if (!focusGroupKey) return first;

  const nextOpts: MaterialsExplainOptions = {
    ...opts,
    focus_cut_group_key: focusGroupKey,
  };
  return run(nextOpts);
}

export const __test__ = { selectBestStock };
