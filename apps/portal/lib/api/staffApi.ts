import 'server-only';

import { getPortalSession } from '@/lib/auth';
import { applyRouteDiagnostics, type RouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400, diagnostics?: RouteDiagnostics | null, extra?: Record<string, unknown>) {
  return applyRouteDiagnostics(NextResponse.json({ error: message, ...(extra ?? {}) }, { status }), diagnostics);
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200, diagnostics?: RouteDiagnostics | null) {
  return applyRouteDiagnostics(NextResponse.json(payload, { status }), diagnostics);
}

export async function requireStaffSession() {
  const session = await getPortalSession();
  return session ?? null;
}

export async function requireStaffContext(diagnostics?: RouteDiagnostics | null) {
  const session = await requireStaffSession();
  if (!session) {
    return {
      ok: false as const,
      response: jsonError('Unauthorized', 401, diagnostics),
    };
  }

  const supabase = await getSupabaseServerAuth();
  return {
    ok: true as const,
    session,
    supabase,
  };
}

export async function parseJsonBody(req: Request): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}
