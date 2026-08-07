import { describe, expect, it, vi } from 'vitest';
import {
  clearPortalSupabaseBrowserSession,
  portalSupabaseAuthStorageKey,
} from './portalSupabaseSessionBoundary';

describe('portal Supabase browser session boundary', () => {
  it('derives the @supabase/ssr storage key from the configured project URL', () => {
    expect(portalSupabaseAuthStorageKey('https://project-ref.supabase.co'))
      .toBe('sb-project-ref-auth-token');
    expect(portalSupabaseAuthStorageKey('not a URL')).toBeNull();
  });

  it('expires only the matching auth cookie chunks and clears fallback storage', () => {
    const expireCookie = vi.fn();
    const removeItem = vi.fn();

    expect(clearPortalSupabaseBrowserSession('https://project-ref.supabase.co', {
      cookieHeader: [
        'unrelated=value',
        'sb-project-ref-auth-token.0=part-a',
        'sb-project-ref-auth-token.1=part-b',
        'sb-project-ref-auth-token-user=user-json',
        'sb-project-ref-auth-token-code-verifier.0=verifier-a',
        'sb-project-ref-auth-token-code-verifier.1=verifier-b',
        'sb-other-auth-token=other',
      ].join('; '),
      expireCookie,
      localStorage: { removeItem },
    })).toBe(5);

    expect(expireCookie).toHaveBeenCalledWith(
      'sb-project-ref-auth-token.0=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(expireCookie).toHaveBeenCalledWith(
      'sb-project-ref-auth-token.1=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(expireCookie).toHaveBeenCalledWith(
      'sb-project-ref-auth-token-user=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(expireCookie).toHaveBeenCalledWith(
      'sb-project-ref-auth-token-code-verifier.0=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(expireCookie).toHaveBeenCalledWith(
      'sb-project-ref-auth-token-code-verifier.1=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(expireCookie).not.toHaveBeenCalledWith(expect.stringContaining('unrelated'));
    expect(removeItem).toHaveBeenCalledWith('sb-project-ref-auth-token');
    expect(removeItem).toHaveBeenCalledWith('sb-project-ref-auth-token-user');
    expect(removeItem).toHaveBeenCalledWith('sb-project-ref-auth-token-code-verifier');
  });
});
