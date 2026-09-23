import { NextResponse } from 'next/server';
import { developer, json, privateHeaders, sameOrigin } from '@/lib/xero/http';
import { config, hash, nonce, seal, XERO_CALLBACK } from '@/lib/xero/security';
import { boundConsentScopes } from '@/lib/xero/oauthScopes';
import { saveAttempt, grantedConsentScopes } from '@/lib/xero/store';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const session = await developer();
  if (!session) return json({ error: 'Forbidden' }, 403);
  try {
    if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== 'mode') || params.getAll('mode').length > 1 || (params.has('mode') && params.get('mode') !== 'reports')) return json({ error: 'Invalid connection request.' }, 400);
    const mode = params.get('mode') === 'reports' ? 'reports' : 'connection';
    const cfg = config(); const state = nonce(); const granted = await grantedConsentScopes(); const scopes = boundConsentScopes(mode, granted);
    await saveAttempt(hash(state), session.user.id);
    const url = new URL('https://login.xero.com/identity/connect/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.origin + XERO_CALLBACK, scope: scopes, state }).toString();
    // Navigate separately after the same-origin POST; external form redirects are blocked by CSP.
    const response = NextResponse.json({ authorizationUrl: url.href }, { headers: privateHeaders });
    response.cookies.set('__Host-xero-state', seal({ state, userId: session.user.id, expires: Date.now()+600000, scopes, mode, granted }, cfg.key),
      { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
    return response;
  } catch { return json({ error: 'Xero connection setup is unavailable. Check developer configuration.' }, 503); }
}
