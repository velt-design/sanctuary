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

vi.mock('@/components/navigation/SidebarRevealOverlayLab', () => ({
  default: () => <div data-testid="mock-sidebar-overlay">Sidebar overlay</div>,
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
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-overlay"]')).toBeNull();

    rendered.unmount();
  });

  it('renders protected routes with the shell chrome for authenticated users', () => {
    const rendered = renderIntoDocument(
      <PortalShell>
        <div data-testid="child">Protected child</div>
      </PortalShell>,
    );

    expect(rendered.container.querySelector('[data-testid="child"]')?.textContent).toContain('Protected child');
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-rail"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-sidebar-overlay"]')).not.toBeNull();

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
