import type { CostingConfigV1 } from './config';
import type { InfillStockPurchaseV1, InfillTakeoffV1, MaterialsLineV1 } from './types';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isCanonicalInfillStockLine(line: MaterialsLineV1): boolean {
  const id = String(line.id ?? '');
  const notes = String(line.notes ?? '');
  return (
    /infill\.acrylic_sheet_clear$/.test(id) ||
    /infill\.crystalite_620_\d+(?:\.\d+)?m$/.test(id) ||
    /infill joiners|infill supports 50x50/i.test(notes)
  );
}

export function pooledInfillMaterialLines(
  existingLines: MaterialsLineV1[],
  takeoff: InfillTakeoffV1,
  config: CostingConfigV1,
): MaterialsLineV1[] {
  const sourceLines = existingLines.filter(isCanonicalInfillStockLine);
  const retained = existingLines.filter((line) => !isCanonicalInfillStockLine(line));
  const findSource = (purchase: InfillStockPurchaseV1): MaterialsLineV1 | undefined => {
    if (purchase.material === 'acrylic_sheet') {
      return sourceLines.find((line) => /infill\.acrylic_sheet_clear$/.test(String(line.id ?? '')));
    }
    if (purchase.material === 'crystalite_620') {
      return sourceLines.find((line) => String(line.id ?? '').endsWith(`infill.crystalite_620_${purchase.stock_length_m}m`));
    }
    const profile = purchase.material === 'joiner' ? 'Joiners' : '50x50';
    const candidates = sourceLines.filter((line) => line.profile === profile && String(line.label ?? '').includes(`${purchase.stock_length_m}m`));
    if (purchase.colour) {
      const colourMatch = candidates.find((line) => String(line.label ?? '').toLowerCase().includes(purchase.colour!.toLowerCase()));
      if (colourMatch) return colourMatch;
    }
    return candidates[0];
  };

  const pooled: MaterialsLineV1[] = [];
  for (const purchase of takeoff.purchases) {
    const directSource = findSource(purchase);
    const attrsMatch = (item: CostingConfigV1['materials']['items'][number], profile?: string) => {
      const attrs = item.attributes as Record<string, unknown> | undefined;
      const itemLength = Number(attrs?.length_m ?? 0);
      const itemProfile = String(attrs?.profile ?? '');
      const itemColour = String(attrs?.colour ?? '');
      return Math.abs(itemLength - purchase.stock_length_m) < 1e-6 &&
        (!profile || itemProfile.toLowerCase() === profile.toLowerCase()) &&
        (!purchase.colour || itemColour.toLowerCase() === purchase.colour.toLowerCase());
    };
    const configuredItem = purchase.material === 'acrylic_sheet'
      ? config.materials.items.find((item) => item.category === 'roofing_sheet' && item.unit === 'sheet' && /Plexi sheet 3050mm x2030mm \(Clear\)/i.test(String(item.name ?? '')))
      : purchase.material === 'crystalite_620'
        ? config.materials.items.find((item) => {
            const attrs = item.attributes as Record<string, unknown> | undefined;
            return item.category === 'roofing_sheet' && item.unit === 'bar' && attrs?.product === 'Crystalite 620mm' && attrs?.colour === 'Clear' && Math.abs(Number(attrs?.length_m ?? 0) - purchase.stock_length_m) < 1e-6;
          })
        : config.materials.items.find((item) => item.category === 'aluminium_extrusion' && item.unit === 'bar' && attrsMatch(item, purchase.profile));
    let source = directSource;
    if (!source && configuredItem) {
      source = {
        id: configuredItem.id,
        label: configuredItem.name,
        profile: purchase.profile ?? (purchase.material === 'crystalite_620' ? 'Crystalite 620mm' : 'Plexi sheet 3050x2030'),
        unit: configuredItem.unit,
        qty: 0,
        unit_cost_ex_gst: roundMoney(Number((configuredItem as { cost_ex_gst?: number }).cost_ex_gst ?? 0)),
        line_cost_ex_gst: 0,
      };
    }
    if (!source) {
      const sameProfile = sourceLines.filter((line) => line.profile === purchase.profile);
      const conservativeRate = Math.max(0, ...sameProfile.map((line) => {
        const match = String(line.label ?? '').match(/(\d+(?:\.\d+)?)m\b/i);
        const length = match ? Number(match[1]) : 0;
        return length > 0 ? Number(line.unit_cost_ex_gst ?? 0) / length : 0;
      }));
      source = {
        id: `infill.unpriced.${purchase.material}.${purchase.stock_length_m}m`,
        label: `${purchase.profile ?? purchase.material} ${purchase.stock_length_m}m`,
        profile: purchase.profile,
        unit: 'bar',
        qty: 0,
        unit_cost_ex_gst: roundMoney(conservativeRate * purchase.stock_length_m),
        line_cost_ex_gst: 0,
        notes: 'Pooled stock priced conservatively from the highest available same-profile per-metre rate.',
      };
    }
    const unitCost = Number(source.unit_cost_ex_gst ?? 0);
    pooled.push({
      ...source,
      id: `job.${purchase.id}`,
      label: `[Job] ${String(source.label ?? purchase.material)}`,
      qty: purchase.qty,
      line_cost_ex_gst: roundMoney(purchase.qty * unitCost),
      notes: `Pooled canonical infill stock plan (${takeoff.scope_id}); ${purchase.allocations.length} allocated stock item(s).`,
    });
  }
  return [...retained, ...pooled];
}
