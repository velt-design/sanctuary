import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalCurrentRouteFrame from './PortalCurrentRouteFrame';

let pathname = '/dashboard';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe('PortalCurrentRouteFrame', () => {
  beforeEach(() => {
    pathname = '/dashboard';
  });

  it('keeps the exact Dashboard frame only for a registered Dashboard route', () => {
    const markup = renderToStaticMarkup(<PortalCurrentRouteFrame />);
    const exactFrameSource = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/components/page-state/PortalExactRouteFrame.tsx'),
      'utf8',
    );

    expect(markup).toContain('data-portal-exact-frame-host="dashboard"');
    expect(exactFrameSource).toContain("case 'dashboard':");
    expect(exactFrameSource).toContain('<DashboardView state="pending" />');
  });

  it('shows a truthful neutral frame for an uncatalogued protected product route', () => {
    pathname = '/staff/not-yet-catalogued';

    const markup = renderToStaticMarkup(<PortalCurrentRouteFrame />);

    expect(markup).toContain('data-portal-route-registration="missing"');
    expect(markup).toContain('Opening portal page...');
    expect(markup).not.toContain('data-portal-exact-frame-host="dashboard"');
    expect(markup).not.toContain('Dashboard');
  });

  it('does not falsely present the declared Sidebar Lab diagnostic route as Dashboard', () => {
    pathname = '/staff/sidebar-lab';

    const markup = renderToStaticMarkup(<PortalCurrentRouteFrame />);

    expect(markup).toContain('data-portal-route-registration="missing"');
    expect(markup).not.toContain('data-portal-exact-frame-host="dashboard"');
  });

  it('does not pull the Dashboard implementation into every route entry', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/components/page-state/PortalCurrentRouteFrame.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/import\s+DashboardView/);
    expect(source).not.toContain("route ?? 'dashboard'");
    expect(source).toContain('if (!route) return <PortalUnregisteredRouteFrame />');
  });
});
