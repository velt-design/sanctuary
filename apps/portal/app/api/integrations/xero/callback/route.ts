import { NextRequest, NextResponse } from 'next/server';
import { developer, json, privateHeaders } from '@/lib/xero/http';
import { config, equalSecret, hash, unseal, XERO_CALLBACK, XERO_PAGE } from '@/lib/xero/security';
import { connect, consumeAttempt } from '@/lib/xero/store';
import { tokenRequest } from '@/lib/xero/provider';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const session = await developer();
  if (!session) return json({ error: 'Forbidden' }, 403);
  const result = (origin: string, outcome: string) => {
    const response = NextResponse.redirect(`${origin}${XERO_PAGE}?connection=${outcome}`, { status: 303, headers: privateHeaders });
    response.cookies.set('__Host-xero-state', '', { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  };
  let origin: string;
  try { origin = config().origin; } catch { return json({ error: 'Connection not configured' }, 503); }
  try {
    const cfg = config();
    const state = unseal<{ state: string; userId: string; expires: number }>(request.cookies.get('__Host-xero-state')?.value ?? '',cfg.key);
    if (state.userId !== session.user.id || !Number.isFinite(state.expires) || state.expires < Date.now() || !equalSecret(state.state,request.nextUrl.searchParams.get('state') ?? '')) throw new Error('INVALID_STATE');
    if (!await consumeAttempt(hash(state.state),session.user.id)) throw new Error('REPLAYED_STATE');
    const code = request.nextUrl.searchParams.get('code');
    if (request.nextUrl.searchParams.has('error') || !code || code.length > 4096) return result(origin,'cancelled');
    const tokens = await tokenRequest(cfg.clientId,cfg.clientSecret,new URLSearchParams({ grant_type:'authorization_code',code,redirect_uri: cfg.origin+XERO_CALLBACK }));
    await connect(tokens,session.user.id);
    return result(origin,'connected');
  } catch { return result(origin,'failed'); }
}
