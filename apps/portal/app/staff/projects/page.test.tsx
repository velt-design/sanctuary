import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffProjectsPage from './page';
import { requireStaffPageAccess } from '@/lib/auth';
import { loadProjectsIndexInitialRead } from './loadProjectsIndexInitialRead';
import { headers } from 'next/headers';
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: vi.fn() }));
vi.mock('./loadProjectsIndexInitialRead', () => ({ loadProjectsIndexInitialRead: vi.fn() }));

vi.mock('./ProjectsIndexClient', () => ({
  default: () => <div data-testid="projects-index" />,
}));

describe('StaffProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaffPageAccess).mockResolvedValue({ role: 'staff', user: { id: 'staff-a' } } as never);
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-portal-document-callback': '/staff/projects' }) as never);
  });
  it('renders the authorized client entrypoint without awaiting project data', async () => {
    const markup = renderToStaticMarkup(await StaffProjectsPage({}));

    expect(markup).toContain('data-testid="projects-index"');
  });

  it('starts the normalized URL read only after the fresh access gate settles', async () => {
    let authorize!: (value: never) => void;
    vi.mocked(requireStaffPageAccess).mockReturnValue(new Promise(resolve => { authorize = resolve; }));
    const page = StaffProjectsPage({ searchParams: Promise.resolve({
      q: '  garden  ', stage: 'sent', status: 'new', owner: 'ALL', archive: 'archived',
      state: 'open', sort: 'name_asc', page: '2', pageSize: '25', context: 'keep',
    }) });
    await Promise.resolve();
    expect(loadProjectsIndexInitialRead).not.toHaveBeenCalled();
    authorize({ role: 'staff', user: { id: 'staff-a' } } as never);
    await page;
    expect(loadProjectsIndexInitialRead).toHaveBeenCalledWith('staff-a', expect.objectContaining({
      search: 'garden', status: 'SENT', owner: 'all', archive: 'active', state: 'OPEN', page: 2, pageSize: 25,
    }));
  });

  it('does not start or serialize a private read when the gate denies access', async () => {
    vi.mocked(requireStaffPageAccess).mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(StaffProjectsPage({})).rejects.toThrow('NEXT_REDIRECT');
    expect(loadProjectsIndexInitialRead).not.toHaveBeenCalled();
  });

  it('leaves ordinary RSC navigation and prefetch on the existing API path', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    expect(renderToStaticMarkup(await StaffProjectsPage({}))).toContain('data-testid="projects-index"');
    expect(requireStaffPageAccess).toHaveBeenCalled();
    expect(loadProjectsIndexInitialRead).not.toHaveBeenCalled();
  });
});
