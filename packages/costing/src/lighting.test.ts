import { describe, expect, it } from 'vitest';

import { priceAllRafterLighting, priceRafterLighting } from './lighting';

function input(lightCount: number | null, dimmer = false) {
  return {
    pergolaId: 'pergola-1',
    label: 'Courtyard',
    lightCount,
    dimmer,
    acrylicEligible: true,
  };
}

describe('rafter lighting pricing', () => {
  it('includes startup and the first driver in the first-light price', () => {
    expect(priceRafterLighting(input(1))).toMatchObject({
      driverCount: 1,
      additionalDriverCount: 0,
      startupIncCents: 80_000,
      lightsIncCents: 19_000,
      lightingSellIncCents: 99_000,
    });
  });

  it('adds a driver only after 16 standard lights', () => {
    expect(priceRafterLighting(input(16))).toMatchObject({ driverCount: 1, lightingSellIncCents: 384_000 });
    expect(priceRafterLighting(input(17))).toMatchObject({
      driverCount: 2,
      additionalDriverCount: 1,
      additionalDriversIncCents: 50_000,
      lightingSellIncCents: 453_000,
    });
  });

  it('charges one dimmer per pergola and uses the 12-light driver capacity', () => {
    expect(priceRafterLighting(input(12, true))).toMatchObject({
      driverCount: 1,
      dimmerIncCents: 50_000,
      lightingSellIncCents: 358_000,
    });
    expect(priceRafterLighting(input(13, true))).toMatchObject({
      driverCount: 2,
      additionalDriverCount: 1,
      dimmerIncCents: 50_000,
      lightingSellIncCents: 427_000,
    });
  });

  it('does not charge a zero-light pergola', () => {
    expect(priceRafterLighting(input(0, true))).toMatchObject({
      driverCount: 0,
      lightingSellIncCents: 0,
      errors: [],
    });
  });

  it('rejects invalid quantities and non-acrylic configured pergolas', () => {
    expect(priceRafterLighting(input(1.5)).errors).toHaveLength(1);
    expect(priceRafterLighting({ ...input(4), acrylicEligible: false }).errors).toHaveLength(1);
  });

  it('totals valid pergolas independently', () => {
    const result = priceAllRafterLighting([
      input(16),
      { ...input(13, true), pergolaId: 'pergola-2' },
    ]);
    expect(result.totals.totalIncCents).toBe(811_000);
  });
});
