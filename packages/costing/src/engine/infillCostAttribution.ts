import { INFILL_JOINER_FIXING_SPACING_M } from './infillConstants';
import { allocateMoneyCentsByWeightV1 } from './moneyAllocation';
import type {
  InfillCostBreakdownItemV1,
  InfillCostBreakdownV1,
  InfillStockPurchaseV1,
  InfillTakeoffItemV1,
  MaterialsLineV1,
  PergolaOutputV1,
} from './types';

type MutableItemCost = {
  module_id: string;
  infill_id: string;
  label?: string;
  quantity: number;
  materialCents: number;
  installCents: number;
  drivers: {
    instances: number;
    joinerM: number;
    joinerFixings: number;
    sheetAreaM2: number;
    stripPanels: number;
    supports: number;
  };
};

const moneyToCents = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : 0
);

const centsToMoney = (value: number) => Math.round(value) / 100;

const itemKey = (moduleId: string, infillId: string) => `${moduleId}\u0000${infillId}`;

function quantityForItem(item: InfillTakeoffItemV1): number {
  const instances = new Set<number>();
  item.panels.forEach((panel) => instances.add(panel.instance_index));
  item.linear_cuts.forEach((cut) => instances.add(cut.instance_index));
  return Math.max(1, instances.size);
}

function mutableItem(item: InfillTakeoffItemV1): MutableItemCost {
  const joinerCuts = item.linear_cuts.filter((cut) => cut.profile === 'Joiners');
  const supportCuts = item.linear_cuts.filter((cut) => cut.profile === '50x50');
  return {
    module_id: item.module_id,
    infill_id: item.infill_id,
    ...(item.label ? { label: item.label } : null),
    quantity: quantityForItem(item),
    materialCents: 0,
    installCents: 0,
    drivers: {
      instances: quantityForItem(item),
      joinerM: joinerCuts.reduce((sum, cut) => sum + cut.length_m, 0),
      joinerFixings: joinerCuts.reduce(
        (sum, cut) => sum + Math.ceil(cut.length_m / INFILL_JOINER_FIXING_SPACING_M),
        0,
      ),
      sheetAreaM2: item.panels
        .filter((panel) => panel.acrylic_source === 'sheet_panels')
        .reduce((sum, panel) => sum + panel.finished_area_m2, 0),
      stripPanels: item.panels.filter((panel) => panel.acrylic_source === 'strip_620').length,
      supports: supportCuts.length,
    },
  };
}

function findPurchaseLine(lines: MaterialsLineV1[], purchase: InfillStockPurchaseV1): MaterialsLineV1 | undefined {
  const expectedId = `job.${purchase.id}`;
  return lines.find((line) => String(line.id ?? '') === expectedId);
}

function allocateAcrossItems(
  totalCents: number,
  items: MutableItemCost[],
  weight: (item: MutableItemCost) => number,
  apply: (item: MutableItemCost, cents: number) => void,
) {
  if (!items.length || totalCents <= 0) return;
  const shares = allocateMoneyCentsByWeightV1(
    totalCents,
    items.map((item) => ({ id: itemKey(item.module_id, item.infill_id), weight: weight(item) })),
  );
  for (const item of items) apply(item, shares[itemKey(item.module_id, item.infill_id)] ?? 0);
}

function driverForAction(actionId: string): keyof MutableItemCost['drivers'] | null {
  switch (actionId) {
    case 'infill.setup_setout_each':
    case 'infill.finish_clean_each':
    case 'infill.job_setup_once':
    case 'infill.shaped_opening_each':
      return 'instances';
    case 'infill.install_joiner_m':
      return 'joinerM';
    case 'infill.fix_joiner_each':
      return 'joinerFixings';
    case 'infill.install_sheet_panels_m2':
      return 'sheetAreaM2';
    case 'infill.install_strip_panels_each':
      return 'stripPanels';
    case 'infill.install_extra_supports_each':
      return 'supports';
    default:
      return null;
  }
}

function publicItem(item: MutableItemCost, overheadCents: number): InfillCostBreakdownItemV1 {
  const totalCents = item.materialCents + item.installCents + overheadCents;
  return {
    module_id: item.module_id,
    infill_id: item.infill_id,
    ...(item.label ? { label: item.label } : null),
    quantity: item.quantity,
    materials_ex_gst: centsToMoney(item.materialCents),
    install_ex_gst: centsToMoney(item.installCents),
    overhead_ex_gst: centsToMoney(overheadCents),
    total_ex_gst: centsToMoney(totalCents),
  };
}

