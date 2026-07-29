import 'server-only';

import type { RouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk } from '@/lib/api/staffApi';

export function privateNoStore<T extends Response>(response: T): T {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function workJsonOk(payload: Record<string, unknown>, diagnostics?: RouteDiagnostics | null) {
  return privateNoStore(jsonOk(payload, 200, diagnostics));
}

export function workJsonError(
  message: string,
  status: number,
  diagnostics?: RouteDiagnostics | null,
  code?: string,
) {
  return privateNoStore(jsonError(message, status, diagnostics, code ? { code } : undefined));
}

export function workDatabaseError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const raw = error as { code?: unknown; message?: unknown };
  const databaseCode = typeof raw?.code === 'string' ? raw.code : '';
  const message = typeof raw?.message === 'string' ? raw.message : 'Project work command failed';
  if (databaseCode === '42501') return { status: 403, code: 'FORBIDDEN', message };
  if (databaseCode === 'P0002') return { status: 404, code: 'NOT_FOUND', message };
  if (databaseCode === '40001' || databaseCode === '23505') {
    return { status: 409, code: 'STALE_STATE', message };
  }
  if (
    databaseCode === '42P01'
    || databaseCode === '42883'
    || databaseCode === 'PGRST200'
    || databaseCode === 'PGRST202'
    || databaseCode === 'PGRST205'
    || /schema cache|business_calendar_unavailable|calendar coverage/i.test(message)
  ) {
    return { status: 503, code: 'WORK_ITEMS_UNAVAILABLE', message };
  }
  if (
    databaseCode === '22023'
    || databaseCode === '22P02'
    || databaseCode === '23502'
    || databaseCode === '23503'
    || databaseCode === '23514'
  ) {
    return { status: 400, code: 'INVALID_COMMAND', message };
  }
  return { status: 500, code: 'COMMAND_FAILED', message };
}
