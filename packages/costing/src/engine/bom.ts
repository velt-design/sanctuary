import type { CostingConfigV1 } from './config';
import type { DerivedV1, InputsNormalizedV1, MaterialsLineV1, MaterialsV1 } from './types';
import { evalArithmeticExpr } from './expr';
import { normaliseColour, normaliseProfile } from './normalise';

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

function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

const isContinuousRunComponent = (component?: string) => /gutter|ledger|beam|stringer/i.test(String(component ?? ''));

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
  };
  const evaluated: Candidate[] = [];

  const candidates = bars
    .filter((b) => preferred.includes(b.stock_length_m))
    .sort((a, b) => preferred.indexOf(a.stock_length_m) - preferred.indexOf(b.stock_length_m));

  for (const bar of candidates) {
    const unitCost = (bar as any).cost_ex_gst as number;
    if (!Number.isFinite(unitCost)) continue;
    const expanded = expandCutsForStock(cuts, bar.stock_length_m);
    if (!expanded || expanded.length === 0) continue;
    const cutsDesc = [...expanded]
      .map((cut) => cut.length_m)
      .filter((len) => Number.isFinite(len) && len > 0)
      .sort((a, b) => b - a);
    const { barsUsed, wasteM } = greedyBinPack(cutsDesc, bar.stock_length_m);
    const totalCost = barsUsed * unitCost;
    const costPerM = unitCost / Math.max(bar.stock_length_m, 0.0001);
    const isExactFit = hasContinuousRun && Array.from(targets).some((t) => Math.abs(t - bar.stock_length_m) <= EPS);

    evaluated.push({ bar, barsUsed, wasteM, totalCost, costPerM, isExactFit });
  }

  if (!evaluated.length) return { bar: null, barsUsed: 0, wasteM: 0 };

  const anyExactFit = hasContinuousRun && evaluated.some((candidate) => candidate.isExactFit);
  let best = evaluated[0];

  for (let i = 1; i < evaluated.length; i += 1) {
    const candidate = evaluated[i];

    if (hasContinuousRun) {
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

function rafterDepthM(profile: string): number {
  const normalized = normaliseProfile(profile);
  if (normalized === '80x50') return 0.08;
  if (normalized === '100x50') return 0.1;
  if (normalized === '150x50') return 0.15;
  return 0.1;
}

const TIMBER_EDGE_RAFTER_PROFILE = '150x50';
const TIMBER_PURLIN_PROFILE = '50x50';

export function buildMaterialsV1(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
  config: CostingConfigV1,
): BuildMaterialsResultV1 {
  const warnings: string[] = [];
  const lines: MaterialsLineV1[] = [];

  const preferredStockLengths = config.bomStrategy.settings.stock_length_preference_m;
  const powdercoatColourUsed = String((derived as any).powdercoat_colour_used ?? '');
  const powdercoatMultiplier = Number((derived as any).powdercoat_multiplier ?? 1);

  const cutGroups = new Map<string, CutGroup>();
  const originIdCounters = new Map<string, number>();

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
    opts?: { colour?: InputsNormalizedV1['extrusion_colour']; finish?: FinishMode; origin_prefix?: string },
  ) => {
    if (!cutsM.length) return;
    const colour = opts?.colour ?? inputs.extrusion_colour;
    const finish: FinishMode = opts?.finish ?? 'default';
    const originPrefix = opts?.origin_prefix ?? component;
    const key = `${profile}__${colour}__${finish}`;
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
        };
        existing.cuts.push(cutItem);
        if (joinPolicy === 'joinable' && Number.isFinite(c) && c > 0) {
          existing.originals_joinable.set(originId, c);
        }
      });
      existing.components.add(component);
      return;
    }
    cutGroups.set(key, {
      profile,
      colour,
      finish,
      cuts: cutsM.map((c) => {
        const originId = nextOriginId(originPrefix);
        return {
          length_m: c,
          origin_id: originId,
          origin_len_m: c,
          join_policy: joinPolicy,
          segment_index: 0,
          component,
          finish,
        };
      }),
      originals_joinable: new Map<string, number>(),
      components: new Set([component]),
    });
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

  if (isTimberRoof) {
    if (timberCommonRafterCountTotal > 0) {
      addCuts(
        inputs.rafter_profile,
        Array.from({ length: timberCommonRafterCountTotal }).map(() => timberSlopeLenPerPlaneM),
        'Timber common rafters',
        'single',
        { colour: 'Mill', finish: 'raw_mill', origin_prefix: 'timber_common_rafter' },
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
      { origin_prefix: 'rafter' },
    );
  } else {
    addCuts(
      inputs.rafter_profile,
      Array.from({ length: rafterPieceCount }).map(() => rafterLength),
      'Rafters',
      'single',
      { origin_prefix: 'rafter' },
    );
  }

  if (ledgerLengthM > 0) {
    if (isHipCorner) {
      addCuts(
        ledgerProfile,
        [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0),
        'Ledger',
        'joinable',
        { origin_prefix: 'ledger' },
      );
    } else {
      addCuts(ledgerProfile, [ledgerLengthM], 'Ledger', 'joinable', { origin_prefix: 'ledger' });
    }
  }

  if ((isTimberRoof || isMixedRoof) && timberEdgeRafterCountTotal > 0) {
    addCuts(
      timberEdgeRafterProfileUsed,
      Array.from({ length: timberEdgeRafterCountTotal }).map(() => timberSlopeLenPerPlaneM),
      'Timber edge rafters',
      'single',
      { colour: inputs.extrusion_colour, finish: timberEdgeRafterFinish, origin_prefix: 'timber_edge_rafter' },
    );
  }

  if ((isTimberRoof || isMixedRoof) && timberPurlinLinesPerPlane > 0 && timberPurlinTotalM > 0) {
    const purlinPieces = timberPurlinLinesPerPlane * timberPlaneCount;
    const pieceLengthM = timberPurlinTotalM / Math.max(1, purlinPieces);
    if (!Number.isFinite(pieceLengthM) || pieceLengthM <= 0) {
      warnings.push('Invalid timber purlin length derived; skipping timber purlins.');
    } else {
      addCuts(
        TIMBER_PURLIN_PROFILE,
        Array.from({ length: purlinPieces }).map(() => pieceLengthM),
        'Timber purlins',
        'joinable',
        { colour: 'Mill', finish: 'raw_mill', origin_prefix: 'timber_purlin' },
      );
    }
  }

  addCuts(
    postProfile,
    Array.from({ length: inputs.post_count }).map(() => inputs.post_cut_height_m),
    'Posts',
    'single',
    { origin_prefix: 'post' },
  );

  if (inputs.structure_type === 'pitched') {
    if (gutterMode === 'overhang_gutter_front_edge') {
      if (Number.isFinite(inputs.length_m) && inputs.length_m > 0) {
        addCuts(
          'Overhang Gutter 100x100',
          [inputs.length_m, inputs.length_m],
          'Overhang gutter (2× stock)',
          'joinable',
          { origin_prefix: 'overhang_gutter_run' },
        );
      }
    } else if (gutterAssemblyMode === 'separate') {
      if (Number.isFinite(separateGutterLengthM) && separateGutterLengthM > 0) {
        addCuts(
          'Box Gutter 100x100x3',
          [separateGutterLengthM, separateGutterLengthM],
          'Separate gutter (2× stock)',
          'joinable',
          { origin_prefix: 'separate_gutter_run' },
        );
        warnings.push('Separate gutter uses 100x100 cut‑down stock; length doubled to allow for waste.');
      }
    } else if (inputs.gutter_type === 'sp_gutter') {
      if (isHipCorner) {
        addCuts(
          'SP Gutter',
          [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0),
          'SP gutter',
          'joinable',
          { origin_prefix: 'sp_gutter_run' },
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
            { origin_prefix: 'sp_gutter_run' },
          );
        } else if (runCount >= 2) {
          addCuts(
            'SP Gutter',
            [inputs.length_m, inputs.length_m],
            'SP gutter (2 eaves)',
            'joinable',
            { origin_prefix: 'sp_gutter_run' },
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
      { origin_prefix: 'box_beam_sidea' },
    );
    addCuts(
      boxBeamProfile,
      [inputs.projection_m, inputs.projection_m],
      'Box perimeter beams',
      'joinable',
      { origin_prefix: 'box_beam_sideb' },
    );
    if (inputs.roof_type === 'gable' && Number.isFinite(derived.ridge_length_m) && derived.ridge_length_m > 0 && ridgeBeamProfile) {
      addCuts(ridgeBeamProfile, [derived.ridge_length_m], 'Ridge beam (box gable)', 'joinable', { origin_prefix: 'ridge_beam' });
    }
    if (inputs.gutter_type === 'box_gutter_100x100_cut') {
      const gutterLength = Math.max(0, Number(inputs.gutter_length_m ?? 0));
      if (gutterLength > 0) {
        addCuts('Box Gutter 100x100x3', [gutterLength], 'Box perimeter gutter', 'joinable', {
          origin_prefix: 'box_gutter_run',
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
        { origin_prefix: 'front_beam' },
      );
    } else if (Number.isFinite(inputs.length_m) && inputs.length_m > 0) {
      addCuts(frontBeamProfile, [inputs.length_m], 'Front beam', 'joinable', { origin_prefix: 'front_beam' });
    }
  }

  if (inputs.roof_type === 'gable' && gableEndFrameCount > 0) {
    if (tieBeamProfile && tieBeamLength > 0) {
      addCuts(
        tieBeamProfile,
        Array.from({ length: gableEndFrameCount }).map(() => tieBeamLength),
        'Gable tie beam',
        'joinable',
        { origin_prefix: 'tie_beam' },
      );
    }
    if (strutProfile && kingpostStrutLength > 0) {
      addCuts(
        strutProfile,
        Array.from({ length: gableEndFrameCount }).map(() => kingpostStrutLength),
        'King-post strut',
        'joinable',
        { origin_prefix: 'kingpost_strut' },
      );
    }
  }

  if (overhangEnabled) {
    if (overhangSupportBeamProfile && overhangSupportBeamLength > 0) {
      addCuts(overhangSupportBeamProfile, [overhangSupportBeamLength], 'Overhang support beam', 'joinable', {
        origin_prefix: 'overhang_support_beam',
      });
    }
    if (overhangStringerProfile && overhangStringerLength > 0) {
      addCuts(overhangStringerProfile, [overhangStringerLength], 'Overhang end stringer', 'joinable', {
        origin_prefix: 'overhang_stringer',
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
    waste_m_by_profile['Crystalite 620mm'] = roundMoney((waste_m_by_profile['Crystalite 620mm'] ?? 0) + wasteM);
    const prev = bars_by_profile['Crystalite 620mm'];
    if (!prev) {
      bars_by_profile['Crystalite 620mm'] = { stock_length_m: stockLen, bars_used: barsUsed };
      return;
    }
    bars_by_profile['Crystalite 620mm'] = {
      stock_length_m: Math.max(prev.stock_length_m, stockLen),
      bars_used: prev.bars_used + barsUsed,
    };
  };

  const addCrystaliteLine = (opts: { requiredLen: number; qty: number; note: string; idSuffix?: string; cutCount?: number }) => {
    const requiredLen = Math.max(0, opts.requiredLen);
    const qty = Math.max(0, Math.round(opts.qty));
    const cutCount = Math.max(0, Math.round(opts.cutCount ?? qty));
    if (!qty || requiredLen <= 0 || !cutCount) return;

    const selectedLen = pickStripStockLen(requiredLen);
    const stripItem = findCrystalite620Item(config, { length_m: selectedLen, colour: 'Clear' });
    if (!stripItem) {
      warnings.push(`Crystalite 620mm (Clear) ${selectedLen}m not found in materials pricebook.`);
      return;
    }

    const unitCost = (stripItem as any).cost_ex_gst as number;
    const totalWaste = Math.max(0, qty * selectedLen - cutCount * requiredLen);
    recordCrystalite(selectedLen, qty, totalWaste);

    const id = opts.idSuffix ? `${stripItem.id}.${opts.idSuffix}` : stripItem.id;
    lines.push({
      id,
      label: stripItem.name,
      profile: 'Crystalite 620mm',
      unit: stripItem.unit,
      qty,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(qty * unitCost),
      notes: opts.note,
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
      warnings.push(
        `Acrylic slope exceeds ${roundMoney(acrylicMaxSlopeM)}m. Max supported acrylic slope is ${roundMoney(
          acrylicMaxSlopeM,
        )}m (use design change or timber). (${debug})`,
      );
    }

    const sheetMode = requiredLen <= sheetLengthM + 1e-6;
    if (sheetMode) {
      if (!plexiSheetClear) {
        warnings.push('Plexi sheet 3050mm x2030mm (Clear) not found in materials pricebook; falling back to 620mm strips.');
      } else {
        const sheetQtyMode: 'plan' | 'bays' = opts.sheetQtyMode === 'plan' ? 'plan' : 'bays';

        let sheetsNeeded = 0;
        let sheetNote = '';

        const forceStripYield = requiredLen > sheetWidthM + 1e-6;

        if (forceStripYield) {
          const STRIP_WIDTH_M = 0.62;
          const stripsPerSheet = Math.floor(sheetWidthM / STRIP_WIDTH_M);
          if (stripsPerSheet < 1) {
            warnings.push('INVALID: Acrylic sheet strip yield invalid (sheet width too small for 620mm strips).');
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
          lines.push({
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
          });
          return;
        }
      }
    }

    const selectedLen = pickStripStockLen(requiredLen);
    const cutsPerBar = Math.max(1, Math.floor(selectedLen / Math.max(0.01, requiredLen)));
    const barsNeeded = Math.max(0, Math.ceil(totalBays / cutsPerBar));

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

  if (inputs.roof_material === 'acrylic') {
    const joinerRunsTotal = Math.max(0, Math.round(Number((derived as any).joiner_runs_total ?? derived.rafter_count)));
    const joinerCountA = isHipCorner ? rafterCountA : joinerRunsTotal;
    const joinerLengthA = isHipCorner ? joinerPieceLengthA : Math.max(0, Number((derived as any).joiner_piece_length_m ?? rafterLength));
    const joinerCountB = isHipCorner ? rafterCountB : 0;
    const joinerLengthB = isHipCorner ? joinerPieceLengthB : 0;

    if (joinerCountA > 0 && joinerLengthA > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountA }).map(() => joinerLengthA), 'Joiners', 'joinable', {
        origin_prefix: 'joiner',
      });
    }
    if (joinerCountB > 0 && joinerLengthB > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountB }).map(() => joinerLengthB), 'Joiners', 'joinable', {
        origin_prefix: 'joiner',
      });
    }

    const rubberMultiplier = 2; // both sides
    const rubberMetres = (joinerCountA * joinerLengthA + joinerCountB * joinerLengthB) * rubberMultiplier;
    if (rubberMetres > 0) {
      const topRubber = findRubberItem(config, 'Top V Rubber');
      const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

      if (!topRubber) warnings.push('Top V Rubber item not found in materials pricebook.');
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

      if (!bottomRubber) warnings.push('Bottom Flat Rubbers item not found in materials pricebook.');
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
      if (!foam) warnings.push(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
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

    const flashingMetres = Math.max(0, inputs.flashing_length_m);
    if (flashingMetres > 0) {
      warnings.push('Flashing material not pricebooked yet; using $0/m placeholder (add real SKU/cost).');
      lines.push({
        id: 'placeholder.flashing_material_m',
        label: 'Flashing (material placeholder)',
        profile: null,
        unit: 'metre',
        qty: roundMoney(flashingMetres),
        unit_cost_ex_gst: 0,
        line_cost_ex_gst: 0,
        notes: 'Placeholder line only (matches flashing labour length).',
      });
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
      warnings.push('Mixed roof selected but no mixed_roof details provided; skipping acrylic materials.');
    } else if (inputs.mixed_roof.mode === 'acrylic_bays') {
      const roofPlanes = Array.isArray((derived as any).roof_planes) ? ((derived as any).roof_planes as any[]) : [];
      const acrylicBaysByPlane =
        inputs.mixed_roof.acrylic_bays_by_plane && typeof inputs.mixed_roof.acrylic_bays_by_plane === 'object'
          ? inputs.mixed_roof.acrylic_bays_by_plane
          : null;

      if (!roofPlanes.length) {
        warnings.push('Mixed roof acrylic bays mode requires roof plane geometry; skipping acrylic materials.');
      } else if (!acrylicBaysByPlane) {
        warnings.push('Mixed roof acrylic bays mode selected but no acrylic_bays_by_plane provided; skipping acrylic materials.');
      } else {
        let totalJoinerM = 0;

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
              { origin_prefix: planeOriginPrefix },
            );
            totalJoinerM += joinerRuns * planeJoinerPieceLenM;
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
        if (rubberMetres > 0) {
          const topRubber = findRubberItem(config, 'Top V Rubber');
          const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

          if (!topRubber) warnings.push('Top V Rubber item not found in materials pricebook.');
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

          if (!bottomRubber) warnings.push('Bottom Flat Rubbers item not found in materials pricebook.');
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
          if (!foam) warnings.push(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
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

        const flashingMetres = Math.max(0, inputs.flashing_length_m);
        if (flashingMetres > 0) {
          warnings.push('Flashing material not pricebooked yet; using $0/m placeholder (add real SKU/cost).');
          lines.push({
            id: 'placeholder.flashing_material_m',
            label: 'Flashing (material placeholder)',
            profile: null,
            unit: 'metre',
            qty: roundMoney(flashingMetres),
            unit_cost_ex_gst: 0,
            line_cost_ex_gst: 0,
            notes: 'Placeholder line only (matches flashing labour length).',
          });
        }
      }
    } else if (inputs.mixed_roof.mode === 'area_override') {
      if (isHipCorner) {
        warnings.push('Mixed roof area override is not costed for hip corner yet; skipping acrylic materials.');
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
              { origin_prefix: 'joiner_mixed_override' },
            );
          }

          const rubberMultiplier = 2; // both sides
          const rubberMetres = joinerCount * joinerLength * rubberMultiplier;
          if (rubberMetres > 0) {
            const topRubber = findRubberItem(config, 'Top V Rubber');
            const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

            if (!topRubber) warnings.push('Top V Rubber item not found in materials pricebook.');
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

            if (!bottomRubber) warnings.push('Bottom Flat Rubbers item not found in materials pricebook.');
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
            if (!foam) warnings.push(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
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

          const flashingMetres = Math.max(0, inputs.flashing_length_m);
          if (flashingMetres > 0) {
            warnings.push('Flashing material not pricebooked yet; using $0/m placeholder (add real SKU/cost).');
            lines.push({
              id: 'placeholder.flashing_material_m',
              label: 'Flashing (material placeholder)',
              profile: null,
              unit: 'metre',
              qty: roundMoney(flashingMetres),
              unit_cost_ex_gst: 0,
              line_cost_ex_gst: 0,
              notes: 'Placeholder line only (matches flashing labour length).',
            });
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
      warnings.push('Mixed roof mode not supported for acrylic materials yet; skipping acrylic materials.');
    } else {
      const stripCount = Math.max(0, Math.round(inputs.mixed_roof.ridge_skylight.strip_count));
      const ridgeLen = isHipCorner ? inputs.length_m + Math.max(0, hipCornerLengthB) : inputs.length_m;
      const requiredLen = Math.max(0, ridgeLen);
      const maxLen = 6;

      const selectedLen = requiredLen <= maxLen ? stripLengths.find((l) => l >= requiredLen) ?? maxLen : maxLen;
      const barsUsed = requiredLen <= maxLen ? stripCount : stripCount * Math.max(1, Math.ceil(requiredLen / maxLen));

      const stripItem = findCrystalite620Item(config, { length_m: selectedLen, colour: 'Clear' });
      if (!stripItem) {
        warnings.push(`Crystalite 620mm (Clear) ${selectedLen}m not found in materials pricebook.`);
      } else if (stripCount > 0) {
        const unitCost = (stripItem as any).cost_ex_gst as number;
        const totalRequired = stripCount * requiredLen;
        const totalStock = barsUsed * selectedLen;
        const totalWaste = Math.max(0, totalStock - totalRequired);

        waste_m_by_profile['Crystalite 620mm'] = roundMoney((waste_m_by_profile['Crystalite 620mm'] ?? 0) + totalWaste);
        bars_by_profile['Crystalite 620mm'] = { stock_length_m: selectedLen, bars_used: barsUsed };

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
        if (joinerCuts.length)
          addCuts('Joiners', joinerCuts, 'Joiners (skylight edges)', 'joinable', { origin_prefix: 'joiner_skylight_edge' });

        const rubberMultiplier = 2; // both sides
        const rubberMetres = joinerLines * requiredLen * rubberMultiplier;
        if (rubberMetres > 0) {
          const topRubber = findRubberItem(config, 'Top V Rubber');
          const bottomRubber = findRubberItem(config, 'Bottom Flat Rubbers');

          if (!topRubber) warnings.push('Top V Rubber item not found in materials pricebook.');
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

          if (!bottomRubber) warnings.push('Bottom Flat Rubbers item not found in materials pricebook.');
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
          if (!foam) warnings.push(`Foam item not found in materials pricebook for colour ${inputs.extrusion_colour}.`);
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

        const flashingMetres = Math.max(0, inputs.flashing_length_m);
        if (flashingMetres > 0) {
          warnings.push('Flashing material not pricebooked yet; using $0/m placeholder (add real SKU/cost).');
          lines.push({
            id: 'placeholder.flashing_material_m',
            label: 'Flashing (material placeholder)',
            profile: null,
            unit: 'metre',
            qty: roundMoney(flashingMetres),
            unit_cost_ex_gst: 0,
            line_cost_ex_gst: 0,
            notes: 'Placeholder line only (matches flashing labour length).',
          });
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
        warnings.push('Invalid cedar sarking cover_m in rules; skipping timber roofing takeoff.');
      } else {
        const cedarLm = (timberAreaM2 / coverM) * (1 + (Number.isFinite(wasteFactor) ? wasteFactor : 0));
        const cedarItem = findPricebookItemById(config, cedarItemId);
        if (!cedarItem) {
          warnings.push(`Cedar sarking item '${cedarItemId}' not found in materials pricebook.`);
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
        if (!panelItem) warnings.push("Roof above item 'roof.insulated_panel_50mm_m2' not found in materials pricebook.");
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
        if (!steelItem) warnings.push("Roof above item 'roof.steel_corrugated_m2' not found in materials pricebook.");
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
        if (!steelItem) warnings.push("Roof above item 'roof.steel_tray_m2' not found in materials pricebook.");
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
      if (!covertekItem) warnings.push("Underlay item 'underlay.covertek_407_m2' not found in materials pricebook.");
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
      if (!polyItem) warnings.push("Insulation item 'insulation.polystyrene_m2' not found in materials pricebook.");
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

  let spliceJoinCount = 0;

  for (const group of cutGroups.values()) {
    const rawBars = pickBarsForProfile(config, group.profile, group.colour);
    const applyPowdercoatOverlay =
      group.finish !== 'raw_mill' && inputs.extrusion_colour === 'Mill' && group.colour === 'Mill' && !!powdercoatColourUsed;
    const bars = applyPowdercoatOverlay
      ? rawBars.map((bar) => {
          const baseCost = Number((bar as any).cost_ex_gst ?? 0);
          const powderItem = findPowdercoatBar(config, group.profile, bar.stock_length_m);
          if (!powderItem) {
            warnings.push(
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
      warnings.push(
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
      warnings.push(
        `Required cut length ${roundMoney(maxSingleCut)}m exceeds max stock length ${roundMoney(maxStock)}m for profile '${group.profile}' (colour '${group.colour}').`,
      );
    }

    const selection = selectBestStock(bars, group.cuts, preferredStockLengths);
    if (!selection.bar || selection.barsUsed <= 0) {
      if (singleCuts.length) {
        const lengths = Array.from(new Set(bars.map((b) => b.stock_length_m))).sort((a, b) => b - a);
        warnings.push(
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
    for (const originLen of group.originals_joinable.values()) {
      if (!Number.isFinite(originLen) || originLen <= selection.bar.stock_length_m + 1e-6) continue;
      joinCountForGroup += Math.max(0, Math.ceil(originLen / selection.bar.stock_length_m) - 1);
    }
    spliceJoinCount += joinCountForGroup;

    waste_m_by_profile[group.profile] = roundMoney(selection.wasteM);
    bars_by_profile[group.profile] = {
      stock_length_m: selection.bar.stock_length_m,
      bars_used: selection.barsUsed,
    };

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

    lines.push({
      id: selection.bar.id,
      label,
      profile: group.profile,
      unit: 'bar',
      qty: selection.barsUsed,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(lineCost),
      notes,
    });
  }

  if (spliceJoinCount > 0) {
    const joinQty = Math.max(0, Math.round(spliceJoinCount));
    const bracketItem = findPricebookItemById(config, 'hardware.splice_join_bracket');
    if (!bracketItem) warnings.push("Splice join bracket item 'hardware.splice_join_bracket' not found in materials pricebook.");
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
    if (!screwItem) warnings.push("Splice join screw item 'fixing.splice_join_screw_each' not found in materials pricebook.");
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
    if (!bracketItem) warnings.push("Soffit bracket pricebook item 'bracket_3f6d3c53fa' not found.");
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
    if (!powderItem) warnings.push("Powdercoating pricebook item 'powdercoating_199231d91b' not found.");
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
  };

  for (const rule of config.hardware.rules) {
    const applies = Object.entries(rule.applies_when).every(([k, v]) => (inputs as any)[k] === v);
    if (!applies) continue;

    for (const line of rule.lines) {
      const item = materialItems.get(line.item_id);
      if (!item) {
        warnings.push(`Hardware rule item '${line.item_id}' not found in materials pricebook (rule ${rule.id}).`);
        continue;
      }

      let qty = 0;
      try {
        qty = evalQtyExpression(String(line.qty), qtyVars);
      } catch (err) {
        warnings.push(`Failed to evaluate qty '${line.qty}' for '${line.item_id}' (rule ${rule.id}).`);
        continue;
      }

      qty = Math.max(0, qty);

      const unitCost = Number((item as any).cost_ex_gst ?? 0);
      lines.push({
        id: item.id,
        label: item.name,
        unit: item.unit,
        qty,
        unit_cost_ex_gst: roundMoney(unitCost),
        line_cost_ex_gst: roundMoney(qty * unitCost),
        notes: rule.notes || undefined,
      });
    }
  }

  // Stable ordering for UI + snapshots.
  lines.sort((a, b) => a.id.localeCompare(b.id));

  const materialsExGst = roundMoney(lines.reduce((acc, l) => acc + l.line_cost_ex_gst, 0));

  return {
    materials: {
      lines,
      totals: {
        materials_ex_gst: materialsExGst,
        waste_m_by_profile,
        bars_by_profile,
      },
    },
    notes_and_warnings: warnings,
    derived_patch: {
      splice_join_count: spliceJoinCount,
    },
  };
}

export const __test__ = { selectBestStock };
