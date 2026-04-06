import 'server-only';

import { getPortalSession } from '@/lib/auth';
import { applyRouteDiagnostics, type RouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400, diagnostics?: RouteDiagnostics | null) {
  return applyRouteDiagnostics(NextResponse.json({ error: message }, { status }), diagnostics);
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200, diagnostics?: RouteDiagnostics | null) {
  return applyRouteDiagnostics(NextResponse.json(payload, { status }), diagnostics);
}

export async function requireAdminSession() {
  const session = await getPortalSession();
  if (!session) return { ok: false as const, response: jsonError('Unauthorized', 401) };
  if (session.role !== 'admin') return { ok: false as const, response: jsonError('Forbidden', 403) };
  return { ok: true as const, session };
}

export async function parseJsonBody(req: Request): Promise<{ ok: true; body: any } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) };
  }
}
