import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContactsPage from './page';

const loadContactsIndexDataMock = vi.fn();

vi.mock('@/lib/contacts/serverContactsIndex', () => ({
  loadContactsIndexData: (...args: unknown[]) => loadContactsIndexDataMock(...args),
}));

vi.mock('./ContactsIndexClient', () => ({
  default: (props: { initialContacts: Array<{ displayName: string }> }) => (
    <div data-testid="contacts-index">{props.initialContacts.map((contact) => contact.displayName).join(',')}</div>
  ),
}));

describe('ContactsPage', () => {
  it('loads contacts on the server and passes them into the client entrypoint', async () => {
    // PR-PG1 (2026-06-16): server fetch returns `{ rows, totalCount }` now.
    loadContactsIndexDataMock.mockResolvedValue({
      rows: [
        { id: 'ct_1', displayName: 'Alex Mason', email: 'alex@example.com', phone: '', createdAt: '2026-04-03T00:00:00.000Z', updatedAt: '2026-04-03T00:00:00.000Z' },
      ],
      totalCount: 1,
    });

    const ui = (await ContactsPage()) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadContactsIndexDataMock).toHaveBeenCalled();
    expect(markup).toContain('data-testid="contacts-index"');
    expect(markup).toContain('Alex Mason');
  });
});
