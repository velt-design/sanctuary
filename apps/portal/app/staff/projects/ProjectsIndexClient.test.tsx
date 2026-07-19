import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsIndexClient from './ProjectsIndexClient';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { qk } from '@/lib/queries/keys';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const replace = vi.fn();
const prefetch = vi.fn();
const openProject = vi.fn();
const prefetchQuery = vi.fn();
const invalidateQueries = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const useQueryMock = vi.fn();
const mockSearchParams = new URLSearchParams('q=deck&status=sent&due=today');

vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: { children?: ReactNode; prefetch?: boolean } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, prefetch }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('./ProjectInstantOpen', () => ({
  preloadProjectInstantView: vi.fn(() => Promise.resolve()),
  useProjectInstantOpen: () => ({ instantProject: null, openProject }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
  }),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ role: 'admin' }),
}));

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({
      prefetchQuery,
      invalidateQueries,
    }),
  };
});

const initialProjects: Project[] = [
  {
    id: 'proj_1',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T01:00:00.000Z',
    contactId: 'ct_1',
    projectName: 'Deck Build',
    region: 'North',
    siteAddress: '12 Beach Road',
    status: 'SENT',
    nextActionDate: '2026-04-03',
  },
];

const initialContacts: Contact[] = [
  {
    id: 'ct_1',
    displayName: 'Alex Mason',
    email: 'alex@example.com',
    phone: '021 123 4567',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
];

describe('ProjectsIndexClient', () => {
  beforeEach(() => {
    replace.mockReset();
    prefetch.mockReset();
    openProject.mockReset();
    prefetchQuery.mockReset();
    prefetchQuery.mockResolvedValue(undefined);
    invalidateQueries.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    useQueryMock.mockReset();
    useQueryMock.mockImplementation((options: { initialData?: unknown }) => ({
      data: options.initialData,
      error: null,
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes the projects and contacts queries from server data and renders the filtered table immediately', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialProjects={initialProjects}
        initialContacts={initialContacts}
        initialFilters={{ query: 'deck', statusFilter: 'SENT', dueFilter: 'today', archiveFilter: 'active' }}
        initialTodayYmd="2026-04-03"
      />,
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.projects.list('host', 'active'),
        initialData: initialProjects,
      }),
    );
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.contacts.list('host'),
        initialData: initialContacts,
      }),
    );
    expect((rendered.container.querySelector('#projectSearch') as HTMLInputElement | null)?.value).toBe('deck');
    expect(rendered.container.textContent).toContain('Deck Build');
    expect(rendered.container.textContent).toContain('021 123 4567');
    expect(rendered.container.textContent).toContain('12 Beach Road');

    const headers = Array.from(rendered.container.querySelectorAll('th')).map((th) => th.textContent ?? '');
    expect(headers).toEqual(['Name', 'Client', 'Phone', 'Address', 'Status', 'Actions']);
    expect(prefetchQuery).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('exposes an Active/Archived/All archive filter', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialProjects={initialProjects}
        initialContacts={initialContacts}
        initialFilters={{ query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' }}
        initialTodayYmd="2026-04-03"
      />,
    );

    const select = rendered.container.querySelector('#projectArchiveFilter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select?.querySelectorAll('option') ?? []).map((opt) => opt.value);
    expect(options).toEqual(['active', 'archived', 'all']);

    rendered.unmount();
  });

  it.each([
    ['hover', 'mouseover', 'tr'],
    ['focus', 'focusin', 'a'],
    ['touch', 'touchstart', 'tr'],
    ['pointer down', 'pointerdown', 'a'],
  ])('preloads the project route and snapshot on %s intent', (_label, eventName, selector) => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialProjects={initialProjects}
        initialContacts={initialContacts}
        initialFilters={{ query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' }}
        initialTodayYmd="2026-04-03"
      />,
    );
    const target = selector === 'tr'
      ? rendered.container.querySelector('tbody tr')
      : rendered.container.querySelector('a[href="/staff/projects/proj_1"]');

    act(() => {
      target?.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    expect(prefetch).toHaveBeenCalledWith('/staff/projects/proj_1');
    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.projects.snapshot('host', 'proj_1') }),
    );

    rendered.unmount();
  });

  it.each([
    ['row click', () => new MouseEvent('click', { bubbles: true })],
    ['keyboard Enter', () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })],
    ['keyboard Space', () => new KeyboardEvent('keydown', { key: ' ', bubbles: true })],
  ])('navigates from %s after preparing the project', (_label, eventFactory) => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialProjects={initialProjects}
        initialContacts={initialContacts}
        initialFilters={{ query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' }}
        initialTodayYmd="2026-04-03"
      />,
    );
    const row = rendered.container.querySelector('tbody tr');

    act(() => {
      row?.dispatchEvent(eventFactory());
    });

    expect(openProject).toHaveBeenCalledWith('proj_1');
    expect(prefetchQuery).toHaveBeenCalled();

    rendered.unmount();
  });

  it('prepares the project before the Open link handles navigation', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialProjects={initialProjects}
        initialContacts={initialContacts}
        initialFilters={{ query: '', statusFilter: 'all', dueFilter: 'all', archiveFilter: 'active' }}
        initialTodayYmd="2026-04-03"
      />,
    );
    const link = rendered.container.querySelector('a[href="/staff/projects/proj_1"]');
    link?.addEventListener('click', (event) => event.preventDefault());

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(link?.getAttribute('href')).toBe('/staff/projects/proj_1');
    expect(prefetch).toHaveBeenCalledWith('/staff/projects/proj_1');
    expect(prefetchQuery).toHaveBeenCalled();
    expect(openProject).toHaveBeenCalledWith('proj_1');

    rendered.unmount();
  });
});
