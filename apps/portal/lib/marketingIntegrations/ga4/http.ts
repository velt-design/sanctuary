import 'server-only';
import { z } from 'zod';
import { authorizePraxisRequest, loadPraxisConnectorConfig, praxisRequestId, praxisResponseHeaders } from '../../praxis/server';
import { parseMarketingQuery, readPraxisMarketing } from '../../praxis/marketing-read';
import { ga4Config, ga4ControlConfig } from './config';
import { ga4Store, ga4LifecycleStore, Ga4StoreFailure } from './store';
import { refreshGa4Report, type Ga4Vault } from './lifecycle';
import { ga4Google } from './providers';
import { ga4Delegation } from './delegation';
import { readGa4Report, reportHash, reportIntent } from './report/ga4';
import { parseReportResponse } from './report/response';
import { businessOutcomes, type BusinessEvidence } from './report/outcomes';

export const ga4HttpDependencies = {
  source: loadPraxisConnectorConfig, control: ga4ControlConfig, credentials: ga4Config, store: ga4Store,
  google: ga4Google, read: readGa4Report, business: readPraxisMarketing, delegation: ga4Delegation, fetcher: fetch,
};
type Dependencies = typeof ga4HttpDependencies & { vault: (config: ReturnType<typeof ga4Config>) => Ga4Vault };
const available = z.object({ status: z.literal('available'), operation: z.uuid(), generation: z.number().int().positive(),
  payload: z.string().max(262144), resultHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.iso.datetime({ offset: true }) }).strict();

async function emptyBody(request: Request) {
  if (!request.body) return true;
  const reader = request.body.getReader(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([(async () => {
      while (true) { const chunk = await reader.read(); if (chunk.done) return true; if (chunk.value.byteLength) return false; }
    })(), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 1000); })]);
  } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
}

