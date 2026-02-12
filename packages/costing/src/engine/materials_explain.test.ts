import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { normalizeAndDeriveV1 } from './derive';
import { buildMaterialsV1, buildMaterialsV1Explain } from './bom';
import type { CostInputsV1 } from './types';

const baseInputs: CostInputsV1 = {
  length_m: 4.2,
  roof_span_m: 3.2,
  post_cut_height_m: 2.5,
  post_count: 4,
  pergola_style: 'pitched',
  box_perimeter_enabled: false,
  roof_material: 'acrylic',
  extrusion_colour: 'Black',
  house_connection_type: 'soffit',
  post_connection_type: 'deck_bracket',
  access: 'normal',
  height: 'single_storey',
};

function buildMaterials(input: CostInputsV1) {
  const cfg = loadCostingConfigV1();
  const derived = normalizeAndDeriveV1(input, cfg);
  return {
    cfg,
    derived,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('materials explain', () => {
  it('explain output does not change materials result', () => {
    const { cfg, derived } = buildMaterials(baseInputs);
    const normal = buildMaterialsV1(derived.inputs_normalized, derived.derived, cfg);
    const withExplain = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, { detail: 'summary' });

    expect(withExplain.result).toEqual(normal);
  });

  it('links every output material line to explain by line_index', () => {
    const { cfg, derived } = buildMaterials(baseInputs);
    const withExplain = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, { detail: 'summary' });

    withExplain.result.materials.lines.forEach((line, idx) => {
      const explainLine = withExplain.explain.lines[String(idx)];
      expect(explainLine).toBeTruthy();
      expect(explainLine?.line_id).toBe(line.id);
      expect(explainLine?.line_index).toBe(idx);
    });
  });

  it('splits same-profile rafters and ledger into separate cut groups with independent selections', () => {
    const { cfg, derived } = buildMaterials({
      ...baseInputs,
      overrides: {
        rafter_profile: '100x50',
        ledger_profile: '100x50',
      },
    });
    const withExplain = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, { detail: 'summary' });
    const groups = Object.entries(withExplain.explain.cut_groups);

    const rafterGroup = groups.find(([key, group]) => key.endsWith('__rafters') && group.components.includes('Rafters'));
    const ledgerGroup = groups.find(([key, group]) => key.endsWith('__ledger') && group.components.includes('Ledger'));

    expect(rafterGroup).toBeTruthy();
    expect(ledgerGroup).toBeTruthy();
    expect(rafterGroup?.[0]).not.toBe(ledgerGroup?.[0]);
    expect(rafterGroup?.[1].selection).toBeTruthy();
    expect(ledgerGroup?.[1].selection).toBeTruthy();
  });

  it('enforces summary caps for cut sampling', () => {
    const { cfg, derived } = buildMaterials(baseInputs);
    const withExplain = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, {
      detail: 'summary',
      caps: {
        sample_cut_items_per_group: 3,
        max_cut_items_per_group: 8,
      },
    });

    const groups = Object.values(withExplain.explain.cut_groups);
    expect(groups.length).toBeGreaterThan(0);

    groups.forEach((group) => {
      expect((group.cuts_summary.sample ?? []).length).toBeLessThanOrEqual(3);
      expect(group.cuts_full).toBeUndefined();
    });
  });

  it('focus mode emits pack plan for focused extrusion group', () => {
    const { cfg, derived } = buildMaterials(baseInputs);
    const initial = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, { detail: 'summary' });
    const focusedIndex = Object.values(initial.explain.lines).find((line) => line.kind === 'extrusion_bar')?.line_index;
    expect(typeof focusedIndex).toBe('number');

    const focused = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, {
      detail: 'summary',
      focus_line_index: focusedIndex,
    });

    const focusedLine = focused.explain.lines[String(focusedIndex)];
    expect(focusedLine?.kind).toBe('extrusion_bar');
    if (!focusedLine || focusedLine.kind !== 'extrusion_bar') return;

    const focusedGroup = focused.explain.cut_groups[focusedLine.cut_group_key];
    expect(focusedGroup.pack_plan).toBeTruthy();

    const nonFocusedGroups = Object.entries(focused.explain.cut_groups).filter(([key]) => key !== focusedLine.cut_group_key);
    if (nonFocusedGroups.length > 0) {
      expect(nonFocusedGroups.some(([, group]) => !group.pack_plan)).toBe(true);
    }
  });

  it('captures hardware expression vars_used based on actually accessed variables', () => {
    const { cfg, derived } = buildMaterials(baseInputs);
    const withExplain = buildMaterialsV1Explain(derived.inputs_normalized, derived.derived, cfg, { detail: 'summary' });

    const hardwareLines = Object.values(withExplain.explain.lines).filter((line) => line.kind === 'rule_hardware');
    expect(hardwareLines.length).toBeGreaterThan(0);

    hardwareLines.forEach((line) => {
      Object.entries(line.vars_used).forEach(([key, value]) => {
        expect(new RegExp(`\\b${escapeRegExp(key)}\\b`).test(line.expr)).toBe(true);
        expect(Number.isFinite(value)).toBe(true);
      });
    });

    expect(hardwareLines.some((line) => Object.keys(line.vars_used).length > 0)).toBe(true);
  });
});
