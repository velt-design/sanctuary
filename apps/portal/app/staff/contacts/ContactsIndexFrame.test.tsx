import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {contactsRecordSlots} from './contactsRecordSlots';
import ContactsIndexFrame, { type ContactsIndexFrameRead } from './ContactsIndexFrame';
import { renderIntoDocument } from '../../../../../test/reactHarness';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
// A pending frame must not need the private read module, QueryClient or session.
vi.mock('./useContactsIndexData', () => ({
  useContactsIndexData: () => { throw new Error('A frame cannot read contacts'); },
}));

const pending: ContactsIndexFrameRead = {
  state: 'pending', backgroundReady: false, retry: vi.fn(),
};
const fresh: ContactsIndexFrameRead = {
  state: 'fresh', backgroundReady: true, retry: vi.fn(),
  data: {
    contacts: {
      rows: [{ id: 'ct_fictional', displayName: 'Fictional Contact', email: 'fictional@example.test',
        phone: '', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }],
      totalCount: 1, truncated: false, page: 1, pageSize: 50, totalPages: 1,
    },
    query: { search: '', sort: 'name_asc' }, generatedAt: '2026-10-23T00:00:00Z',
  },
};

function Frame({ read = pending }: { read?: ContactsIndexFrameRead }) {
  const [query, setQuery] = useState('');
  return <ContactsIndexFrame query={query} debouncedQuery={query} page={1} pageSize={50}
    sort="name_asc" setQuery={setQuery} setPage={vi.fn()} setPageSize={vi.fn()}
    setSort={vi.fn()} contactsIndex={read} {...contactsRecordSlots(read,1,50,vi.fn())}/>;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('Contacts actual frame', () => {
  it('mounts useful public controls and columns without any private read owner', () => {
    const view = renderIntoDocument(<Frame />);
    expect(view.container.querySelector('h1')?.textContent).toBe('Contacts');
    expect(view.container.querySelector('thead')?.textContent).toContain('Email');
    expect(view.container.querySelector<HTMLInputElement>('#contactSearch')?.disabled).toBe(false);
    expect(view.container.textContent).toContain('Reading contacts');
    expect(view.container.textContent).not.toContain('No contacts found');
    expect(view.container.textContent).not.toContain('Fictional Contact');
    expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
    view.unmount();
  });

  it('keeps the same real nodes and typed selection when genuine evidence arrives or ends', () => {
    const view = renderIntoDocument(<Frame />);
    const input = view.container.querySelector<HTMLInputElement>('#contactSearch')!;
    const table = view.container.querySelector('table');
    const columns = Array.from(table!.querySelectorAll('thead th'));
    expect(columns).toHaveLength(5);
    const viewport = table!.parentElement;
    const status = view.container.querySelector('[role="status"]');
    const heading = view.container.querySelector('h1');
    const previous = view.container.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!;
    const next = view.container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!;
    expect(previous.disabled).toBe(true); expect(next.disabled).toBe(true);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Fictional');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    view.rerender(<Frame read={fresh} />);
    expect(view.container.textContent).toContain('Fictional Contact');
    expect(view.container.querySelector('table')).toBe(table);
    expect(table?.parentElement).toBe(viewport);
    expect(Array.from(table!.querySelectorAll('thead th'))).toEqual(columns);
    expect(status?.isConnected).toBe(true);
    expect(view.container.querySelector('h1')).toBe(heading);
    expect(view.container.querySelector('[aria-label="Previous page"]')).toBe(previous);
    expect(view.container.querySelector('[aria-label="Next page"]')).toBe(next);
    expect(view.container.querySelector('#contactSearch')).toBe(input);
    expect(input.value).toBe('Fictional');
    view.rerender(<Frame read={{ ...pending, state: 'unavailable' }} />);
    expect(view.container.textContent).toContain('Contacts unavailable');
    expect(view.container.textContent).not.toContain('Fictional Contact');
    expect(view.container.querySelector('table')).toBe(table);
    expect(input.value).toBe('Fictional');
    view.unmount();
  });
});
