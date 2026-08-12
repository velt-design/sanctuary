import { buildTrustedMaterialsBreakdownV1 } from './breakdownExplanation';
import type { CostingConfigV1 } from './config';
import { applyGst } from './derive';
import { normaliseColour, normaliseProfile } from './normalise';
import type {
  MaterialsLineV1,
  SiteAdditionalAluminiumInputV1,
  SiteAdditionalAluminiumOutputV1,
  WarningV1,
} from './types';

const roundMoney = (value: number) => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

function findBar(config: CostingConfigV1, profile: string, colour: string, stockLengthM: number) {
  const targetProfile = normaliseProfile(profile);
  const targetColour = normaliseColour(colour);
  return config.materials.items.find((item) => {
    if (item.category !== 'aluminium_extrusion' || item.unit !== 'bar') return false;
    const attributes = item.attributes as Record<string, unknown> | undefined;
    return typeof attributes?.profile === 'string'
      && normaliseProfile(attributes.profile) === targetProfile
      && typeof attributes.colour === 'string'
      && normaliseColour(attributes.colour) === targetColour
      && typeof attributes.length_m === 'number'
      && Math.abs(attributes.length_m - stockLengthM) < 1e-6;
  });
}

function findPowdercoat(config: CostingConfigV1, profile: string, stockLengthM: number) {
  const targetProfile = normaliseProfile(profile);
  return config.materials.items.find((item) => {
    if (item.category !== 'powdercoating' || item.unit !== 'bar') return false;
    const attributes = item.attributes as Record<string, unknown> | undefined;
    return typeof attributes?.profile === 'string'
      && normaliseProfile(attributes.profile) === targetProfile
      && typeof attributes.length_m === 'number'
      && Math.abs(attributes.length_m - stockLengthM) < 1e-6;
  });
}

export function calculateSiteAdditionalAluminiumV1(args: {
  input?: SiteAdditionalAluminiumInputV1;
  config: CostingConfigV1;
  toWarnings: (messages: string[]) => WarningV1[];
}): SiteAdditionalAluminiumOutputV1 | undefined {
  const input = args.input;
  if (!input?.rows.length) return undefined;

  const warnings: string[] = [];
  const lines: MaterialsLineV1[] = [];
  for (const row of input.rows) {
    const bar = findBar(args.config, row.profile, input.extrusion_colour, row.stock_length_m);
    if (!bar) {
      warnings.push(`INVALID: Aluminium pricebook item not found for profile '${row.profile}' (${row.stock_length_m}m, ${input.extrusion_colour}).`);
      continue;
    }
    const baseCost = Number((bar as { cost_ex_gst?: unknown }).cost_ex_gst ?? 0);
    let unitCost = baseCost;
    if (input.extrusion_colour === 'Mill') {
      const powdercoat = findPowdercoat(args.config, row.profile, row.stock_length_m);
      if (!powdercoat) {
        warnings.push(`INVALID: Powdercoat pricebook item not found for profile '${row.profile}' (${row.stock_length_m}m).`);
      } else {
        const multiplier = input.powdercoat_is_custom ? 1.2 : 1;
        unitCost += Number((powdercoat as { cost_ex_gst?: unknown }).cost_ex_gst ?? 0) * multiplier;
      }
    }
    lines.push({
      id: `job.additional-aluminium.${row.id}`,
      label: `[Job] Additional aluminium (${row.profile})`,
      profile: row.profile,
      unit: 'bar',
      qty: row.quantity,
      unit_cost_ex_gst: roundMoney(unitCost),
      line_cost_ex_gst: roundMoney(unitCost * row.quantity),
      notes: `${row.quantity} full ${row.stock_length_m}m bar${row.quantity === 1 ? '' : 's'}; estimate-level material only.`,
    });
  }
  const materialsExGst = roundMoney(lines.reduce((sum, line) => sum + line.line_cost_ex_gst, 0));
  return {
    item_count: input.rows.length,
    materials: {
      lines,
      totals: { materials_ex_gst: materialsExGst, waste_m_by_profile: {}, bars_by_profile: {} },
      trusted_breakdown: buildTrustedMaterialsBreakdownV1(lines),
    },
    totals: {
      cost_ex_gst: materialsExGst,
      cost_inc_gst: roundMoney(applyGst(materialsExGst)),
      warnings: args.toWarnings(warnings),
      notes_and_warnings: warnings,
    },
  };
}

export function mergeSiteAdditionalAluminiumV1(
  output: import('./types').SiteOutputV1,
  additional: SiteAdditionalAluminiumOutputV1 | undefined,
): import('./types').SiteOutputV1 {
  if (!additional) return output;
  const lines = [...output.materials.lines, ...additional.materials.lines];
  const notes = [...output.totals.notes_and_warnings, ...additional.totals.notes_and_warnings];
  const costExGst = roundMoney(output.totals.cost_ex_gst + additional.totals.cost_ex_gst);
  return {
    ...output,
    additional_aluminium: additional,
    materials: {
      ...output.materials,
      lines,
      totals: {
        ...output.materials.totals,
        materials_ex_gst: roundMoney(output.materials.totals.materials_ex_gst + additional.materials.totals.materials_ex_gst),
      },
      trusted_breakdown: buildTrustedMaterialsBreakdownV1(lines),
    },
    totals: {
      ...output.totals,
      cost_ex_gst: costExGst,
      cost_inc_gst: roundMoney(applyGst(costExGst)),
      warnings: [...output.totals.warnings, ...additional.totals.warnings],
      notes_and_warnings: notes,
    },
  };
}
