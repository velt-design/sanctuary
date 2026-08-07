import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Loading from './loading';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('Contacts loading frame', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the final Contacts structure with only values pending', () => {
    const rendered = renderIntoDocument(<Loading />);
    const root = rendered.container.querySelector('[data-portal-page-shell="contacts"]');
    expect(root?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(root?.querySelector('[aria-label="Search contacts"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Contacts list"] table')).not.toBeNull();
    expect(root?.textContent).toContain('Rows per page');
    expect(root?.textContent).toContain('Created');
    expect(root?.querySelectorAll('[data-portal-value-slot="loading"]').length).toBeGreaterThan(0);
    rendered.unmount();
  });
});
