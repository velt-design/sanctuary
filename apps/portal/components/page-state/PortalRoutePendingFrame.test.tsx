import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import PortalRoutePendingFrame from './PortalRoutePendingFrame';
import { PORTAL_INSTANT_ROUTE_DEFINITIONS } from '@/lib/portalInstantRoutes';

describe('PortalRoutePendingFrame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(Object.values(PORTAL_INSTANT_ROUTE_DEFINITIONS).map((entry) => [entry.route, entry.title] as const))(
    'renders the registered %s shell synchronously',
    (route, title) => {
      const rendered = renderIntoDocument(<PortalRoutePendingFrame route={route} />);
      expect(rendered.container.querySelector(`[data-portal-instant-shell="${route}"]`)).not.toBeNull();
      expect(rendered.container.querySelector('h1')?.textContent).toBe(title);
      expect(rendered.container.querySelector('[role="status"]')?.textContent).toBeTruthy();
      rendered.unmount();
    },
  );

  it('uses a known project label without pretending project data is fresh', () => {
    const rendered = renderIntoDocument(<PortalRoutePendingFrame route="project-detail" label="Beach House" />);
    expect(rendered.container.querySelector('h1')?.textContent).toBe('Beach House');
    expect(rendered.container.querySelector('[data-portal-instant-shell-state]')?.getAttribute('data-portal-instant-shell-state')).toBe('pending');
    rendered.unmount();
  });
});
