import { act } from 'react';
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
  default: ({ initialTab, optimisticTab, onTabSelect }: any) => (
    <nav data-testid="header-tabs" data-tab={initialTab} data-optimistic-tab={optimisticTab ?? ''}>
      <button type="button" onClick={() => onTabSelect?.('job-packs')}>Job Packs</button>
    </nav>
  ),
}));

vi.mock('./ProjectPageShell', () => ({
  default: ({ optimisticTab }: any) => (
    <section data-testid="mock-project-shell" data-optimistic-tab={optimisticTab ?? ''}>Shell</section>
  ),
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
    expect(rendered.container.textContent).not.toContain('Alex');
    expect(rendered.container.textContent).not.toContain('North');
    expect(rendered.container.textContent).toContain('Projects');
    expect(rendered.container.textContent).toContain('Design Workbench');
    expect(rendered.container.textContent).toContain('More');
    expect(rendered.container.textContent).not.toContain('Delete project');
    expect(rendered.container.querySelector('[data-testid="header-tabs"]')?.getAttribute('data-tab')).toBe('estimates');
    expect(rendered.container.querySelector('[data-testid="mock-project-shell"]')).not.toBeNull();
    expect(rendered.container.querySelector('[role="separator"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-pipeline]')).toBeNull();

    rendered.unmount();
  });

  it('opens and dismisses the accessible project actions menu with the keyboard', () => {
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot} host="host" tab="estimates" />);
    const moreButton = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'More');
    expect(moreButton?.getAttribute('aria-haspopup')).toBe('menu');

    act(() => moreButton?.click());
    const menu = rendered.container.querySelector('[role="menu"]');
    expect(menu?.getAttribute('aria-label')).toBe('Project actions');
    expect(menu?.textContent).toContain('Delete project');

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(rendered.container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(moreButton);

    rendered.unmount();
  });

  it('shares optimistic tab intent between the masthead and body', () => {
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot} host="host" tab="activity" />);
    const jobPacks = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Job Packs');

    act(() => jobPacks?.click());

    expect(rendered.container.querySelector('[data-testid="header-tabs"]')?.getAttribute('data-optimistic-tab')).toBe('job-packs');
    expect(rendered.container.querySelector('[data-testid="mock-project-shell"]')?.getAttribute('data-optimistic-tab')).toBe('job-packs');
    rendered.unmount();
  });
});
