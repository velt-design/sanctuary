import { describe, expect, it } from 'vitest';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';
import { buildCalculatorSaveOutcomeUi } from './calculatorSaveOutcome';

const outcome: CalculatorEstimateSaveOutcome = {
  estimateId: 'estimate-1',
  projectId: 'project-1',
  versionLabel: 'V2',
  operation: 'updated',
  saveMode: 'preserve_current',
  pricingChanged: true,
  quotePreview: { lineItems: [], totalIncGstCents: 0, blockingIssues: [] },
};

describe('calculator save outcome UI', () => {
  it.each([
    ['idle', 'Saved on this device', true],
    ['queued', 'Saved on this device — syncing', false],
    ['syncing', 'Saved on this device — syncing', false],
    ['synced', 'Saved and synced', false],
    ['offline', 'Saved on this device', false],
    ['error', 'Saved locally — sync needs attention', true],
    ['conflict', 'Saved locally — conflict detected', true],
  ] as const)('maps %s sync state and quote eligibility', (status, label, quoteDisabled) => {
    expect(buildCalculatorSaveOutcomeUi(outcome, { status, lastError: 'Specific sync error.' })).toMatchObject({
      syncLabel: label,
      quoteDisabled,
    });
  });

  it('waits for an actionable sync state before enabling quote handoff', () => {
    const idle = buildCalculatorSaveOutcomeUi(outcome, { status: 'idle' });
    const queued = buildCalculatorSaveOutcomeUi(outcome, { status: 'queued' });
    expect(idle.quoteBlockedDetail).toContain('Wait for');
    expect(queued.quoteDisabled).toBe(false);
    expect(queued.quoteBlockedDetail).toBeNull();
  });

  it('makes preserved and repriced quote sources explicit', () => {
    const preserved = buildCalculatorSaveOutcomeUi(outcome, { status: 'queued' }, 12_500);
    const repriced = buildCalculatorSaveOutcomeUi(
      {
        ...outcome,
        saveMode: 'reprice_latest',
        pricingChanged: false,
        quotePreview: { lineItems: [], totalIncGstCents: 12_500, blockingIssues: [] },
      },
      { status: 'synced' },
      12_500,
    );
    expect(preserved.costingDetail).toContain('stored costing basis was kept');
    expect(preserved.quoteDetail).toContain('not the Live calculator preview');
    expect(preserved.reconciliationStatus).toBe('stored_basis');
    expect(repriced.costingDetail).toContain('Live calculator costing result');
    expect(repriced.quoteDetail).toContain('customer-pricing rules');
    expect(repriced.reconciliationStatus).toBe('matched');
    expect(repriced.quoteDisabled).toBe(false);
  });

  it('fails closed when a repriced saved quote total differs from the Live Calculator', () => {
    const mismatch = buildCalculatorSaveOutcomeUi(
      {
        ...outcome,
        saveMode: 'reprice_latest',
        pricingChanged: false,
        quotePreview: { lineItems: [], totalIncGstCents: 12_501, blockingIssues: [] },
      },
      { status: 'synced' },
      12_500,
    );

    expect(mismatch.reconciliationStatus).toBe('mismatch');
    expect(mismatch.reconciliationLabel).toBe('Totals do not match');
    expect(mismatch.quoteDisabled).toBe(true);
    expect(mismatch.quoteBlockedDetail).toContain('pricing mismatch');
  });

  it('blocks handoff when the saved quote mapping has a commercial blocker', () => {
    const blocked = buildCalculatorSaveOutcomeUi(
      {
        ...outcome,
        quotePreview: {
          lineItems: [],
          totalIncGstCents: 0,
          blockingIssues: ['Pool blind needs valid dimensions and selections before a quote can be created.'],
        },
      },
      { status: 'synced' },
    );

    expect(blocked.quoteDisabled).toBe(true);
    expect(blocked.quoteBlockedDetail).toContain('Pool blind');
  });
});
