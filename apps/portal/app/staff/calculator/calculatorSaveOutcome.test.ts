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
    const preserved = buildCalculatorSaveOutcomeUi(outcome, { status: 'queued' });
    const repriced = buildCalculatorSaveOutcomeUi(
      { ...outcome, saveMode: 'reprice_latest', pricingChanged: false },
      { status: 'synced' },
    );
    expect(preserved.costingDetail).toContain('stored costing basis was kept');
    expect(preserved.quoteDetail).toContain('not the Live calculator preview');
    expect(repriced.costingDetail).toContain('Live calculator costing result');
    expect(repriced.quoteDetail).toContain('customer-pricing rules');
  });
});
