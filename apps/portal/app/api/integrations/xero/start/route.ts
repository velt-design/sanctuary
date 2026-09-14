import { NextResponse } from 'next/server';
import { developer, json, privateHeaders, sameOrigin } from '@/lib/xero/http';
import { config, hash, nonce, seal, XERO_CALLBACK, XERO_SCOPES } from '@/lib/xero/security';
import { saveAttempt } from '@/lib/xero/store';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const session = await developer();
  if (!session) return json({ error: 'Forbidden' }, 403);
  try {
    if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
    const cfg = config(); const state = nonce();
    await saveAttempt(hash(state), session.user.id);
    const url = new URL('https://login.xero.com/identity/connect/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.origin + XERO_CALLBACK, scope: XERO_SCOPES, state }).toString();
    // Navigate separately after the same-origin POST; external form redirects are blocked by CSP.
    const response = NextResponse.json({ authorizationUrl: url.href }, { headers: privateHeaders });
    response.cookies.set('__Host-xero-state', seal({ state, userId: session.user.id, expires: Date.now()+600000 }, cfg.key),
      { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
    return response;
  } catch { return json({ error: 'Xero connection setup is unavailable. Check developer configuration.' }, 503); }
}
