import { describe, expect, it } from 'vitest';
import { calculateJobCostV1 } from './calculate';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

describe('infill job pooling', () => {
  it('physically pools infill stock across modules and prices the final material lines', () => {
    const moduleInputs = {
      length_m: 4,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
      infills: [{
        id: 'pooled-sheet',
        qty: 1,
        location: 'side' as const,
        acrylic_source: 'sheet_panels' as const,
        panel_orientation: 'vertical' as const,
        width_mode: 'target_width' as const,
        support: {
          has_top: true,
          has_bottom: true,
          has_left: true,
          has_right: true,
          internal_support_mode: 'none' as const,
        },
        shape: { type: 'rect' as const, width_m: 1, height_m: 1 },
      }],
    };

    const job = calculateJobCostV1({ modules: [moduleInputs, moduleInputs] });

    expect(job.modules.map((module) => module.infill_takeoff?.totals.sheet_count)).toEqual([1, 1]);
    expect(job.infill_takeoff?.totals.sheet_count).toBe(1);
    expect(job.infill_takeoff?.items.flatMap((item) => item.panels).map((panel) => panel.module_id)).toEqual([
      'module-1',
      'module-2',
    ]);
    const pooledSheet = job.materials.lines.find((line) => /infill\.acrylic_sheet_clear$/.test(line.id));
    expect(pooledSheet?.qty).toBe(1);
    expect(job.materials.totals.materials_ex_gst).toBe(
      roundMoney(job.materials.lines.reduce((sum, line) => sum + line.line_cost_ex_gst, 0)),
    );
  });
});
