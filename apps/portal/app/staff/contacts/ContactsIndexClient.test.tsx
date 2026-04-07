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
      invalidateQueries,
    }),
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
    useQueryMock.mockImplementation((options: { initialData?: unknown }) => ({
      data: options.initialData,
      error: null,
    }));
    parseContactsCsvMock.mockReturnValue({
      headerRowNumber: 1,
      warnings: [],
      rows: [
        { displayName: 'New Contact', email: 'new@example.com', phone: '022' },
        { displayName: 'Alex Mason', email: 'filled@example.com', phone: '021' },
      ],
    });
    planContactsImportMock.mockReturnValue({
      stats: { create: 1, merge: 1, skip: 0, invalid: 0 },
      decisions: [
        { action: 'create', row: { displayName: 'New Contact', email: 'new@example.com', phone: '022' } },
        {
          action: 'merge',
          row: { displayName: 'Alex Mason', email: 'filled@example.com', phone: '021' },
          match: { existingId: 'ct_1' },
        },
      ],
    });
    apiJsonMock.mockResolvedValue({ contact: initialContacts[0] });
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

  it('routes import create and merge writes through the contacts API and invalidates the scoped contacts query', async () => {
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.contacts.list('host') });
    expect(toastSuccess).toHaveBeenCalledWith('Imported contacts: 1 created, 1 merged.');

    rendered.unmount();
  });
});
