import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from '@sp/costing';

import { buildAdditionalAluminiumCatalogue } from './additionalAluminiumCatalogue';

describe('buildAdditionalAluminiumCatalogue', () => {
  it('derives selectable aluminium profiles and stock lengths from Mill pricebook bars', () => {
    const catalogue = buildAdditionalAluminiumCatalogue(loadCostingConfigV1());

    expect(catalogue.find((item) => item.profile === '150x50')?.stockLengthsM).toEqual([4, 5, 6]);
    expect(catalogue.find((item) => item.profile === 'Overhang Gutter 100x100')?.stockLengthsM).toEqual([6]);
    expect(catalogue.some((item) => item.profile.startsWith('RHS '))).toBe(false);
  });

  it('has a powdercoat rate for every selectable profile and stock length', () => {
    const config = loadCostingConfigV1();
    const powdercoatKeys = new Set(config.materials.items.flatMap((item) => {
      if (item.category !== 'powdercoating' || item.unit !== 'bar') return [];
      const attributes = item.attributes as Record<string, unknown> | undefined;
      return [`${attributes?.profile}::${attributes?.length_m}`];
    }));

    const missing = buildAdditionalAluminiumCatalogue(config).flatMap((item) =>
      item.stockLengthsM
        .filter((lengthM) => !powdercoatKeys.has(`${item.profile}::${lengthM}`))
        .map((lengthM) => `${item.profile} ${lengthM}m`),
    );
    expect(missing).toEqual([]);
  });
});
