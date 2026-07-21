import 'server-only';

import { jsonError, jsonOk } from '@/lib/api/staffApi';
import type { RouteDiagnostics } from '@/lib/api/routeDiagnostics';

export function privateNoStore<T extends Response>(response: T): T {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function commandJsonOk(payload: Record<string, unknown>, diagnostics?: RouteDiagnostics | null) {
  return privateNoStore(jsonOk(payload, 200, diagnostics));
}

export function commandJsonError(message: string, status: number, diagnostics?: RouteDiagnostics | null, code?: string) {
  return privateNoStore(jsonError(message, status, diagnostics, code ? { code } : undefined));
}

export function commandDatabaseError(error: unknown): { status: number; code: string; message: string } {
  const raw = error as { code?: unknown; message?: unknown };
  const code = typeof raw?.code === 'string' ? raw.code : '';
  const message = typeof raw?.message === 'string' ? raw.message : 'Command failed';
  if (code === '42501') return { status: 403, code: 'FORBIDDEN', message };
  if (code === 'P0002') return { status: 404, code: 'NOT_FOUND', message };
  if (code === '40001' || code === '23505') return { status: 409, code: 'STALE_STATE', message };
  if (code === '22023' || code === '22P02' || code === '23502' || code === '23503' || code === '23514') {
    return { status: 400, code: 'INVALID_COMMAND', message };
  }
  return { status: 500, code: 'COMMAND_FAILED', message };
}
