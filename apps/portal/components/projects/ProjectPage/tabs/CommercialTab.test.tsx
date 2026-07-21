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
    const kind = dynamicState.callCount++ === 0 ? 'quotes' : 'invoices';
    return (props: any) => <div data-testid={`${kind}-subview`} data-project-id={props.projectId} />;
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

  it('keeps Quotes and Invoices as lazy subviews behind one owner', () => {
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).toBeNull();
    expect(Array.from(rendered.container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent)).toEqual([
      'Quotes',
      'Invoices',
    ]);
    rendered.unmount();
  });

  it('renders the invoice owner for the invoices compatibility URL', () => {
    search = 'tab=invoices';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="invoices" />);
    expect(rendered.container.querySelector('[data-testid="invoices-subview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="quotes-subview"]')).toBeNull();
    rendered.unmount();
  });

  it('switches to Invoices, clears preview, and preserves quote and unrelated context', () => {
    search = 'tab=quotes&quoteId=q_1&quotePreview=1&createFromEstimateId=est_1&campaign=winter';
    const rendered = renderIntoDocument(<CommercialTab host="host" projectId="proj_1" view="quotes" />);
    const invoices = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((button) => button.textContent === 'Invoices');
    act(() => invoices?.click());

    expect(replace).toHaveBeenCalledWith(
      '/staff/projects/proj_1?tab=invoices&quoteId=q_1&createFromEstimateId=est_1&campaign=winter',
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
});
