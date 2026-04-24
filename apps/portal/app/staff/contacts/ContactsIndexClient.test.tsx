import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsIndexClient from './ContactsIndexClient';
import { qk } from '@/lib/queries/keys';
import type { Contact } from '@/lib/types/contact';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const useQueryMock = vi.fn();
const invalidateQueries = vi.fn();
const apiJsonMock = vi.fn();
const parseContactsCsvMock = vi.fn();
const planContactsImportMock = vi.fn();
const upsertContactCachesMock = vi.fn();
const queryClientMock = {
  invalidateQueries,
};

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
  }),
}));

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

vi.mock('@/lib/import/contactsCsv', () => ({
  parseContactsCsv: (...args: unknown[]) => parseContactsCsvMock(...args),
  planContactsImport: (...args: unknown[]) => planContactsImportMock(...args),
}));

vi.mock('@/lib/localFirst/portalEntities', () => ({
  upsertContactCaches: (...args: unknown[]) => upsertContactCachesMock(...args),
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
    useQueryClient: () => queryClientMock,
  };
});

const initialContacts: Contact[] = [
  {
    id: 'ct_1',
    displayName: 'Alex Mason',
    email: '',
    phone: '',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
];

describe('ContactsIndexClient', () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    useQueryMock.mockReset();
    invalidateQueries.mockReset();
    apiJsonMock.mockReset();
    parseContactsCsvMock.mockReset();
    planContactsImportMock.mockReset();
    upsertContactCachesMock.mockReset();
    useQueryMock.mockImplementation((options: { initialData?: unknown }) => ({
      data: options.initialData,
      error: null,
    }));
    parseContactsCsvMock.mockReturnValue({
      headerRowNumber: 1,
      warnings: [],
      rows: [
        { sourceRowNumber: 2, displayName: 'New Contact', email: 'new@example.com', phone: '022' },
        { sourceRowNumber: 3, displayName: 'Alex Mason', email: 'filled@example.com', phone: '021' },
      ],
    });
    planContactsImportMock.mockReturnValue({
      stats: { create: 1, merge: 1, skip: 0, invalid: 0 },
      decisions: [
        { action: 'create', row: { sourceRowNumber: 2, displayName: 'New Contact', email: 'new@example.com', phone: '022' } },
        {
          action: 'merge',
          row: { sourceRowNumber: 3, displayName: 'Alex Mason', email: 'filled@example.com', phone: '021' },
          match: { existingId: 'ct_1' },
        },
      ],
    });
    apiJsonMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('seeds the contacts query from server data and renders the list immediately', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient initialContacts={initialContacts} />);

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.contacts.list('host'),
        initialData: initialContacts,
      }),
    );
    expect(rendered.container.textContent).toContain('Alex Mason');
    expect(rendered.container.querySelector('table')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Search contacts');

    rendered.unmount();
  });

  it('still surfaces refresh failures when seeded data exists', () => {
    useQueryMock.mockReturnValue({
      data: initialContacts,
      error: new Error('Refresh failed'),
    });

    const rendered = renderIntoDocument(<ContactsIndexClient initialContacts={initialContacts} />);

    expect(rendered.container.textContent).toContain('Alex Mason');
    expect(toastError).toHaveBeenCalledWith("Couldn't refresh contacts (showing last saved).");

    rendered.unmount();
  });

  it('renders import preview rows without React key warnings', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rendered = renderIntoDocument(<ContactsIndexClient initialContacts={initialContacts} />);

    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'contacts.csv',
      text: vi.fn().mockResolvedValue('name,email,phone'),
    };

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Each child in a list should have a unique "key" prop.'));

    consoleErrorSpy.mockRestore();
    rendered.unmount();
  });

  it('routes import create and merge writes through the contacts API, upserts returned contacts, and invalidates the scoped contacts query', async () => {
    apiJsonMock
      .mockResolvedValueOnce({
        contact: {
          id: 'ct_2',
          displayName: 'New Contact',
          email: 'new@example.com',
          phone: '022',
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        contact: {
          id: 'ct_1',
          displayName: 'Alex Mason',
          email: 'filled@example.com',
          phone: '021',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-07T00:00:00.000Z',
        },
      });

    const rendered = renderIntoDocument(<ContactsIndexClient initialContacts={initialContacts} />);

    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'contacts.csv',
      text: vi.fn().mockResolvedValue('name,email,phone'),
    };

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const confirmButton = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm import'),
    ) as HTMLButtonElement;
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'New Contact',
          email: 'new@example.com',
          phone: '022',
        }),
      }),
    );
    expect(apiJsonMock).toHaveBeenNthCalledWith(
      2,
      '/api/contacts/ct_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          email: 'filled@example.com',
          phone: '021',
        }),
      }),
    );
    expect(upsertContactCachesMock).toHaveBeenNthCalledWith(
      1,
      queryClientMock,
      'host',
      expect.objectContaining({
        id: 'ct_2',
        displayName: 'New Contact',
      }),
    );
    expect(upsertContactCachesMock).toHaveBeenNthCalledWith(
      2,
      queryClientMock,
      'host',
      expect.objectContaining({
        id: 'ct_1',
        email: 'filled@example.com',
        phone: '021',
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.contacts.list('host') });
    expect(toastSuccess).toHaveBeenCalledWith('Imported contacts: 1 created, 1 merged.');

    rendered.unmount();
  });

  it('keeps the parsed import plan open on API failure and shows the error', async () => {
    apiJsonMock.mockRejectedValueOnce(new Error('Import exploded'));

    const rendered = renderIntoDocument(<ContactsIndexClient initialContacts={initialContacts} />);

    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'contacts.csv',
      text: vi.fn().mockResolvedValue('name,email,phone'),
    };

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [file],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const confirmButton = Array.from(rendered.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm import'),
    ) as HTMLButtonElement;

    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Import contacts');
    expect(rendered.container.textContent).toContain('Import exploded');
    expect(toastError).toHaveBeenCalledWith('Import exploded');
    expect(invalidateQueries).not.toHaveBeenCalled();

    rendered.unmount();
  });
});
