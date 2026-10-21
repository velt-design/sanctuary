import type { StandaloneInfillsInputV1 } from '@sp/costing';
import { isStudioObject, type StudioJsonObject } from './contracts';
import { resolveStudioInfillSelections } from './infillSelections';

export function resolveStudioStandaloneInfillSelections(site: StudioJsonObject) {
  const value = site.standaloneInfills;
  if (value === undefined) return undefined;
  const fields = ['items', 'extrusionColour', 'powdercoatStandardColour', 'powdercoatCustomColour', 'powdercoatIsCustom'];
  if (!isStudioObject(value) || Object.keys(value).some(key => !fields.includes(key))) throw Error('Unsupported standalone infill fields.');
  const parsed = resolveStudioInfillSelections({ items: value.items });
  if (!parsed.infills.length) return undefined;
  if (!['Black', 'White', 'Mill'].includes(String(value.extrusionColour))) throw Error('Select the standalone infill finish.');
  for (const key of ['powdercoatStandardColour', 'powdercoatCustomColour']) if (value[key] !== undefined && typeof value[key] !== 'string') throw Error('Invalid standalone powdercoat colour.');
  if (value.powdercoatIsCustom !== undefined && typeof value.powdercoatIsCustom !== 'boolean') throw Error('Invalid standalone powdercoat choice.');
  if (!['easy', 'normal', 'hard'].includes(String(site.access)) || !['single_storey', 'two_storey'].includes(String(site.height))) throw Error('Select standalone site access and height.');
  const finish: Pick<StandaloneInfillsInputV1, 'extrusion_colour' | 'powdercoat_standard_colour' | 'powdercoat_custom_colour' | 'powdercoat_is_custom'> = { extrusion_colour: value.extrusionColour as 'Black' | 'White' | 'Mill',
    powdercoat_standard_colour: value.powdercoatStandardColour as string | undefined, powdercoat_custom_colour: value.powdercoatCustomColour as string | undefined,
    powdercoat_is_custom: value.powdercoatIsCustom as boolean | undefined };
  return { ...parsed, finish, site: { access: site.access as 'easy' | 'normal' | 'hard', height: site.height as 'single_storey' | 'two_storey' } };
}
