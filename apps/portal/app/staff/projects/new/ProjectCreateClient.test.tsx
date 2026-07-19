import { act } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectCreateClient from './ProjectCreateClient';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

const pushMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const listContactsMock = vi.fn();
const createProjectMock = vi.fn();
const apiJsonMock = vi.fn();
const upsertContactCachesMock = vi.fn();
const queryClientMock = {};
const toastApi = {
  error: (...args: unknown[]) => toastErrorMock(...args),
  success: (...args: unknown[]) => toastSuccessMock(...args),
};

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => toastApi,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => queryClientMock,
}));

vi.mock('@/lib/repo/contactsRepo', () => ({
  listContacts: (...args: unknown[]) => listContactsMock(...args),
}));

vi.mock('@/lib/repo/projectsRepo', () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));

vi.mock('@/lib/localFirst/portalEntities', () => ({
  upsertContactCaches: (...args: unknown[]) => upsertContactCachesMock(...args),
}));

describe('ProjectCreateClient', () => {
  beforeEach(() => {
    pushMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    listContactsMock.mockReset();
    createProjectMock.mockReset();
    apiJsonMock.mockReset();
    upsertContactCachesMock.mockReset();

    listContactsMock.mockResolvedValue([
      {
        id: 'ct_existing',
        displayName: 'Existing Contact',
        email: '',
        phone: '',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
    apiJsonMock.mockResolvedValue({
      contact: {
        id: 'ct_created',
        displayName: 'Created Contact',
        email: 'created@example.com',
        phone: '021',
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-07T00:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates inline contacts through the contacts API and updates local state without refetching the list', async () => {
    const rendered = renderIntoDocument(<ProjectCreateClient />);

    await act(async () => {
      await Promise.resolve();
    });
    const callsBeforeCreate = listContactsMock.mock.calls.length;

    const toggleButton = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create new contact'),
    ) as HTMLButtonElement;

    await act(async () => {
      toggleButton.click();
    });

    const nameInput = rendered.container.querySelector('#newContactName') as HTMLInputElement;
    const emailInput = rendered.container.querySelector('#newContactEmail') as HTMLInputElement;
    const phoneInput = rendered.container.querySelector('#newContactPhone') as HTMLInputElement;
    const createButton = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create contact'),
    ) as HTMLButtonElement;

    await act(async () => {
      changeValue(nameInput, 'Created Contact');
      changeValue(emailInput, 'created@example.com');
      changeValue(phoneInput, '021');
      createButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'Created Contact',
          email: 'created@example.com',
          phone: '021',
        }),
      }),
    );
    expect(upsertContactCachesMock).toHaveBeenCalledWith(
      queryClientMock,
      'host',
      expect.objectContaining({
        id: 'ct_created',
        displayName: 'Created Contact',
      }),
    );
    expect(listContactsMock).toHaveBeenCalledTimes(callsBeforeCreate);
    const select = rendered.container.querySelector('#contactId') as HTMLSelectElement;
    expect(select.value).toBe('ct_created');
    expect(rendered.container.querySelector('option[value="ct_created"]')?.textContent).toContain('Created Contact');
    expect(toastSuccessMock).toHaveBeenCalledWith('Contact created.');

    rendered.unmount();
  });
});
