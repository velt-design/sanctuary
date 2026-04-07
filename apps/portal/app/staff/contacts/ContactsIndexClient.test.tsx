import type { ReactNode } from 'react';
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
    email: 'alex@example.com',
    phone: '021',
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
    useQueryMock.mockImplementation((options: { initialData?: unknown }) => ({
      data: options.initialData,
      error: null,
    }));
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
});
