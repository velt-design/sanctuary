import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffProjectsPage from './page';
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: vi.fn().mockResolvedValue({ role: 'staff' }) }));

vi.mock('./ProjectsIndexClient', () => ({
  default: () => <div data-testid="projects-index" />,
}));

describe('StaffProjectsPage', () => {
  it('renders the authorized client entrypoint without awaiting project data', async () => {
    const markup = renderToStaticMarkup(await StaffProjectsPage());

    expect(markup).toContain('data-testid="projects-index"');
  });
});
