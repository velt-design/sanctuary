import { loadCostingConfigV1, type CostingConfigV1 } from './config';
import type {
  CalculateInfillsTakeoffOptionsV1,
  InfillAcrylicSourceV1,
  InfillInputV1,
  InfillLinearCutRoleV1,
  InfillLinearCutV1,
  InfillPanelPieceV1,
  InfillPanelOrientationV1,
  InfillRequestedPanelOrientationV1,
  InfillRequestedAcrylicSourceV1,
  InfillStockAllocationV1,
  InfillStockPurchaseV1,
  InfillTakeoffInputV1,
  InfillTakeoffItemV1,
  InfillTakeoffPointV1,
  InfillTakeoffV1,
  InfillTakeoffWarningV1,
} from './types';

const EPSILON = 1e-6;
const DEFAULT_KERF_M = 0.003;
const DEFAULT_SHEET_LENGTH_M = 3.05;
const DEFAULT_SHEET_WIDTH_M = 2.03;
const DEFAULT_STRIP_STOCK_LENGTHS_M = [4, 5, 6];
const CRYSTALITE_STRIP_WIDTH_M = 0.62;
const DEFAULT_LINEAR_STOCK_LENGTHS_M = [4, 5, 6];
const SOURCE_RULES: Record<InfillAcrylicSourceV1, { maxCentreM: number; maxRunM: number }> = {
  sheet_panels: { maxCentreM: 1.2, maxRunM: 3.05 },
  strip_620: { maxCentreM: 0.64, maxRunM: 6 },
};

type Candidate = {
  source: InfillAcrylicSourceV1;
  orientation: InfillPanelOrientationV1;
  panels: InfillPanelPieceV1[];
  cuts: InfillLinearCutV1[];
  warnings: InfillTakeoffWarningV1[];
  addedSupportCount: number;
  purchasedStockCount: number;
  stockWaste: number;
};

type Bounds = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };

function round6(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function polygonArea(points: InfillTakeoffPointV1[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x_m * next.y_m - next.x_m * current.y_m;
  }
  return Math.abs(sum) / 2;
}

function boundsOf(points: InfillTakeoffPointV1[]): Bounds {
  const xs = points.map((point) => point.x_m);
  const ys = points.map((point) => point.y_m);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function normalizePolygon(points: InfillTakeoffPointV1[]): InfillTakeoffPointV1[] {
  const out: InfillTakeoffPointV1[] = [];
  for (const point of points) {
    const normalized = { x_m: round6(point.x_m), y_m: round6(point.y_m) };
    const previous = out[out.length - 1];
    if (!previous || Math.abs(previous.x_m - normalized.x_m) > EPSILON || Math.abs(previous.y_m - normalized.y_m) > EPSILON) {
      out.push(normalized);
    }
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first.x_m - last.x_m) <= EPSILON && Math.abs(first.y_m - last.y_m) <= EPSILON) out.pop();
  }
  return out;
}

function clipPolygonAtY(
  points: InfillTakeoffPointV1[],
  boundary: number,
  keepAbove: boolean,
): InfillTakeoffPointV1[] {
  const output: InfillTakeoffPointV1[] = [];
  const isInside = (point: InfillTakeoffPointV1) => (keepAbove ? point.y_m >= boundary - EPSILON : point.y_m <= boundary + EPSILON);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);
    if (currentInside !== previousInside) {
      const dy = current.y_m - previous.y_m;
      const ratio = Math.abs(dy) <= EPSILON ? 0 : (boundary - previous.y_m) / dy;
      output.push({ x_m: previous.x_m + (current.x_m - previous.x_m) * ratio, y_m: boundary });
    }
    if (currentInside) output.push(current);
  }
  return normalizePolygon(output);
}

function clipPolygonToYBand(points: InfillTakeoffPointV1[], low: number, high: number): InfillTakeoffPointV1[] {
  return clipPolygonAtY(clipPolygonAtY(points, low, true), high, false);
}

function shapePolygon(shape: InfillInputV1['shape']): InfillTakeoffPointV1[] | null {
  const width = positive(shape.width_m);
  if (!width) return null;
  if (shape.type === 'rect') {
    const height = positive(shape.height_m);
    if (!height) return null;
    return [
      { x_m: 0, y_m: 0 },
      { x_m: width, y_m: 0 },
      { x_m: width, y_m: height },
      { x_m: 0, y_m: height },
    ];
  }
  const low = positive(shape.height_low_m);
  const high = positive(shape.height_high_m);
  if (!low || !high) return null;
  return [
    { x_m: 0, y_m: 0 },
    { x_m: width, y_m: 0 },
    { x_m: width, y_m: high },
    { x_m: 0, y_m: low },
  ];
}

