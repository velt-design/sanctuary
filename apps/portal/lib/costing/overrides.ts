import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { loadCostingConfigV1, type CostingConfigV1 } from '@sp/costing';

export type DriverCurvePoint = {
  length_m: number;
  minutes_per_m: number;
};

export type CostingOverrides = {
  materialCostOverrides: Record<string, number>;
  actionMinutesOverrides: Record<string, number>;
  driverCurveOverrides: Record<string, DriverCurvePoint[]>;
};

type MaterialOverrideRow = {
  material_id: string;
  cost_ex_gst_cents: number;
};

type ActionOverrideRow = {
  action_id: string;
  base_minutes: number;
};

type DriverCurveOverrideRow = {
  curve_key: string;
  points_json: unknown;
};

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as any).message === 'string') return String((err as any).message);
  return 'Unknown error';
}

function isMissingRelationError(err: unknown, relationName: string): boolean {
  const message = formatErrorMessage(err).toLowerCase();
  return (
    message.includes('does not exist') &&
    (message.includes(relationName.toLowerCase()) || message.includes(`public.${relationName.toLowerCase()}`))
  );
}

function parseDriverCurvePoints(value: unknown): DriverCurvePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const lengthM = Number((entry as any)?.length_m);
      const minutesPerM = Number((entry as any)?.minutes_per_m);
      if (!Number.isFinite(lengthM) || !Number.isFinite(minutesPerM)) return null;
      return {
        length_m: Math.max(0, Math.round(lengthM * 1000) / 1000),
        minutes_per_m: Math.max(0, Math.round(minutesPerM * 1000) / 1000),
      };
    })
    .filter((entry): entry is DriverCurvePoint => entry !== null)
    .sort((a, b) => a.length_m - b.length_m);
}

export async function fetchCostingOverrides(supabase?: SupabaseClient): Promise<CostingOverrides> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const materialRes = await client.from('material_cost_overrides').select('material_id, cost_ex_gst_cents');
  if (materialRes.error) {
    throw new Error(`Failed to load material overrides: ${materialRes.error.message}`);
  }

  const actionRes = await client.from('install_action_minutes_overrides').select('action_id, base_minutes');
  if (actionRes.error) {
    throw new Error(`Failed to load action overrides: ${actionRes.error.message}`);
  }

  const curveRes = await client.from('install_driver_curve_overrides').select('curve_key, points_json');
  if (curveRes.error) {
    if (isMissingRelationError(curveRes.error, 'install_driver_curve_overrides')) {
      console.warn(
        '[costing overrides] Driver curve override table missing; using JSON defaults until the migration is applied.',
      );
    } else {
      throw new Error(`Failed to load driver curve overrides: ${curveRes.error.message}`);
    }
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

  const driverCurveOverrides: Record<string, DriverCurvePoint[]> = {};
  for (const row of ((curveRes.data ?? []) as DriverCurveOverrideRow[])) {
    if (!row?.curve_key) continue;
    const points = parseDriverCurvePoints(row.points_json);
    if (points.length === 0) continue;
    driverCurveOverrides[row.curve_key] = points;
  }

  return { materialCostOverrides, actionMinutesOverrides, driverCurveOverrides };
}

export async function getCostingConfigWithOverrides(
  supabase?: SupabaseClient,
): Promise<{ config: CostingConfigV1; overrides: CostingOverrides }> {
  const base = loadCostingConfigV1();

  let overrides: CostingOverrides;
  try {
    overrides = await fetchCostingOverrides(supabase);
  } catch (err) {
    console.warn(`[costing overrides] Falling back to JSON config only. ${formatErrorMessage(err)}`);
    return { config: base, overrides: { materialCostOverrides: {}, actionMinutesOverrides: {}, driverCurveOverrides: {} } };
  }

  const materialOverrideIds = new Set(Object.keys(overrides.materialCostOverrides));
  const actionOverrideIds = new Set(Object.keys(overrides.actionMinutesOverrides));
  const driverCurveOverrideKeys = new Set(Object.keys(overrides.driverCurveOverrides));

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
    }) as CostingConfigV1['installActions']['actions'],
  };

  const driverRulesReference = {
    ...base.installActions.driver_rules_reference,
  } as Record<string, unknown>;

  for (const curveKey of driverCurveOverrideKeys) {
    const existing = driverRulesReference[curveKey];
    const override = overrides.driverCurveOverrides[curveKey];
    if (!existing || typeof existing !== 'object' || !Array.isArray((existing as any).points) || !override?.length) continue;
    driverRulesReference[curveKey] = {
      ...(existing as Record<string, unknown>),
      points: override.map((point) => ({ ...point })),
    };
  }

  const installActionsWithCurveOverrides = {
    ...installActions,
    driver_rules_reference: driverRulesReference as CostingConfigV1['installActions']['driver_rules_reference'],
  };

  const unknownMaterials = [...materialOverrideIds].filter((id) => !base.materials.items.some((item) => item.id === id));
  if (unknownMaterials.length) {
    console.warn('[costing overrides] Ignored unknown material overrides:', unknownMaterials.join(', '));
  }

  const unknownActions = [...actionOverrideIds].filter((id) => !base.installActions.actions.some((action) => action.id === id));
  if (unknownActions.length) {
    console.warn('[costing overrides] Ignored unknown install action overrides:', unknownActions.join(', '));
  }

  const unknownCurves = [...driverCurveOverrideKeys].filter((key) => {
    const existing = (base.installActions.driver_rules_reference as Record<string, unknown>)[key];
    return !existing || typeof existing !== 'object' || !Array.isArray((existing as any).points);
  });
  if (unknownCurves.length) {
    console.warn('[costing overrides] Ignored unknown driver curve overrides:', unknownCurves.join(', '));
  }

  return { config: { ...base, materials, installActions: installActionsWithCurveOverrides }, overrides };
}
