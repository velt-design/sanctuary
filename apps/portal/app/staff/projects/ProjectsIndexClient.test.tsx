import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsIndexClient from './ProjectsIndexClient';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { qk } from '@/lib/queries/keys';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import { PROJECTS_INDEX_QUERY_SCOPE } from '@/lib/queries/projectsIndex';

const replace = vi.fn();
const prefetch = vi.fn();
const openProject = vi.fn();
const prefetchQuery = vi.fn();
const invalidateQueries = vi.fn();
const setQueryData = vi.fn();
const setQueriesData = vi.fn();
const getQueryData = vi.fn();
const getQueriesData = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const useQueryMock = vi.fn();
const apiJsonMock = vi.fn();
let mockSearchParams = new URLSearchParams(
  'q=deck&journey=proposal&stage=sent&state=waiting',
);

function changeInputValue(target: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing input value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: { children?: ReactNode; prefetch?: boolean } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, prefetch }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('./ProjectInstantOpen', () => ({
  useProjectInstantOpen: () => ({ openProject }),
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

vi.mock('@/lib/repo/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repo/apiClient')>();
  return {
    ...actual,
    apiJson: (...args: unknown[]) => apiJsonMock(...args),
  };
});

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
      setQueryData,
      setQueriesData,
      getQueryData,
      getQueriesData,
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
    operationalState: 'WAITING',
    effectiveState: 'WAITING',
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

function matchingIndexData(options: { queryKey: readonly unknown[] }) {
  const archive = options.queryKey[3] as 'active' | 'archived' | 'all';
  const params = options.queryKey[4] as {
    search: string;
    status: Project['status'] | 'all';
    journey: 'all' | 'ENQUIRY' | 'PROPOSAL' | 'CONFIRMED' | 'DELIVERY' | 'SETTLED';
    state: 'all' | 'ACTIVE' | 'WAITING' | 'CLOSED' | 'ARCHIVED';
    owner: 'all' | 'unassigned' | 'jordan' | 'jp' | 'joe' | 'bruce';
    page: number;
    pageSize: 25 | 50 | 100;
    sort: 'newest';
  };
  return {
    archive,
    projects: {
      rows: initialProjects,
      totalCount: 1,
      truncated: false,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: 1,
    },
    contacts: { rows: initialContacts, totalCount: 1, truncated: false },
    query: {
      search: params.search,
      status: params.status,
      journey: params.journey,
      state: params.state,
      owner: params.owner,
      sort: params.sort,
    },
    generatedAt: '2026-04-03T01:00:00.000Z',
  };
}

const ALL_FILTERS = {
  query: '',
  journeyFilter: 'all',
  stageFilter: 'all',
  stateFilter: 'all',
  ownerFilter: 'all',
  archiveFilter: 'active',
} as const;

describe('ProjectsIndexClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('q=deck&journey=proposal&stage=sent&state=waiting');
    replace.mockReset();
    prefetch.mockReset();
    openProject.mockReset();
    prefetchQuery.mockReset();
    prefetchQuery.mockResolvedValue(undefined);
    invalidateQueries.mockReset();
    setQueryData.mockReset();
    setQueriesData.mockReset();
    getQueryData.mockReset();
    getQueriesData.mockReset();
    getQueriesData.mockReturnValue([]);
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    apiJsonMock.mockReset();
    apiJsonMock.mockResolvedValue({});
    useQueryMock.mockReset();
    useQueryMock.mockImplementation((options) => ({
      data: matchingIndexData(options),
      error: null,
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders fresh index data through the combined authenticated query', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient
        initialFilters={{
          query: 'deck',
          journeyFilter: 'PROPOSAL',
          stageFilter: 'SENT',
          stateFilter: 'WAITING',
          ownerFilter: 'all',
          archiveFilter: 'active',
        }}
      />,
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active', {
          search: 'deck',
          status: 'SENT',
          journey: 'PROPOSAL',
          state: 'WAITING',
          owner: 'all',
          page: 1,
          pageSize: 50,
          sort: 'newest',
        }),
      }),
    );
    expect((rendered.container.querySelector('#projectSearch') as HTMLInputElement | null)?.value).toBe('deck');
    expect(rendered.container.textContent).toContain('Deck Build');
    expect(rendered.container.textContent).toContain('021 123 4567');
    expect(rendered.container.textContent).toContain('12 Beach Road');
    expect(rendered.container.textContent).toContain('Proposal');
    expect(rendered.container.textContent).toContain('Waiting');

    const headers = Array.from(rendered.container.querySelectorAll('th')).map((th) => th.textContent ?? '');
    expect(headers).toEqual([
      'Name',
      'Client',
      'Phone',
      'Address',
      'Journey',
      'Stage',
      'State',
      'Owner',
      'Next attention',
      'Actions',
    ]);
    expect(prefetchQuery).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('does not overwrite live typing when unrelated URL state changes', () => {
    const rendered = renderIntoDocument(<ProjectsIndexClient />);
    const input = rendered.container.querySelector('#projectSearch') as HTMLInputElement;

    act(() => changeInputValue(input, 'deck extension'));
    mockSearchParams = new URLSearchParams(
      'q=deck&journey=proposal&stage=sent&state=waiting&toast=saved',
    );
    rendered.rerender(<ProjectsIndexClient />);
    expect(input.value).toBe('deck extension');

    mockSearchParams = new URLSearchParams(
      'q=roof&journey=proposal&stage=sent&state=waiting',
    );
    rendered.rerender(<ProjectsIndexClient />);
    expect(input.value).toBe('roof');
    rendered.unmount();
  });

  it('exposes journey, detailed stage, and state without an archive filter', () => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );

    const values = (id: string) => Array.from(
      rendered.container.querySelectorAll<HTMLSelectElement>(`#${id} option`),
    ).map((option) => option.value);
    expect(values('projectJourneyFilter')).toEqual([
      'all',
      'ENQUIRY',
      'PROPOSAL',
      'CONFIRMED',
      'DELIVERY',
      'SETTLED',
    ]);
    expect(values('projectStageFilter')).toEqual([
      'all',
      'NEW',
      'CONTACTED',
      'SITE_VISIT',
      'QUOTING',
      'SENT',
      'DEPOSIT',
      'SCHEDULED',
      'COMPLETED',
      'PAID',
    ]);
    expect(values('projectStateFilter')).toEqual([
      'all',
      'ACTIVE',
      'WAITING',
      'CLOSED',
      'ARCHIVED',
    ]);
    expect(rendered.container.querySelector('#projectArchiveFilter')).toBeNull();

    rendered.unmount();
  });

  it('does not retain active rows while the archived scope is pending', () => {
    useQueryMock.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[3] === 'archived') {
        return {
          data: undefined,
          error: null,
          isFetching: true,
          isPlaceholderData: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: matchingIndexData(options),
        error: null,
        isFetching: false,
        isPlaceholderData: false,
        refetch: vi.fn(),
      };
    });
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );
    const state = rendered.container.querySelector('#projectStateFilter') as HTMLSelectElement;

    act(() => {
      state.value = 'ARCHIVED';
      state.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(rendered.container.textContent).not.toContain('Deck Build');
    expect(rendered.container.textContent).toContain('Updating projects…');
    rendered.unmount();
  });

  it('renders a truthful pending list instead of an empty state without cached data', () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: true,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );

    expect(rendered.container.querySelector('main')?.getAttribute('data-projects-index-state')).toBe('pending');
    expect(rendered.container.textContent).toContain('Updating projects…');
    expect(rendered.container.textContent).not.toContain('No projects yet');
    rendered.unmount();
  });

  it('keeps known rows visible when a refresh fails', () => {
    const refetch = vi.fn();
    useQueryMock.mockImplementation((options) => ({
      data: matchingIndexData(options),
      error: new Error('offline'),
      isFetching: false,
      isPlaceholderData: false,
      refetch,
    }));
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );

    expect(rendered.container.querySelector('main')?.getAttribute('data-projects-index-state')).toBe('refresh-failed');
    expect(rendered.container.textContent).toContain('Deck Build');
    expect(rendered.container.textContent).toContain('Retry');
    expect(Array.from(rendered.container.querySelectorAll('button')).filter((button) => button.textContent === 'Retry')).toHaveLength(1);
    rendered.unmount();
  });

  it.each([401, 403])('hides cached rows after an access-ending %s response', (status) => {
    useQueryMock.mockImplementation((options) => ({
      data: matchingIndexData(options),
      error: new ApiError('Access ended', { status, body: null }),
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }));
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );

    expect(rendered.container.querySelector('main')?.getAttribute('data-projects-index-state')).toBe('unavailable');
    expect(rendered.container.textContent).not.toContain('Deck Build');
    expect(rendered.container.textContent).toContain('cannot access');
    rendered.unmount();
  });

  it.each([
    ['hover', 'mouseover', 'tr'],
    ['focus', 'focusin', 'a'],
    ['touch', 'touchstart', 'tr'],
    ['pointer down', 'pointerdown', 'a'],
  ])('preloads the project route and snapshot on %s intent', (_label, eventName, selector) => {
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
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
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
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
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
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

  it('closes an inline editor immediately and shows background save state before the request settles', async () => {
    let resolveRequest: ((value: unknown) => void) | null = null;
    apiJsonMock.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const rendered = renderIntoDocument(
      <ProjectsIndexClient initialFilters={ALL_FILTERS} />,
    );
    const nameButton = Array.from(rendered.container.querySelectorAll('tbody button')).find(
      (button) => button.textContent?.trim() === 'Deck Build',
    );

    await act(async () => {
      nameButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const editor = rendered.container.querySelector('tbody input[type="text"]') as HTMLInputElement;

    await act(async () => {
      changeInputValue(editor, 'Instant Deck');
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('tbody input[type="text"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Saving…');
    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/projects/proj_1/details',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(setQueryData).toHaveBeenCalled();

    await act(async () => {
      resolveRequest?.({});
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).not.toContain('Saving…');

    rendered.unmount();
  });
});
