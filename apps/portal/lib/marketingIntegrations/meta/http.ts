import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authorizePraxisRequest, loadPraxisConnectorConfig, praxisRequestId, praxisResponseHeaders } from '../../praxis/server';
import { metaConfig, metaControlConfig } from './config';
import { metaStore, MetaStoreFailure } from './store';
import { verifyMeta } from './verify';
import { readMetaCampaigns } from './reader';
import { metaReportSchema, validateMetaPeriod, type MetaReport } from './report';
import type { Boundary } from './boundary';
import { parseMetaSnapshot } from './snapshot';
import { metaDelegation } from './delegation';

const deps = { source: loadPraxisConnectorConfig, control: metaControlConfig, credentials: metaConfig, store: metaStore,
  verify: verifyMeta, read: readMetaCampaigns, fetcher: fetch, delegation: metaDelegation };


async function emptyBody(request: Request) {
  if (!request.body) return true;
  const reader = request.body.getReader(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([(async () => { while (true) { const value = await reader.read(); if (value.done) return true; if (value.value.byteLength) return false; } })(),
    new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 1000); })]); }
  finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
}

export async function sanctuaryMetaResponse(request: Request, dependencies = deps): Promise<Response> {
  const requestId = praxisRequestId(), headers = praxisResponseHeaders(requestId);
  let failOperation: (() => Promise<unknown>) | undefined;
  // All labels below are fixed code literals. Never include exception text,
  // provider data, request values, identities or credentials in diagnostics.
  let stage = 'authorize';
  let diagnosticAction: 'unknown' | 'refresh' | 'read' | 'delete' = 'unknown';
  const at = async <T>(label: string, execute: () => T | Promise<T>): Promise<T> => { stage = label; return execute(); };
  try {
    const source = dependencies.source(); authorizePraxisRequest(request, source);
    const url = new URL(request.url), action = url.searchParams.get('action');
    if (!['refresh', 'read', 'delete'].includes(action ?? '') || request.method !== (action === 'delete' ? 'DELETE' : 'GET') || !(await emptyBody(request))
      || [...url.searchParams.keys()].some(key => !['action', ...(action === 'refresh' ? ['start', 'end', 'retain'] : [])].includes(key) || url.searchParams.getAll(key).length !== 1)) {
      return Response.json({ error: 'invalid_meta_request' }, { status: 400, headers });
    }
    diagnosticAction = action as 'refresh' | 'read' | 'delete';
    stage = 'control';
    const control = dependencies.control(process.env, action === 'delete');
    const command = dependencies.store(control, source);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const current = () => {
      signal.throwIfAborted();
      const latest = dependencies.control(process.env, action === 'delete');
      if (JSON.stringify(latest) !== JSON.stringify(control)) throw new Error('Source configuration changed.');
      authorizePraxisRequest(request, dependencies.source());
    };
    const envelope = (result: object) => ({ schemaVersion: 'sanctuary.praxis.meta.v1', requestId,
      source: { sourceKey: source.sourceKey, connectionId: source.connectionId, environment: source.environment, authority: 'canonical', accountId: control.account, retrievedAt: new Date().toISOString() }, ...result });
    if (action === 'delete') {
      const raw = await at('rpc_delete', () => command('delete', null, signal));
      stage = 'parse_delete';
      const result = z.object({ status: z.literal('deleted') }).strict().parse(raw);
      stage = 'delete_final_authority'; current(); return Response.json(envelope(result), { headers });
    }
    let transient: { operation: string; generation: number; report: MetaReport } | undefined;
    let refreshedOperation: string | undefined;
    let checkDelegation: (()=>Promise<void>) | undefined;
    if (action === 'refresh') {
      stage = 'parse_refresh';
      const retain = z.enum(['true','false']).parse(url.searchParams.get('retain')) === 'true';
      const period = validateMetaPeriod({ start: url.searchParams.get('start'), end: url.searchParams.get('end') });
      checkDelegation = dependencies.delegation(request,period,retain,signal,dependencies.fetcher);
      await at('delegation_initial', checkDelegation);
      stage = 'credentials';
      const config = dependencies.credentials();
      if (config.binding !== control.binding || config.account !== control.account || config.actor !== control.actor) throw new Error('Credential association changed.');
      const rawClaim = await at('rpc_claim', () => command('claim', null, signal, { query: JSON.stringify({...period,retain}) }));
      stage = 'parse_claim';
      const claim = z.object({ operation: z.uuid(), generation: z.number().int().positive() }).strict().parse(rawClaim);
      refreshedOperation = claim.operation;
      failOperation = () => command('failed', claim.operation, AbortSignal.timeout(5000));
      const boundary: Boundary = async (step, execute) => {
        stage = 'boundary_authority'; current(); await at('delegation_before', checkDelegation!);
        await at('rpc_before', () => command('before', claim.operation, signal, { step }));
        const result = await at('provider_read', execute); stage = 'boundary_authority'; current();
        await at('delegation_after', checkDelegation!); await at('rpc_after', () => command('after', claim.operation, signal, { step })); stage = 'read_report'; return result;
      };
      const fetcher: typeof fetch = (url, init) => dependencies.fetcher(url, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
      const account = await at('verify_account', () => dependencies.verify(config, boundary, fetcher));
      const rawReport = await at('read_report', () => dependencies.read(config.token, config.account, config.appSecret, period, account, boundary, fetcher));
      stage = 'parse_report'; const report = metaReportSchema.parse(rawReport);
      stage = 'completion_authority'; current();
      await at('delegation_complete', checkDelegation);
      const completed = await at('rpc_complete', () => command('complete', claim.operation, signal, { payload: JSON.stringify(report) }));
      stage = 'parse_complete';
      z.object({ status: z.literal('completed'), operation: z.literal(claim.operation), retained: z.literal(retain) }).strict().parse(completed);
      if (!retain) transient = { ...claim, report };
      failOperation = undefined;
    }
    const raw = await at('rpc_read', () => command('read', null, signal)); stage = 'delivery_authority'; current();
    if (refreshedOperation) await at('rpc_deliver', () => command('deliver',refreshedOperation!,signal));
    if (checkDelegation) await at('delegation_deliver', checkDelegation);
    stage = 'parse_delivery';
    if (transient) return Response.json(envelope({ status: 'available', retained: false, operation: transient.operation, generation: transient.generation,
      resultHash: createHash('sha256').update(JSON.stringify(transient.report)).digest('hex'), expiresAt: new Date(Date.parse(transient.report.fetchedAt)+7*86400000).toISOString(), report: transient.report }), { headers });
    if (z.object({ status: z.literal('missing') }).strict().safeParse(raw).success) return Response.json(envelope({ status: 'missing' }), { headers });
    const { saved, report } = parseMetaSnapshot(raw);
    if (refreshedOperation && saved.operation !== refreshedOperation) throw new Error('Source report superseded.');
    const response = envelope({ status: 'available', retained: true, operation: saved.operation, generation: saved.generation,
      resultHash: saved.resultHash, expiresAt: new Date(saved.expiresAt).toISOString(), report });
    if (Buffer.byteLength(JSON.stringify(response)) > 262144) throw new Error('Source response exceeds bound.');
    return Response.json(response, { headers });
  } catch (error) {
    console.warn('sanctuary_meta_failure', { action: diagnosticAction, stage,
      sqlState: error instanceof MetaStoreFailure ? error.sqlState : null });
    if (failOperation) await failOperation().catch(() => undefined);
    return Response.json({ error: 'sanctuary_meta_unavailable' }, { status: 503, headers });
  }
}
