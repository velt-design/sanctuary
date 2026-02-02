import type { InstallActionV1, MaterialsLineV1 } from '@sp/costing';
import type { AcrylicLine, HardwareLine, InstallPhase, PowdercoatLine } from '@/lib/outputs/types';

export type BomCsvRow = {
  item: string;
  profile: string;
  unit: string;
  quantity: number;
  cost_ex_gst: number;
  notes: string;
};

export function mapBOMLinesToCsvRows(lines: MaterialsLineV1[]): BomCsvRow[] {
  return lines.map((l) => ({
    item: l.label,
    profile: l.profile ? String(l.profile) : '',
    unit: l.unit,
    quantity: l.qty,
    cost_ex_gst: l.line_cost_ex_gst,
    notes: l.notes ?? '',
  }));
}

export type InstallCsvRow = {
  action: string;
  scope: string;
  quantity: number;
  minutes: number;
  cost_ex_gst: number;
};

export function mapInstallActionsToCsvRows(actions: InstallActionV1[]): InstallCsvRow[] {
  return actions.map((a) => ({
    action: a.label,
    scope: a.scope ?? '',
    quantity: a.qty,
    minutes: a.minutes,
    cost_ex_gst: a.cost_ex_gst,
  }));
}

export type PowdercoatCsvRow = {
  profile: string;
  colour: string;
  stock_length_m: number;
  unit: string;
  qty: number;
  notes: string;
};

export function mapPowdercoatToCsvRows(rows: PowdercoatLine[]): PowdercoatCsvRow[] {
  return rows.map((r) => ({
    profile: r.profile,
    colour: r.colour,
    stock_length_m: r.stock_length_m,
    unit: r.unit,
    qty: r.qty,
    notes: r.notes ?? '',
  }));
}

export type AcrylicCsvRow = {
  item: string;
  colour: string;
  stock_length_m: string;
  unit: string;
  qty: number;
  notes: string;
};

export function mapAcrylicToCsvRows(rows: AcrylicLine[]): AcrylicCsvRow[] {
  return rows.map((r) => ({
    item: r.item,
    colour: r.colour ?? '',
    stock_length_m: typeof r.stock_length_m === 'number' ? String(r.stock_length_m) : '',
    unit: r.unit,
    qty: r.qty,
    notes: r.notes ?? '',
  }));
}

export type HardwareCsvRow = {
  item: string;
  unit: string;
  qty: number;
  notes: string;
};

export function mapHardwareToCsvRows(rows: HardwareLine[]): HardwareCsvRow[] {
  return rows.map((r) => ({
    item: r.item,
    unit: r.unit,
    qty: r.qty,
    notes: r.notes ?? '',
  }));
}

export type InstallPhaseCsvRow = {
  phaseId: string;
  label: string;
  minutes: number;
  cost_ex_gst: number;
  actions_count: number;
};

export function mapInstallPhasesToCsvRows(phases: InstallPhase[]): InstallPhaseCsvRow[] {
  return phases.map((p) => ({
    phaseId: p.phaseId,
    label: p.label,
    minutes: p.minutes,
    cost_ex_gst: p.costExGst,
    actions_count: p.actions.length,
  }));
}
