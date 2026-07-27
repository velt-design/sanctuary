import type { LocalFirstEntitySyncState } from '@/lib/localFirst/types';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';

type CalculatorSaveOutcomeUi = {
  syncLabel: string;
  syncDetail: string;
  syncTone: 'neutral' | 'success' | 'warning' | 'danger';
  costingDetail: string;
  quoteDetail: string;
  reconciliationStatus: 'matched' | 'stored_basis' | 'blocked' | 'mismatch' | 'unavailable';
  reconciliationLabel: string;
  reconciliationDetail: string;
  quoteDisabled: boolean;
  quoteBlockedDetail: string | null;
};

export function buildCalculatorSaveOutcomeUi(
  outcome: CalculatorEstimateSaveOutcome,
  syncState: Pick<LocalFirstEntitySyncState, 'status' | 'lastError'>,
  liveCalculatorTotalIncGstCents?: number | null,
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
  const quotePreviewBlocked = outcome.quotePreview.blockingIssues.length > 0;
  const liveTotalAvailable =
    typeof liveCalculatorTotalIncGstCents === 'number' &&
    Number.isFinite(liveCalculatorTotalIncGstCents) &&
    liveCalculatorTotalIncGstCents >= 0;
  const reconciliation = (() => {
    if (quotePreviewBlocked) {
      return {
        reconciliationStatus: 'blocked' as const,
        reconciliationLabel: 'Quote handoff blocked',
        reconciliationDetail:
          'The saved design cannot produce a complete proposed quote until the listed commercial issue is resolved.',
      };
    }
    if (outcome.saveMode === 'preserve_current') {
      return {
        reconciliationStatus: 'stored_basis' as const,
        reconciliationLabel: 'Stored pricing retained',
        reconciliationDetail:
          'The proposed quote is reconciled to the saved estimate’s stored costing basis, so it may intentionally differ from the Live Calculator preview.',
      };
    }
    if (!liveTotalAvailable) {
      return {
        reconciliationStatus: 'unavailable' as const,
        reconciliationLabel: 'Live comparison unavailable',
        reconciliationDetail:
          'The proposed quote still comes from the saved estimate, but this screen cannot compare it with the Live Calculator total.',
      };
    }
    if (outcome.quotePreview.totalIncGstCents === liveCalculatorTotalIncGstCents) {
      return {
        reconciliationStatus: 'matched' as const,
        reconciliationLabel: 'Exact match',
        reconciliationDetail:
          'The saved design’s proposed quote total matches the Live Calculator customer total to the cent.',
      };
    }
    return {
      reconciliationStatus: 'mismatch' as const,
      reconciliationLabel: 'Totals do not match',
      reconciliationDetail:
        'The saved design’s proposed quote total differs from the Live Calculator total. Stay in the Calculator and review the design before creating a quote.',
    };
  })();

  return {
    ...sync,
    ...reconciliation,
    costingDetail: preservedChanged
      ? 'Design inputs were saved and the stored costing basis was kept. The Live calculator preview did not replace it.'
      : outcome.saveMode === 'preserve_current'
        ? 'The design was saved with its existing stored costing basis.'
        : 'The design was saved using the Live calculator costing result.',
    quoteDetail: preservedChanged
      ? 'A quote created now will use the stored costing basis, not the Live calculator preview.'
      : 'The quote applies the existing customer-pricing rules to this saved design.',
    quoteDisabled:
      quotePreviewBlocked ||
      reconciliation.reconciliationStatus === 'mismatch' ||
      syncState.status === 'idle' ||
      syncState.status === 'error' ||
      syncState.status === 'conflict',
    quoteBlockedDetail:
      quotePreviewBlocked
        ? outcome.quotePreview.blockingIssues.join(' ')
        : reconciliation.reconciliationStatus === 'mismatch'
          ? 'Resolve the pricing mismatch before creating a quote from this design.'
        : syncState.status === 'idle'
        ? 'Wait for the saved design’s sync state before creating a quote.'
        : syncState.status === 'error' || syncState.status === 'conflict'
          ? 'Resolve the sync issue before creating a quote from this design.'
          : null,
  };
}
