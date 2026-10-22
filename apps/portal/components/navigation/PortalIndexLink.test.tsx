import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalIndexLink from './PortalIndexLink';
import { contactsIndexQueryOptions } from '@/lib/queries/contactsIndex';
import { renderIntoDocument } from '../../../../test/reactHarness';

const routerPrefetch = vi.fn();
const routerReplace = vi.fn();
const prefetchQuery = vi.fn();
const beginInstantRoute = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, prefetch, ...props }: any) => <a data-next-prefetch={String(prefetch)} {...props}>{children}</a>,
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
  return { ...actual, usePortalRouteTransition: () => ({ beginInstantRoute }) };
});

describe('PortalIndexLink Contacts navigation', () => {
  beforeEach(() => {
    routerPrefetch.mockReset();
    routerReplace.mockReset();
    prefetchQuery.mockReset();
    beginInstantRoute.mockReset();
    window.history.replaceState(null, '', '/dashboard');
  });
  afterEach(() => { document.body.innerHTML = ''; });

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

  it.each(['mouseover', 'focusin', 'pointerdown', 'touchstart'])('warms only the non-index route on %s, preserving its exact selection', (eventName) => {
    const href = '/staff/projects/proj_demo?tab=estimates&estimateId=est_demo&returnTo=%2Fdashboard#price';
    const view = renderIntoDocument(<PortalIndexLink href={href}>Saved estimate</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(href);
    expect(link.dataset.nextPrefetch).toBe('false');
    expect(routerPrefetch).not.toHaveBeenCalled();
    act(() => link.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));
    expect(routerPrefetch).toHaveBeenCalledExactlyOnceWith(href);
    expect(prefetchQuery).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginInstantRoute).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each([
    'https://external.example/route', '#notes', 'mailto:demo@example.com', '/dashboard#notes',
    '/api/staff/v1/invoices/inv_demo/inspect', '/login/callback?code=fictional',
    '/staff/api/command', '/staff/auth/callback', '/staff/login/callback', '/staff/logout',
    '/quotes/quote_demo',
  ])('does not start new route work for %s', (href) => {
    const view = renderIntoDocument(<PortalIndexLink href={href}>Other link</PortalIndexLink>);
    for (const eventName of ['mouseover', 'focusin', 'pointerdown', 'touchstart']) {
      act(() => view.container.querySelector('a')!.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));
    }
    expect(routerPrefetch).not.toHaveBeenCalled();
    expect(prefetchQuery).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each([undefined, 'secondary'] as const)('does not prefetch or navigate a disabled link (%s)', (variant) => {
    const view = renderIntoDocument(<PortalIndexLink href="/staff/projects" variant={variant} disabled>Cancel</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    for (const eventName of ['mouseover', 'focusin', 'pointerdown', 'touchstart']) {
      act(() => link.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));
    }
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => link.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    expect(routerPrefetch).not.toHaveBeenCalled();
    expect(prefetchQuery).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
    view.unmount();
  });

  it('chains intent handlers and can prepare after an owner cancellation clears', () => {
    const cancel = (event: { preventDefault(): void }) => event.preventDefault();
    const handlers = { onMouseEnter: vi.fn(cancel), onFocus: vi.fn(cancel), onPointerDown: vi.fn(cancel), onTouchStart: vi.fn(cancel) };
    const view = renderIntoDocument(<PortalIndexLink href="/staff/schedule?view=gantt" {...handlers}>Schedule</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    for (const eventName of ['mouseover', 'focusin', 'pointerdown', 'touchstart']) {
      act(() => link.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));
    }
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
    expect(routerPrefetch).not.toHaveBeenCalled();
    view.rerender(<PortalIndexLink href="/staff/schedule?view=gantt">Schedule</PortalIndexLink>);
    act(() => link.dispatchEvent(new Event('focusin', { bubbles: true, cancelable: true })));
    expect(routerPrefetch).toHaveBeenCalledExactlyOnceWith('/staff/schedule?view=gantt');
    view.unmount();
  });

  it('keeps explicit prefetch control and the current href after a source switch', () => {
    const view = renderIntoDocument(<PortalIndexLink href="/staff/schedule?view=board" prefetch>Schedule</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    expect(link.dataset.nextPrefetch).toBe('true');
    view.rerender(<PortalIndexLink href="/staff/schedule?view=gantt#today" prefetch={false}>Schedule</PortalIndexLink>);
    expect(link.dataset.nextPrefetch).toBe('false');
    act(() => link.dispatchEvent(new Event('mouseover', { bubbles: true, cancelable: true })));
    expect(routerPrefetch).toHaveBeenCalledExactlyOnceWith('/staff/schedule?view=gantt#today');
    view.unmount();
  });

  it('leaves non-index dirty guards, modified clicks and native targets with the native owner', () => {
    const cancelled = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const view = renderIntoDocument(<PortalIndexLink href="/staff/schedule?view=gantt" onClick={cancelled}>Schedule</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => link.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    expect(cancelled).toHaveBeenCalledTimes(1);
    view.rerender(<PortalIndexLink href="/staff/schedule?view=gantt" target="_blank">Schedule</PortalIndexLink>);
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    act(() => link.dispatchEvent(modified));
    expect(modified.defaultPrevented).toBe(false);
    expect(link.target).toBe('_blank');
    expect(window.location.pathname).toBe('/dashboard');
    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginInstantRoute).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each([{ target: '_blank' }, { download: '' }])('retains native target/download without route preparation: %j', (props) => {
    const view = renderIntoDocument(<PortalIndexLink href="/staff/schedule" {...props}>Schedule</PortalIndexLink>);
    act(() => view.container.querySelector('a')!.dispatchEvent(new Event('focusin', { bubbles: true, cancelable: true })));
    expect(routerPrefetch).not.toHaveBeenCalled();
    expect(prefetchQuery).not.toHaveBeenCalled();
    view.unmount();
  });

  it('forwards the anchor ref, class, aria and selected source without replacing the native node', () => {
    const ref = { current: null as HTMLAnchorElement | null };
    const view = renderIntoDocument(<PortalIndexLink ref={ref} href="/staff/calculator?draft=A#sheet" className="original" aria-label="Open saved sheet">Sheet</PortalIndexLink>);
    const link = view.container.querySelector('a')!;
    expect(ref.current).toBe(link);
    expect(link.className).toBe('original');
    expect(link.getAttribute('aria-label')).toBe('Open saved sheet');
    view.rerender(<PortalIndexLink ref={ref} href="/staff/calculator?draft=B#plan" className="original" aria-label="Open saved plan">Plan</PortalIndexLink>);
    expect(ref.current).toBe(link);
    expect(link.getAttribute('href')).toBe('/staff/calculator?draft=B#plan');
    view.unmount();
    expect(ref.current).toBeNull();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('preserves index modified clicks: %j', (modifier) => {
    const view = renderIntoDocument(<PortalIndexLink href="/staff/contacts?search=demo#records">Contacts</PortalIndexLink>);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...modifier });
    act(() => view.container.querySelector('a')!.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(false);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginInstantRoute).not.toHaveBeenCalled();
    view.unmount();
  });
});
