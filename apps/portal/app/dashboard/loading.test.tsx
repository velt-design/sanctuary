import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Loading from './loading';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('Dashboard loading frame', () => {
  it('shows the complete Dashboard layout with inline loading values and rows', () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-portal-page-shell="dashboard"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('data-dashboard-state="pending"');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Quick actions');
    expect(markup).toContain('Project portfolio');
    expect(markup).toContain('Work Queue');
    expect(markup).toContain('Recent Activity');
    expect(markup).toContain('Recent Estimates');
    expect(markup).toContain('My Tasks');
    expect(markup).toContain('Updating dashboard values...');
    expect(markup).toContain('data-dashboard-loading-rows="true"');
    expect(markup).toContain('data-portal-shell-region="dashboard-hero"');
    expect(markup).toContain('data-portal-shell-region="dashboard-portfolio"');
    expect(markup).toContain('data-portal-shell-region="dashboard-work-queue"');
    expect(markup).toContain('data-portal-shell-region="dashboard-tasks"');
    expect(markup).not.toContain('data-blueprint-loading');
  });
});
