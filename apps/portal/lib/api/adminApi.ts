import 'server-only';

import { getPortalSession } from '@/lib/auth';
import { applyRouteDiagnostics, type RouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { NextResponse } from 'next/server';

function applyAdminCachePolicy<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export function jsonError(message: string, status = 400, diagnostics?: RouteDiagnostics | null) {
  return applyAdminCachePolicy(
    applyRouteDiagnostics(NextResponse.json({ error: message }, { status }), diagnostics),
  );
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200, diagnostics?: RouteDiagnostics | null) {
  return applyAdminCachePolicy(
    applyRouteDiagnostics(NextResponse.json(payload, { status }), diagnostics),
  );
}

export async function requireAdminSession() {
  const session = await getPortalSession();
  if (!session) return { ok: false as const, response: jsonError('Unauthorized', 401) };
  if (session.role !== 'admin') return { ok: false as const, response: jsonError('Forbidden', 403) };
  return { ok: true as const, session };
}

export async function requireAdminContext(diagnostics?: RouteDiagnostics | null) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return {
      ok: false as const,
      response:
        auth.response.status === 403 ? jsonError('Forbidden', 403, diagnostics) : jsonError('Unauthorized', 401, diagnostics),
    };
  }

  const supabase = await getSupabaseServerAuth();
  return {
    ok: true as const,
    session: auth.session,
    supabase,
  };
}

export async function parseJsonBody(req: Request): Promise<{ ok: true; body: any } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) };
  }
}
