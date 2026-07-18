import { describe, expect, it } from 'vitest';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import {
  buildCalculatorPricingComparison,
  extractStoredCalculatorCosting,
  formatCalculatorCostMoney,
} from './calculatorPricingComparison';
import { makeDefaultModule } from './calculatorInputs';

function inputs(projectionM = '3'): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: 'Test',
    quoteRef: 'Q-1',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [{ ...makeDefaultModule(), projectionM }],
    blinds: { items: [] },
  };
}

function estimate(snapshot: Record<string, unknown>): EstimateDetail {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'draft',
    summary: {},
    versionLabel: 'V2',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: snapshot,
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
  };
}

const storedOutputs = {
  materials: { totals: { materials_ex_gst: 100 } },
  install: { totals: { install_ex_gst: 50 } },
  overhead: { total_ex_gst: 25 },
  totals: { cost_ex_gst: 175, cost_inc_gst: 201.25 },
  pricing_sync_state: 'stale',
};

const liveResult = {
  materials: { totals: { materials_ex_gst: 110 } },
  install: { totals: { install_ex_gst: 45 } },
  overhead: { total_ex_gst: 30 },
  totals: { cost_ex_gst: 185, cost_inc_gst: 212.75 },
} as any;

describe('calculator pricing comparison', () => {
  it('extracts stored costing from direct and nested snapshots', () => {
    expect(extractStoredCalculatorCosting(estimate({ inputs: inputs(), outputs: storedOutputs }))).toEqual({
      materialsEx: 100,
      installEx: 50,
      overheadEx: 25,
      trueCostEx: 175,
      trueCostInc: 201.25,
    });
    expect(
      extractStoredCalculatorCosting(estimate({ calculator_snapshot: { inputs: inputs(), outputs: storedOutputs } })),
    ).toEqual(expect.objectContaining({ trueCostEx: 175 }));
  });

  it('keeps unavailable legacy breakdown values unknown rather than zero', () => {
    const detail = estimate({ inputs: inputs(), total_true_cost_ex_gst: 175 });
    expect(extractStoredCalculatorCosting(detail)).toEqual({
      materialsEx: null,
      installEx: null,
      overheadEx: null,
      trueCostEx: 175,
      trueCostInc: null,
    });
  });

  it('uses input semantics for change detection and calculates signed live-minus-stored differences', () => {
    const comparison = buildCalculatorPricingComparison({
      estimate: estimate({ inputs: inputs(), outputs: storedOutputs }),
      values: inputs('4'),
      liveResult,
    });
    expect(comparison.pricingInputsChanged).toBe(true);
    expect(comparison.storedPricingState).toBe('stale');
    expect(comparison.difference).toEqual({
      materialsEx: 10,
      installEx: -5,
      overheadEx: 5,
      trueCostEx: 10,
      trueCostInc: 11.5,
    });
  });

  it('reports pricing input changes even when the resulting dollars are equal', () => {
    const comparison = buildCalculatorPricingComparison({
      estimate: estimate({ inputs: inputs(), outputs: storedOutputs }),
      values: inputs('4'),
      liveResult: {
        ...liveResult,
        materials: storedOutputs.materials,
        install: storedOutputs.install,
        overhead: storedOutputs.overhead,
        totals: storedOutputs.totals,
      } as any,
    });
    expect(comparison.pricingInputsChanged).toBe(true);
    expect(comparison.difference?.trueCostEx).toBe(0);
  });

  it('formats missing, positive, negative, and zero money values', () => {
    expect(formatCalculatorCostMoney(null)).toBe('—');
    expect(formatCalculatorCostMoney(10, { signed: true })).toBe('+$10.00');
    expect(formatCalculatorCostMoney(-5, { signed: true })).toBe('-$5.00');
    expect(formatCalculatorCostMoney(0, { signed: true })).toBe('$0.00');
  });
});
