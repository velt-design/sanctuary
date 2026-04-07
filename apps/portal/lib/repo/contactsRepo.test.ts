import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSupabaseBrowser = vi.fn();

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseBrowser,
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
  supabaseRestUrl: (table: string) => `https://example.supabase.co/rest/v1/${table}`,
}));

describe('contactsRepo schema guardrails', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseBrowser.mockReset();
  });

  it('fails explicitly on create when the contacts schema is missing a required write column', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      error: {
        code: 'PGRST204',
        message: "Could not find the 'address' column of 'contacts' in the schema cache",
      },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn((table: string) => {
      if (table !== 'contacts') throw new Error(`Unexpected table ${table}`);
      return { insert: insertMock };
    });
    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { createContact } = await import('./contactsRepo');

    await expect(
      createContact({
        displayName: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021',
      }),
    ).rejects.toThrow(/missing required column "address"/i);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('fails explicitly on update when the contacts schema is missing a required write column', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'address' column of 'contacts' in the schema cache",
      },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn((table: string) => {
      if (table === 'contacts') return { update: updateMock };
      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseBrowser.mockReturnValue({ from: fromMock });

    const { updateContact } = await import('./contactsRepo');

    await expect(updateContact('ct_11111111-1111-4111-8111-111111111111', { address: '123 Main St' } as any)).rejects.toThrow(
      /missing required column "address"/i,
    );
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
