import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { calculateInfillsTakeoffV1 } from './infillTakeoff';
import type { InfillTakeoffInputV1 } from './types';

function makeInfill(overrides: Partial<InfillTakeoffInputV1> = {}): InfillTakeoffInputV1 {
  return {
    id: 'infill-1',
    module_id: 'module-1',
    label: 'Test infill',
    qty: 1,
    location: 'side',
    acrylic_source: 'sheet_panels',
    panel_orientation: 'vertical',
    width_mode: 'target_width',
    target_panel_width_m: 1.2,
    max_panel_width_m: 1.2,
    support: {
      has_top: true,
      has_bottom: true,
      has_left: true,
      has_right: true,
      internal_support_mode: 'none',
    },
    shape: { type: 'rect', width_m: 2.4, height_m: 2.1 },
    ...overrides,
  };
}

describe('calculateInfillsTakeoffV1', () => {
  it('produces the same takeoff from the narrow default catalogue and an explicit full config', () => {
    const inputs = [makeInfill({
      support: {
        has_top: true,
        has_bottom: true,
        has_left: false,
        has_right: true,
        internal_support_mode: 'none',
      },
    })];

    expect(calculateInfillsTakeoffV1(inputs)).toEqual(
      calculateInfillsTakeoffV1(inputs, {}, loadCostingConfigV1()),
    );
  });

  it('physically places a 2.4m x 2.1m vertical sheet infill on two sheets', () => {
    const result = calculateInfillsTakeoffV1([makeInfill()]);

    expect(result.status).toBe('valid');
    expect(result.totals.panel_count).toBe(2);
    expect(result.totals.sheet_count).toBe(2);
    expect(result.totals.joiner_cut_m).toBeCloseTo(11.1, 6);
    expect(result.items[0].linear_cuts.filter((cut) => cut.role === 'joiner_internal')).toHaveLength(1);
    expect(result.purchases.find((purchase) => purchase.material === 'acrylic_sheet')?.allocations).toHaveLength(2);
    expect(result.purchases.find((purchase) => purchase.material === 'acrylic_sheet')?.waste_m2).toBeCloseTo(2 * 3.05 * 2.03 - 2 * 1.2 * 2.1, 6);
  });

  it('counts a horizontal perimeter once and honours kerf for two 3m strips', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({
        acrylic_source: 'strip_620',
        panel_orientation: 'horizontal',
        shape: { type: 'rect', width_m: 3, height_m: 1 },
      }),
    ]);

    expect(result.status).toBe('valid');
    expect(result.totals.panel_count).toBe(2);
    expect(result.totals.joiner_cut_m).toBeCloseTo(11, 6);
    const strips = result.purchases.find((purchase) => purchase.material === 'crystalite_620');
    expect(strips).toMatchObject({ stock_length_m: 4, stock_width_m: 0.62, qty: 2 });
    expect(strips?.allocations.every((allocation) => allocation.piece_ids.length === 1)).toBe(true);
  });

  it('uses the mono-slope edge rather than pergola pitch', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({ shape: { type: 'mono_slope', width_m: 2, height_low_m: 1, height_high_m: 2 } }),
    ]);
    const top = result.items[0].linear_cuts.find((cut) => cut.role === 'joiner_top');

    expect(top?.length_m).toBeCloseTo(Math.hypot(2, 1), 6);
    expect(result.items[0].panels.every((panel) => panel.shape === 'trapezoid')).toBe(true);
  });

  it.each([
    ['right', 0, 1, 'joiner_left', 'support_left'],
    ['left', 1, 0, 'joiner_right', 'support_right'],
  ] as const)('treats a %s-high zero-ended mono-slope as a true three-edge triangle', (_highSide, left, right, omittedJoiner, omittedSupport) => {
    const base = makeInfill();
    const result = calculateInfillsTakeoffV1([makeInfill({
      acrylic_source: 'auto',
      panel_orientation: 'auto',
      support: {
        ...base.support,
        has_top: false,
        has_bottom: false,
        has_left: false,
        has_right: false,
      },
      shape: { type: 'mono_slope', width_m: 1, height_low_m: left, height_high_m: right },
    })]);
    const cuts = result.items[0].linear_cuts;

    expect(result.status).toBe('valid');
    expect(result.items[0].panels).toHaveLength(1);
    expect(result.items[0].panels[0]).toMatchObject({
      shape: 'triangle',
      finished_area_m2: 0.5,
    });
    expect(result.items[0].panels[0].points).toHaveLength(3);
    expect(cuts.filter((cut) => cut.profile === 'Joiners')).toHaveLength(3);
    expect(cuts.filter((cut) => cut.profile === '50x50')).toHaveLength(3);
    expect(cuts.some((cut) => cut.role === omittedJoiner || cut.role === omittedSupport)).toBe(false);
    expect(cuts.every((cut) => cut.length_m > 0)).toBe(true);
    expect(result.totals.joiner_cut_m).toBeCloseTo(2 + Math.SQRT2, 6);
    expect(result.totals.extra_support_count).toBe(3);
    expect(result.purchases.every((purchase) => purchase.allocations.every((allocation) => allocation.piece_ids.length > 0))).toBe(true);
  });

  it('clips horizontal panels within a triangular aperture', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({
      acrylic_source: 'strip_620',
      panel_orientation: 'horizontal',
      shape: { type: 'mono_slope', width_m: 2, height_low_m: 0, height_high_m: 1.5 },
    })]);

    expect(result.status).toBe('valid');
    expect(result.items[0].panels.length).toBeGreaterThan(1);
    expect(result.items[0].panels.every((panel) => panel.points.length >= 3)).toBe(true);
    expect(result.items[0].panels.at(-1)?.finished_width_m).toBeLessThan(result.items[0].panels[0].finished_width_m);
    expect(result.items[0].linear_cuts.some((cut) => cut.role === 'joiner_left')).toBe(false);
  });

  it('blocks a zero-area mono-slope with a specific invalid-shape warning', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({
      shape: { type: 'mono_slope', width_m: 2, height_low_m: 0, height_high_m: 0 },
    })]);

    expect(result.status).toBe('blocked');
    expect(result.items[0].panels).toEqual([]);
    expect(result.items[0].linear_cuts).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_geometry' }),
    ]));
  });

  it('honours a tighter requested maximum panel width without exceeding the material centre limit', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({ max_panel_width_m: 0.8 })]);

    expect(result.items[0].panels).toHaveLength(3);
    expect(result.items[0].panels.every((panel) => panel.finished_width_m <= 0.8 + 1e-6)).toBe(true);
  });

  it('clips horizontal mono-slope panels to the aperture', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({
        acrylic_source: 'strip_620',
        panel_orientation: 'horizontal',
        shape: { type: 'mono_slope', width_m: 3, height_low_m: 1, height_high_m: 2 },
      }),
    ]);
    const widths = result.items[0].panels.map((panel) => panel.finished_width_m);

    expect(widths.length).toBeGreaterThan(2);
    expect(widths[widths.length - 1]).toBeLessThan(widths[0]);
    expect(result.items[0].panels.some((panel) => panel.shape !== 'rectangle')).toBe(true);
  });

  it.each([
    ['top', { has_top: false }, 'support_top'],
    ['bottom', { has_bottom: false }, 'support_bottom'],
    ['left', { has_left: false }, 'support_left'],
    ['right', { has_right: false }, 'support_right'],
  ] as const)('adds a length-bearing 50x50 cut for a missing %s support', (_name, supportOverride, role) => {
    const base = makeInfill();
    const result = calculateInfillsTakeoffV1([
      makeInfill({ support: { ...base.support, ...supportOverride } }),
    ]);
    const cut = result.items[0].linear_cuts.find((candidate) => candidate.role === role);

    expect(cut?.profile).toBe('50x50');
    expect(cut?.length_m).toBeGreaterThan(0);
  });

  it.each(Array.from({ length: 16 }, (_, mask) => mask))('counts each missing perimeter combination exactly once (mask %i)', (mask) => {
    const flags = [
      ['top', 'support_top'],
      ['bottom', 'support_bottom'],
      ['left', 'support_left'],
      ['right', 'support_right'],
    ] as const;
    const base = makeInfill();
    const support = {
      ...base.support,
      has_top: (mask & 1) === 0,
      has_bottom: (mask & 2) === 0,
      has_left: (mask & 4) === 0,
      has_right: (mask & 8) === 0,
    };
    const result = calculateInfillsTakeoffV1([makeInfill({ support })]);
    const perimeterSupportCuts = result.items[0].linear_cuts.filter((cut) => cut.role !== 'support_internal' && cut.role.startsWith('support_'));

    expect(perimeterSupportCuts).toHaveLength(flags.filter((_, index) => (mask & (1 << index)) !== 0).length);
    for (let index = 0; index < flags.length; index += 1) {
      expect(perimeterSupportCuts.some((cut) => cut.role === flags[index][1])).toBe((mask & (1 << index)) !== 0);
    }
  });

  it('uses actual rafter spacing only for a full matching edge', () => {
    const input = makeInfill({ location: 'front', width_mode: 'match_roof_rafters' });
    const full = calculateInfillsTakeoffV1([input], { rafter_spacing_m: 0.6, edge_length_m: 2.4 });
    const partial = calculateInfillsTakeoffV1([input], { rafter_spacing_m: 0.6, edge_length_m: 3 });

    expect(full.status).toBe('valid');
    expect(full.totals.panel_count).toBe(4);
    expect(full.items[0].linear_cuts.some((cut) => cut.role === 'support_internal')).toBe(false);
    expect(partial.status).toBe('blocked');
    expect(partial.warnings.some((warning) => warning.code === 'partial_rafter_match')).toBe(true);
  });

  it('keeps cut geometry unchanged when only bottom offset changes', () => {
    const atGround = calculateInfillsTakeoffV1([makeInfill()]);
    const raised = calculateInfillsTakeoffV1([
      makeInfill({ shape: { type: 'rect', width_m: 2.4, height_m: 2.1, bottom_offset_m: 1 } }),
    ]);

    expect(raised.items[0].panels).toEqual(atGround.items[0].panels);
    expect(raised.items[0].linear_cuts).toEqual(atGround.items[0].linear_cuts);
    expect(raised.purchases).toEqual(atGround.purchases);
  });

  it('pools stock across infills in one scope and preserves piece origins', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({ id: 'a', shape: { type: 'rect', width_m: 1, height_m: 1 } }),
      makeInfill({ id: 'b', shape: { type: 'rect', width_m: 1, height_m: 1 } }),
    ], { scope_id: 'job-1' });
    const pieceIds = new Set(result.items.flatMap((item) => [
      ...item.panels.map((panel) => panel.id),
      ...item.linear_cuts.map((cut) => cut.id),
    ]));

    expect(result.scope_id).toBe('job-1');
    expect(result.purchases.flatMap((purchase) => purchase.allocations.flatMap((allocation) => allocation.piece_ids))
      .every((pieceId) => pieceIds.has(pieceId))).toBe(true);
  });

  it('auto-selects the candidate with fewer extra supports', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({ acrylic_source: 'strip_620', panel_orientation: 'auto', shape: { type: 'rect', width_m: 3, height_m: 0.6 } }),
    ]);

    expect(result.status).toBe('valid');
    expect(result.items[0].resolved_orientation).toBe('horizontal');
    expect(result.totals.extra_support_count).toBe(0);
  });

  it('auto-selects the acrylic source using supports before stock and waste', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({
      acrylic_source: 'auto',
      panel_orientation: 'vertical',
      shape: { type: 'rect', width_m: 1.2, height_m: 3 },
    })]);

    expect(result.status).toBe('valid');
    expect(result.items[0].requested_acrylic_source).toBe('auto');
    expect(result.items[0].resolved_acrylic_source).toBe('sheet_panels');
    expect(result.totals.extra_support_count).toBe(0);
  });

  it.each([
    ['none', undefined, 1],
    ['center', undefined, 0],
    ['custom', [1.2], 0],
  ] as const)('resolves %s internal support mode against the actual divider', (mode, positions, expectedExtraSupports) => {
    const base = makeInfill();
    const result = calculateInfillsTakeoffV1([makeInfill({
      support: {
        ...base.support,
        internal_support_mode: mode,
        ...(positions ? { internal_support_positions_m: [...positions] } : null),
      },
    })]);

    expect(result.items[0].linear_cuts.filter((cut) => cut.role === 'support_internal')).toHaveLength(expectedExtraSupports);
  });

  it('supports quantity greater than one while keeping every cut traceable', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({ qty: 2 })]);
    const allPieces = [
      ...result.items[0].panels,
      ...result.items[0].linear_cuts,
    ];

    expect(result.totals.instance_count).toBe(2);
    expect(result.totals.panel_count).toBe(4);
    expect(new Set(allPieces.map((piece) => piece.id)).size).toBe(allPieces.length);
    expect(allPieces.every((piece) => piece.infill_id === 'infill-1' && piece.module_id === 'module-1')).toBe(true);
  });

  it('rotates a sheet panel when that is the only physical fit', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({ shape: { type: 'rect', width_m: 1.2, height_m: 2.5 } })]);
    const placement = result.purchases.find((purchase) => purchase.material === 'acrylic_sheet')?.allocations[0].placements?.[0];

    expect(result.status).toBe('valid');
    expect(placement?.rotated).toBe(true);
    expect(placement?.width_m).toBe(2.5);
    expect(placement?.height_m).toBe(1.2);
  });

  it('allows one exact 3.05m finished sheet run with zero edge trim', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({ shape: { type: 'rect', width_m: 1, height_m: 3.05 } })]);

    expect(result.status).toBe('valid');
    expect(result.totals.sheet_count).toBe(1);
    expect(result.items[0].panels[0].blank_length_m).toBe(3.05);
  });

  it('blocks an infill when no available acrylic stock can contain its panel run', () => {
    const result = calculateInfillsTakeoffV1([makeInfill({ shape: { type: 'rect', width_m: 1, height_m: 6.1 } })]);

    expect(result.status).toBe('blocked');
    expect(result.totals.panel_count).toBe(0);
    expect(result.warnings.some((warning) => warning.code === 'source_unavailable')).toBe(true);
    expect(result.purchases.some((purchase) => purchase.material === 'acrylic_sheet' || purchase.material === 'crystalite_620')).toBe(false);
  });

  it('keeps every allocated cut within stock capacity and sheet placements non-overlapping', () => {
    const result = calculateInfillsTakeoffV1([
      makeInfill({ id: 'a', qty: 2, shape: { type: 'rect', width_m: 1.2, height_m: 2.5 } }),
      makeInfill({ id: 'b', acrylic_source: 'strip_620', panel_orientation: 'horizontal', shape: { type: 'rect', width_m: 3, height_m: 1 } }),
    ]);

    for (const purchase of result.purchases) {
      for (const allocation of purchase.allocations) {
        if (allocation.used_m !== undefined) expect(allocation.used_m).toBeLessThanOrEqual(purchase.stock_length_m + 1e-6);
        const placements = allocation.placements ?? [];
        for (const placement of placements) {
          expect(placement.x_m + placement.width_m).toBeLessThanOrEqual(purchase.stock_length_m + 1e-6);
          expect(placement.y_m + placement.height_m).toBeLessThanOrEqual((purchase.stock_width_m ?? 0) + 1e-6);
        }
        for (let left = 0; left < placements.length; left += 1) {
          for (let right = left + 1; right < placements.length; right += 1) {
            const a = placements[left];
            const b = placements[right];
            const overlaps = a.x_m < b.x_m + b.width_m && b.x_m < a.x_m + a.width_m && a.y_m < b.y_m + b.height_m && b.y_m < a.y_m + a.height_m;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  });
});
