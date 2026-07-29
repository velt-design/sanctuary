import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.fn();
const createServerClient = vi.fn();

vi.mock('next/headers', () => ({ cookies }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

describe('server Supabase cookie ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    cookies.mockReset();
    createServerClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('fails an auth callback when its session cookie cannot be written', async () => {
    const set = vi.fn(() => {
      throw new Error('cookie write unavailable');
    });
    cookies.mockResolvedValue({ getAll: () => [], set });
    createServerClient.mockImplementation((_url, _key, options) => options);

    const { getSupabaseServerAuthCallback } = await import('./serverClient');
    const client = await getSupabaseServerAuthCallback() as any;

    expect(() => client.cookies.setAll([
      { name: 'session', value: 'value', options: { httpOnly: true } },
    ])).toThrow('cookie write unavailable');
  });

  it('retains the read-only client tolerance for non-mutable render contexts', async () => {
    const set = vi.fn(() => {
      throw new Error('cookie write unavailable');
    });
    cookies.mockResolvedValue({ getAll: () => [], set });
    createServerClient.mockImplementation((_url, _key, options) => options);

    const { getSupabaseServerAuth } = await import('./serverClient');
    const client = await getSupabaseServerAuth() as any;

    expect(() => client.cookies.setAll([
      { name: 'session', value: 'value', options: { httpOnly: true } },
    ])).not.toThrow();
  });
});
