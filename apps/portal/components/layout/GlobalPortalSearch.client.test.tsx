import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PORTAL_SEARCH_DEBOUNCE_MS } from '@/lib/queries/portalSearch';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import GlobalPortalSearch from './GlobalPortalSearch.client';
import { GlobalPortalSearchStateProvider } from './GlobalPortalSearchState';

const navigation = vi.hoisted(() => ({
  pathname: '/staff/dashboard',
  search: '',
  beginRouteTransition: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: navigation.prefetch }),
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
  default: ({ children, href, onClick, prefetch: _prefetch, ...props }: any) => (
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

function SearchHost({ pending }: { pending: boolean }) {
  return (
    <GlobalPortalSearchStateProvider>
      {pending
        ? <div key="pending" data-testid="pending-header"><GlobalPortalSearch /></div>
        : <div key="loaded" data-testid="loaded-header"><GlobalPortalSearch /></div>}
    </GlobalPortalSearchStateProvider>
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
    navigation.prefetch.mockReset();
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
    expect(document.body.textContent).toContain('Type at least 2 characters');
    rendered.unmount();
  });

  it('renders the open results panel outside clipping header containers', () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    const root = rendered.container.querySelector('[data-global-portal-search="true"]') as HTMLDivElement;
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 800);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 40,
      left: 500,
      right: 800,
      top: 60,
      width: 300,
      x: 500,
      y: 60,
      toJSON: () => ({}),
    });

    act(() => input.focus());

    const panel = document.querySelector<HTMLElement>('[data-global-search-panel="true"]');
    expect(panel).not.toBeNull();
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.style.position).toBe('fixed');
    expect(panel?.style.left).toBe('240px');
    expect(panel?.style.top).toBe('104px');
    expect(panel?.style.width).toBe('560px');
    expect(panel?.style.maxHeight).toBe('620px');
    act(() => panel?.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('[data-global-search-panel="true"]')).not.toBeNull();
    rendered.unmount();
  });

  it('debounces grouped results and starts keyboard navigation with visible feedback', async () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    expect(fetch).toHaveBeenCalledWith('/api/staff/v1/search?q=re', expect.objectContaining({ cache: 'no-store' }));
    expect(document.body.textContent).toContain('Remuera Residence');
    expect(document.body.textContent).toContain('Rebecca Stone');
    expect(document.body.textContent).toContain('View all matching projects');

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
    expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Remuera Residence');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(document.querySelector('[role="option"]')?.textContent).toContain('Opening');
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
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    const projectResult = document.querySelector('[role="option"]') as HTMLAnchorElement;
    act(() => {
      projectResult.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(navigation.prefetch).toHaveBeenCalledWith('/staff/projects/proj_1');
    act(() => projectResult.click());
    expect(input.value).toBe('re');
    expect(document.body.textContent).toContain('Opening');

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
    expect(document.querySelector('[role="listbox"]')).toBeNull();
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
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    const current = document.querySelector('[role="option"][aria-current="page"]') as HTMLAnchorElement;
    expect(current.textContent).toContain('Current');
    act(() => current.click());

    expect(navigation.beginRouteTransition).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('closes the result panel with Escape without clearing the query', () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 'deck');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(input.value).toBe('deck');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('preserves live typing when a pending page header is replaced by the loaded header', () => {
    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <PortalQueryClientScope client={queryClient}>
          <SearchHost pending />
        </PortalQueryClientScope>
      </QueryClientProvider>,
    );
    const pendingInput = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => pendingInput.focus());
    inputText(pendingInput, 'doreen');

    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <PortalQueryClientScope client={queryClient}>
          <SearchHost pending={false} />
        </PortalQueryClientScope>
      </QueryClientProvider>,
    );

    const loadedInput = rendered.container.querySelector('input') as HTMLInputElement;
    expect(loadedInput).not.toBe(pendingInput);
    expect(loadedInput.value).toBe('doreen');
    expect(document.activeElement).toBe(loadedInput);
    rendered.unmount();
  });

  it('serves a repeated exact query from the user cache without another debounce or request', async () => {
    const rendered = renderSearch();
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();
    expect(document.body.textContent).toContain('Remuera Residence');
    expect(fetch).toHaveBeenCalledTimes(1);

    inputText(input, '');
    inputText(input, 'RE');
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Remuera Residence');
    expect(document.body.textContent).not.toContain('Searching the portal');
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
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();

    inputText(input, 'rem');
    expect(document.body.textContent).toContain('Remuera Residence');
    expect(document.body.textContent).toContain('Updating results');

    await act(async () => {
      vi.advanceTimersByTime(PORTAL_SEARCH_DEBOUNCE_MS + 1);
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('Remuera Residence');

    await act(async () => {
      finishRefresh?.(Response.json(searchResponse('rem', 'Remuera Courtyard')));
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushQueryNotifications();
    expect(document.body.textContent).toContain('Remuera Courtyard');
    expect(document.body.textContent).not.toContain('Updating results');
    rendered.unmount();
  });
});
