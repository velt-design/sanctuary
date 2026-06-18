import type { CostInputsV1, CostOutputV1 } from '@sp/costing';
import type { InfillLineItem } from '@/lib/types/calculator';

type ModuleCostSnapshot = {
  totals: {
    total_ex: number;
    total_inc: number;
    materials_ex: number;
    install_ex: number;
    overhead_ex: number;
    crew_hours: number;
  };
};

const n = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function snapshotModuleCost(out: CostOutputV1): ModuleCostSnapshot {
  return {
    totals: {
      total_ex: n(out?.totals?.cost_ex_gst),
      total_inc: n(out?.totals?.cost_inc_gst),
      materials_ex: n(out?.materials?.totals?.materials_ex_gst),
      install_ex: n(out?.install?.totals?.install_ex_gst),
      overhead_ex: n(out?.overhead?.total_ex_gst),
      crew_hours: n(out?.install?.totals?.crew_hours),
    },
  };
}

export function diffModuleCost(
  base: CostOutputV1 | null,
  compare: CostOutputV1 | null,
): ModuleCostSnapshot['totals'] | null {
  if (!base || !compare) return null;
  const a = snapshotModuleCost(base).totals;
  const b = snapshotModuleCost(compare).totals;
  return {
    total_ex: a.total_ex - b.total_ex,
    total_inc: a.total_inc - b.total_inc,
    materials_ex: a.materials_ex - b.materials_ex,
    install_ex: a.install_ex - b.install_ex,
    overhead_ex: a.overhead_ex - b.overhead_ex,
    crew_hours: a.crew_hours - b.crew_hours,
  };
}

function cloneInfillPayloadItem(item: NonNullable<CostInputsV1['infills']>[number]) {
  return {
    ...item,
    support: item.support ? { ...item.support } : item.support,
    shape: item.shape ? { ...item.shape } : item.shape,
  };
}

export function applyAcrylicVariantToInfillPayload(
  item: NonNullable<CostInputsV1['infills']>[number],
  source: InfillLineItem['acrylicSource'],
): NonNullable<CostInputsV1['infills']>[number] {
  const maxPanelWidth = source === 'sheet_panels' ? 1.2 : 0.64;
  const targetPanelWidth = source === 'sheet_panels' ? 1.2 : 0.64;
  return {
    ...cloneInfillPayloadItem(item),
    acrylic_source: source,
    max_panel_width_m: maxPanelWidth,
    target_panel_width_m: targetPanelWidth,
  };
}

export async function fetchModuleCost(payload: CostInputsV1, signal?: AbortSignal): Promise<CostOutputV1> {
  const res = await fetch('/api/staff/costing/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Costing failed'));
  return json as CostOutputV1;
}

export function buildModulePayloadWithInfills(payload: CostInputsV1, nextInfills: CostInputsV1['infills']): CostInputsV1 {
  return { ...payload, infills: nextInfills };
}

export function removeInfillFromInfills(infills: CostInputsV1['infills'] | undefined, infillId: string) {
  const list = Array.isArray(infills) ? infills : [];
  const filtered = list.filter((entry) => String(entry.id) !== infillId);
  return filtered.length ? filtered : undefined;
}

export function replaceInfillInPayload(
  infills: CostInputsV1['infills'] | undefined,
  infillId: string,
  updater: (entry: NonNullable<CostInputsV1['infills']>[number]) => NonNullable<CostInputsV1['infills']>[number],
): CostInputsV1['infills'] {
  if (!Array.isArray(infills) || infills.length === 0) return infills;
  return infills.map((entry) => (String(entry.id) === infillId ? updater(entry) : cloneInfillPayloadItem(entry)));
}

