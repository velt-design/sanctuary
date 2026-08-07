import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Loading from './loading';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('Schedule loading frame', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps Board controls, Unscheduled and installer lanes visible', () => {
    const rendered = renderIntoDocument(<Loading />);
    const root = rendered.container.querySelector('[data-portal-page-shell="schedule"]');
    expect(root?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(root?.querySelector('[aria-label="Unscheduled jobs"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Installer lanes"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Collapse unscheduled panel"]')).not.toBeNull();
    expect(root?.textContent).toContain('Board');
    expect(root?.textContent).toContain('Gantt');
    rendered.unmount();
  });
});
