import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContactsPage from './page';

vi.mock('./ContactsIndexClient', () => ({
  default: () => <div data-testid="contacts-index">Contacts client frame</div>,
}));

describe('ContactsPage', () => {
  it('renders the Contacts frame without awaiting a server database read', () => {
    const markup = renderToStaticMarkup(<ContactsPage />);
    expect(markup).toContain('data-testid="contacts-index"');
    expect(markup).toContain('Contacts client frame');
  });
});
