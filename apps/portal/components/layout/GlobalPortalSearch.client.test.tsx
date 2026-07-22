import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import GlobalPortalSearch from './GlobalPortalSearch.client';

const navigation = vi.hoisted(() => ({
  pathname: '/staff/dashboard',
  search: '',
  beginRouteTransition: vi.fn(),
}));

vi.mock('@/components/page-state/PortalRouteTransition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/page-state/PortalRouteTransition')>();
  return {
    ...actual,
    usePortalRouteTransition: () => ({
      beginRouteTransition: navigation.beginRouteTransition,
      beginInstantRoute: vi.fn(),
      finishInstantRoute: vi.fn(),
      instantRoute: null,
      pathname: navigation.pathname,
      routeKey: `${navigation.pathname}?${navigation.search}`,
    }),
  };
});

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

function inputText(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

let queryClient: QueryClient;

function renderSearch() {
  return renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <PortalQueryClientScope client={queryClient}>
        <GlobalPortalSearch />
      </PortalQueryClientScope>
    </QueryClientProvider>,
  );
}

async function flushQueryNotifications() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
  });
}

function searchResponse(query = 're', projectName = 'Remuera Residence') {
  return {
    query,
    projects: [{
      kind: 'project',
      id: 'proj_1',
      href: '/staff/projects/proj_1',
      name: projectName,
      reference: 'Q-1010',
      siteAddress: 'Remuera, Auckland',
      contactName: 'Alex Mason',
      stage: 'quoting',
      archived: false,
    }],
    contacts: [{
      kind: 'contact',
      id: 'ct_1',
      href: '/staff/contacts/ct_1',
      name: 'Rebecca Stone',
      email: 'rebecca@example.com',
      phone: '021 555 0101',
      address: null,
    }],
    generatedAt: '2026-07-22T00:00:00.000Z',
  };
}

describe('GlobalPortalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    navigation.pathname = '/staff/dashboard';
    navigation.search = '';
    navigation.beginRouteTransition.mockReset();
    window.history.replaceState(null, '', navigation.pathname);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(searchResponse())));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('opens from the global shortcut and explains the two-character threshold', () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(document.activeElement).toBe(input);
    expect(rendered.container.textContent).toContain('Type at least 2 characters');
    rendered.unmount();
  });

  it('debounces grouped results and starts keyboard navigation with visible feedback', async () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    expect(fetch).toHaveBeenCalledWith('/api/staff/v1/search?q=re', expect.objectContaining({ cache: 'no-store' }));
    expect(rendered.container.textContent).toContain('Remuera Residence');
    expect(rendered.container.textContent).toContain('Rebecca Stone');
    expect(rendered.container.textContent).toContain('View all matching projects');

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
    expect(rendered.container.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Remuera Residence');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(rendered.container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(rendered.container.querySelector('[role="option"]')?.textContent).toContain('Opening');
    expect(navigation.beginRouteTransition).toHaveBeenCalledWith(expect.objectContaining({
      href: '/staff/projects/proj_1',
      source: 'global-portal-search',
    }));
    rendered.unmount();
  });

  it('keeps the query during mouse navigation and clears it when the route settles', async () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    act(() => (rendered.container.querySelector('[role="option"]') as HTMLAnchorElement).click());
    expect(input.value).toBe('re');
    expect(rendered.container.textContent).toContain('Opening');

    navigation.pathname = '/staff/projects/proj_1';
    window.history.pushState(null, '', navigation.pathname);
    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <PortalQueryClientScope client={queryClient}>
          <GlobalPortalSearch />
        </PortalQueryClientScope>
      </QueryClientProvider>,
    );

    expect(input.value).toBe('');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('marks the current result and closes cleanly without starting navigation', async () => {
    navigation.pathname = '/staff/projects/proj_1';
    window.history.replaceState(null, '', navigation.pathname);
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    const current = rendered.container.querySelector('[role="option"][aria-current="page"]') as HTMLAnchorElement;
    expect(current.textContent).toContain('Current');
    act(() => current.click());

    expect(navigation.beginRouteTransition).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('closes the result panel with Escape without clearing the query', () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 'deck');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(input.value).toBe('deck');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('serves a repeated exact query from the user cache without another debounce or request', async () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();
    expect(rendered.container.textContent).toContain('Remuera Residence');
    expect(fetch).toHaveBeenCalledTimes(1);

    inputText(input, '');
    inputText(input, 'RE');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Remuera Residence');
    expect(rendered.container.textContent).not.toContain('Searching the portal');
    expect(fetch).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('keeps prior results visible while an uncached query refreshes', async () => {
    let finishRefresh: ((response: Response) => void) | null = null;
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(searchResponse()))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRefresh = resolve; }));

    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');
    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    inputText(input, 'rem');
    expect(rendered.container.textContent).toContain('Remuera Residence');
    expect(rendered.container.textContent).toContain('Updating results');

    await act(async () => {
      vi.advanceTimersByTime(101);
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(rendered.container.textContent).toContain('Remuera Residence');

    await act(async () => {
      finishRefresh?.(Response.json(searchResponse('rem', 'Remuera Courtyard')));
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();
    expect(rendered.container.textContent).toContain('Remuera Courtyard');
    expect(rendered.container.textContent).not.toContain('Updating results');
    rendered.unmount();
  });
});
