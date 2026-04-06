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

export async function requireStaffSession() {
  const session = await getPortalSession();
  return session ?? null;
}

export async function parseJsonBody(req: Request): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}
