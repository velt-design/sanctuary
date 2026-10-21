import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/** Owns cookie transport, never an authorization decision. */
export function createProxySupabase(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const updates: CookieToSet[] = [];
  const supabase = url && key ? createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => { updates.push(...cookies); },
    },
  }) : null;

  return {
    supabase,
    forwardRefreshedCookies(headers?: Headers) {
      // RSC cannot persist renewal itself. Forward the same rotation/chunk
      // removals that the browser receives, including when diagnostics copied headers.
      for (const cookie of updates) {
        if (!cookie.value || cookie.options?.maxAge === 0) req.cookies.delete(cookie.name);
        else req.cookies.set(cookie.name, cookie.value);
      }
      const forwarded = new Headers(headers ?? req.headers);
      forwarded.set('cookie', req.cookies.toString());
      return forwarded;
    },
    apply(response: NextResponse) {
      for (const cookie of updates) response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    },
  };
}
