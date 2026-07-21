import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectPageFrame from './ProjectPageFrame';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ role: 'admin' }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/lib/repo/projectsRepo', () => ({ deleteProject: vi.fn() }));

vi.mock('./ProjectTabNavigation', () => ({
  default: ({ initialTab }: { initialTab: string }) => <nav data-testid="header-tabs" data-tab={initialTab}>Tabs</nav>,
}));

vi.mock('./ProjectPageShell', () => ({
  default: () => <section data-testid="mock-project-shell">Shell</section>,
}));

const snapshot = {
  project: {
    id: 'proj_123',
    name: 'Test project',
    stage: 'lead',
    contactName: 'Alex',
    region: 'North',
    owner: { key: 'jordan', displayName: 'Jordan' },
  },
  pipeline: { stage: 'lead' },
  tasks: { stage: 'lead', items: [] },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe('ProjectPageFrame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses one fixed sticky header with identity, owner, actions, and tab navigation', () => {
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot} host="host" tab="estimates" />);

    expect(rendered.container.querySelector('[data-project-masthead-slot="fixed"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-masthead-slot-sticky="true"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Test project');
    expect(rendered.container.textContent).toContain('Jordan');
    expect(rendered.container.textContent).toContain('Projects');
    expect(rendered.container.textContent).toContain('Design Workbench');
    expect(rendered.container.textContent).toContain('Delete project');
    expect(rendered.container.querySelector('[data-testid="header-tabs"]')?.getAttribute('data-tab')).toBe('estimates');
    expect(rendered.container.querySelector('[data-testid="mock-project-shell"]')).not.toBeNull();
    expect(rendered.container.querySelector('[role="separator"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-pipeline]')).toBeNull();

    rendered.unmount();
  });
});
