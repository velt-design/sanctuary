import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsIndexLink from './ProjectsIndexLink';
import { qk } from '@/lib/queries/keys';
import { PROJECTS_INDEX_QUERY_SCOPE } from '@/lib/queries/projectsIndex';
import { renderIntoDocument } from '../../../../test/reactHarness';

const routerPrefetch = vi.fn();
const routerReplace = vi.fn();
const prefetchQuery = vi.fn();

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
    useQueryClient: () => ({ prefetchQuery }),
  };
});

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://tenant.supabase.co',
  supabaseHostFromUrl: () => 'tenant',
}));

describe('ProjectsIndexLink', () => {
  beforeEach(() => {
    routerPrefetch.mockReset();
    routerReplace.mockReset();
    prefetchQuery.mockReset();
    window.history.replaceState(null, '', '/dashboard');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['mouseover', 'focusin', 'pointerdown', 'touchstart'])('preloads route and data on %s intent', (eventName) => {
    const rendered = renderIntoDocument(
      <ProjectsIndexLink href="/staff/projects?archive=archived">Projects</ProjectsIndexLink>,
    );
    const link = rendered.container.querySelector('a');

    act(() => link?.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true })));

    expect(routerPrefetch).toHaveBeenCalledWith('/staff/projects?archive=archived');
    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'archived') }),
    );
    rendered.unmount();
  });

  it('changes the URL immediately and finishes with a background replace', () => {
    const rendered = renderIntoDocument(<ProjectsIndexLink href="/staff/projects?status=NEW">Projects</ProjectsIndexLink>);
    const link = rendered.container.querySelector('a');

    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));

    expect(window.location.pathname).toBe('/staff/projects');
    expect(window.location.search).toContain('__portal_opening=projects-index');
    expect(routerReplace).toHaveBeenCalledWith('/staff/projects?status=NEW', { scroll: false });
    rendered.unmount();
  });

  it('preserves target=_blank navigation', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexLink href="/staff/projects" target="_blank">Projects</ProjectsIndexLink>,
    );
    const link = rendered.container.querySelector('a');

    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));

    expect(routerReplace).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
