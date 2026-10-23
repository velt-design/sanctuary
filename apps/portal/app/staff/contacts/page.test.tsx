vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: vi.fn(async () => ({ user: { id: 'fixture' }, role: 'staff' })) }));
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContactsPage from './page';

// Mock the actual guarded leaf boundary, leaving its installed React.lazy target
// to the separate connected/compiled code-arrival checks.
vi.mock('./GuardedContactsIndexClient', () => ({
  default: ({ initialQuery }: { initialQuery?: string }) => <div data-testid="contacts-index" data-initial-query={initialQuery}>Contacts client frame</div>,
}));

describe('ContactsPage', () => {
  it('delivers the guarded Contacts boundary without awaiting a server database read', async () => {
    const markup = renderToStaticMarkup(await ContactsPage({}));
    expect(markup).toContain('data-testid="contacts-index"');
    expect(markup).toContain('Contacts client frame');
  });

  it('passes a global-search query into the existing local filter', async () => {
    const markup = renderToStaticMarkup(await ContactsPage({ searchParams: Promise.resolve({ q: 'Alex' }) }));
    expect(markup).toContain('data-initial-query="Alex"');
  });
});
