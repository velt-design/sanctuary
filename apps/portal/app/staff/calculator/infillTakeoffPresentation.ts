import type { InfillTakeoffItemV1, InfillTakeoffV1 } from '@sp/costing';

export type CutListRow = {
  group: 'piece' | 'purchase';
  pieceType: 'panel' | 'linear_cut' | 'stock';
  role: string;
  part: string;
  qty: number;
  lengthM?: number | { min: number; max: number };
  finishedWidthM?: number;
  finishedHeightM?: number;
  pieceId?: string;
  sourceInfillId?: string;
  allocatedStock?: string;
  notes?: string;
};

function canonicalRoleLabel(role: InfillTakeoffItemV1['linear_cuts'][number]['role']): string {
  return role
    .replace('joiner_', 'Joiner · ')
    .replace('support_', '50x50 support · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function canonicalCutListRows(takeoff: InfillTakeoffV1, item: InfillTakeoffItemV1): CutListRow[] {
  const allocatedStockFor = (pieceId: string): string | undefined => {
    for (const purchase of takeoff.purchases) {
      const allocation = purchase.allocations.find((candidate) => candidate.piece_ids.includes(pieceId));
      if (!allocation) continue;
      const dimensions = purchase.stock_width_m
        ? `${purchase.stock_length_m.toFixed(3)}m × ${purchase.stock_width_m.toFixed(3)}m`
        : `${purchase.stock_length_m.toFixed(3)}m`;
      return `${dimensions} stock #${allocation.stock_index + 1}`;
    }
    return undefined;
  };

  const pieceRows: CutListRow[] = [
    ...item.panels.map((panel) => ({
      group: 'piece' as const,
      pieceType: 'panel' as const,
      role: panel.shape,
      part: `Acrylic panel ${panel.panel_index + 1}`,
      qty: 1,
      lengthM: panel.blank_length_m,
      finishedWidthM: panel.finished_width_m,
      finishedHeightM: panel.finished_height_m,
      pieceId: panel.id,
      sourceInfillId: panel.infill_id,
      allocatedStock: allocatedStockFor(panel.id),
      notes: `${panel.shape}; ${panel.acrylic_source === 'sheet_panels' ? 'sheet panel' : '620 strip'}.`,
    })),
    ...item.linear_cuts.map((cut) => ({
      group: 'piece' as const,
      pieceType: 'linear_cut' as const,
      role: cut.role,
      part: canonicalRoleLabel(cut.role),
      qty: 1,
      lengthM: cut.length_m,
      pieceId: cut.id,
      sourceInfillId: cut.infill_id,
      allocatedStock: allocatedStockFor(cut.id),
      notes: cut.profile,
    })),
  ];
  const pieceInfillById = new Map<string, string>(takeoff.items.flatMap((takeoffItem) => [
    ...takeoffItem.panels.map((panel) => [panel.id, panel.infill_id] as const),
    ...takeoffItem.linear_cuts.map((cut) => [cut.id, cut.infill_id] as const),
  ]));
  const purchaseRows: CutListRow[] = takeoff.purchases.map((purchase) => ({
    group: 'purchase',
    pieceType: 'stock',
    role: purchase.material,
    part:
      purchase.material === 'acrylic_sheet'
        ? 'Plexi sheet 3050 × 2030'
        : purchase.material === 'crystalite_620'
          ? `Crystalite 620 · ${purchase.stock_length_m}m`
          : purchase.material === 'joiner'
            ? `Joiner stock · ${purchase.stock_length_m}m`
            : `50x50 stock · ${purchase.stock_length_m}m`,
    qty: purchase.qty,
    lengthM: purchase.stock_length_m,
    finishedWidthM: purchase.stock_width_m,
    pieceId: purchase.id,
    sourceInfillId: Array.from(new Set(purchase.allocations.flatMap((allocation) => allocation.piece_ids.map((pieceId) => pieceInfillById.get(pieceId))).filter((infillId): infillId is string => Boolean(infillId)))).join('; '),
    allocatedStock: purchase.allocations.map((allocation) => `stock #${allocation.stock_index + 1}`).join('; '),
    notes: `${purchase.allocations.reduce((total, allocation) => total + allocation.piece_ids.length, 0)} allocated cut(s); waste ${purchase.waste_m2 !== undefined ? `${purchase.waste_m2.toFixed(3)}m²` : `${Number(purchase.waste_m ?? 0).toFixed(3)}m`}.`,
  }));
  return [...pieceRows, ...purchaseRows];
}