export function buildPergolaInfillCostBreakdownV1(
  pergola: PergolaOutputV1,
): InfillCostBreakdownV1 | undefined {
  const takeoff = pergola.infill_takeoff;
  if (!takeoff?.items.length) return undefined;

  const warnings: string[] = [];
  const items = takeoff.items.map(mutableItem);
  const itemByKey = new Map(items.map((item) => [itemKey(item.module_id, item.infill_id), item]));
  const pieceOwner = new Map<string, { owner: MutableItemCost; weight: number }>();
  for (const takeoffItem of takeoff.items) {
    const owner = itemByKey.get(itemKey(takeoffItem.module_id, takeoffItem.infill_id));
    if (!owner) continue;
    for (const panel of takeoffItem.panels) {
      pieceOwner.set(panel.id, {
        owner,
        weight: panel.acrylic_source === 'sheet_panels'
          ? panel.blank_width_m * panel.blank_length_m
          : panel.blank_length_m,
      });
    }
    for (const cut of takeoffItem.linear_cuts) {
      pieceOwner.set(cut.id, { owner, weight: cut.length_m });
    }
  }

  for (const purchase of takeoff.purchases) {
    const line = findPurchaseLine(pergola.materials.lines, purchase);
    if (!line) {
      warnings.push(`Missing pooled material line for infill purchase '${purchase.id}'.`);
      continue;
    }
    const lineCents = moneyToCents(line.line_cost_ex_gst);
    const allocations = purchase.allocations;
    if (!allocations.length) {
      if (lineCents > 0) warnings.push(`Infill purchase '${purchase.id}' has cost but no stock allocations.`);
      continue;
    }
    const stockShares = allocateMoneyCentsByWeightV1(
      lineCents,
      allocations.map((allocation, index) => ({
        id: `${allocation.stock_index}:${index}`,
        weight: 1,
      })),
    );
    allocations.forEach((allocation, index) => {
      const allocationId = `${allocation.stock_index}:${index}`;
      const owners = allocation.piece_ids
        .map((pieceId) => ({ pieceId, resolved: pieceOwner.get(pieceId) }))
        .filter((entry): entry is { pieceId: string; resolved: { owner: MutableItemCost; weight: number } } => Boolean(entry.resolved));
      if (owners.length !== allocation.piece_ids.length) {
        warnings.push(`Infill purchase '${purchase.id}' contains an untraceable allocated piece.`);
      }
      if (!owners.length) return;
      const pieceShares = allocateMoneyCentsByWeightV1(
        stockShares[allocationId] ?? 0,
        owners.map(({ pieceId, resolved }) => ({ id: pieceId, weight: resolved.weight })),
      );
      owners.forEach(({ pieceId, resolved }) => {
        resolved.owner.materialCents += pieceShares[pieceId] ?? 0;
      });
    });
  }

  const infillAncillaryLines = pergola.materials.lines.filter((line) =>
    /for canonical infill joiner cuts/i.test(String(line.notes ?? '')),
  );
  for (const line of infillAncillaryLines) {
    allocateAcrossItems(
      moneyToCents(line.line_cost_ex_gst),
      items,
      (item) => item.drivers.joinerM,
      (item, cents) => {
        item.materialCents += cents;
      },
    );
  }

  pergola.modules.forEach((module, moduleIndex) => {
    const moduleId = `${pergola.id}.module-${moduleIndex + 1}`;
    const moduleItems = items.filter((item) => item.module_id === moduleId);
    for (const action of module.install.actions.filter((candidate) =>
      candidate.category === 'Infill' || candidate.id.startsWith('infill.'),
    )) {
      const driver = driverForAction(action.id);
      if (!driver) {
        warnings.push(`Unknown infill labour action '${action.id}' was allocated by infill instance count.`);
      }
      allocateAcrossItems(
        moneyToCents(action.cost_ex_gst),
        moduleItems,
        (item) => item.drivers[driver ?? 'instances'],
        (item, cents) => {
          item.installCents += cents;
        },
      );
    }
  });

  const materialsCents = moneyToCents(pergola.materials.totals.materials_ex_gst);
  const installCents = moneyToCents(pergola.install.totals.install_ex_gst);
  const totalCents = moneyToCents(pergola.totals.cost_ex_gst);
  const infillMaterialsCents = items.reduce((sum, item) => sum + item.materialCents, 0);
  const infillInstallCents = items.reduce((sum, item) => sum + item.installCents, 0);
  const baseMaterialsCents = materialsCents - infillMaterialsCents;
  const baseInstallCents = installCents - infillInstallCents;
  const overheadCents = totalCents - materialsCents - installCents;
  if (baseMaterialsCents < 0 || baseInstallCents < 0 || overheadCents < 0) {
    warnings.push('Infill attribution exceeded the reconciled pergola cost components.');
  }

  const safeBaseMaterialsCents = Math.max(0, baseMaterialsCents);
  const safeBaseInstallCents = Math.max(0, baseInstallCents);
  const safeOverheadCents = Math.max(0, overheadCents);
  const overheadShares = allocateMoneyCentsByWeightV1(
    safeOverheadCents,
    [
      {
        id: 'pergola-remainder',
        weight: safeBaseMaterialsCents + safeBaseInstallCents,
      },
      ...items.map((item) => ({
        id: itemKey(item.module_id, item.infill_id),
        weight: item.materialCents + item.installCents,
      })),
    ],
  );
  const publicItems = items.map((item) =>
    publicItem(item, overheadShares[itemKey(item.module_id, item.infill_id)] ?? 0),
  );
  const remainderOverheadCents = overheadShares['pergola-remainder'] ?? 0;
  const remainderTotalCents = safeBaseMaterialsCents + safeBaseInstallCents + remainderOverheadCents;

  return {
    schema_version: 'infill_cost_breakdown_v1',
    source: '@sp/costing/engine/infill-cost-attribution-v1',
    status: takeoff.status === 'valid' && warnings.length === 0 ? 'ready' : 'blocked',
    scope_id: pergola.id,
    allocation: {
      pooled_materials: 'stock_piece_usage',
      install: 'infill_labour_drivers',
      overhead: 'proportional_direct_cost',
    },
    items: publicItems,
    remainder: {
      materials_ex_gst: centsToMoney(safeBaseMaterialsCents),
      install_ex_gst: centsToMoney(safeBaseInstallCents),
      overhead_ex_gst: centsToMoney(remainderOverheadCents),
      total_ex_gst: centsToMoney(remainderTotalCents),
    },
    totals: {
      materials_ex_gst: centsToMoney(materialsCents),
      install_ex_gst: centsToMoney(installCents),
      overhead_ex_gst: centsToMoney(safeOverheadCents),
      total_ex_gst: centsToMoney(totalCents),
    },
    notes_and_warnings: [
      ...takeoff.warnings.map((warning) => warning.message),
      ...warnings,
    ],
  };
}
