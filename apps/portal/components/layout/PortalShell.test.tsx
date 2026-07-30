import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalShell from './PortalShell';
import { dispatchKeyboard, renderIntoDocument } from '../../../../test/reactHarness';
import { act } from 'react';

const replaceMock = vi.fn();

let mockPathname = '/staff/projects';
let mockSearchParams = new URLSearchParams();
let mockSession = {
  status: 'authenticated',
  email: 'ops@example.com',
  role: 'staff' as 'staff' | 'admin',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/navigation/SidebarRail', () => ({
  default: () => <div data-testid="mock-sidebar-rail">Sidebar rail</div>,
}));

vi.mock('@/components/navigation/PortalSidebarPanel', () => ({
  default: () => <div data-testid="mock-pinned-sidebar">Pinned sidebar</div>,
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => mockSession,
}));

describe('PortalShell', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockPathname = '/staff/projects';
    mockSearchParams = new URLSearchParams();
    mockSession = {
      status: 'authenticated',
      email: 'ops@example.com',
      role: 'staff',
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders public routes without portal chrome', () => {
    mockPathname = '/login';
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: 'staff',
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Public child</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toContain('Public child');
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-rail"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();

    rendered.unmount();
  });

  it('renders the project mutation QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/projects-index-mutation-fixture';
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Mutation fixture</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe('Mutation fixture');
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('renders project command centre QA fixture scenarios without auth redirects or portal chrome', () => {
    mockPathname = '/qa/project-command-centre-fixture';
    mockSearchParams = new URLSearchParams('scenario=accepted-newer-estimate');
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Command centre fixture</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe('Command centre fixture');
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('renders the commercial workflow QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/commercial-workflow-fixture';
    mockSearchParams = new URLSearchParams('scenario=retryable&modal=1');
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Commercial workflow fixture</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe(
      'Commercial workflow fixture',
    );
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('renders the project page shell QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/project-page-shell-fixture';
    mockSearchParams = new URLSearchParams('tab=activity');
    mockSession = { status: 'unauthenticated', email: null, role: null } as any;

    const rendered = renderIntoDocument(
      <PortalShell><div data-testid="child">Project shell fixture</div></PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe('Project shell fixture');
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('renders the UI foundation QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/ui-foundation-fixture';
    mockSession = { status: 'unauthenticated', email: null, role: null } as any;

    const rendered = renderIntoDocument(
      <PortalShell><div data-testid="child">UI foundation fixture</div></PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe('UI foundation fixture');
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('renders the email preview workbench QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/email-preview-workbench-fixture';
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Email preview fixture</div>
      </PortalShell>,
    );

    expect(
      rendered.container.querySelector('[data-testid="child"]')?.textContent,
    ).toBe('Email preview fixture');
    expect(
      rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]'),
    ).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('renders the design booklet QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/design-booklet-workbench-fixture';
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Design booklet fixture</div>
      </PortalShell>,
    );

    expect(
      rendered.container.querySelector('[data-testid="child"]')?.textContent,
    ).toBe('Design booklet fixture');
    expect(
      rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]'),
    ).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('renders the project work queue QA fixture without auth redirects or portal chrome', () => {
    mockPathname = '/qa/project-work-queue-fixture';
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Project work queue fixture</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toBe(
      'Project work queue fixture',
    );
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('renders protected routes with the pinned shell chrome for authenticated users', () => {
    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Protected child</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toContain('Protected child');
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-rail"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-sidebar-mode]')?.getAttribute('data-portal-sidebar-mode')).toBe(
      'pinned',
    );
    expect(
      rendered.container
        .querySelector('[data-portal-content-sidebar-mode]')
        ?.getAttribute('data-portal-content-sidebar-mode'),
    ).toBe('pinned');

    rendered.unmount();
  });

  it('renders authenticated design booklets without normal portal chrome', () => {
    mockPathname = '/staff/design-booklets';

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Design booklet workbench</div>
      </PortalShell>,
    );

    expect(
      rendered.container.querySelector('[data-testid="child"]')?.textContent,
    ).toBe('Design booklet workbench');
    expect(
      rendered.container.querySelector('[data-authenticated-standalone-shell]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-sidebar-rail"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-portal-mobile-top-bar]'),
    ).toBeNull();
    rendered.unmount();
  });

  it('renders design workbench routes with rail-only shell chrome', () => {
    mockPathname = '/staff/projects/proj_123/design-workbench';

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Workbench child</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toContain('Workbench child');
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-rail"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-pinned-sidebar"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-sidebar-mode]')?.getAttribute('data-portal-sidebar-mode')).toBe(
      'railOnly',
    );
    expect(
      rendered.container
        .querySelector('[data-portal-content-sidebar-mode]')
        ?.getAttribute('data-portal-content-sidebar-mode'),
    ).toBe('railOnly');

    rendered.unmount();
  });

  it('does not blank protected content or fire a client redirect on first mount', () => {
    mockSession = {
      status: 'unauthenticated',
      email: null,
      role: null,
    } as any;
    mockSearchParams = new URLSearchParams('q=deck');

    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Fallback child</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toContain('Fallback child');
    expect(replaceMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('switches to the real collapsed rail and exposes a focus-managed mobile drawer', () => {
    const rendered = renderIntoDocument(<PortalShell><div>Content</div></PortalShell>);
    const collapse = rendered.container.querySelector('button[aria-label="Collapse sidebar"]') as HTMLButtonElement;
    act(() => collapse.click());
    expect(rendered.container.querySelector('[data-portal-content-sidebar-mode]')?.getAttribute('data-portal-content-sidebar-mode')).toBe('collapsed');
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-rail"]')).not.toBeNull();

    const mobileTrigger = rendered.container.querySelector('button[aria-label="Open portal navigation"]') as HTMLButtonElement;
    mobileTrigger.focus();
    act(() => mobileTrigger.click());
    expect(document.body.querySelector('[data-drawer-panel]')).not.toBeNull();
    dispatchKeyboard(window, 'Escape');
    expect(document.activeElement).toBe(mobileTrigger);
    rendered.unmount();
  });
});
