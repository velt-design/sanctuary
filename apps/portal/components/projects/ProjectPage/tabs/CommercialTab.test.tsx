import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import CommercialTab from './CommercialTab';

const dynamicState = vi.hoisted(() => ({ callCount: 0 }));
const replace = vi.fn();
const prefetchQuery = vi.fn();
let search = 'tab=quotes';

vi.mock('next/dynamic', () => ({
  default: () => {
    const kind = ['estimates', 'quotes', 'invoices'][dynamicState.callCount++] ?? 'unknown';
    return (props: any) => (
      <div
        data-testid={`${kind}-subview`}
        data-project-id={props.projectId}
        data-selected-quote-id={props.selectedQuoteId ?? ''}
      />
    );
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects/proj_1',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery }),
}));

describe('CommercialTab', () => {
  beforeEach(() => {
    replace.mockReset();
    prefetchQuery.mockReset();
    search = 'tab=quotes';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps Estimates, Quotes and Invoices as lazy subviews behind one owner', () => {
    search = 'tab=estimates';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="estimates" />);
    expect(rendered.container.querySelector('[data-testid="estimates-subview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).toBeNull();
    expect(Array.from(rendered.container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent)).toEqual([
      'Estimates',
      'Quotes',
      'Invoices',
    ]);
    rendered.unmount();
  });

  it('renders the invoice owner for the invoices compatibility URL', () => {
    search = 'tab=invoices';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="invoices" />);
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="estimates-subview"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')).toBeNull();
    rendered.unmount();
  });

  it('switches to the Estimates list and clears nested record selections', () => {
    search = 'tab=quotes&quoteId=q_1&quotePreview=1&estimateId=est_1&fromEstimateId=est_0&newDesign=1&campaign=winter';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    const estimates = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((button) => button.textContent === 'Estimates');

    act(() => estimates?.click());

    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter');
    expect(rendered.container.querySelector('[data-testid="estimates-subview"]')).not.toBeNull();
    rendered.unmount();
  });

  it('removes Commercial navigation chrome in focused calculator mode', () => {
    search = 'tab=estimates&estimateId=est_1';
    const rendered = renderIntoDocument(
      <CommercialTab host="host" projectId="proj_1" projectName="Deck Build" view="estimates" calculatorWorkspace />,
    );

    expect(rendered.container.querySelector('[data-commercial-calculator-workspace="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[role="tablist"]')).toBeNull();
    rendered.unmount();
  });

  it('switches to Invoices, clears the quote detail and preview, and preserves unrelated context', () => {
    search = 'tab=quotes&quoteId=q_1&quotePreview=1&createFromEstimateId=est_1&campaign=winter';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    const invoices = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((button) => button.textContent === 'Invoices');
    act(() => invoices?.click());

    expect(replace).toHaveBeenCalledWith(
      '/staff/projects/proj_1?tab=invoices&createFromEstimateId=est_1&campaign=winter',
    );
    expect(invoices?.getAttribute('aria-selected')).toBe('true');
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')).toBeNull();
    rendered.unmount();
  });

  it('preserves Edit and Preview URLs for a selected quote', () => {
    search = 'tab=quotes&quoteId=q_1&campaign=winter';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    const preview = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Preview');
    expect(preview?.disabled).toBe(false);
    act(() => preview?.click());
    expect(replace).toHaveBeenCalledWith(
      '/staff/projects/proj_1?tab=quotes&quoteId=q_1&campaign=winter&quotePreview=1',
    );
    rendered.unmount();
  });

  it('clears the controlled quote selection when the canonical URL returns to the list', () => {
    search = 'tab=quotes&quoteId=q_1';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')?.getAttribute('data-selected-quote-id')).toBe('q_1');

    search = 'tab=quotes';
    rendered.rerender(<CommercialTab host="host" projectId="proj_1" view="quotes" />);

    const quotesSubview = rendered.container.querySelector('[data-testid="quotes-subview"]');
    expect(quotesSubview?.getAttribute('data-selected-quote-id')).toBe('');
    rendered.unmount();
  });

  it('lets Back or Forward override a pending commercial subtab intent', () => {
    search = 'tab=estimates';
    const rendered = renderIntoDocument(
      <CommercialTab host="host" projectId="proj_1" view="estimates" />,
    );
    const quotes = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab) => tab.textContent === 'Quotes');

    act(() => quotes?.click());
    expect(rendered.container.querySelector('[data-project-commercial-view]')?.getAttribute('data-project-commercial-view')).toBe('quotes');

    search = 'tab=invoices';
    rendered.rerender(<CommercialTab host="host" projectId="proj_1" view="estimates" />);
    expect(rendered.container.querySelector('[data-project-commercial-view]')?.getAttribute('data-project-commercial-view')).toBe('invoices');
    rendered.unmount();
  });
});
