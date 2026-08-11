import type { CostingConfigV1 } from '@sp/costing';

export type AdditionalAluminiumCatalogueItem = {
  profile: string;
  stockLengthsM: number[];
};

export function buildAdditionalAluminiumCatalogue(
  config: CostingConfigV1,
): AdditionalAluminiumCatalogueItem[] {
  const lengthsByProfile = new Map<string, Set<number>>();

  for (const item of config.materials.items) {
    if (item.category !== 'aluminium_extrusion' || item.unit !== 'bar') continue;
    const attributes = item.attributes as Record<string, unknown> | undefined;
    const profile = typeof attributes?.profile === 'string' ? attributes.profile.trim() : '';
    const lengthM = Number(attributes?.length_m);
    const colour = attributes?.colour;
    if (!profile || profile.toUpperCase().startsWith('RHS ') || colour !== 'Mill') continue;
    if (!Number.isFinite(lengthM) || lengthM <= 0) continue;

    const lengths = lengthsByProfile.get(profile) ?? new Set<number>();
    lengths.add(lengthM);
    lengthsByProfile.set(profile, lengths);
  }

  return [...lengthsByProfile.entries()]
    .map(([profile, lengths]) => ({ profile, stockLengthsM: [...lengths].sort((a, b) => a - b) }))
    .sort((a, b) => a.profile.localeCompare(b.profile, undefined, { numeric: true }));
}
