import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDetailPage from './page';
const scheduling = vi.hoisted(() => ({ headers: new Headers(), load: vi.fn(), gate: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => scheduling.headers }));
vi.mock('./loadProjectWorkInitialRead', () => ({ loadProjectWorkInitialRead: scheduling.load }));
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: scheduling.gate }));
beforeEach(() => {
  scheduling.headers = new Headers(); scheduling.load.mockReset();
  scheduling.gate.mockReset().mockResolvedValue({ role: 'staff', user: { id: 'staff-a' } });
});

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./ProjectSnapshotPageClient', () => ({
  default: (props: { projectId: string; tab: string; estimateId: string | null; calculatorWorkspace: boolean; debugExportEnabled: boolean }) => (
    <div
      data-testid="project-page"
      data-project-id={props.projectId}
      data-tab={props.tab}
      data-estimate-id={props.estimateId ?? ''}
      data-calculator-workspace={String(props.calculatorWorkspace)}
      data-debug-enabled={String(props.debugExportEnabled)}
    />
  ),
}));

describe('ProjectDetailPage', () => {
  it('starts only a matching Work document read after the fresh gate', async () => {
    const id = 'proj_11111111-1111-4111-8111-111111111111';
    scheduling.headers.set('x-portal-document-callback', `/staff/projects/${id}?tab=activity`);
    scheduling.load.mockImplementation(() => {
      expect(scheduling.gate).toHaveBeenCalledWith(`/staff/projects/${id}`);
      return undefined;
    });
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    expect(scheduling.load).toHaveBeenCalledWith(id, { userId: 'staff-a', isAdmin: false });
    scheduling.load.mockClear();
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }), searchParams: Promise.resolve({ tab: 'estimates' }) });
    scheduling.headers = new Headers();
    await ProjectDetailPage({ params: Promise.resolve({ projectId: id }) });
    expect(scheduling.load).not.toHaveBeenCalled();
  });

  it('returns the actual client while every request-owned document result is still unsettled', async () => {
    const id='proj_11111111-1111-4111-8111-111111111111';
    scheduling.headers.set('x-portal-document-callback', `/staff/projects/${id}?tab=activity`);
    const pending=new Promise(()=>{});
    const initial={id:'fictional-read',ownerId:'staff-a',host:'fixture',projectId:id,results:{summary:pending,snapshot:pending,command:pending,payment:pending}};
    scheduling.load.mockReturnValue(initial);
    const page=await ProjectDetailPage({params:Promise.resolve({projectId:id})});
    expect((page.props.children as ReactElement<{initialRead:unknown}>).props.initialRead).toBe(initial);
    expect(scheduling.gate).toHaveBeenCalledTimes(1);
  });

  it('never starts private reads when the page gate rejects', async () => {
    scheduling.gate.mockRejectedValue(new Error('denied'));
    await expect(ProjectDetailPage({ params: Promise.resolve({ projectId: 'proj_1' }) })).rejects.toThrow('denied');
    expect(scheduling.load).not.toHaveBeenCalled();
  });
  it('renders an unavailable state for invalid ids', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: '   ' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
  });

  it('passes route state to the client without blocking on the project snapshot', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'quotes', estimateId: 'est_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="quotes"');
    expect(markup).toContain('data-estimate-id="est_1"');
    expect(markup).toContain('data-calculator-workspace="false"');
  });

  it('selects the focused calculator workspace only for explicit Estimates intent', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'estimates', fromEstimateId: 'est_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-calculator-workspace="true"');
  });

  it('preserves a direct Files workspace entry', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'files' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="files"');
  });

  it('coerces the retired Emails tab back to activity', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'emails' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="activity"');
  });

  it('accepts invoices through the shared project-tab contract', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'invoices' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="invoices"');
  });
});
