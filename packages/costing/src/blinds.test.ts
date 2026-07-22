import { describe, expect, it } from 'vitest';
import {
  autoSplitByMaxWidth,
  getBand,
  priceAllBlinds,
  priceBlindLineItem,
  roundUpToIncrementMm,
} from './blinds';

describe('blinds pricing (line items)', () => {
  it('banding: width/length use next higher band', () => {
    const priced = priceBlindLineItem({
      id: 'b1',
      system: 'ZIPTRAK',
      widthMm: 1499,
      coverLengthMm: 1499,
      fabric: 'MESH',
      motorised: false,
    });

    expect(priced.errors.length).toBe(0);
    expect(priced.widthBandMm).toBe(1500);
    expect(priced.lengthBandMm).toBe(1500);
  });

  it('min band: width/length below min use min band', () => {
    const priced = priceBlindLineItem({
      id: 'b2',
      system: 'OMNI',
      widthMm: 500,
      coverLengthMm: 500,
      fabric: 'MESH',
      motorised: false,
    });

    expect(priced.errors.length).toBe(0);
    expect(priced.widthBandMm).toBe(1000);
    expect(priced.lengthBandMm).toBe(1000);
  });

  it('max blind drop enforcement', () => {
    const priced = priceBlindLineItem({
      id: 'b3',
      system: 'OMNI',
      widthMm: 3000,
      coverLengthMm: 3001,
      fabric: 'MESH',
      motorised: false,
    });

    expect(priced.errors.some((e) => e.toLowerCase().includes('manual quote'))).toBe(true);
  });

  it('max width enforcement', () => {
    const priced = priceBlindLineItem({
      id: 'b4',
      system: 'OMNI',
      widthMm: 4600,
      coverLengthMm: 2000,
      fabric: 'MESH',
      motorised: false,
    });

    expect(priced.errors.some((e) => e.toLowerCase().includes('split'))).toBe(true);
  });

  it('motor add-on applied per blind', () => {
    const result = priceAllBlinds([
      {
        id: 'b5',
        system: 'OMNI',
        widthMm: 3000,
        coverLengthMm: 2000,
        fabric: 'MESH',
        motorised: true,
      },
      {
        id: 'b6',
        system: 'OMNI',
        widthMm: 3000,
        coverLengthMm: 2000,
        fabric: 'MESH',
        motorised: true,
      },
    ]);

    const motorLines = result.items.filter((item) => item.motorExCents > 0);
    expect(motorLines.length).toBe(2);
    expect(motorLines[0].motorExCents).toBe(motorLines[1].motorExCents);
    expect(motorLines[0].motorIncCents).toBe(90000);
  });

  it('applies the 15% core uplift before GST', () => {
    const priced = priceBlindLineItem({
      id: 'core-uplift',
      system: 'OMNI',
      widthMm: 2000,
      coverLengthMm: 2000,
      fabric: 'MESH',
      motorised: false,
      rollCover: 'NONE',
    });

    expect(priced.baseExCents).toBe(134783);
    expect(priced.coreSellExCents).toBe(155000);
    expect(priced.coreSellIncCents).toBe(178250);
    expect(priced.blindSellIncCents).toBe(178250);
  });

  it('keeps the motor and roll-cover rates fixed instead of applying the core uplift', () => {
    const baseInput = {
      system: 'OMNI' as const,
      widthMm: 2000,
      coverLengthMm: 2000,
      fabric: 'MESH' as const,
      motorised: false,
    };
    const noCover = priceBlindLineItem({ id: 'no-cover', ...baseInput, rollCover: 'NONE' });
    const flashing = priceBlindLineItem({ id: 'flashing', ...baseInput, rollCover: 'FLASHING' });
    const pelmet = priceBlindLineItem({ id: 'pelmet', ...baseInput, rollCover: 'PELMET' });
    const motorised = priceBlindLineItem({ id: 'motorised', ...baseInput, motorised: true, rollCover: 'NONE' });

    expect(flashing.rollCoverIncCents).toBe(8800);
    expect(pelmet.rollCoverIncCents).toBe(29000);
    expect(flashing.blindSellIncCents - noCover.blindSellIncCents).toBe(8800);
    expect(pelmet.blindSellIncCents - noCover.blindSellIncCents).toBe(29000);
    expect(motorised.blindSellIncCents - noCover.blindSellIncCents).toBe(90000);
  });

  it('prices a roll cover from entered width rather than the rounded pricing band', () => {
    const priced = priceBlindLineItem({
      id: 'entered-width',
      system: 'OMNI',
      widthMm: 2400,
      coverLengthMm: 2000,
      fabric: 'MESH',
      motorised: false,
      rollCover: 'FLASHING',
    });

    expect(priced.widthBandMm).toBe(2500);
    expect(priced.rollCoverIncCents).toBe(10560);
  });

  it('fabric multipliers apply (PVC +10%, fine mesh +15%)', () => {
    const mesh = priceBlindLineItem({
      id: 'b7',
      system: 'ZIPTRAK',
      widthMm: 2000,
      coverLengthMm: 2000,
      fabric: 'MESH',
      motorised: false,
    });
    const pvc = priceBlindLineItem({
      id: 'b8',
      system: 'ZIPTRAK',
      widthMm: 2000,
      coverLengthMm: 2000,
      fabric: 'PVC',
      motorised: false,
    });
    const fine = priceBlindLineItem({
      id: 'b9',
      system: 'ZIPTRAK',
      widthMm: 2000,
      coverLengthMm: 2000,
      fabric: 'FINE_MESH',
      motorised: false,
    });

    expect(pvc.blindSellExCents).toBeGreaterThan(mesh.blindSellExCents);
    expect(fine.blindSellExCents).toBeGreaterThan(pvc.blindSellExCents);
  });

  it('totals exclude invalid blinds', () => {
    const result = priceAllBlinds([
      {
        id: 'b10',
        system: 'OMNI',
        widthMm: 2000,
        coverLengthMm: 2000,
        fabric: 'MESH',
        motorised: false,
      },
      {
        id: 'b11',
        system: 'OMNI',
        widthMm: 5000,
        coverLengthMm: 2000,
        fabric: 'MESH',
        motorised: false,
      },
    ]);

    const validTotal = result.items.find((i) => i.id === 'b10')?.blindSellExCents ?? 0;
    expect(result.totals.totalExCents).toBe(validTotal);
  });

  it('aggregate totals equal the sum of valid inclusive line prices', () => {
    const result = priceAllBlinds([
      {
        id: 'sum-1',
        system: 'OMNI',
        widthMm: 2000,
        coverLengthMm: 2000,
        fabric: 'MESH',
        motorised: false,
        rollCover: 'FLASHING',
      },
      {
        id: 'sum-2',
        system: 'ZIPTRAK',
        widthMm: 2400,
        coverLengthMm: 2100,
        fabric: 'PVC',
        motorised: true,
        rollCover: 'PELMET',
      },
    ]);

    expect(result.totals.totalIncCents).toBe(
      result.items.reduce((sum, item) => sum + item.blindSellIncCents, 0),
    );
  });
});

describe('blinds helpers', () => {
  it('roundUpToIncrementMm rounds to next 3mm', () => {
    expect(roundUpToIncrementMm(1000, 3)).toBe(1002);
  });

  it('getBand returns next higher band', () => {
    expect(getBand(1400, [1000, 1500, 2000])).toBe(1500);
  });

  it('autoSplitByMaxWidth keeps panels within max', () => {
    const widths = autoSplitByMaxWidth(12000, 4500, 3);
    expect(widths).toBeTruthy();
    expect(Math.max(...(widths ?? []))).toBeLessThanOrEqual(4500);
  });
});
