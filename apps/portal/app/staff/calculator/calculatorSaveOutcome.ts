import type { LocalFirstEntitySyncState } from '@/lib/localFirst/types';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';

export type CalculatorSaveOutcomeUi = {
  syncLabel: string;
  syncDetail: string;
  syncTone: 'neutral' | 'success' | 'warning' | 'danger';
  costingDetail: string;
  quoteDetail: string;
  quoteDisabled: boolean;
  quoteBlockedDetail: string | null;
};

export function buildCalculatorSaveOutcomeUi(
  outcome: CalculatorEstimateSaveOutcome,
  syncState: Pick<LocalFirstEntitySyncState, 'status' | 'lastError'>,
): CalculatorSaveOutcomeUi {
  const sync = (() => {
    switch (syncState.status) {
      case 'synced':
        return {
          syncLabel: 'Saved and synced',
          syncDetail: 'The server has confirmed this design.',
          syncTone: 'success' as const,
        };
      case 'offline':
        return {
          syncLabel: 'Saved on this device',
          syncDetail: 'You are offline. This design will sync when the connection returns.',
          syncTone: 'warning' as const,
        };
      case 'error':
        return {
          syncLabel: 'Saved locally — sync needs attention',
          syncDetail: syncState.lastError || 'The portal will retry, but the server has not confirmed this design.',
          syncTone: 'danger' as const,
        };
      case 'conflict':
        return {
          syncLabel: 'Saved locally — conflict detected',
          syncDetail: syncState.lastError || 'Open the project to resolve the server conflict before creating a quote.',
          syncTone: 'danger' as const,
        };
      case 'queued':
      case 'syncing':
        return {
          syncLabel: 'Saved on this device — syncing',
          syncDetail: 'You can keep working while the design syncs in the background.',
          syncTone: 'neutral' as const,
        };
      default:
        return {
          syncLabel: 'Saved on this device',
          syncDetail: 'The design is stored locally while sync status is prepared.',
          syncTone: 'neutral' as const,
        };
    }
  })();

  const preservedChanged = outcome.saveMode === 'preserve_current' && outcome.pricingChanged;
  return {
    ...sync,
    costingDetail: preservedChanged
      ? 'Design inputs were saved and the stored costing basis was kept. The Live calculator preview did not replace it.'
      : outcome.saveMode === 'preserve_current'
        ? 'The design was saved with its existing stored costing basis.'
        : 'The design was saved using the Live calculator costing result.',
    quoteDetail: preservedChanged
      ? 'A quote created now will use the stored costing basis, not the Live calculator preview.'
      : 'Quotes applies the existing customer-pricing rules to this saved design.',
    quoteDisabled:
      syncState.status === 'idle' || syncState.status === 'error' || syncState.status === 'conflict',
    quoteBlockedDetail:
      syncState.status === 'idle'
        ? 'Wait for the saved design’s sync state before creating a quote.'
        : syncState.status === 'error' || syncState.status === 'conflict'
          ? 'Resolve the sync issue before creating a quote from this design.'
          : null,
  };
}
