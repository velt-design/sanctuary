import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectCommercialPendingFrame, {
  InvoicesPendingView,
  QuotesPendingView,
} from './CommercialPendingFrames';
import QuoteDetailPendingView from './QuoteDetailPendingView';

describe('project Commercial pending frames', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the real quote list heading, create action, and table columns', () => {
    const rendered = renderIntoDocument(<QuotesPendingView />);
    expect(rendered.container.querySelector('[data-quotes-view="list"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Create quote');
    expect(Array.from(rendered.container.querySelectorAll('th')).map((cell) => cell.textContent)).toEqual([
      'Quote', 'From design', 'Issue date', 'Expiry', 'Status', 'Amount (inc GST)', 'PDF',
    ]);
    rendered.unmount();
  });

  it('renders the real invoice table and switches through the pending Commercial owner', () => {
    const select = vi.fn();
    const rendered = renderIntoDocument(<ProjectCommercialPendingFrame view="quotes" onViewSelect={select} />);
    const invoices = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((button) => button.textContent === 'Invoices');
    act(() => invoices?.click());
    expect(select).toHaveBeenCalledWith('invoices');
    rendered.rerender(<InvoicesPendingView />);
    expect(rendered.container.querySelector('table[aria-label="Invoices"]')).not.toBeNull();
    rendered.unmount();
  });

  it('keeps the complete quote-detail card and table hierarchy while values load', () => {
    const back = vi.fn();
    const rendered = renderIntoDocument(<QuoteDetailPendingView onBack={back} />);
    expect(rendered.container.querySelector('[data-portal-page-shell="quote-detail"]')?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(rendered.container.textContent).toContain('Quote details');
    expect(rendered.container.querySelector('table[aria-label="Quote line items"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Totals');
    expect(rendered.container.textContent).toContain('Intro & Terms');
    expect(rendered.container.querySelector('table[aria-label="Quote send log"]')).not.toBeNull();
    const backButton = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Back'));
    act(() => backButton?.click());
    expect(back).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it('keeps Edit and Preview usable when the offline quote detail owner is supplied', () => {
    const selectPreview = vi.fn();
    const rendered = renderIntoDocument(
      <ProjectCommercialPendingFrame
        view="quotes"
        quoteDetail
        onQuotePreviewSelect={selectPreview}
      />,
    );
    const quoteViewButtons = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>('[aria-label="Quote view"] button'),
    );
    expect(quoteViewButtons.every((button) => !button.disabled)).toBe(true);
    act(() => quoteViewButtons.find((button) => button.textContent === 'Preview')?.click());
    expect(selectPreview).toHaveBeenCalledWith(true);
    rendered.unmount();
  });
});