function heightAtX(shape: InfillInputV1['shape'], x: number): number {
  if (shape.type === 'rect') return shape.height_m;
  const ratio = shape.width_m > 0 ? x / shape.width_m : 0;
  return shape.height_low_m + (shape.height_high_m - shape.height_low_m) * ratio;
}

function horizontalExtentAtY(shape: InfillInputV1['shape'], y: number): number {
  if (shape.type === 'rect') return y <= shape.height_m + EPSILON ? shape.width_m : 0;
  const low = shape.height_low_m;
  const high = shape.height_high_m;
  const minimum = Math.min(low, high);
  const maximum = Math.max(low, high);
  if (y <= minimum + EPSILON) return shape.width_m;
  if (y > maximum + EPSILON || Math.abs(high - low) <= EPSILON) return 0;
  const fraction = (maximum - y) / (maximum - minimum);
  return Math.max(0, shape.width_m * fraction);
}

function equalBoundaries(length: number, maxCentre: number): number[] {
  const count = Math.max(1, Math.ceil(length / Math.max(maxCentre, EPSILON)));
  return Array.from({ length: count + 1 }, (_, index) => round6((length * index) / count));
}

function rafterBoundaries(length: number, spacing: number): number[] {
  const out = [0];
  for (let value = spacing; value < length - EPSILON; value += spacing) out.push(round6(value));
  out.push(round6(length));
  return out;
}

function isNearAny(value: number, positions: number[], tolerance = 0.01): boolean {
  return positions.some((position) => Math.abs(position - value) <= tolerance);
}

function classifyPanel(points: InfillTakeoffPointV1[]): InfillPanelPieceV1['shape'] {
  if (points.length <= 3) return 'triangle';
  const bounds = boundsOf(points);
  const rectangularArea = bounds.width * bounds.height;
  return Math.abs(polygonArea(points) - rectangularArea) <= 1e-5 ? 'rectangle' : 'trapezoid';
}

function panelFromPolygon(args: {
  points: InfillTakeoffPointV1[];
  moduleId: string;
  infillId: string;
  instanceIndex: number;
  panelIndex: number;
  source: InfillAcrylicSourceV1;
  orientation: InfillPanelOrientationV1;
}): InfillPanelPieceV1 {
  const points = normalizePolygon(args.points);
  const bounds = boundsOf(points);
  const run = args.orientation === 'vertical' ? bounds.height : bounds.width;
  const shortSide = args.orientation === 'vertical' ? bounds.width : bounds.height;
  return {
    id: `${args.moduleId}.${args.infillId}.i${args.instanceIndex + 1}.panel${args.panelIndex + 1}`,
    module_id: args.moduleId,
    infill_id: args.infillId,
    instance_index: args.instanceIndex,
    panel_index: args.panelIndex,
    acrylic_source: args.source,
    orientation: args.orientation,
    shape: classifyPanel(points),
    points,
    finished_width_m: round6(bounds.width),
    finished_height_m: round6(bounds.height),
    finished_area_m2: round6(polygonArea(points)),
    blank_width_m: round6(args.source === 'strip_620' ? Math.min(shortSide, CRYSTALITE_STRIP_WIDTH_M) : shortSide),
    blank_length_m: round6(run),
  };
}

function makeLinearCut(args: {
  moduleId: string;
  infillId: string;
  instanceIndex: number;
  role: InfillLinearCutRoleV1;
  length: number;
  boundaryPosition?: number;
  ordinal: number;
  colour?: string;
}): InfillLinearCutV1 {
  const support = args.role.startsWith('support_');
  return {
    id: `${args.moduleId}.${args.infillId}.i${args.instanceIndex + 1}.${args.role}.${args.ordinal + 1}`,
    module_id: args.moduleId,
    infill_id: args.infillId,
    instance_index: args.instanceIndex,
    role: args.role,
    profile: support ? '50x50' : 'Joiners',
    ...(args.colour ? { colour: args.colour } : null),
    length_m: round6(args.length),
    ...(args.boundaryPosition === undefined ? null : { boundary_position_m: round6(args.boundaryPosition) }),
  };
}

