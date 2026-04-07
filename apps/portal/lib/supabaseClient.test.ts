import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn(() => ({ from: vi.fn() }));
const env = { ...process.env };

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

describe('supabase service-role client', () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('uses the service role key explicitly when requested', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const { getSupabaseServiceRole } = await import('./supabaseClient');
    getSupabaseServiceRole();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }),
      }),
    );
  });

  it('does not fall back to the anon key when the service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { getSupabaseServiceRole } = await import('./supabaseClient');

    expect(() => getSupabaseServiceRole()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is not set/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
