import type { LocalFirstEntityStatus } from '@/lib/localFirst/types';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';
import CalculatorSaveOutcomeDialog from './CalculatorSaveOutcomeDialog';

const mocks = vi.hoisted(() => ({
  navigateRoute: vi.fn(() => true),
  syncState: {
    entityKey: 'estimate:detail:estimate-1',
    status: 'idle' as LocalFirstEntityStatus,
    pendingCount: 0,
    updatedAt: '2026-07-27T00:00:00.000Z',
    lastError: undefined as string | undefined,
  },
}));

vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({ navigateRoute: mocks.navigateRoute }),
}));

vi.mock('@/lib/localFirst/useEntitySyncState', () => ({
  useAliasedEntitySyncState: () => mocks.syncState,
}));

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({
    open,
    ariaLabel,
    children,
  }: {
    open: boolean;
    ariaLabel: string;
    children: React.ReactNode;
  }) => (open ? <div role="dialog" aria-label={ariaLabel}>{children}</div> : null),
}));

const outcome: CalculatorEstimateSaveOutcome = {
  estimateId: 'estimate-1',
  projectId: 'project-1',
  versionLabel: 'V2',
  operation: 'updated',
  saveMode: 'reprice_latest',
  pricingChanged: true,
  quotePreview: {
    lineItems: [],
    totalIncGstCents: 1_234_567,
    blockingIssues: [],
  },
};

function renderDialog(
  status: LocalFirstEntityStatus,
  {
    saveOutcome = outcome,
    liveCalculatorTotalIncGstCents = 1_234_567,
  }: {
    saveOutcome?: CalculatorEstimateSaveOutcome;
    liveCalculatorTotalIncGstCents?: number | null;
  } = {},
) {
  mocks.syncState.status = status;
  mocks.syncState.lastError = undefined;
  const onDismiss = vi.fn();
  const rendered = renderIntoDocument(
    <CalculatorSaveOutcomeDialog
      outcome={saveOutcome}
      liveCalculatorTotalIncGstCents={liveCalculatorTotalIncGstCents}
      onDismiss={onDismiss}
    />,
  );
  return { ...rendered, onDismiss };
}

function actionButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${label} button is unavailable.`);
  return button;
}

function quoteButton(): HTMLButtonElement {
  return actionButton('Create quote from this design');
}

afterEach(() => {
  document.body.innerHTML = '';
  mocks.navigateRoute.mockReset();
  mocks.navigateRoute.mockReturnValue(true);
  mocks.syncState.status = 'idle';
  mocks.syncState.lastError = undefined;
});

describe('CalculatorSaveOutcomeDialog', () => {
  it('renders no handoff controls before a save outcome exists', () => {
    renderIntoDocument(
      <CalculatorSaveOutcomeDialog
        outcome={null}
        liveCalculatorTotalIncGstCents={null}
        onDismiss={vi.fn()}
      />,
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each([
    ['idle', 'Saved on this device', 'sync status is prepared', true],
    ['queued', 'syncing', 'syncs in the background', false],
    ['syncing', 'syncing', 'syncs in the background', false],
    ['synced', 'Saved and synced', 'server has confirmed this design', false],
    ['offline', 'Saved on this device', 'sync when the connection returns', false],
    ['error', 'sync needs attention', 'server has not confirmed this design', true],
    ['conflict', 'conflict detected', 'resolve the server conflict', true],
  ] as const)('renders %s truthfully and preserves quote eligibility', (status, label, detail, disabled) => {
    renderDialog(status);

    const dialog = document.querySelector('[role="dialog"][aria-label="Design saved"]');
    const syncStatus = dialog?.querySelector('[aria-label="Save and sync status"]');
    expect(dialog?.textContent).toContain(label);
    expect(syncStatus?.textContent).toContain(detail);
    expect(syncStatus?.textContent?.includes('server has confirmed this design')).toBe(
      status === 'synced',
    );
    expect(dialog?.textContent).toContain('Exact match');
    expect(syncStatus?.getAttribute('data-save-sync-status')).toBe(status);
    expect(dialog?.querySelector('[data-pricing-reconciliation="matched"]')).not.toBeNull();
    expect(quoteButton().disabled).toBe(disabled);
  });

  it.each(['idle', 'error', 'conflict'] as const)(
    'does not navigate from the disabled %s handoff',
    (status) => {
      const { onDismiss } = renderDialog(status);

      act(() => {
        quoteButton().click();
      });

      expect(onDismiss).not.toHaveBeenCalled();
      expect(mocks.navigateRoute).not.toHaveBeenCalled();
    },
  );

  it('uses the explicit quote handoff route without creating a quote itself', () => {
    const { onDismiss } = renderDialog('synced');

    act(() => {
      quoteButton().click();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mocks.navigateRoute).toHaveBeenCalledWith({
      href: '/staff/projects/project-1?tab=quotes&createFromEstimateId=estimate-1',
      label: 'Quote',
      source: 'calculator-save-outcome',
    });
  });

  it('updates the same dialog from queued through syncing to server-confirmed sync', () => {
    const { rerender, onDismiss } = renderDialog('queued');
    expect(
      document.querySelector('[aria-label="Save and sync status"]')?.getAttribute('data-save-sync-status'),
    ).toBe('queued');

    for (const status of ['syncing', 'synced'] as const) {
      mocks.syncState.status = status;
      act(() => {
        rerender(
          <CalculatorSaveOutcomeDialog
            outcome={outcome}
            liveCalculatorTotalIncGstCents={1_234_567}
            onDismiss={onDismiss}
          />,
        );
      });
      expect(
        document.querySelector('[aria-label="Save and sync status"]')?.getAttribute('data-save-sync-status'),
      ).toBe(status);
    }

    const syncStatus = document.querySelector('[aria-label="Save and sync status"]');
    expect(syncStatus?.textContent).toContain('Saved and synced');
    expect(syncStatus?.textContent).toContain('server has confirmed this design');
    expect(quoteButton().disabled).toBe(false);
  });

  it('stays in the Calculator without navigating', () => {
    const { onDismiss } = renderDialog('synced');

    act(() => {
      actionButton('Stay in calculator').click();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mocks.navigateRoute).not.toHaveBeenCalled();
  });

  it('returns to the exact saved estimate', () => {
    const { onDismiss } = renderDialog('synced');

    act(() => {
      actionButton('Back to project').click();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mocks.navigateRoute).toHaveBeenCalledWith({
      href: '/staff/projects/project-1?tab=estimates&estimateId=estimate-1',
      label: 'Project',
      source: 'calculator-save-outcome',
    });
  });

  it.each([
    {
      name: 'pricing mismatch',
      saveOutcome: {
        ...outcome,
        quotePreview: {
          ...outcome.quotePreview,
          totalIncGstCents: outcome.quotePreview.totalIncGstCents + 1,
        },
      },
      reconciliationStatus: 'mismatch',
      label: 'Totals do not match',
      detail: 'pricing mismatch',
    },
    {
      name: 'quote mapping blocker',
      saveOutcome: {
        ...outcome,
        quotePreview: {
          ...outcome.quotePreview,
          blockingIssues: [
            'Pool blind needs valid dimensions and selections before a quote can be created.',
          ],
        },
      },
      reconciliationStatus: 'blocked',
      label: 'Quote handoff blocked',
      detail: 'Pool blind needs valid dimensions',
    },
  ] satisfies Array<{
    name: string;
    saveOutcome: CalculatorEstimateSaveOutcome;
    reconciliationStatus: string;
    label: string;
    detail: string;
  }>)(
    'presents and blocks a $name',
    ({ saveOutcome, reconciliationStatus, label, detail }) => {
      renderDialog('synced', { saveOutcome });

      const reconciliation = document.querySelector(
        `[data-pricing-reconciliation="${reconciliationStatus}"]`,
      );
      expect(reconciliation?.textContent).toContain(label);
      expect(document.body.textContent).toContain(detail);
      expect(quoteButton().disabled).toBe(true);
    },
  );
});
