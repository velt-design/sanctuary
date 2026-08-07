import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Loading from './loading';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('Admin Imports loading frame', () => {
  it('keeps the real import summary structure visible with inline values', () => {
    const rendered = renderIntoDocument(<Loading />);

    expect(rendered.container.querySelector('[data-portal-page-shell="admin-imports"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="admin-imports-header"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="admin-imports-summary"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Select JSON files');
    expect(rendered.container.textContent).toContain('Schedule items');
    expect(rendered.container.querySelectorAll('[data-portal-value-slot="loading"]')).toHaveLength(7);

    rendered.unmount();
  });
});
