import 'server-only';

import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false as const, response: jsonError('Unauthorized', 401) };
  const role = (session.user as any)?.role as string | undefined;
  if (role !== 'admin') return { ok: false as const, response: jsonError('Forbidden', 403) };
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
