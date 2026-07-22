import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContactsPage from './page';

vi.mock('./ContactsIndexClient', () => ({
  default: ({ initialQuery }: { initialQuery?: string }) => <div data-testid="contacts-index" data-initial-query={initialQuery}>Contacts client frame</div>,
}));

describe('ContactsPage', () => {
  it('renders the Contacts frame without awaiting a server database read', async () => {
    const markup = renderToStaticMarkup(await ContactsPage({}));
    expect(markup).toContain('data-testid="contacts-index"');
    expect(markup).toContain('Contacts client frame');
  });

  it('passes a global-search query into the existing local filter', async () => {
    const markup = renderToStaticMarkup(await ContactsPage({ searchParams: Promise.resolve({ q: 'Alex' }) }));
    expect(markup).toContain('data-initial-query="Alex"');
  });
});
