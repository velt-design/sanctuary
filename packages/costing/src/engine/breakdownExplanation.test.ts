import { describe, expect, it } from 'vitest';

import { calculateSiteCostV1 } from './calculate';
import {
  buildTrustedLabourBreakdownV1,
  buildTrustedMaterialsBreakdownV1,
} from './breakdownExplanation';
import type { CostInputsV1 } from './types';

function moduleInput(overrides: Partial<CostInputsV1> = {}): CostInputsV1 {
  return {
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
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
    ...overrides,
  };
}

describe('trusted materials and labour breakdowns', () => {
  it('groups every whole-job material line and publishes stock allocation facts', () => {
    const result = calculateSiteCostV1({
      pergolas: [
        {
          id: 'main',
          label: 'Main pergola',
          modules: [moduleInput()],
        },
      ],
    });
    const breakdown = result.materials.trusted_breakdown;
    expect(breakdown).toMatchObject({
      version: 1,
      status: 'ready',
      source: '@sp/costing/materials-v1',
      scope: 'whole_job',
      row_count: result.materials.lines.length,
    });

    const rows = breakdown!.groups.flatMap((group) => group.rows);
    expect(rows).toHaveLength(result.materials.lines.length);
    expect(rows.map((row) => row.id).sort()).toEqual(
      result.materials.lines.map((line) => line.id).sort(),
    );
    expect(new Set(rows.map((row) => row.instance_id)).size).toBe(rows.length);
    expect(
      rows.reduce((total, row) => total + row.internal_cost_ex_gst, 0),
    ).toBeCloseTo(result.materials.totals.materials_ex_gst, 2);
    expect(
      rows.flatMap((row) => [
        row.explanation?.summary ?? '',
        ...(row.explanation?.assumptions ?? []),
      ]).join(' '),
    ).not.toContain('$');

    const rafterStock = rows.find(
      (row) => row.profile === '100x50' && row.explanation?.facts.some((fact) => fact.label === 'Allocated waste'),
    );
    expect(rafterStock).toMatchObject({
      owner: { scope: 'module', label: 'Main pergola / Module 1' },
      unit: 'bar',
      explanation: {
        source: '@sp/costing/materials-v1',
        rounding: expect.stringContaining('whole bars'),
      },
    });
    expect(rafterStock?.label).not.toContain('[Main pergola M1]');
    expect(rafterStock?.explanation?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Required cuts', unit: 'm' }),
        expect.objectContaining({ label: 'Stock length', unit: 'm' }),
        expect.objectContaining({ label: 'Bars purchased', unit: 'bar' }),
        expect.objectContaining({ label: 'Allocated waste', unit: 'm' }),
      ]),
    );

    const roofSheet = rows.find((row) => row.unit === 'sheet');
    expect(roofSheet?.explanation).toMatchObject({
      summary: expect.stringContaining('sheet mode'),
      rounding: expect.stringContaining('whole units'),
    });
  });

  it('keeps module and pergola ownership distinct across a multi-pergola site', () => {
    const result = calculateSiteCostV1({
      pergolas: [
        { id: 'front', label: 'Front', modules: [moduleInput(), moduleInput({ length_m: 4 })] },
        { id: 'rear', label: 'Rear', modules: [moduleInput({ projection_m: 2.5 })] },
      ],
    });
    const owners = new Set(
      result.materials.trusted_breakdown!.groups
        .flatMap((group) => group.rows)
        .map((row) => row.owner.label),
    );

    expect(owners).toContain('Front / Module 1');
    expect(owners).toContain('Front / Module 2');
    expect(owners).toContain('Rear / Module 1');
  });

  it('groups labour by work stage and explains quantities, time and non-neutral loadings', () => {
    const result = calculateSiteCostV1({
      pergolas: [
        {
          id: 'steep',
          label: 'Steep roof',
          modules: [moduleInput({ roof_pitch_deg: 35, access: 'difficult' })],
        },
      ],
    });
    const breakdown = result.install.trusted_breakdown;
    expect(breakdown).toMatchObject({
      version: 1,
      status: 'ready',
      source: '@sp/costing/install-actions-v1',
      action_count: result.install.actions.length,
      total_crew_minutes: result.install.totals.crew_minutes,
      total_crew_hours: result.install.totals.crew_hours,
    });

    const rows = breakdown!.groups.flatMap((group) => group.rows);
    expect(rows).toHaveLength(result.install.actions.length);
    expect(rows.reduce((total, row) => total + row.minutes, 0)).toBeCloseTo(
      result.install.totals.crew_minutes,
      2,
    );
    const rafterAction = rows.find((row) => row.id.includes('install_rafter'));
    expect(rafterAction).toMatchObject({
      owner: { scope: 'module', label: 'Steep roof / Module 1' },
      unit: 'rafter',
      explanation: {
        source: '@sp/costing/install-actions-v1',
        summary: expect.stringContaining('rafter count'),
      },
    });
    expect(rafterAction!.minutes).toBeGreaterThan(0);
    expect(rafterAction!.crew_hours).toBeCloseTo(rafterAction!.minutes / 60, 2);
    expect(rafterAction!.relevant_multipliers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Steep roof pitch' }),
        expect.objectContaining({ label: 'Rafter length' }),
      ]),
    );
  });

  it('publishes explicit empty contracts rather than inventing rows', () => {
    expect(buildTrustedMaterialsBreakdownV1([])).toMatchObject({
      status: 'empty',
      row_count: 0,
      groups: [],
    });
    expect(
      buildTrustedLabourBreakdownV1([], {
        crew_minutes: 0,
        crew_hours: 0,
        install_ex_gst: 0,
      }),
    ).toMatchObject({
      status: 'empty',
      action_count: 0,
      groups: [],
    });
  });
});
