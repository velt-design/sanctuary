import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalIndexLink from './PortalIndexLink';
import { contactsIndexQueryOptions } from '@/lib/queries/contactsIndex';
import { renderIntoDocument } from '../../../../test/reactHarness';

const routerPrefetch = vi.fn();
const routerReplace = vi.fn();
const prefetchQuery = vi.fn();
const beginInstantRoute = vi.fn();
const beginRouteTransition = vi.fn();

function setNavigatorOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: routerPrefetch, replace: routerReplace }),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQueryClient: () => ({ prefetchQuery }) };
});
vi.mock('@/components/page-state/PortalRouteTransition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/page-state/PortalRouteTransition')>();
  return {
    ...actual,
    usePortalRouteTransition: () => ({ beginInstantRoute, beginRouteTransition }),
  };
});

describe('PortalIndexLink Contacts navigation', () => {
  beforeEach(() => {
    routerPrefetch.mockReset();
    routerReplace.mockReset();
    prefetchQuery.mockReset();
    beginInstantRoute.mockReset();
    beginRouteTransition.mockReset();
    setNavigatorOnline(true);
    window.history.replaceState(null, '', '/dashboard');
  });
  afterEach(() => {
    document.body.innerHTML = '';
    setNavigatorOnline(true);
  });

  it.each(['mouseover', 'focusin', 'pointerdown', 'touchstart'])('preloads Contacts route and data on %s intent', (eventName) => {
    const rendered = renderIntoDocument(<PortalIndexLink href="/staff/contacts">Contacts</PortalIndexLink>);
    act(() => rendered.container.querySelector('a')?.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));
    expect(routerPrefetch).toHaveBeenCalledWith('/staff/contacts');
    expect(prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: contactsIndexQueryOptions().queryKey,
    }));
    rendered.unmount();
  });

  it('changes the Contacts URL immediately and completes with background replace', () => {
    const rendered = renderIntoDocument(<PortalIndexLink href="/staff/contacts">Contacts</PortalIndexLink>);
    act(() => rendered.container.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    expect(window.location.pathname).toBe('/staff/contacts');
    expect(window.location.search).toContain('__portal_opening=contacts-index');
    expect(beginInstantRoute).toHaveBeenCalledWith('contacts-index');
    expect(routerReplace).toHaveBeenCalledWith('/staff/contacts', { scroll: false });
    rendered.unmount();
  });

  it('preserves new-tab and modified navigation', () => {
    const rendered = renderIntoDocument(<PortalIndexLink href="/staff/contacts" target="_blank">Contacts</PortalIndexLink>);
    act(() => rendered.container.querySelector('a')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginInstantRoute).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('can use a foundation button treatment without changing instant navigation', () => {
    const rendered = renderIntoDocument(<PortalIndexLink href="/staff/contacts" variant="secondary">Contacts</PortalIndexLink>);
    const link = rendered.container.querySelector('a');
    expect(link?.textContent).toBe('Contacts');
    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    expect(beginInstantRoute).toHaveBeenCalledWith('contacts-index');
    expect(routerReplace).toHaveBeenCalledWith('/staff/contacts', { scroll: false });
    rendered.unmount();
  });

  it('uses the offline shell instead of the live index shortcut when disconnected', () => {
    setNavigatorOnline(false);
    const rendered = renderIntoDocument(
      <PortalIndexLink href="/staff/contacts">Contacts</PortalIndexLink>,
    );
    const link = rendered.container.querySelector('a');

    const navigationAccepted = link?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(navigationAccepted).toBe(false);
    expect(beginInstantRoute).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginRouteTransition).toHaveBeenCalledTimes(1);
    expect(beginRouteTransition).toHaveBeenCalledWith(expect.objectContaining({
      href: '/staff/contacts',
      source: 'portal-route-link',
      control: link,
    }));
    rendered.unmount();
  });
});
