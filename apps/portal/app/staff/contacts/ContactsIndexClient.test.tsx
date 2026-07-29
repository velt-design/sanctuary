import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsIndexClient from './ContactsIndexClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const retry = vi.fn();
const finishInstantRoute = vi.fn();
const useContactsIndexData = vi.fn();
const contact = {
  id: 'ct_1',
  displayName: 'Alex Mason',
  email: 'alex@example.com',
  phone: '021',
  createdAt: '2026-04-03T00:00:00.000Z',
  updatedAt: '2026-04-03T00:00:00.000Z',
};

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));
vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({ finishInstantRoute }),
}));
vi.mock('./ContactsImportAction', () => ({
  default: () => <button type="button">Import CSV</button>,
}));
vi.mock('./useContactsIndexData', () => ({
  useContactsIndexData: (...args: unknown[]) => useContactsIndexData(...args),
}));

function indexResult(
  state: 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable',
  rows = state === 'pending' || state === 'unavailable' ? [] : [contact],
  search = '',
) {
  return {
    state,
    data: state === 'pending' || state === 'unavailable' ? undefined : {
      contacts: {
        rows,
        totalCount: rows.length,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      query: { search, sort: 'name_asc' },
      generatedAt: state === 'fresh' ? 'fresh' : 'cached',
    },
    error: state === 'refresh-failed' ? new Error('offline') : null,
    retry,
    backgroundReady: state === 'fresh',
  };
}

describe('ContactsIndexClient', () => {
  beforeEach(() => {
    retry.mockReset();
    finishInstantRoute.mockReset();
    useContactsIndexData.mockReset();
    useContactsIndexData.mockImplementation((params: { search?: string }) =>
      params.search
        ? indexResult('fresh', [], params.search)
        : indexResult('fresh'));
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('renders fresh contacts and dismisses the instant pending frame', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.querySelector('[data-contacts-index-state="fresh"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Alex Mason');
    expect(rendered.container.textContent).not.toContain('Updating contacts');
    expect(finishInstantRoute).toHaveBeenCalledWith('contacts-index');
    rendered.unmount();
  });

  it.each(['pending', 'cached'] as const)('shows a truthful updating state for %s data', (state) => {
    useContactsIndexData.mockReturnValue(indexResult(state));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain(state === 'pending' ? 'Updating contacts...' : 'Updating...');
    expect(rendered.container.textContent).not.toContain('No contacts found.');
    rendered.unmount();
  });

  it('retains cached rows and offers Retry after a refresh failure', () => {
    useContactsIndexData.mockReturnValue(indexResult('refresh-failed'));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('Alex Mason');
    expect(rendered.container.textContent).toContain('Could not refresh contacts');
    const retryButton = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry');
    act(() => retryButton?.click());
    expect(retry).toHaveBeenCalled();
    rendered.unmount();
  });

  it('hides cached content when access ends', () => {
    useContactsIndexData.mockReturnValue(indexResult('unavailable'));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('Contacts unavailable');
    expect(rendered.container.textContent).not.toContain('Alex Mason');
    rendered.unmount();
  });

  it('shows the genuine empty state only after a successful fresh response', () => {
    useContactsIndexData.mockReturnValue(indexResult('fresh', []));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('No contacts found.');
    rendered.unmount();
  });

  it('does not claim to show or update a saved list when the first refresh fails', () => {
    useContactsIndexData.mockReturnValue(indexResult('refresh-failed', []));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('No saved list is available. Retry the request.');
    expect(rendered.container.textContent).not.toContain('Showing the last saved list.');
    expect(rendered.container.textContent).not.toContain('Updating contacts...');
    rendered.unmount();
  });

  it('hands a global-search query to the server-backed index', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient initialQuery="missing" />);
    expect((rendered.container.querySelector('#contactSearch') as HTMLInputElement).value).toBe('missing');
    expect(useContactsIndexData).toHaveBeenCalledWith(expect.objectContaining({ search: 'missing' }));
    expect(rendered.container.textContent).toContain('No contacts match your search.');
    expect(rendered.container.textContent).not.toContain('Alex Mason');
    rendered.unmount();
  });
});
