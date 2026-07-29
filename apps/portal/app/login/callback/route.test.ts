import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getSupabaseServerAuthCallback = vi.fn();
const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuthCallback,
}));

describe('/login/callback', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseServerAuthCallback.mockReset();
    verifyOtp.mockReset();
    getSupabaseServerAuthCallback.mockResolvedValue({
      auth: { verifyOtp },
    });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it('exchanges a hashed one-time token and redirects to a safe local page', async () => {
    const mod = await import('./route');
    const response = await mod.GET(
      new NextRequest(
        'http://localhost:3001/login/callback?token_hash=hashed-token&callbackUrl=%2Fstaff%2Fprojects',
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'magiclink',
      token_hash: 'hashed-token',
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/staff/projects',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('location')).not.toContain('token');
  });

  it('returns to login without echoing a rejected token', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Expired token' } });

    const mod = await import('./route');
    const response = await mod.GET(
      new NextRequest(
        'http://localhost:3001/login/callback?token_hash=expired-secret&callbackUrl=%2Fstaff%2Fprojects',
      ),
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/login?callbackUrl=%2Fstaff%2Fprojects',
    );
    expect(response.headers.get('location')).not.toContain('expired-secret');
  });

  it('does not call Supabase when the token is missing', async () => {
    const mod = await import('./route');
    const response = await mod.GET(
      new NextRequest(
        'http://localhost:3001/login/callback?callbackUrl=%2Fstaff%2Fprojects',
      ),
    );

    expect(getSupabaseServerAuthCallback).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/login?callbackUrl=%2Fstaff%2Fprojects',
    );
  });

  it('rejects an external callback destination', async () => {
    const mod = await import('./route');
    const response = await mod.GET(
      new NextRequest(
        'http://localhost:3001/login/callback?token_hash=hashed-token&callbackUrl=https%3A%2F%2Fevil.example',
      ),
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/dashboard',
    );
  });

  it('rejects a backslash network-path callback destination', async () => {
    const mod = await import('./route');
    const response = await mod.GET(
      new NextRequest(
        'http://localhost:3001/login/callback?token_hash=hashed-token&callbackUrl=%2F%5Cevil.example',
      ),
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/dashboard',
    );
  });
});
