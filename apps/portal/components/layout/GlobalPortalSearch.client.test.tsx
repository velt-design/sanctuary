import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
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

describe('GlobalPortalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigation.pathname = '/staff/dashboard';
    navigation.search = '';
    navigation.beginRouteTransition.mockReset();
    window.history.replaceState(null, '', navigation.pathname);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 're',
        projects: [{
          kind: 'project',
          id: 'proj_1',
          href: '/staff/projects/proj_1',
          name: 'Remuera Residence',
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
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('opens from the global shortcut and explains the two-character threshold', () => {
    const rendered = renderIntoDocument(<GlobalPortalSearch />);
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(document.activeElement).toBe(input);
    expect(rendered.container.textContent).toContain('Type at least 2 characters');
    rendered.unmount();
  });

  it('debounces grouped results and starts keyboard navigation with visible feedback', async () => {
    const rendered = renderIntoDocument(<GlobalPortalSearch />);
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(221);
      await Promise.resolve();
      await Promise.resolve();
    });

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
    const rendered = renderIntoDocument(<GlobalPortalSearch />);
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(221);
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => (rendered.container.querySelector('[role="option"]') as HTMLAnchorElement).click());
    expect(input.value).toBe('re');
    expect(rendered.container.textContent).toContain('Opening');

    navigation.pathname = '/staff/projects/proj_1';
    window.history.pushState(null, '', navigation.pathname);
    rendered.rerender(<GlobalPortalSearch />);

    expect(input.value).toBe('');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('marks the current result and closes cleanly without starting navigation', async () => {
    navigation.pathname = '/staff/projects/proj_1';
    window.history.replaceState(null, '', navigation.pathname);
    const rendered = renderIntoDocument(<GlobalPortalSearch />);
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 're');

    await act(async () => {
      vi.advanceTimersByTime(221);
      await Promise.resolve();
      await Promise.resolve();
    });

    const current = rendered.container.querySelector('[role="option"][aria-current="page"]') as HTMLAnchorElement;
    expect(current.textContent).toContain('Current');
    act(() => current.click());

    expect(navigation.beginRouteTransition).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });

  it('closes the result panel with Escape without clearing the query', () => {
    const rendered = renderIntoDocument(<GlobalPortalSearch />);
    const input = rendered.container.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    inputText(input, 'deck');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(input.value).toBe('deck');
    expect(rendered.container.querySelector('[role="listbox"]')).toBeNull();
    rendered.unmount();
  });
});
