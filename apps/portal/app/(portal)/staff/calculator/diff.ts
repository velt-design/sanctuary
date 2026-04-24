import type { SiteOutputV1 } from '@sp/costing';

type Num = number | undefined | null;

export type ImpactDelta = {
  total_ex?: number;
  total_inc?: number;
  materials_ex?: number;
  install_ex?: number;
  overhead_ex?: number;
  crew_hours?: number;
  install_days?: number;
};

export type Driver = {
  id: string;
  label: string;
  prev: number;
  next: number;
  delta: number;
  meta?: string;
};

export type ImpactDiff = {
  delta: ImpactDelta;
  materialsDrivers: Driver[];
  installDrivers: Driver[];
};

const n = (v: Num) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

function diffNum(prev: Num, next: Num) {
  const p = n(prev);
  const nx = n(next);
  return round2(nx - p);
}

function toLineCostEx(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  return n(record.line_cost_ex_gst as Num);
}

function toMinutes(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  return n(record.minutes as Num);
}

function toLabel(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = (value as Record<string, unknown>).label;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

export function buildImpactDiff(prev: SiteOutputV1, next: SiteOutputV1): ImpactDiff {
  const delta: ImpactDelta = {
    total_ex: diffNum(prev?.totals?.cost_ex_gst, next?.totals?.cost_ex_gst),
    total_inc: diffNum(prev?.totals?.cost_inc_gst, next?.totals?.cost_inc_gst),
    materials_ex: diffNum(prev?.materials?.totals?.materials_ex_gst, next?.materials?.totals?.materials_ex_gst),
    install_ex: diffNum(prev?.install?.totals?.install_ex_gst, next?.install?.totals?.install_ex_gst),
    overhead_ex: diffNum(prev?.overhead?.total_ex_gst, next?.overhead?.total_ex_gst),
    crew_hours: diffNum(prev?.install?.totals?.crew_hours, next?.install?.totals?.crew_hours),
    install_days: diffNum(
      (prev as unknown as { totals?: { site_days?: number }; pergolas?: Array<{ modules?: Array<{ derived?: { site_days?: number } }> }> })
        ?.totals?.site_days ?? (prev?.pergolas?.[0]?.modules?.[0]?.derived?.site_days as number | undefined),
      (next as unknown as { totals?: { site_days?: number }; pergolas?: Array<{ modules?: Array<{ derived?: { site_days?: number } }> }> })
        ?.totals?.site_days ?? (next?.pergolas?.[0]?.modules?.[0]?.derived?.site_days as number | undefined),
    ),
  };

  const prevMat = new Map<string, unknown>((prev.materials?.lines ?? []).map((line) => [String(line.id), line]));
  const nextMat = new Map<string, unknown>((next.materials?.lines ?? []).map((line) => [String(line.id), line]));
  const matKeys = new Set([...prevMat.keys(), ...nextMat.keys()]);

  const materialsDrivers: Driver[] = [];
  for (const id of matKeys) {
    const a = prevMat.get(id);
    const b = nextMat.get(id);
    const prevCost = toLineCostEx(a);
    const nextCost = toLineCostEx(b);
    const deltaCost = round2(nextCost - prevCost);
    if (Math.abs(deltaCost) < 0.01) continue;

    const labelCandidate = toLabel(b) ?? toLabel(a);
    const label = labelCandidate && labelCandidate !== id ? labelCandidate : 'Unlabelled material';

    const unit = b && typeof b === 'object' && typeof (b as Record<string, unknown>).unit === 'string'
      ? ((b as Record<string, unknown>).unit as string)
      : undefined;
    const qty = b && typeof b === 'object' ? n((b as Record<string, unknown>).qty as Num) : 0;

    materialsDrivers.push({
      id,
      label: String(label),
      prev: prevCost,
      next: nextCost,
      delta: deltaCost,
      meta: unit ? `${round2(qty)} ${unit}` : undefined,
    });
  }
  materialsDrivers.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const prevAct = new Map<string, unknown>((prev.install?.actions ?? []).map((action) => [String(action.id), action]));
  const nextAct = new Map<string, unknown>((next.install?.actions ?? []).map((action) => [String(action.id), action]));
  const actKeys = new Set([...prevAct.keys(), ...nextAct.keys()]);

  const installDrivers: Driver[] = [];
  for (const id of actKeys) {
    const a = prevAct.get(id);
    const b = nextAct.get(id);
    const prevMinutes = toMinutes(a);
    const nextMinutes = toMinutes(b);
    const deltaMin = round2(nextMinutes - prevMinutes);
    if (Math.abs(deltaMin) < 0.5) continue;

    const labelCandidate = toLabel(b) ?? toLabel(a);
    const label = labelCandidate && labelCandidate !== id ? labelCandidate : 'Unlabelled labour action';

    const unit = b && typeof b === 'object' && typeof (b as Record<string, unknown>).unit === 'string'
      ? ((b as Record<string, unknown>).unit as string)
      : undefined;
    const qty = b && typeof b === 'object' ? n((b as Record<string, unknown>).qty as Num) : 0;

    installDrivers.push({
      id,
      label: String(label),
      prev: prevMinutes,
      next: nextMinutes,
      delta: deltaMin,
      meta: unit ? `${round2(qty)} ${unit}` : undefined,
    });
  }
  installDrivers.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return {
    delta,
    materialsDrivers: materialsDrivers.slice(0, 6),
    installDrivers: installDrivers.slice(0, 6),
  };
}

