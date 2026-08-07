import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Loading from './loading';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('Admin Access loading frame', () => {
  it('keeps the real account and crew structure visible while crew values load', () => {
    const rendered = renderIntoDocument(<Loading />);

    expect(rendered.container.querySelector('[data-portal-page-shell="admin-access"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="admin-access-user"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="admin-access-crews"]')).not.toBeNull();
    expect(rendered.container.querySelector('table[aria-busy]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Schedule crews table"][aria-busy="true"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Set temp password');
    expect(rendered.container.textContent).toContain('Board jobs');
    expect(rendered.container.querySelectorAll('[data-portal-value-slot="loading"]')).toHaveLength(1);

    rendered.unmount();
  });
});
