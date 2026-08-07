import { afterEach, describe, expect, it, vi } from 'vitest';
import UIFoundationPage from './page';
import { renderIntoDocument } from '../../../../../test/reactHarness';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('/staff/ui-foundation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the live catalogue from reusable foundation components', () => {
    const rendered = renderIntoDocument(<UIFoundationPage />);

    expect(rendered.container.querySelector('[data-ui-foundation="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="ui-foundation"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="ui-foundation-headers"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="ui-foundation-components"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="ui-foundation-patterns"]')).not.toBeNull();
    expect(rendered.container.querySelector('h1')?.textContent).toBe('UI Foundation');
    expect(rendered.container.querySelectorAll('h1')).toHaveLength(1);
    expect(rendered.container.querySelectorAll('h2').length).toBeGreaterThan(0);
    expect(rendered.container.textContent).toContain('Design tokens');
    expect(rendered.container.textContent).toContain('Project stage badges');
    expect(rendered.container.textContent).toContain('Responsive shells');
    expect(rendered.container.textContent).toContain('Search, filters and selection');
    expect(rendered.container.textContent).toContain('Modal, drawer and destructive work');
    expect(rendered.container.querySelectorAll('ol[aria-label="Project stage"] li')).toHaveLength(9);

    rendered.unmount();
  });
});
