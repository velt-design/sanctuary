import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactDetailClient from './ContactDetailClient';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';

const useQueryMock = vi.fn();
const apiJsonMock = vi.fn();
const toastErrorMock = vi.fn();
const upsertContactCachesMock = vi.fn();
const getQueryDataMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({
      getQueryData: (...args: unknown[]) => getQueryDataMock(...args),
    }),
  };
});

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/portalEntities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/portalEntities')>();
  return {
    ...actual,
    upsertContactCaches: (...args: unknown[]) => upsertContactCachesMock(...args),
  };
});

const contact = {
  id: 'ct_1',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-02T00:00:00Z',
  displayName: 'Taylor',
  email: 'taylor@example.com',
  phone: '0210000000',
} as const;

function click(target: Element | null) {
  if (!target) throw new Error('Missing click target');
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  act(() => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ContactDetailClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useQueryMock.mockReset();
    apiJsonMock.mockReset();
    toastErrorMock.mockReset();
    upsertContactCachesMock.mockReset();
    getQueryDataMock.mockReset();

    getQueryDataMock.mockReturnValue([contact]);
    apiJsonMock.mockResolvedValue({
      contact: {
        ...contact,
        email: 'updated@example.com',
      },
    });

    let callIndex = 0;
    useQueryMock.mockImplementation(() => {
      callIndex += 1;
      return callIndex % 2 === 1
        ? { data: contact, error: null }
        : { data: [], error: null };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('autosaves contact edits directly through the API', async () => {
    const rendered = renderIntoDocument(<ContactDetailClient contactId="ct_1" />);

    click(rendered.container.querySelector('button'));
    changeValue(rendered.container.querySelectorAll('input')[1] as HTMLInputElement | null, 'updated@example.com');

    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/contacts/ct_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          displayName: 'Taylor',
          email: 'updated@example.com',
          phone: '0210000000',
        }),
      }),
    );
    expect(upsertContactCachesMock).toHaveBeenCalled();

    rendered.unmount();
  });
});