function packLinear(
  id: string,
  material: InfillStockPurchaseV1['material'],
  profile: 'Joiners' | '50x50' | undefined,
  cuts: Array<{ id: string; length: number }>,
  stockOptions: number[],
  kerf: number,
  colour?: string,
): { purchase?: InfillStockPurchaseV1; critical?: string } {
  if (!cuts.length) return {};
  type Plan = { stockLength: number; bins: Array<{ used: number; ids: string[]; cutTotal: number }> };
  let best: Plan | null = null;
  for (const stockLength of [...stockOptions].filter((value) => value > 0).sort((a, b) => a - b)) {
    if (cuts.some((cut) => cut.length > stockLength + EPSILON)) continue;
    const bins: Plan['bins'] = [];
    for (const cut of [...cuts].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id))) {
      let target = bins.find((bin) => bin.used + (bin.ids.length ? kerf : 0) + cut.length <= stockLength + EPSILON);
      if (!target) {
        target = { used: 0, ids: [], cutTotal: 0 };
        bins.push(target);
      }
      target.used += (target.ids.length ? kerf : 0) + cut.length;
      target.cutTotal += cut.length;
      target.ids.push(cut.id);
    }
    const waste = bins.reduce((sum, bin) => sum + stockLength - bin.used, 0);
    const bestWaste = best ? best.bins.reduce((sum, bin) => sum + best!.stockLength - bin.used, 0) : Number.POSITIVE_INFINITY;
    if (!best || bins.length < best.bins.length || (bins.length === best.bins.length && waste < bestWaste - EPSILON)) {
      best = { stockLength, bins };
    }
  }
  if (!best) return { critical: `${material} contains a cut longer than every available stock length.` };
  const allocations: InfillStockAllocationV1[] = best.bins.map((bin, index) => ({
    stock_index: index,
    piece_ids: bin.ids,
    used_m: round6(bin.used),
    waste_m: round6(best!.stockLength - bin.cutTotal),
  }));
  const totalCut = cuts.reduce((sum, cut) => sum + cut.length, 0);
  return {
    purchase: {
      id,
      material,
      ...(profile ? { profile } : null),
      ...(colour ? { colour } : null),
      stock_length_m: best.stockLength,
      ...(material === 'crystalite_620' ? { stock_width_m: CRYSTALITE_STRIP_WIDTH_M } : null),
      qty: allocations.length,
      total_stock_m: round6(best.stockLength * allocations.length),
      total_cut_m: round6(totalCut),
      waste_m: round6(allocations.reduce((sum, allocation) => sum + Number(allocation.waste_m ?? 0), 0)),
      allocations,
    },
  };
}