export async function sanctuaryGa4Response(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = praxisRequestId(), headers = praxisResponseHeaders(requestId);
  let stage = 'authorize';
  let failOperation: (() => Promise<unknown>) | undefined;
  try {
    const source = dependencies.source(); authorizePraxisRequest(request, source);
    const url = new URL(request.url), action = url.searchParams.get('action');
    const allowed = ['action', ...(action === 'refresh' ? ['start', 'end', 'comparisonStart', 'comparisonEnd', 'retain'] : [])];
    if (!['refresh', 'read', 'delete'].includes(action ?? '') || request.method !== (action === 'delete' ? 'DELETE' : 'GET')
      || !(await emptyBody(request)) || [...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) {
      return Response.json({ error: 'invalid_ga4_request' }, { status: 400, headers });
    }
    const control = dependencies.control(process.env, action === 'delete');
    const command = dependencies.store(control, source);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(110000)]);
    const current = () => {
      signal.throwIfAborted();
      if (JSON.stringify(dependencies.control(process.env, action === 'delete')) !== JSON.stringify(control)) throw new Error('Control changed.');
      const latest = dependencies.source();
      if (latest.sourceKey !== source.sourceKey || latest.connectionId !== source.connectionId || latest.environment !== source.environment) throw new Error('Source changed.');
      authorizePraxisRequest(request, latest);
    };
    const envelope = (value: object) => ({ schemaVersion: 'sanctuary.praxis.ga4.v1', requestId,
      source: { sourceKey: source.sourceKey, connectionId: source.connectionId, environment: source.environment,
        authority: 'canonical', propertyId: control.property, retrievedAt: new Date().toISOString() }, ...value });
    if (action === 'delete') {
      stage = 'delete';
      const result = z.object({ status: z.literal('deleted') }).strict().parse(await command('delete', null, signal));
      current(); return Response.json(envelope(result), { headers });
    }
    let refreshed: string | undefined, delegation: (() => Promise<void>) | undefined;
    if (action === 'refresh') {
      stage = 'query';
      if (url.searchParams.get('retain') !== 'true') return Response.json({ error: 'invalid_ga4_request' }, { status: 400, headers });
      const queryUrl = new URL(url); queryUrl.searchParams.delete('action'); queryUrl.searchParams.delete('retain');
      const query = parseMarketingQuery(queryUrl);
      delegation = dependencies.delegation(request, query, signal, dependencies.fetcher);
      await delegation(); current();
      const config = dependencies.credentials();
      if (config.actor !== control.actor || config.propertyId !== control.property || config.binding !== control.binding) throw new Error('Credentials changed.');
      stage = 'claim';
      const claim = z.object({ operation: z.uuid(), generation: z.number().int().positive() }).strict().parse(await command('claim', null, signal, { query }));
      refreshed = claim.operation;
      const store = ga4LifecycleStore(command, claim.operation, signal);
      failOperation = () => store.finish('uncertain');
      const guarded = { ...store, before: async (...args: Parameters<typeof store.before>) => {
        current(); await delegation!(); await store.before(...args);
      } };
      const intent = reportIntent(control.property, query);
      stage = 'collect';
      const report = await refreshGa4Report({ config, vault: dependencies.vault(config), google: dependencies.google(dependencies.fetcher, signal),
        store: guarded, signal, intent,
        read: async token => {
          const ga4 = await dependencies.read(token, control.property, query, signal, dependencies.fetcher);
          let business: BusinessEvidence;
          try {
            current(); await delegation!();
            const evidence = await dependencies.business(query, source, requestId);
            if (evidence.timezone !== ga4.timezone) throw new Error('Business timezone differs.');
            business = { status: 'available', binding: reportHash({ sourceKey: source.sourceKey, connectionId: source.connectionId,
              environment: source.environment, propertyId: control.property }), operations: [claim.operation], report: businessOutcomes(evidence) };
          } catch { business = { status: 'unavailable', reason: 'complete_snapshot_unavailable' }; }
          return parseReportResponse({ ...ga4, business }, query);
        },
        evidence: value => ({ ...intent, resultHash: reportHash(value), rowCount: value.traffic.length + value.channels.length + value.landing.length + value.events.length,
          warningCount: value.warnings.length, timezone: value.timezone }),
      });
      stage = 'complete'; current(); await delegation();
      const payload = JSON.stringify(report);
      if (Buffer.byteLength(payload) > 262144) throw new Error('Report exceeds bound.');
      z.object({ status: z.literal('completed'), operation: z.literal(claim.operation) }).strict()
        .parse(await command('complete', claim.operation, signal, { payload }));
      failOperation = undefined;
    }
    stage = 'read';
    const raw = await command('read', null, signal); current();
    if (z.object({ status: z.literal('missing') }).strict().safeParse(raw).success) {
      if (refreshed) throw new Error('Completed report missing.');
      return Response.json(envelope({ status: 'missing' }), { headers });
    }
    const saved = available.parse(raw);
    if (refreshed && saved.operation !== refreshed) throw new Error('Report superseded.');
    if (Buffer.byteLength(saved.payload) > 262144 || reportHash(JSON.parse(saved.payload)) !== saved.resultHash) throw new Error('Report integrity unavailable.');
    const parsed = JSON.parse(saved.payload);
    const report = parseReportResponse(parsed, parsed.query);
    if (report.property !== control.property || Date.parse(report.fetchedAt) > Date.now() + 5000 || Date.parse(saved.expiresAt) <= Date.now()
      || Date.parse(saved.expiresAt) !== Date.parse(report.fetchedAt) + 7 * 86400000) throw new Error('Report association unavailable.');
    stage = 'deliver';
    await command('deliver', saved.operation, signal); current(); if (delegation) await delegation();
    const response = envelope({ status: 'available', retained: true, operation: saved.operation, generation: saved.generation,
      resultHash: saved.resultHash, expiresAt: new Date(saved.expiresAt).toISOString(), report });
    if (Buffer.byteLength(JSON.stringify(response)) > 262144) throw new Error('Response exceeds bound.');
    return Response.json(response, { headers });
  } catch (error) {
    console.warn('sanctuary_ga4_failure', { stage, sqlState: error instanceof Ga4StoreFailure ? error.sqlState : null });
    if (failOperation) await failOperation().catch(() => undefined);
    return Response.json({ error: 'sanctuary_ga4_unavailable' }, { status: 503, headers });
  }
}
