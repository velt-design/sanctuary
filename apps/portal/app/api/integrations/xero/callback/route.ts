import { NextRequest, NextResponse } from 'next/server';
import { developer, json, privateHeaders } from '@/lib/xero/http';
import { config, equalSecret, hash, seal, unseal, XERO_CALLBACK, XERO_PAGE, XERO_SCOPES } from '@/lib/xero/security';
import { boundConsentScopes, consentScopes, XERO_INVOICE_SCOPES } from '@/lib/xero/oauthScopes';
import { connect, consumeAttempt, grantedConsentScopes } from '@/lib/xero/store';
import { connections, tokenRequest } from '@/lib/xero/provider';

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
    const state = unseal<{ state: string; userId: string; expires: number; scopes?: string; mode?: 'connection' | 'reports'; granted?: string[] }>(request.cookies.get('__Host-xero-state')?.value ?? '',cfg.key);
    if (state.userId !== session.user.id || !Number.isFinite(state.expires) || state.expires < Date.now() || !equalSecret(state.state,request.nextUrl.searchParams.get('state') ?? '')) throw new Error('INVALID_STATE');
    if (!await consumeAttempt(hash(state.state),session.user.id)) throw new Error('REPLAYED_STATE');
    const code = request.nextUrl.searchParams.get('code');
    if (request.nextUrl.searchParams.has('error') || !code || code.length > 4096) return result(origin,'cancelled');
    const scopes = state.scopes ?? XERO_SCOPES;
    if (state.mode) {
      if (!['connection', 'reports'].includes(state.mode) || !Array.isArray(state.granted) || scopes !== boundConsentScopes(state.mode, state.granted)) throw new Error('INVALID_SCOPE_ATTEMPT');
      if ((await grantedConsentScopes()).some(scope => !scopes.split(' ').includes(scope))) throw new Error('GRANT_CHANGED_DURING_CONSENT');
    } else if (scopes !== XERO_SCOPES && (scopes !== XERO_INVOICE_SCOPES || consentScopes() !== XERO_INVOICE_SCOPES)) throw new Error('INVALID_SCOPE_ATTEMPT');
    const tokens = await tokenRequest(cfg.clientId,cfg.clientSecret,new URLSearchParams({ grant_type:'authorization_code',code,redirect_uri: cfg.origin+XERO_CALLBACK }),scopes.split(' '));
    if (!cfg.tenantId) {
      const organisations = await connections(tokens.accessToken);
      if (!organisations.length || organisations.length > 5 || organisations.some(item =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.tenantId) || item.tenantName.length > 150)) throw new Error('INVALID_ORGANISATIONS');
      const response = result(origin,'discovered');
      // Only organisation metadata survives this setup request. Never persist discovery tokens.
      response.cookies.set('__Host-xero-organisations',seal({userId:session.user.id,expires:Date.now()+600000,organisations},cfg.key),
        {secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:600});
      return response;
    }
    // Pre-deployment sealed attempts can remain valid for ten minutes. They must
    // not overwrite a broader grant completed after they were initiated either.
    await connect(tokens,session.user.id,true);
    const response = result(origin,'connected');
    response.cookies.set('__Host-xero-organisations','',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
    return response;
  } catch { return result(origin,'failed'); }
}
