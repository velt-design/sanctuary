import 'server-only';

import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';
import { recordProjectLostConversion } from '@/lib/projects/workItems/lostConversion';
import { PROJECT_LOST_OUTCOMES } from '@/lib/projects/workItems/types';
import { parsePortalActionExecution, PortalActionInputError } from './contract';
import { portalActionBearerHash } from './token';

export function actionJson(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: {
    'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export function actionEnvironment(): 'staging' | 'production' | null {
  if (process.env.PORTAL_ACTIONS_ENABLED !== '1') return null;
  const environment = process.env.PORTAL_ACTIONS_ENVIRONMENT;
  return environment === 'staging' || environment === 'production' ? environment : null;
}

/** Pin the public origin rather than trusting rewritten internal request URLs. */
export function actionSameOrigin(request: Request): boolean {
  try {
    const configured = process.env.PORTAL_ACTIONS_ORIGIN;
    if (!configured) return false;
    const url = new URL(configured);
    const stagingLoopback = process.env.PORTAL_ACTIONS_ENVIRONMENT === 'staging'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:';
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
      || (url.protocol !== 'https:' && !stagingLoopback)) return false;
    return request.headers.get('origin') === url.origin;
  } catch { return false; }
}

export function actionDatabaseError(error: { code?: string } | null) {
  const status = error?.code === '42501' ? 403
    : ['PT409', '40001', '23505'].includes(error?.code ?? '') ? 409
      : ['22023', '22P02', '23514', '23502', '23503'].includes(error?.code ?? '') ? 400 : 503;
  const message = status === 403 ? 'Access denied' : status === 409 ? 'State changed; review required'
    : status === 400 ? 'Invalid Portal action' : 'Portal action service unavailable';
  return actionJson({ error: message }, status);
}

/** Streaming bound applies even when Content-Length is omitted or dishonest. */
export async function actionBody(request: Request, limit: number): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) {
    throw new PortalActionInputError();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new PortalActionInputError(); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new PortalActionInputError(); }
  finally { reader.releaseLock(); }
}

/** A narrow RPC adapter: no arbitrary table, actor, project or payload input. */
export async function handlePortalAction(request: Request, operation: 'connection' | 'projects' | 'commands') {
  const environment = actionEnvironment();
  if (!environment) return actionJson({ error: 'Portal actions disabled' }, 503);
  const tokenHash = portalActionBearerHash(request.headers.get('authorization'));
  if (!tokenHash) return actionJson({ error: 'Unauthorized' }, 401);
  if (new URL(request.url).search) return actionJson({ error: 'Query parameters are not supported' }, 400);
  try {
    const execution = operation === 'commands' ? parsePortalActionExecution(await actionBody(request, 1024)) : null;
    const supabase = getSupabaseServiceRole();
    const rpc = operation === 'commands' ? 'portal_action_execute' : `portal_action_${operation}`;
    const { data, error } = await supabase.rpc(rpc, {
      p_token_hash: tokenHash, p_environment: environment,
      ...(execution ? { p_command_id: execution.commandId } : {}),
    });
    if (error) return actionDatabaseError(error);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return actionDatabaseError(null);
    if (operation !== 'commands') return actionJson(data);
    // The SQL receipt is committed. Subsequent failures must never disguise it as
    // a rejected write. Retry the SAME ID to retrieve that receipt and repair.
    let conversionStatus = 'not_applicable';
    if (data.command === 'CLOSE' && PROJECT_LOST_OUTCOMES.includes(data.outcome)) {
      try {
        await recordProjectLostConversion({ supabase, projectId: data.project_id,
          commandId: execution!.commandId, outcome: data.outcome, replayed: data.replayed === true });
        conversionStatus = 'attempted';
      } catch { conversionStatus = 'retry_required'; }
    }
    let project: Record<string, unknown> | null = null;
    try {
      const read = await supabase.rpc('portal_action_projects', { p_token_hash: tokenHash, p_environment: environment });
      if (!read.error && Array.isArray(read.data?.projects)) {
        project = read.data.projects.find((candidate: Record<string, unknown>) => candidate.projectId === data.project_id) ?? null;
      }
    } catch { /* Return the durable commit with explicit unverified read-back. */ }
    return actionJson({ ...data, committed: true, project, readBackRequired: !project, conversionStatus });
  } catch (error) {
    return error instanceof PortalActionInputError
      ? actionJson({ error: 'Invalid Portal action' }, 400) : actionDatabaseError(null);
  }
}
