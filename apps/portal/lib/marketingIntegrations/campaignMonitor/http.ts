import 'server-only';
import { z } from 'zod';
import { authorizePraxisRequest, loadPraxisConnectorConfig, praxisRequestId, praxisResponseHeaders } from '../../praxis/server';
import { metaConfig, metaControlConfig } from '../meta/config';
import { metaStore } from '../meta/store';
import { scopedMetaDelegation } from '../meta/delegation';
import { openMetaReportCredential } from '../metaCredentials/runtime';
import { verifyMeta } from '../meta/verify';
import type { Boundary } from '../meta/boundary';
import { supabaseServiceRole } from '../../supabaseClient';
import { campaignScope, campaignRequest, campaignPeriods, outcomesSchema, registeredCreativeAdSchema, steadyAdSchema } from './contract';
import { readCampaignHealth } from './reader';

export async function campaignHealthResponse(request: Request): Promise<Response> {
  const requestId = praxisRequestId(), headers = praxisResponseHeaders(requestId);
  let failed: (() => Promise<unknown>) | undefined;
  let lease: Awaited<ReturnType<typeof openMetaReportCredential>>;
  try {
    if (process.env.SANCTUARY_CAMPAIGN_MONITOR_ENABLED !== 'true') return Response.json({ error: 'disabled' }, { status: 503, headers });
    const source = loadPraxisConnectorConfig(); authorizePraxisRequest(request, source);
    if (request.method !== 'GET' || new URL(request.url).search || request.body || request.headers.has('origin')) return Response.json({ error: 'invalid_request' }, { status: 400, headers });
    const control = metaControlConfig(), scope = campaignScope(), signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
    if (control.account !== scope.account) throw new Error('Account differs.');
    const delegation = scopedMetaDelegation(request, campaignRequest, signal);
    // The credential lifecycle calls this callback from its own check(). It
    // must not call the returned lease again, which would recurse indefinitely.
    const authorize = async () => {
      signal.throwIfAborted();
      if (process.env.SANCTUARY_CAMPAIGN_MONITOR_ENABLED !== 'true' || JSON.stringify(metaControlConfig()) !== JSON.stringify(control) || JSON.stringify(campaignScope()) !== JSON.stringify(scope)) throw new Error('Monitor disabled.');
      authorizePraxisRequest(request, loadPraxisConnectorConfig()); await delegation();
    };
    await authorize(); lease = await openMetaReportCredential(signal, authorize);
    const current = async () => { if (lease) await lease.check(); else await authorize(); };
    const config = lease?.reportConfig ?? metaConfig();
    if (config.actor !== control.actor || config.binding !== control.binding || config.account !== control.account) throw new Error('Credential association differs.');
    const command = metaStore(control, source), now = new Date(), period = campaignPeriods(now).week;
    const claim = z.object({ operation: z.uuid(), generation: z.number().int().positive() }).strict().parse(await command('claim', null, signal, {
      query: JSON.stringify({ ...period, retain: false, health: true, scope }),
    }));
    failed = () => command('failed', claim.operation, AbortSignal.timeout(5000));
    const boundary: Boundary = async (step, execute) => {
      await current(); await command('before', claim.operation, signal, { step });
      const value = await execute(); await current(); await command('after', claim.operation, signal, { step }); return value;
    };
    const fetcher: typeof fetch = (url, init) => fetch(url, { ...init, signal });
    const account = await verifyMeta(config, boundary, fetcher);
    const registryResult = await supabaseServiceRole.rpc('meta_creative_reporting_registry').abortSignal(signal);
    // Before additive schema installation an empty registry preserves the existing
    // four-ad contract. Any undeclared extra campaign ad still fails closed below.
    const registry = registryResult.error ? [] : registryResult.data;
    const inventory = Array.isArray(registry) ? { experimental: z.array(registeredCreativeAdSchema).max(40).parse(registry), steady: [] } :
      z.object({ version: z.literal(2), experimental: z.array(registeredCreativeAdSchema).max(40), steady: z.array(steadyAdSchema).max(40) }).strict().parse(registry);
    await current();
    const report = await readCampaignHealth(config, account, boundary, fetcher, now, inventory.experimental, inventory.steady);
    await current(); await command('complete', claim.operation, signal, { payload: JSON.stringify(report) }); failed = undefined;
    // Source-owned campaign-to-project facts. A failure remains partial coverage.
    let outcomes: z.infer<typeof outcomesSchema> | null = null;
    try {
      const result = await supabaseServiceRole.rpc('sanctuary_campaign_outcomes', { p_actor: control.actor, p_account: control.account, p_binding: control.binding,
        p_source: source.sourceKey, p_connection: source.connectionId, p_environment: source.environment, p_operation: claim.operation }).abortSignal(signal);
      if (!result.error) {
        outcomes = outcomesSchema.parse(result.data);
        while (Buffer.byteLength(JSON.stringify(outcomes)) > 240_000 && outcomes.correspondence.contacts.length) {
          outcomes.correspondence.contacts.pop(); outcomes.correspondence.omitted++;
        }
      }
    } catch { /* Do not replace unavailable canonical facts with zeros. */ }
    await current(); await command('deliver', claim.operation, signal);
    return Response.json({ schemaVersion: 'sanctuary.praxis.campaign-health.v1', requestId,
      source: { sourceKey: source.sourceKey, connectionId: source.connectionId, environment: source.environment, authority: 'canonical', retrievedAt: new Date().toISOString() },
      operation: claim.operation, report, outcomes }, { headers });
  } catch {
    await failed?.().catch(() => undefined);
    return Response.json({ error: 'campaign_health_unavailable' }, { status: 503, headers });
  } finally { await lease?.finish().catch(() => undefined); }
}
