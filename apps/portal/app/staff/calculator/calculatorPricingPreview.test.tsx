import { priceAllBlinds, type BlindLineItemInput, type SiteOutputV1 } from '@sp/costing';
import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { buildQuoteLineItemsFromEstimate } from '@/lib/quotes/mapping';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { makeDefaultCalculatorInputs, makeDefaultInfillItem, makeDefaultModule } from './calculatorInputs';
import {
  buildCalculatorPricingPreview,
  useCalculatorPricingPreview,
} from './calculatorPricingPreview';

const blind: BlindLineItemInput = {
  id: 'blind-1',
  label: 'West blind',
  system: 'OMNI',
  widthMm: 2000,
  coverLengthMm: 2000,
  fabric: 'MESH',
  motorised: false,
  rollCover: 'NONE',
};

function inputs(): CalculatorInputs {
  const value = makeDefaultCalculatorInputs();
  const first = makeDefaultModule('p1');
  first.infills = { items: [makeDefaultInfillItem({ id: 'infill-1', label: 'Front infill', location: 'front' })] };
  const second = makeDefaultModule('p2');
  return {
    ...value,
    projectName: 'Test',
    quoteRef: 'Q-1',
    quoteDiscountPct: '10',
    pergolas: [
      { id: 'p1', label: 'Front patio' },
      { id: 'p2', label: 'Pool cover' },
    ],
    modules: [first, second],
    blinds: {
      items: [{
        id: blind.id,
        label: blind.label,
        system: blind.system,
        widthMm: String(blind.widthMm),
        coverLengthMm: String(blind.coverLengthMm),
        fabric: blind.fabric,
        motorised: 'NONE',
        rollCover: blind.rollCover,
      }],
    },
  };
}

function result(): SiteOutputV1 {
  return {
    pergolas: [
      { id: 'p1', label: 'Front patio', module_count: 1, totals: { cost_ex_gst: 100 } },
      { id: 'p2', label: 'Pool cover', module_count: 1, totals: { cost_ex_gst: 200 } },
    ],
    shared: { totals: { cost_ex_gst: 40 } },
  } as SiteOutputV1;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('calculator pricing preview', () => {
  it('builds exact quote-priced rows and keeps infills included', () => {
    const calculatorInputs = inputs();
    const siteResult = result();
    const blindPricing = priceAllBlinds([blind]);
    const estimateSnapshot = { inputs: calculatorInputs, outputs: { lighting_total_inc_gst: 300 } };
    const preview = buildCalculatorPricingPreview({
      result: siteResult,
      inputs: calculatorInputs,
      blindPricing,
      estimateSnapshot,
    });

    expect(preview.rows.map((row) => [row.kind, row.label, row.status, row.priceIncGstCents])).toEqual([
      ['pergola', 'Front patio', 'priced', 12_938],
      ['infill', 'Front infill', 'included', null],
      ['pergola', 'Pool cover', 'priced', 25_875],
      ['shared', 'Shared site costs', 'priced', 5_175],
      ['blind', 'West blind', 'priced', 178_250],
      ['lighting', 'Lighting', 'priced', 30_000],
    ]);
    expect(preview.totalIncGstCents).toBe(252_238);
    expect(preview.totalExGstCents).toBe(219_337);
    expect(preview.undiscountedTotalIncGstCents).toBe(257_125);
    expect(preview.unpricedItemCount).toBe(0);

    const quoteMapping = buildQuoteLineItemsFromEstimate({
      inputs: calculatorInputs,
      outputs: {
        pergolas: siteResult.pergolas,
        siteShared: siteResult.shared,
        lighting_total_inc_gst: 300,
      },
    } as any);
    expect(quoteMapping.items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0)).toBe(preview.totalIncGstCents);
  });

  it('merges shared costs into a single pergola and marks invalid blinds unpriced', () => {
    const calculatorInputs = inputs();
    calculatorInputs.pergolas = [{ id: 'p1', label: '' }];
    calculatorInputs.modules = [calculatorInputs.modules[0]!];
    calculatorInputs.quoteDiscountPct = '0';
    const siteResult = result();
    siteResult.pergolas = [siteResult.pergolas[0]!];
    const invalidBlind = { ...blind, widthMm: null };
    const preview = buildCalculatorPricingPreview({
      result: siteResult,
      inputs: calculatorInputs,
      blindPricing: priceAllBlinds([invalidBlind]),
    });

    expect(preview.rows[0]).toMatchObject({
      kind: 'pergola',
      label: 'Front patio',
      detail: '1 module · Includes shared site costs',
      priceIncGstCents: 20_125,
    });
    expect(preview.rows.at(-1)).toMatchObject({ kind: 'blind', status: 'unpriced', priceIncGstCents: null });
    expect(preview.totalIncGstCents).toBe(20_125);
    expect(preview.unpricedItemCount).toBe(1);
  });

  it('holds the last current preview while costing is stale', () => {
    function Harness({ freshness, siteResult }: { freshness: 'current' | 'stale'; siteResult: SiteOutputV1 }) {
      const preview = useCalculatorPricingPreview({
        result: siteResult,
        inputs: inputs(),
        blindPricing: priceAllBlinds([]),
        resultFreshness: freshness,
      });
      return <span>{preview.totalIncGstCents}</span>;
    }

    const firstResult = result();
    const { container, rerender, unmount } = renderIntoDocument(
      <Harness freshness="current" siteResult={firstResult} />,
    );
    expect(container.textContent).toBe('43988');

    const changed = result();
    changed.pergolas[0]!.totals.cost_ex_gst = 999;
    rerender(<Harness freshness="stale" siteResult={changed} />);
    expect(container.textContent).toBe('43988');
    unmount();
  });
});
