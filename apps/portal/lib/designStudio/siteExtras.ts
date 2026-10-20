import type { BlindLineItemInput, SiteAdditionalAluminiumInputV1 } from '@sp/costing';
import { isStudioObject, type StudioJsonObject } from './contracts';

function fields(value: unknown, allowed: string[]): StudioJsonObject {
  if (!isStudioObject(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unsupported site accessory fields.');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw Error('Invalid site accessory text.');
  return value;
}
function positive(value: unknown): number {
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw Error('Enter a site accessory quantity.');
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > Number.MAX_SAFE_INTEGER / 100) throw Error('Invalid site accessory quantity.');
  return number;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw Error('Select a site accessory option.');
  return value as T;
}

/** Saved strings become explicit job quantities; domain pricing remains in costing.
 * Empty containers retain inactive finish choices without applying any cost. */
export function resolveStudioSiteExtras(site: StudioJsonObject): { additionalAluminium?: SiteAdditionalAluminiumInputV1; blinds: BlindLineItemInput[] } {
  let additionalAluminium: SiteAdditionalAluminiumInputV1 | undefined;
  const blinds: BlindLineItemInput[] = [];
  if (site.additionalAluminium !== undefined) {
    const value = fields(site.additionalAluminium, ['rows', 'extrusionColour', 'powdercoatStandardColour', 'powdercoatCustomColour', 'powdercoatIsCustom']);
    if (!Array.isArray(value.rows)) throw Error('Invalid aluminium rows.');
    if (value.rows.length) {
      if (value.powdercoatIsCustom !== undefined && typeof value.powdercoatIsCustom !== 'boolean') throw Error('Invalid powdercoat choice.');
      additionalAluminium = { extrusion_colour: choice(value.extrusionColour, ['Black', 'White', 'Mill']),
        powdercoat_standard_colour: value.powdercoatStandardColour === undefined ? undefined : text(value.powdercoatStandardColour),
        powdercoat_custom_colour: value.powdercoatCustomColour === undefined ? undefined : text(value.powdercoatCustomColour),
        powdercoat_is_custom: value.powdercoatIsCustom as boolean | undefined,
        rows: value.rows.map(raw => { const row = fields(raw, ['id', 'profile', 'stockLengthM', 'quantity']);
          const quantity = positive(row.quantity);
          if (!Number.isSafeInteger(quantity)) throw Error('Full aluminium bars require a whole quantity.');
          return { id: text(row.id), profile: text(row.profile), stock_length_m: positive(row.stockLengthM), quantity };
        }) };
    }
  }
  if (site.blinds !== undefined) {
    const value = fields(site.blinds, ['items']);
    if (!Array.isArray(value.items)) throw Error('Invalid blind items.');
    for (const raw of value.items) {
      const row = fields(raw, ['id', 'label', 'system', 'widthMm', 'coverLengthMm', 'fabric', 'motorised', 'rollCover']);
      blinds.push({ id: text(row.id), ...(row.label === undefined ? {} : { label: text(row.label) }),
        system: choice(row.system, ['ZIPTRAK', 'OMNI']), widthMm: positive(row.widthMm), coverLengthMm: positive(row.coverLengthMm),
        fabric: choice(row.fabric, ['MESH', 'PVC', 'FINE_MESH', 'NONE']), motorised: choice(row.motorised, ['NONE', 'YES']) === 'YES',
        rollCover: choice(row.rollCover, ['NONE', 'FLASHING', 'PELMET'] as const) });
    }
  }
  return { additionalAluminium, blinds };
}
