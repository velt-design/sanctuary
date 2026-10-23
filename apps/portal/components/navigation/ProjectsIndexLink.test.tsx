import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsIndexLink from './ProjectsIndexLink';
import { renderIntoDocument } from '../../../../test/reactHarness';

const routerPrefetch = vi.fn();
const routerReplace = vi.fn();
const prefetchQuery = vi.fn();
const fetchQuery = vi.fn();
const getQueryData = vi.fn();
const privateQuery = vi.fn();
const privateApi = vi.fn();
const beginInstantRoute = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: routerPrefetch, replace: routerReplace }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ prefetchQuery, fetchQuery, getQueryData }),
    useQuery: (...args:unknown[]) => privateQuery(...args),
  };
});

vi.mock('@/lib/repo/apiClient',async original=>({...await original<typeof import('@/lib/repo/apiClient')>(),apiJson:(...args:unknown[])=>privateApi(...args)}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://tenant.supabase.co',
  supabaseHostFromUrl: () => 'tenant',
}));

vi.mock('@/components/page-state/PortalRouteTransition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/page-state/PortalRouteTransition')>();
  return {
    ...actual,
    usePortalRouteTransition: () => ({ beginInstantRoute }),
  };
});

describe('ProjectsIndexLink', () => {
  beforeEach(() => {
    routerPrefetch.mockReset();
    routerReplace.mockReset();
    prefetchQuery.mockReset();fetchQuery.mockReset();getQueryData.mockReset();privateQuery.mockReset();privateApi.mockReset();
    beginInstantRoute.mockReset();
    window.history.replaceState(null, '', '/dashboard');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['mouseover', 'focusin', 'pointerdown', 'touchstart'])('prepares the exact route without private records on %s intent', (eventName) => {
    const rendered = renderIntoDocument(
      <ProjectsIndexLink href="/staff/projects?archive=archived">Projects</ProjectsIndexLink>,
    );
    const link = rendered.container.querySelector('a');

    act(() => link?.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));

    expect(routerPrefetch).toHaveBeenCalledExactlyOnceWith('/staff/projects?archive=archived');
    expect(link?.getAttribute('href')).toBe('/staff/projects?archive=archived');
    expect(prefetchQuery).not.toHaveBeenCalled();expect(fetchQuery).not.toHaveBeenCalled();expect(getQueryData).not.toHaveBeenCalled();expect(privateQuery).not.toHaveBeenCalled();expect(privateApi).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/dashboard');expect(routerReplace).not.toHaveBeenCalled();expect(beginInstantRoute).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('changes the accepted URL once, preserves native Back/Forward and finishes with the exact background replace', async () => {
    const rendered = renderIntoDocument(<ProjectsIndexLink href="/staff/projects?status=NEW">Projects</ProjectsIndexLink>);
    const link = rendered.container.querySelector('a');

    const originalHref=window.location.href,originalLength=window.history.length;
    const push=vi.spyOn(window.history,'pushState');
    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));

    expect(window.location.pathname).toBe('/staff/projects');
    expect(window.location.search).toContain('__portal_opening=projects-index');
    expect(beginInstantRoute).toHaveBeenCalledExactlyOnceWith('projects-index',{href:'/staff/projects?status=NEW'});
    expect(push).toHaveBeenCalledExactlyOnceWith(null,'','/staff/projects?status=NEW&__portal_opening=projects-index');
    expect(window.history.length).toBe(originalLength+1);expect(window.location.href).toBe(new URL('/staff/projects?status=NEW&__portal_opening=projects-index',originalHref).href);
    expect(link?.getAttribute('href')).toBe('/staff/projects?status=NEW');
    expect(routerReplace).toHaveBeenCalledExactlyOnceWith('/staff/projects?status=NEW', { scroll: false });
    const openingHref=window.location.href;
    const traverse=async(direction:'back'|'forward')=>{await act(async()=>{const popped=new Promise<void>(resolve=>window.addEventListener('popstate',()=>resolve(),{once:true}));window.history[direction]();await popped;});};
    await traverse('back');expect(window.location.href).toBe(originalHref);
    await traverse('forward');expect(window.location.href).toBe(openingHref);expect(push).toHaveBeenCalledOnce();expect(routerReplace).toHaveBeenCalledOnce();
    expect(prefetchQuery).not.toHaveBeenCalled();expect(fetchQuery).not.toHaveBeenCalled();expect(getQueryData).not.toHaveBeenCalled();expect(privateQuery).not.toHaveBeenCalled();expect(privateApi).not.toHaveBeenCalled();
    push.mockRestore();rendered.unmount();
  });

  it('preserves target=_blank navigation', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexLink href="/staff/projects" target="_blank">Projects</ProjectsIndexLink>,
    );
    const link = rendered.container.querySelector('a');

    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));

    expect(routerReplace).not.toHaveBeenCalled();
    expect(beginInstantRoute).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
