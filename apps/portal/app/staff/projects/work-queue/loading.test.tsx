import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import Loading from './loading';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('Work Queue loading frame', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps the filters and queue groups visible before values arrive', () => {
    const rendered = renderIntoDocument(<Loading />);
    const root = rendered.container.querySelector('[data-project-work-queue-state="pending"]');
    expect(root?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(root?.querySelector('[aria-label="Work Queue filters"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Project work queue"]')).not.toBeNull();
    expect(root?.textContent).toContain('Owner');
    expect(root?.textContent).toContain('Stage');
    expect(root?.textContent).toContain('When');
    rendered.unmount();
  });
});