function packSheets(
  panels: InfillPanelPieceV1[],
  stockLength: number,
  stockWidth: number,
  kerf: number,
): { purchase?: InfillStockPurchaseV1; critical?: string } {
  if (!panels.length) return {};
  type Shelf = { y: number; height: number; x: number };
  type Sheet = { shelves: Shelf[]; placements: NonNullable<InfillStockAllocationV1['placements']> };
  const sheets: Sheet[] = [];
  const sorted = [...panels].sort(
    (a, b) => b.finished_width_m * b.finished_height_m - a.finished_width_m * a.finished_height_m || a.id.localeCompare(b.id),
  );

  const orientations = (panel: InfillPanelPieceV1) => [
    { width: panel.finished_width_m, height: panel.finished_height_m, rotated: false },
    { width: panel.finished_height_m, height: panel.finished_width_m, rotated: true },
  ].filter((candidate, index, all) => index === 0 || Math.abs(candidate.width - all[0].width) > EPSILON || Math.abs(candidate.height - all[0].height) > EPSILON);

  for (const panel of sorted) {
    let placed = false;
    for (const sheet of sheets) {
      for (const orientation of orientations(panel)) {
        for (const shelf of sheet.shelves) {
          const x = shelf.x + (shelf.x > 0 ? kerf : 0);
          if (orientation.height <= shelf.height + EPSILON && x + orientation.width <= stockLength + EPSILON) {
            sheet.placements.push({
              piece_id: panel.id,
              x_m: round6(x),
              y_m: round6(shelf.y),
              width_m: round6(orientation.width),
              height_m: round6(orientation.height),
              rotated: orientation.rotated,
            });
            shelf.x = x + orientation.width;
            placed = true;
            break;
          }
        }
        if (placed) break;
        const usedHeight = sheet.shelves.reduce((max, shelf) => Math.max(max, shelf.y + shelf.height), 0);
        const y = usedHeight + (sheet.shelves.length ? kerf : 0);
        if (orientation.width <= stockLength + EPSILON && y + orientation.height <= stockWidth + EPSILON) {
          sheet.shelves.push({ y, height: orientation.height, x: orientation.width });
          sheet.placements.push({
            piece_id: panel.id,
            x_m: 0,
            y_m: round6(y),
            width_m: round6(orientation.width),
            height_m: round6(orientation.height),
            rotated: orientation.rotated,
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (placed) continue;

    const orientation = orientations(panel).find(
      (candidate) => candidate.width <= stockLength + EPSILON && candidate.height <= stockWidth + EPSILON,
    );
    if (!orientation) return { critical: `Panel ${panel.id} does not fit a ${stockLength}m x ${stockWidth}m sheet in either orientation.` };
    sheets.push({
      shelves: [{ y: 0, height: orientation.height, x: orientation.width }],
      placements: [{
        piece_id: panel.id,
        x_m: 0,
        y_m: 0,
        width_m: round6(orientation.width),
        height_m: round6(orientation.height),
        rotated: orientation.rotated,
      }],
    });
  }

  const allocations: InfillStockAllocationV1[] = sheets.map((sheet, index) => ({
    stock_index: index,
    piece_ids: sheet.placements.map((placement) => placement.piece_id),
    placements: sheet.placements,
  }));
  return {
    purchase: {
      id: 'infill.acrylic_sheet_clear',
      material: 'acrylic_sheet',
      stock_length_m: stockLength,
      stock_width_m: stockWidth,
      qty: sheets.length,
      total_stock_m2: round6(stockLength * stockWidth * sheets.length),
      total_cut_m2: round6(panels.reduce((sum, panel) => sum + panel.blank_width_m * panel.blank_length_m, 0)),
      waste_m2: round6(stockLength * stockWidth * sheets.length - panels.reduce((sum, panel) => sum + panel.blank_width_m * panel.blank_length_m, 0)),
      allocations,
    },
  };
}

function stockLengthsForProfile(config: CostingConfigV1 | undefined, profile: string, fallback: number[]): number[] {
  if (!config) return fallback;
  const values = config.materials.items
    .filter((item) => item.category === 'aluminium_extrusion' && item.unit === 'bar')
    .filter((item) => String((item.attributes as Record<string, unknown> | undefined)?.profile ?? '').toLowerCase() === profile.toLowerCase())
    .map((item) => Number((item.attributes as Record<string, unknown> | undefined)?.length_m ?? 0))
    .filter((value) => value > 0);
  return values.length ? Array.from(new Set(values)) : fallback;
}

function buildCandidate(
  item: InfillTakeoffInputV1,
  moduleId: string,
  source: InfillAcrylicSourceV1,
  orientation: InfillPanelOrientationV1,
  options: Required<Pick<CalculateInfillsTakeoffOptionsV1, 'kerf_m' | 'sheet_stock_length_m' | 'sheet_stock_width_m'>> &
    CalculateInfillsTakeoffOptionsV1,
): Candidate | null {
  const aperture = shapePolygon(item.shape);
  if (!aperture) return null;
  const apertureBounds = boundsOf(aperture);
  const rules = SOURCE_RULES[source];
  const warnings: InfillTakeoffWarningV1[] = [];
  let boundaries: number[];
  let rafterMatched = false;

  const wantsRafterMatch = item.width_mode === 'match_roof_rafters' || item.support.internal_support_mode === 'match_roof_rafters';
  if (wantsRafterMatch) {
    if (orientation !== 'vertical' || (item.location !== 'front' && item.location !== 'house')) {
      warnings.push({
        level: 'critical',
        code: 'partial_rafter_match',
        message: `${item.label ?? item.id}: roof-rafter matching is only valid for vertical panels on a full front or house edge. Use explicit support positions instead.`,
        module_id: moduleId,
        infill_id: item.id,
      });
      return { source, orientation, panels: [], cuts: [], warnings, addedSupportCount: 0, purchasedStockCount: Number.POSITIVE_INFINITY, stockWaste: Number.POSITIVE_INFINITY };
    }
    const spacing = positive(options.rafter_spacing_m);
    const edgeLength = positive(options.edge_length_m);
    if (!spacing) {
      warnings.push({
        level: 'critical',
        code: 'rafter_context_required',
        message: `${item.label ?? item.id}: roof-rafter spacing is required to match infill boundaries.`,
        module_id: moduleId,
        infill_id: item.id,
      });
      return { source, orientation, panels: [], cuts: [], warnings, addedSupportCount: 0, purchasedStockCount: Number.POSITIVE_INFINITY, stockWaste: Number.POSITIVE_INFINITY };
    }
    if (edgeLength && Math.abs(edgeLength - apertureBounds.width) > 0.01) {
      warnings.push({
        level: 'critical',
        code: 'partial_rafter_match',
        message: `${item.label ?? item.id}: match-roof-rafter mode requires a full ${round6(edgeLength)}m edge or explicit support positions.`,
        module_id: moduleId,
        infill_id: item.id,
      });
      return { source, orientation, panels: [], cuts: [], warnings, addedSupportCount: 0, purchasedStockCount: Number.POSITIVE_INFINITY, stockWaste: Number.POSITIVE_INFINITY };
    }
    boundaries = rafterBoundaries(apertureBounds.width, spacing);
    rafterMatched = true;
  } else {
    const across = orientation === 'vertical' ? apertureBounds.width : apertureBounds.height;
    const requestedMaximum = positive(item.max_panel_width_m);
    boundaries = equalBoundaries(across, requestedMaximum ? Math.min(rules.maxCentreM, requestedMaximum) : rules.maxCentreM);
  }

  const qty = Math.max(1, Math.round(Number(item.qty ?? 1)));
  const panels: InfillPanelPieceV1[] = [];
  const cuts: InfillLinearCutV1[] = [];
  const basePanelPolygons: InfillTakeoffPointV1[][] = [];
  if (orientation === 'vertical') {
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const x0 = boundaries[index];
      const x1 = boundaries[index + 1];
      basePanelPolygons.push([
        { x_m: x0, y_m: 0 },
        { x_m: x1, y_m: 0 },
        { x_m: x1, y_m: heightAtX(item.shape, x1) },
        { x_m: x0, y_m: heightAtX(item.shape, x0) },
      ]);
    }
  } else {
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const clipped = clipPolygonToYBand(aperture, boundaries[index], boundaries[index + 1]);
      if (polygonArea(clipped) > EPSILON) basePanelPolygons.push(clipped);
    }
  }

  for (let instanceIndex = 0; instanceIndex < qty; instanceIndex += 1) {
    basePanelPolygons.forEach((points, panelIndex) => {
      panels.push(panelFromPolygon({ points, moduleId, infillId: item.id, instanceIndex, panelIndex, source, orientation }));
    });
  }
  if (panels.some((panel) => panel.blank_length_m > rules.maxRunM + EPSILON)) return null;

  const topLength = item.shape.type === 'rect'
    ? item.shape.width_m
    : Math.hypot(item.shape.width_m, item.shape.height_high_m - item.shape.height_low_m);
  const perimeter: Array<{ role: InfillLinearCutRoleV1; length: number }> = [
    { role: 'joiner_bottom', length: apertureBounds.width },
    { role: 'joiner_top', length: topLength },
    { role: 'joiner_left', length: heightAtX(item.shape, 0) },
    { role: 'joiner_right', length: heightAtX(item.shape, apertureBounds.width) },
  ];
  const support = item.support;
  const perimeterSupports: Array<{ needed: boolean; role: InfillLinearCutRoleV1; length: number }> = [
    { needed: !support.has_bottom, role: 'support_bottom', length: apertureBounds.width },
    { needed: !support.has_top, role: 'support_top', length: topLength },
    { needed: !support.has_left, role: 'support_left', length: heightAtX(item.shape, 0) },
    { needed: !support.has_right, role: 'support_right', length: heightAtX(item.shape, apertureBounds.width) },
  ];
  const internalPositions = (support.internal_support_positions_m ?? []).filter((position) => Number.isFinite(position));
  let addedSupportCount = perimeterSupports.filter((entry) => entry.needed).length * qty;

  for (let instanceIndex = 0; instanceIndex < qty; instanceIndex += 1) {
    perimeter.forEach((entry, ordinal) => cuts.push(makeLinearCut({
      moduleId,
      infillId: item.id,
      instanceIndex,
      role: entry.role,
      length: entry.length,
      ordinal,
      colour: options.extrusion_colour,
    })));
    perimeterSupports.filter((entry) => entry.needed).forEach((entry, ordinal) => cuts.push(makeLinearCut({
      moduleId,
      infillId: item.id,
      instanceIndex,
      role: entry.role,
      length: entry.length,
      ordinal,
      colour: options.extrusion_colour,
    })));

    for (let index = 1; index < boundaries.length - 1; index += 1) {
      const position = boundaries[index];
      const length = orientation === 'vertical' ? heightAtX(item.shape, position) : horizontalExtentAtY(item.shape, position);
      cuts.push(makeLinearCut({
        moduleId,
        infillId: item.id,
        instanceIndex,
        role: 'joiner_internal',
        length,
        boundaryPosition: position,
        ordinal: index - 1,
        colour: options.extrusion_colour,
      }));
      const mode = support.internal_support_mode ?? 'none';
      const supported = rafterMatched ||
        (mode === 'center' && Math.abs(position - boundaries[boundaries.length - 1] / 2) <= 0.01) ||
        (mode === 'custom' && isNearAny(position, internalPositions));
      if (!supported) {
        addedSupportCount += 1;
        cuts.push(makeLinearCut({
          moduleId,
          infillId: item.id,
          instanceIndex,
          role: 'support_internal',
          length,
          boundaryPosition: position,
          ordinal: index - 1,
          colour: options.extrusion_colour,
        }));
      }
    }
  }

  const acrylicPlan = source === 'sheet_panels'
    ? packSheets(panels, options.sheet_stock_length_m, options.sheet_stock_width_m, options.kerf_m)
    : packLinear('infill.crystalite_620', 'crystalite_620', undefined, panels.map((panel) => ({ id: panel.id, length: panel.blank_length_m })), options.strip_stock_lengths_m ?? DEFAULT_STRIP_STOCK_LENGTHS_M, options.kerf_m);
  if (!acrylicPlan.purchase) return null;
  const joinerPlan = packLinear(
    'candidate.joiners',
    'joiner',
    'Joiners',
    cuts.filter((cut) => cut.profile === 'Joiners').map((cut) => ({ id: cut.id, length: cut.length_m })),
    options.joiner_stock_lengths_m ?? DEFAULT_LINEAR_STOCK_LENGTHS_M,
    options.kerf_m,
  );
  const supportPlan = packLinear(
    'candidate.supports',
    'support_50x50',
    '50x50',
    cuts.filter((cut) => cut.profile === '50x50').map((cut) => ({ id: cut.id, length: cut.length_m })),
    options.support_stock_lengths_m ?? [6],
    options.kerf_m,
  );
  if (joinerPlan.critical || supportPlan.critical) return null;
  const candidatePurchases = [acrylicPlan.purchase, joinerPlan.purchase, supportPlan.purchase].filter(
    (purchase): purchase is InfillStockPurchaseV1 => Boolean(purchase),
  );
  return {
    source,
    orientation,
    panels,
    cuts,
    warnings,
    addedSupportCount,
    purchasedStockCount: candidatePurchases.reduce((sum, purchase) => sum + purchase.qty, 0),
    stockWaste: candidatePurchases.reduce((sum, purchase) => {
      const total = Number(purchase.total_stock_m2 ?? purchase.total_stock_m ?? 0);
      const waste = Number(purchase.waste_m2 ?? purchase.waste_m ?? 0);
      return sum + (total > 0 ? waste / total : 0);
    }, 0),
  };
}

function chooseCandidate(candidates: Candidate[]): Candidate | null {
  return [...candidates].sort((a, b) =>
    a.warnings.filter((warning) => warning.level === 'critical').length - b.warnings.filter((warning) => warning.level === 'critical').length ||
    a.addedSupportCount - b.addedSupportCount ||
    a.purchasedStockCount - b.purchasedStockCount ||
    a.stockWaste - b.stockWaste ||
    a.orientation.localeCompare(b.orientation),
  )[0] ?? null;
}

function finalizeTakeoff(
  items: InfillTakeoffItemV1[],
  initialWarnings: InfillTakeoffWarningV1[],
  instanceCount: number,
  scopeId: string,
  options: CalculateInfillsTakeoffOptionsV1,
  config?: CostingConfigV1,
): InfillTakeoffV1 {
  const kerf = Number.isFinite(options.kerf_m) && Number(options.kerf_m) >= 0 ? Number(options.kerf_m) : DEFAULT_KERF_M;
  const sheetLength = positive(options.sheet_stock_length_m) ?? DEFAULT_SHEET_LENGTH_M;
  const sheetWidth = positive(options.sheet_stock_width_m) ?? DEFAULT_SHEET_WIDTH_M;
  const warnings = [...initialWarnings];
  const panels = items.flatMap((item) => item.panels);
  const linearCuts = items.flatMap((item) => item.linear_cuts);
  const purchases: InfillStockPurchaseV1[] = [];
  const plans: Array<{ purchase?: InfillStockPurchaseV1; critical?: string }> = [
    packSheets(panels.filter((panel) => panel.acrylic_source === 'sheet_panels'), sheetLength, sheetWidth, kerf),
    packLinear(
      'infill.crystalite_620',
      'crystalite_620',
      undefined,
      panels.filter((panel) => panel.acrylic_source === 'strip_620').map((panel) => ({ id: panel.id, length: panel.blank_length_m })),
      options.strip_stock_lengths_m ?? DEFAULT_STRIP_STOCK_LENGTHS_M,
      kerf,
    ),
  ];
  for (const [profile, material, stockLengths] of [
    ['Joiners', 'joiner', options.joiner_stock_lengths_m ?? stockLengthsForProfile(config, 'Joiners', DEFAULT_LINEAR_STOCK_LENGTHS_M)],
    ['50x50', 'support_50x50', options.support_stock_lengths_m ?? stockLengthsForProfile(config, '50x50', [6])],
  ] as const) {
    const profileCuts = linearCuts.filter((cut) => cut.profile === profile);
    const colours = Array.from(new Set(profileCuts.map((cut) => cut.colour ?? options.extrusion_colour ?? '')));
    for (const colour of colours) {
      const colourCuts = profileCuts.filter((cut) => (cut.colour ?? options.extrusion_colour ?? '') === colour);
      plans.push(packLinear(
        `infill.${profile.toLowerCase()}.${colour || 'default'}`,
        material,
        profile,
        colourCuts.map((cut) => ({ id: cut.id, length: cut.length_m })),
        [...stockLengths],
        kerf,
        colour || undefined,
      ));
    }
  }
  for (const plan of plans) {
    if (plan.purchase) purchases.push(plan.purchase);
    if (plan.critical) warnings.push({ level: 'critical', code: 'stock_unavailable', message: plan.critical });
  }
  const joinerCuts = linearCuts.filter((cut) => cut.profile === 'Joiners');
  const supportCuts = linearCuts.filter((cut) => cut.profile === '50x50');
  return {
    schema_version: 'infill_takeoff_v1',
    status: warnings.some((warning) => warning.level === 'critical') ? 'blocked' : 'valid',
    scope_id: scopeId,
    kerf_m: kerf,
    items,
    purchases,
    warnings,
    totals: {
      instance_count: instanceCount,
      panel_count: panels.length,
      panel_area_m2: round6(panels.reduce((sum, panel) => sum + panel.finished_area_m2, 0)),
      joiner_cut_m: round6(joinerCuts.reduce((sum, cut) => sum + cut.length_m, 0)),
      support_cut_m: round6(supportCuts.reduce((sum, cut) => sum + cut.length_m, 0)),
      extra_support_count: supportCuts.length,
      sheet_count: purchases.find((purchase) => purchase.material === 'acrylic_sheet')?.qty ?? 0,
      strip_stock_count: purchases.find((purchase) => purchase.material === 'crystalite_620')?.qty ?? 0,
    },
  };
}

export function calculateInfillsTakeoffV1(
  inputs: InfillTakeoffInputV1[],
  options: CalculateInfillsTakeoffOptionsV1 = {},
  config?: CostingConfigV1,
): InfillTakeoffV1 {
  const effectiveConfig = config ?? loadCostingConfigV1();
  const resolvedOptions = {
    ...options,
    kerf_m: Number.isFinite(options.kerf_m) && Number(options.kerf_m) >= 0 ? Number(options.kerf_m) : DEFAULT_KERF_M,
    sheet_stock_length_m: positive(options.sheet_stock_length_m) ?? DEFAULT_SHEET_LENGTH_M,
    sheet_stock_width_m: positive(options.sheet_stock_width_m) ?? DEFAULT_SHEET_WIDTH_M,
    joiner_stock_lengths_m: options.joiner_stock_lengths_m ?? stockLengthsForProfile(effectiveConfig, 'Joiners', DEFAULT_LINEAR_STOCK_LENGTHS_M),
    support_stock_lengths_m: options.support_stock_lengths_m ?? stockLengthsForProfile(effectiveConfig, '50x50', [6]),
  };
  const scopeId = options.scope_id?.trim() || 'module';
  const items: InfillTakeoffItemV1[] = [];
  const warnings: InfillTakeoffWarningV1[] = [];

  for (const input of inputs) {
    const moduleId = input.module_id?.trim() || options.module_id?.trim() || 'module-1';
    const requestedOrientation: InfillRequestedPanelOrientationV1 = input.panel_orientation ?? 'vertical';
    const orientations: InfillPanelOrientationV1[] = requestedOrientation === 'auto' ? ['vertical', 'horizontal'] : [requestedOrientation];
    const requestedSource: InfillRequestedAcrylicSourceV1 = input.acrylic_source;
    const preferred: InfillAcrylicSourceV1 = requestedSource === 'auto' ? 'sheet_panels' : requestedSource;
    const fallback: InfillAcrylicSourceV1 = preferred === 'sheet_panels' ? 'strip_620' : 'sheet_panels';
    const preferredSources: InfillAcrylicSourceV1[] = requestedSource === 'auto' ? ['sheet_panels', 'strip_620'] : [preferred];
    const preferredCandidates = preferredSources
      .flatMap((source) => orientations.map((orientation) => buildCandidate(input, moduleId, source, orientation, resolvedOptions)))
      .filter((candidate): candidate is Candidate => Boolean(candidate));
    let selected = chooseCandidate(preferredCandidates);
    let switched = false;
    if (!selected) {
      const fallbackCandidates = orientations
        .map((orientation) => buildCandidate(input, moduleId, fallback, orientation, resolvedOptions))
        .filter((candidate): candidate is Candidate => Boolean(candidate));
      selected = chooseCandidate(fallbackCandidates);
      switched = Boolean(selected) && requestedSource !== 'auto';
    }
    if (!selected) {
      const warning: InfillTakeoffWarningV1 = {
        level: 'critical',
        code: 'source_unavailable',
        message: `${input.label ?? input.id}: required panel run exceeds sheet and strip stock limits; skipping infill materials.`,
        module_id: moduleId,
        infill_id: input.id,
      };
      warnings.push(warning);
      items.push({
        module_id: moduleId,
        infill_id: input.id,
        label: input.label,
        requested_acrylic_source: requestedSource,
        resolved_acrylic_source: preferred,
        requested_orientation: requestedOrientation,
        resolved_orientation: requestedOrientation === 'horizontal' ? 'horizontal' : 'vertical',
        panels: [],
        linear_cuts: [],
        warnings: [warning],
      });
      continue;
    }
    const itemWarnings = [...selected.warnings];
    if (switched) itemWarnings.push({
      level: 'info',
      code: 'source_auto_switched',
      message: `${input.label ?? input.id}: auto-switched acrylic source from ${preferred} to ${selected.source} because the preferred stock cannot contain the required panels.`,
      module_id: moduleId,
      infill_id: input.id,
    });
    warnings.push(...itemWarnings);
    items.push({
      module_id: moduleId,
      infill_id: input.id,
      label: input.label,
      requested_acrylic_source: requestedSource,
      resolved_acrylic_source: selected.source,
      requested_orientation: requestedOrientation,
      resolved_orientation: selected.orientation,
      panels: selected.panels,
      linear_cuts: selected.cuts,
      warnings: itemWarnings,
    });
  }

  return finalizeTakeoff(
    items,
    warnings,
    inputs.reduce((sum, input) => sum + Math.max(1, Math.round(Number(input.qty ?? 1))), 0),
    scopeId,
    resolvedOptions,
    effectiveConfig,
  );
}

export function poolInfillsTakeoffsV1(
  takeoffs: Array<InfillTakeoffV1 | undefined>,
  options: CalculateInfillsTakeoffOptionsV1 = {},
  config?: CostingConfigV1,
): InfillTakeoffV1 {
  const effectiveConfig = config ?? loadCostingConfigV1();
  const valid = takeoffs.filter((takeoff): takeoff is InfillTakeoffV1 => Boolean(takeoff));
  return finalizeTakeoff(
    valid.flatMap((takeoff) => takeoff.items),
    valid.flatMap((takeoff) => takeoff.warnings),
    valid.reduce((sum, takeoff) => sum + takeoff.totals.instance_count, 0),
    options.scope_id?.trim() || 'job',
    { ...options, kerf_m: options.kerf_m ?? valid[0]?.kerf_m ?? DEFAULT_KERF_M },
    effectiveConfig,
  );
}
