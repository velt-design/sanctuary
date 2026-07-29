import { NextRequest, NextResponse } from 'next/server';
import { getSafeCallbackUrl } from '@/lib/portalAccess';
import { getSupabaseServerAuthCallback } from '@/lib/supabase/serverClient';

const CACHE_CONTROL = 'private, no-store';

function redirect(req: NextRequest, href: string): NextResponse {
  const response = NextResponse.redirect(new URL(href, req.url));
  response.headers.set('cache-control', CACHE_CONTROL);
  response.headers.set('referrer-policy', 'no-referrer');
  return response;
}

function loginHref(callbackUrl: string): string {
  const params = new URLSearchParams({ callbackUrl });
  return `/login?${params.toString()}`;
}

export async function GET(req: NextRequest) {
  const callbackUrl = getSafeCallbackUrl(
    req.nextUrl.searchParams.get('callbackUrl'),
  );
  const tokenHash = req.nextUrl.searchParams.get('token_hash')?.trim();

  if (!tokenHash) {
    return redirect(req, loginHref(callbackUrl));
  }

  try {
    const supabase = await getSupabaseServerAuthCallback();
    const { error } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    });

    if (error) {
      return redirect(req, loginHref(callbackUrl));
    }
  } catch {
    return redirect(req, loginHref(callbackUrl));
  }

  return redirect(req, callbackUrl);
}
