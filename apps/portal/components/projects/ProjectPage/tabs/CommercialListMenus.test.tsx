import { act, type ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { dispatchKeyboard, renderIntoDocument } from '../../../../../../test/reactHarness';
import EstimatesListView from './EstimatesListView';
import QuotesListView from './QuotesListView';
import { estimates, projectId, quotes } from '@/app/qa/project-page-shell-fixture/commercialClarityData';

vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a> }));
let view: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { view?.unmount(); view = undefined; document.body.innerHTML = ''; });

function checkMenu(trigger: HTMLButtonElement, selected: ReturnType<typeof vi.fn>, openRow: ReturnType<typeof vi.fn>) {
  act(() => { trigger.focus(); trigger.click(); });
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  const action = menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')!;
  expect(document.activeElement).toBe(action);
  dispatchKeyboard(action, 'End');
  dispatchKeyboard(document.activeElement!, 'Home');
  expect(document.activeElement).toBe(action);
  dispatchKeyboard(action, 'Escape');
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(openRow).not.toHaveBeenCalled();
  act(() => trigger.click());
  const select = document.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')!;
  dispatchKeyboard(select, 'Enter');
  expect(openRow).not.toHaveBeenCalled();
  act(() => select.click());
  expect(selected).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(trigger);
  expect(document.querySelector('[role="menu"]')).toBeNull();
}

it('closes the actual estimate action menu with focused Escape while retaining row and menu keyboard actions', () => {
  const onOpen = vi.fn(), onRename = vi.fn();
  view = renderIntoDocument(<EstimatesListView projectId={projectId} estimates={estimates} loading={false} error={null}
    quotes={quotes} quoteReadState="ready" onRetry={vi.fn()} onCreate={vi.fn()} onCreateAddOn={vi.fn()}
    onOpen={onOpen} onDuplicate={vi.fn()} onRename={onRename} />);
  checkMenu(view.container.querySelector<HTMLButtonElement>('button[aria-label^="Actions for"]')!, onRename, onOpen);
  const row = view.container.querySelector('tbody tr')!;
  dispatchKeyboard(row, 'Enter'); dispatchKeyboard(row, ' ');
  expect(onOpen).toHaveBeenCalledTimes(2);
});

it('closes an actual historical quote menu with focused Escape without opening its row', () => {
  const noop = vi.fn(), selectQuote = vi.fn(), renameQuote = vi.fn();
  const props: ComponentProps<typeof QuotesListView> = {
    projectId, quotes, quotesLoading: false, quotesError: null, retryQuotes: noop, openCreate: noop,
    selectQuote, prefetchQuoteDetail: noop, createOpen: false, closeCreate: noop, createEstimateId: '',
    setCreateEstimateId: noop, createInternalName: '', setCreateInternalName: noop, estimatesLoading: false,
    estimates, createQuote: noop, createMode: 'estimate', setCreateMode: noop, manualDescription: '',
    setManualDescription: noop, manualQty: '1', setManualQty: noop, manualPrice: '', setManualPrice: noop,
    createBusy: false, isAdmin: false, deleteQuote: noop, supersedeQuote: noop, supersedePendingId: null,
    renameTarget: null, renamePending: false, renameQuote, closeRename: noop, saveRename: noop,
  };
  view = renderIntoDocument(<QuotesListView {...props} />);
  act(() => view!.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  const historical = view.container.querySelector<HTMLButtonElement>('button[aria-label="Actions for Q-CLARITY version 2"]')!;
  expect(historical).not.toBeNull();
  checkMenu(historical, renameQuote, selectQuote);
  const row = historical.closest('tr')!;
  dispatchKeyboard(row, 'Enter'); dispatchKeyboard(row, ' ');
  expect(selectQuote).toHaveBeenCalledTimes(2);
});
