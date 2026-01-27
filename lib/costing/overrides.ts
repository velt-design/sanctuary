import 'server-only';

import { supabaseServer } from '@/lib/supabaseClient';
import { loadCostingConfigV1, type CostingConfigV1 } from '@/src/costing/engine/config';

export type CostingOverrides = {
  materialCostOverrides: Record<string, number>;
  actionMinutesOverrides: Record<string, number>;
};

type MaterialOverrideRow = {
  material_id: string;
  cost_ex_gst_cents: number;
};

type ActionOverrideRow = {
  action_id: string;
  base_minutes: number;
};

export async function fetchCostingOverrides(): Promise<CostingOverrides> {
  const materialRes = await supabaseServer.from('material_cost_overrides').select('material_id, cost_ex_gst_cents');
  if (materialRes.error) {
    throw new Error(`Failed to load material overrides: ${materialRes.error.message}`);
  }

  const actionRes = await supabaseServer.from('install_action_minutes_overrides').select('action_id, base_minutes');
  if (actionRes.error) {
    throw new Error(`Failed to load action overrides: ${actionRes.error.message}`);
  }

  const materialCostOverrides: Record<string, number> = {};
  for (const row of (materialRes.data ?? []) as MaterialOverrideRow[]) {
    if (!row?.material_id) continue;
    const dollars = Number(row.cost_ex_gst_cents ?? 0) / 100;
    if (!Number.isFinite(dollars)) continue;
    materialCostOverrides[row.material_id] = Math.round(dollars * 100) / 100;
  }

  const actionMinutesOverrides: Record<string, number> = {};
  for (const row of (actionRes.data ?? []) as ActionOverrideRow[]) {
    if (!row?.action_id) continue;
    const minutes = Number(row.base_minutes ?? 0);
    if (!Number.isFinite(minutes)) continue;
    actionMinutesOverrides[row.action_id] = minutes;
  }

  return { materialCostOverrides, actionMinutesOverrides };
}

export async function getCostingConfigWithOverrides(): Promise<{ config: CostingConfigV1; overrides: CostingOverrides }> {
  const base = loadCostingConfigV1();

  let overrides: CostingOverrides;
  try {
    overrides = await fetchCostingOverrides();
  } catch (err) {
    console.warn('[costing overrides] Falling back to JSON config only.', err);
    return { config: base, overrides: { materialCostOverrides: {}, actionMinutesOverrides: {} } };
  }

  const materialOverrideIds = new Set(Object.keys(overrides.materialCostOverrides));
  const actionOverrideIds = new Set(Object.keys(overrides.actionMinutesOverrides));

  const materials = {
    ...base.materials,
    items: base.materials.items.map((item) => {
      if (!materialOverrideIds.has(item.id)) return item;
      const override = overrides.materialCostOverrides[item.id];
      if (!Number.isFinite(override) || override < 0) return item;
      return { ...item, cost_ex_gst: override };
    }),
  };

  const installActions = {
    ...base.installActions,
    actions: base.installActions.actions.map((action) => {
      if (!actionOverrideIds.has(action.id)) return action;
      const override = overrides.actionMinutesOverrides[action.id];
      if (!Number.isFinite(override) || override < 0) return action;
      return { ...action, base_minutes: override };
    }),
  };

  const unknownMaterials = [...materialOverrideIds].filter((id) => !base.materials.items.some((item) => item.id === id));
  if (unknownMaterials.length) {
    console.warn('[costing overrides] Ignored unknown material overrides:', unknownMaterials.join(', '));
  }

  const unknownActions = [...actionOverrideIds].filter((id) => !base.installActions.actions.some((action) => action.id === id));
  if (unknownActions.length) {
    console.warn('[costing overrides] Ignored unknown install action overrides:', unknownActions.join(', '));
  }

  return { config: { ...base, materials, installActions }, overrides };
}
