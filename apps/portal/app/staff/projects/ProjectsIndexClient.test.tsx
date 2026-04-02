import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsIndexClient from './ProjectsIndexClient';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { qk } from '@/lib/queries/keys';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const push = vi.fn();
const replace = vi.fn();
const prefetchQuery = vi.fn();
const invalidateQueries = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const useQueryMock = vi.fn();
const mockSearchParams = new URLSearchParams('q=deck&status=sent&due=today');

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => mockSearchParams,
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
    status: 'SENT',
    nextActionDate: '2026-04-03',
  },
];

const initialContacts: Contact[] = [
  {
    id: 'ct_1',
    displayName: 'Alex Mason',
    email: 'alex@example.com',
    phone: '',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
];

describe('ProjectsIndexClient', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    prefetchQuery.mockReset();
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
        initialFilters={{ query: 'deck', statusFilter: 'SENT', dueFilter: 'today' }}
        initialTodayYmd="2026-04-03"
      />,
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.projects.list('host'),
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

    rendered.unmount();
  });
});
