import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalShell from './PortalShell';
import { renderIntoDocument } from '../../../../test/reactHarness';

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
});
