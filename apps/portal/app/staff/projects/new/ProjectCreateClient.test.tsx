import { act } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectCreateClient from './ProjectCreateClient';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

const pushMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastInfoMock = vi.fn();
const apiJsonMock = vi.fn();
const invalidateProjectsIndexCachesMock = vi.fn();
const queryClientMock = {};

const savedContact = {
  id: 'ct_22222222-2222-4222-8222-222222222222',
  displayName: 'Created Contact',
  email: 'created@example.com',
  phone: '021',
  createdAt: '2026-04-07T00:00:00.000Z',
  updatedAt: '2026-04-07T00:00:00.000Z',
};

const savedProject = {
  id: 'proj_11111111-1111-4111-8111-111111111111',
  projectName: 'Courtyard roof',
  status: 'NEW',
  contactId: savedContact.id,
  createdAt: '2026-04-07T00:00:00.000Z',
  updatedAt: '2026-04-07T00:00:00.000Z',
};

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

async function fillNewContactProject(container: HTMLElement) {
  const toggle = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Create new contact'));
  await act(async () => {
    toggle?.click();
  });
  await act(async () => {
    changeValue(container.querySelector('#newContactName'), 'Created Contact');
    changeValue(container.querySelector('#newContactEmail'), 'created@example.com');
    changeValue(container.querySelector('#newContactPhone'), '021');
    changeValue(container.querySelector('#projectName'), 'Courtyard roof');
  });
}

function savedResponse() {
  return {
    project: savedProject,
    contact: savedContact,
    receipt: {
      state: 'server_confirmed',
      confirmedAt: '2026-04-07T00:00:00.000Z',
      replayed: false,
      createdContact: true,
      setupAutomation: 'confirmed',
    },
  };
}

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: undefined,
      isLoading: false,
      isError: false,
    }),
    useQueryClient: () => queryClientMock,
  };
});

vi.mock('@/lib/repo/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repo/apiClient')>();
  return {
    ...actual,
    apiJson: (...args: unknown[]) => apiJsonMock(...args),
  };
});

vi.mock('@/lib/utils/id', () => ({
  newId: (prefix?: string) => prefix === 'proj'
    ? 'proj_11111111-1111-4111-8111-111111111111'
    : 'ct_22222222-2222-4222-8222-222222222222',
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectsIndexCaches: (...args: unknown[]) => invalidateProjectsIndexCachesMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));

describe('ProjectCreateClient', () => {
  beforeEach(() => {
    pushMock.mockReset();
    toastErrorMock.mockReset();
    toastInfoMock.mockReset();
    toastSuccessMock.mockReset();
    apiJsonMock.mockReset();
    invalidateProjectsIndexCachesMock.mockReset();
    invalidateProjectsIndexCachesMock.mockResolvedValue(undefined);
    apiJsonMock.mockResolvedValue(savedResponse());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('saves a new contact and project as one server-confirmed command', async () => {
    const rendered = renderIntoDocument(<ProjectCreateClient />);

    await fillNewContactProject(rendered.container);
    await act(async () => {
      rendered.container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledTimes(1);
    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/staff/v1/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          projectId: savedProject.id,
          projectName: 'Courtyard roof',
          quoteRef: '',
          region: '',
          siteAddress: '',
          contact: {
            kind: 'new',
            contactId: savedContact.id,
            displayName: 'Created Contact',
            email: 'created@example.com',
            phone: '021',
            allowDuplicate: false,
          },
        }),
      }),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('Project saved to Sanctuary.');
    expect(invalidateProjectsIndexCachesMock).toHaveBeenCalledWith(queryClientMock, 'host', {
      includeContacts: true,
    });
    expect(pushMock).toHaveBeenCalledWith(`/staff/projects/${savedProject.id}`);
    rendered.unmount();
  });

  it('keeps the confirmed project and surfaces setup automation attention', async () => {
    apiJsonMock.mockResolvedValue({
      ...savedResponse(),
      receipt: {
        ...savedResponse().receipt,
        setupAutomation: 'needs_attention',
      },
    });
    const rendered = renderIntoDocument(<ProjectCreateClient />);

    await fillNewContactProject(rendered.container);
    await act(async () => {
      rendered.container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(toastInfoMock).toHaveBeenCalledWith(
      'Project saved. Initial setup automation needs administrator review.',
    );
    expect(pushMock).toHaveBeenCalledWith(`/staff/projects/${savedProject.id}`);
    rendered.unmount();
  });

  it('requires an explicit override before creating a duplicate contact', async () => {
    apiJsonMock.mockRejectedValueOnce(new ApiError(
      'A contact with the same email or phone already exists.',
      {
        status: 409,
        body: {
          code: 'CONTACT_DUPLICATE_CANDIDATES',
          candidates: [{ ...savedContact, id: 'ct_33333333-3333-4333-8333-333333333333' }],
        },
      },
    )).mockResolvedValueOnce(savedResponse());
    const rendered = renderIntoDocument(<ProjectCreateClient />);

    await fillNewContactProject(rendered.container);
    await act(async () => {
      rendered.container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Possible existing contact');
    expect(apiJsonMock).toHaveBeenCalledTimes(1);

    const override = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create separate contact and project'));
    await act(async () => {
      override?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(apiJsonMock.mock.calls[1][1].body).contact.allowDuplicate).toBe(true);
    rendered.unmount();
  });

  it('does not tell staff to retry when server cleanup needs review', async () => {
    apiJsonMock.mockRejectedValue(new ApiError(
      'Project creation could not be confirmed. Do not retry; ask a portal administrator to reconcile this request.',
      {
        status: 500,
        body: { code: 'PROJECT_CREATION_REVIEW_REQUIRED' },
      },
    ));
    const rendered = renderIntoDocument(<ProjectCreateClient />);

    await fillNewContactProject(rendered.container);
    await act(async () => {
      rendered.container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Do not retry');
    expect(rendered.container.textContent).not.toContain('Retry is safe.');
    rendered.unmount();
  });
});
