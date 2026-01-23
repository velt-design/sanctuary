import type { CostingConfigV1 } from './config';
import type { DerivedV1, InputsNormalizedV1, MaterialsLineV1, MaterialsV1 } from './types';
import { evalArithmeticExpr } from './expr';
import { normaliseColour, normaliseProfile } from './normalise';

type PricebookItem = CostingConfigV1['materials']['items'][number];

type BuildMaterialsResultV1 = {
  materials: MaterialsV1;
  notes_and_warnings: string[];
};

type CutGroup = {
  profile: string;
  colour: InputsNormalizedV1['extrusion_colour'];
  cuts_m: number[];
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

function splitIntoStockCuts(totalLengthM: number, stockLengthM: number): number[] {
  if (!Number.isFinite(totalLengthM) || totalLengthM <= 0) return [];
  if (!Number.isFinite(stockLengthM) || stockLengthM <= 0) return [totalLengthM];

  const cuts: number[] = [];
  let remaining = totalLengthM;
  while (remaining > stockLengthM + 1e-6) {
    cuts.push(stockLengthM);
    remaining -= stockLengthM;
  }
  if (remaining > 1e-6) cuts.push(remaining);
  return cuts;
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

function selectBestStock(
  bars: Array<PricebookItem & { stock_length_m: number }>,
  cutsM: number[],
  preferred: number[],
): {
  bar: (PricebookItem & { stock_length_m: number }) | null;
  barsUsed: number;
  wasteM: number;
} {
  const cutsDesc = [...cutsM].sort((a, b) => b - a);

  let best: { bar: (PricebookItem & { stock_length_m: number }); barsUsed: number; wasteM: number; cost: number; costPerM: number } | null =
    null;

  const candidates = bars
    .filter((b) => preferred.includes(b.stock_length_m))
    .sort((a, b) => preferred.indexOf(a.stock_length_m) - preferred.indexOf(b.stock_length_m));

  for (const bar of candidates) {
    const unitCost = (bar as any).cost_ex_gst as number;
    if (!Number.isFinite(unitCost)) continue;
    const { barsUsed, wasteM } = greedyBinPack(cutsDesc, bar.stock_length_m);
    const cost = barsUsed * unitCost;
    const costPerM = unitCost / bar.stock_length_m;

    if (!best) {
      best = { bar, barsUsed, wasteM, cost, costPerM };
      continue;
    }

    const costDelta = cost - best.cost;
    if (costDelta < -0.01) {
      best = { bar, barsUsed, wasteM, cost, costPerM };
      continue;
    }
    if (Math.abs(costDelta) <= 0.01) {
      if (costPerM < best.costPerM - 1e-6) {
        best = { bar, barsUsed, wasteM, cost, costPerM };
        continue;
      }
      if (Math.abs(costPerM - best.costPerM) <= 1e-6 && wasteM < best.wasteM - 1e-6) {
        best = { bar, barsUsed, wasteM, cost, costPerM };
      }
    }
  }

  if (!best) return { bar: null, barsUsed: 0, wasteM: 0 };
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

export function buildMaterialsV1(
  inputs: InputsNormalizedV1,
  derived: DerivedV1,
  config: CostingConfigV1,
): BuildMaterialsResultV1 {
  const warnings: string[] = [];
  const lines: MaterialsLineV1[] = [];

  const preferredStockLengths = config.bomStrategy.settings.stock_length_preference_m;

  const cutGroups = new Map<string, CutGroup>();

  const addCuts = (profile: string, cutsM: number[], component: string) => {
    const key = `${profile}__${inputs.extrusion_colour}`;
    const existing = cutGroups.get(key);
    if (existing) {
      cutsM.forEach((c) => existing.cuts_m.push(c));
      existing.components.add(component);
      return;
    }
    cutGroups.set(key, {
      profile,
      colour: inputs.extrusion_colour,
      cuts_m: [...cutsM],
      components: new Set([component]),
    });
  };

  // === Extrusions (v1 assumptions) ===
  const waste_m_by_profile: Record<string, number> = {};
  const bars_by_profile: Record<string, { stock_length_m: number; bars_used: number }> = {};

  const isHipCorner = inputs.roof_type === 'hip_corner';
  const hipCornerLengthB = Number(inputs.hip_corner_length_b_m ?? 0);
  const hipCornerProjectionB = Number(inputs.hip_corner_projection_b_m ?? 0);

  const roofPitchDegUsed = Number((derived as any).roof_pitch_deg_used ?? 0);
  const effectiveCos = Math.max(0.02, Math.cos((roofPitchDegUsed * Math.PI) / 180));

  const rafterCountA = Math.max(0, Math.round(Number((derived as any).hip_corner_rafter_count_a ?? derived.rafter_count)));
  const rafterCountB = isHipCorner ? Math.max(0, Math.round(Number((derived as any).hip_corner_rafter_count_b ?? 0))) : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);
  const bayCountB = isHipCorner ? Math.max(0, rafterCountB - 1) : 0;

  const rafterLengthA = inputs.projection_m / effectiveCos;
  const rafterLengthB = isHipCorner ? Math.max(0, hipCornerProjectionB) / effectiveCos : 0;

  const rafterMultiplier = inputs.roof_type === 'low_gable' || inputs.roof_type === 'gable' || inputs.roof_type === 'hip' ? 2 : 1;
  const rafterPieceCount = Math.max(0, Math.round(derived.rafter_count * rafterMultiplier));
  const rafterLength = Number((derived as any).rafter_length_m ?? (derived as any).rafter_length_m_assumed ?? inputs.projection_m);

  if (isHipCorner) {
    addCuts(
      inputs.rafter_profile,
      [
        ...Array.from({ length: rafterCountA }).map(() => rafterLengthA),
        ...Array.from({ length: rafterCountB }).map(() => rafterLengthB),
      ],
      'Rafters',
    );
    addCuts('100x50', [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0), 'Ledger (assumed)');
  } else {
    addCuts(inputs.rafter_profile, Array.from({ length: rafterPieceCount }).map(() => rafterLength), 'Rafters');
    addCuts('100x50', [inputs.length_m], 'Ledger (assumed)');
  }

  addCuts('100x100', Array.from({ length: inputs.post_count }).map(() => inputs.post_cut_height_m), 'Posts');

  if (inputs.structure_type === 'pitched') {
    if (isHipCorner) {
      addCuts('SP Gutter', [inputs.length_m, hipCornerLengthB].filter((n) => Number.isFinite(n) && n > 0), 'Front gutter (assumed)');
    } else {
      addCuts('SP Gutter', [inputs.length_m], 'Front gutter (assumed)');
    }
  }

  if (inputs.structure_type === 'box_perimeter') {
    addCuts('300x50', [inputs.length_m, inputs.length_m, inputs.projection_m, inputs.projection_m], 'Box perimeter beams');
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

  const addCrystaliteLine = (opts: { requiredLen: number; qty: number; note: string; idSuffix?: string }) => {
    const requiredLen = Math.max(0, opts.requiredLen);
    const qty = Math.max(0, Math.round(opts.qty));
    if (!qty || requiredLen <= 0) return;

    const selectedLen = stripLengths.find((l) => l >= requiredLen) ?? Math.max(...stripLengths, 6);
    const stripItem = findCrystalite620Item(config, { length_m: selectedLen, colour: 'Clear' });
    if (!stripItem) {
      warnings.push(`Crystalite 620mm (Clear) ${selectedLen}m not found in materials pricebook.`);
      return;
    }

    const unitCost = (stripItem as any).cost_ex_gst as number;
    const wastePerStrip = Math.max(0, selectedLen - requiredLen);
    const totalWaste = wastePerStrip * qty;
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

  const addAcrylicRoofingPanels = (opts: { requiredLen: number; bayCount: number; note: string; idSuffix?: string }) => {
    const requiredLen = Math.max(0, opts.requiredLen);
    const bayCount = Math.max(0, Math.round(opts.bayCount));
    if (!bayCount || requiredLen <= 0) return;

    if (Number.isFinite(acrylicMaxSlopeM) && requiredLen > acrylicMaxSlopeM + 1e-6) {
      warnings.push(
        `Acrylic slope exceeds ${roundMoney(acrylicMaxSlopeM)}m. Max supported acrylic slope is ${roundMoney(acrylicMaxSlopeM)}m (use design change or timber).`,
      );
    }

    const sheetMode = Number.isFinite(sheetLengthM) && requiredLen <= sheetLengthM + 1e-6;
    if (sheetMode) {
      if (!plexiSheetClear) {
        warnings.push('Plexi sheet 3050mm x2030mm (Clear) not found in materials pricebook; falling back to 620mm strips.');
      } else {
        const acrossDim = requiredLen <= sheetWidthM + 1e-6 ? sheetLengthM : sheetWidthM;
        const stripsPerSheet = Math.max(1, Math.floor(acrossDim / Math.max(0.01, bayWidthM)));
        const sheetsNeeded = Math.max(0, Math.ceil(bayCount / stripsPerSheet));
        if (sheetsNeeded > 0) {
          const unitCost = (plexiSheetClear as any).cost_ex_gst as number;
          const id = opts.idSuffix ? `${plexiSheetClear.id}.${opts.idSuffix}` : plexiSheetClear.id;
          const orientation =
            requiredLen <= sheetWidthM + 1e-6
              ? `${roundMoney(sheetWidthM)}m down-slope (4 strips from ${roundMoney(sheetLengthM)}m)`
              : `${roundMoney(sheetLengthM)}m down-slope (3 strips from ${roundMoney(sheetWidthM)}m)`;
          lines.push({
            id,
            label: plexiSheetClear.name,
            profile: 'Plexi sheet 3050×2030',
            unit: plexiSheetClear.unit,
            qty: sheetsNeeded,
            unit_cost_ex_gst: roundMoney(unitCost),
            line_cost_ex_gst: roundMoney(sheetsNeeded * unitCost),
            notes: `${opts.note} Using sheet mode: ${bayCount} bay(s), ${stripsPerSheet} strips/sheet, ${sheetsNeeded} sheet(s); orientation: ${orientation}.`,
          });
          return;
        }
      }
    }

    addCrystaliteLine({
      requiredLen,
      qty: bayCount,
      note: `${opts.note} Using strip mode (one 620mm strip per bay). Required ${roundMoney(requiredLen)}m sloped.`,
      idSuffix: opts.idSuffix,
    });
  };

  if (inputs.roof_material === 'acrylic') {
    const joinerCountA = isHipCorner ? rafterCountA : Math.max(0, Math.round(derived.rafter_count));
    const joinerLengthA = isHipCorner ? rafterLengthA : Math.max(0, rafterLength);
    const joinerCountB = isHipCorner ? rafterCountB : 0;
    const joinerLengthB = isHipCorner ? rafterLengthB : 0;

    if (joinerCountA > 0 && joinerLengthA > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountA }).map(() => joinerLengthA), 'Joiners');
    }
    if (joinerCountB > 0 && joinerLengthB > 0) {
      addCuts('Joiners', Array.from({ length: joinerCountB }).map(() => joinerLengthB), 'Joiners');
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

    const foamMetres = Math.max(0, inputs.flashing_length_m);
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
        requiredLen: rafterLengthA,
        bayCount: bayCountA,
        note: 'Acrylic roofing (wing A).',
        idSuffix: 'wingA',
      });
      addAcrylicRoofingPanels({
        requiredLen: rafterLengthB,
        bayCount: bayCountB,
        note: 'Acrylic roofing (wing B).',
        idSuffix: 'wingB',
      });
    } else {
      const bayCount = Math.max(0, Math.round((derived as any).bay_count ?? derived.rafter_count - 1));
      addAcrylicRoofingPanels({
        requiredLen: joinerLengthA,
        bayCount,
        note: 'Acrylic roofing.',
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
          const joinerLength = Math.max(0, Number(plane?.rafter_length_m ?? 0));
          if (joinerRuns > 0 && joinerLength > 0) {
            addCuts('Joiners', Array.from({ length: joinerRuns }).map(() => joinerLength), `Joiners (${planeLabel}, mixed acrylic bays)`);
            totalJoinerM += joinerRuns * joinerLength;
          }

          addAcrylicRoofingPanels({
            requiredLen: joinerLength,
            bayCount: acrylicBays,
            note: `Acrylic roofing (${planeLabel}, mixed roof).`,
            idSuffix: planeId || undefined,
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

        const foamMetres = Math.max(0, inputs.flashing_length_m);
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
            addCuts('Joiners', Array.from({ length: joinerCount }).map(() => joinerLength), 'Joiners (mixed roof area override; acrylic bays)');
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

          const foamMetres = Math.max(0, inputs.flashing_length_m);
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
            requiredLen: joinerLength,
            bayCount: acrylicBays,
            note: `Mixed roof area override: acrylic bays ≈ ${acrylicBays}/${bayCount} (${Math.round(fraction * 100)}%).`,
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
        const joinerStock = 6;
        const joinerCuts: number[] = [];
        for (let i = 0; i < joinerLines; i += 1) {
          joinerCuts.push(...splitIntoStockCuts(requiredLen, joinerStock));
        }
        if (joinerCuts.length) addCuts('Joiners', joinerCuts, 'Joiners (skylight edges)');

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

        const foamMetres = Math.max(0, inputs.flashing_length_m);
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

  for (const group of cutGroups.values()) {
    const bars = pickBarsForProfile(config, group.profile, group.colour);
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

    const selection = selectBestStock(bars, group.cuts_m, preferredStockLengths);
    if (!selection.bar || selection.barsUsed <= 0) {
      const lengths = Array.from(new Set(bars.map((b) => b.stock_length_m))).sort((a, b) => b - a);
      warnings.push(
        `Could not allocate bars for requested profile '${group.profile}' (colour '${group.colour}'). Available stock lengths: ${lengths.join(
          ', ',
        )}.`,
      );
      continue;
    }

    const unitCost = (selection.bar as any).cost_ex_gst as number;
    const lineCost = selection.barsUsed * unitCost;

    waste_m_by_profile[group.profile] = roundMoney(selection.wasteM);
    bars_by_profile[group.profile] = {
      stock_length_m: selection.bar.stock_length_m,
      bars_used: selection.barsUsed,
    };

    const components = Array.from(group.components).join(', ');
    const totalCutM = roundMoney(sum(group.cuts_m));
    const wasteM = roundMoney(selection.wasteM);
    const notes = `Cuts ${totalCutM}m from ${selection.barsUsed}×${selection.bar.stock_length_m}m; waste ${wasteM}m (${components})`;

    lines.push({
      id: selection.bar.id,
      label: selection.bar.name,
      profile: group.profile,
      unit: 'bar',
      qty: selection.barsUsed,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(lineCost),
      notes,
    });
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

  // === Hardware placeholders ===
  const hwItems = new Map(config.hardware.items.map((it) => [it.id, it]));
  const qtyVars: Record<string, number> = {
    post_count: inputs.post_count,
    bracket_count: derived.bracket_count,
    stringer_fixing_count: derived.stringer_fixing_count,
    rafter_count: derived.rafter_count,
    acrylic_sheet_count: inputs.acrylic_sheet_count,
    acrylic_bays_total: Number((derived as any).acrylic_bays_total ?? 0) || 0,
    length_m: inputs.length_m,
    projection_m: inputs.projection_m,
  };

  for (const rule of config.hardware.rules) {
    const applies = Object.entries(rule.applies_when).every(([k, v]) => (inputs as any)[k] === v);
    if (!applies) continue;

    for (const line of rule.lines) {
      const item = hwItems.get(line.item_id);
      if (!item) {
        warnings.push(`Hardware placeholder item '${line.item_id}' not found (rule ${rule.id}).`);
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

      const unitCost = item.unit_cost_ex_gst;
      lines.push({
        id: item.id,
        label: item.label,
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
  };
}
