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

export async function requireStaffSession() {
  const session = await getServerSession(authOptions);
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

