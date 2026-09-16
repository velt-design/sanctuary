import { requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { configuratorMarketingOrigin } from '@/lib/projects/configuratorRevisionNavigation';
import { configuratorRevisionHeaders } from '@/lib/projects/configuratorRevisionTransport.server';

export const runtime = 'nodejs';
const record = (value: unknown): Record<string, any> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status,
  headers: {'Cache-Control': 'private, no-store'}});
type Context = {params: Promise<{projectId: string}>};

export async function GET(request: Request, context: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  try {
    const projectId = uuidFromAppId((await context.params).projectId, 'proj');
    const requestedSource = new URL(request.url).searchParams.get('sourceEstimateId');
    let query = auth.supabase.from('estimates').select('id,outputs')
      .eq('project_id', projectId).eq('outputs->snapshot->>source', 'marketing_enquiry')
      .order('created_at', {ascending: false}).limit(50);
    if (requestedSource) query = query.eq('id', uuidFromAppId(requestedSource, 'est'));
    const rows = await query;
    if (rows.error) return json({error: 'The configured design could not be loaded.'}, 503);
    const source = rows.data?.find(row => {
      const snapshot = record(record(row.outputs)?.snapshot);
      return record(snapshot?.frozenConfiguratorPrice)?.design || record(snapshot?.customerBrief)?.design;
    });
    if (!source) return json({error: 'No saved configurator design was found for this project.'}, 404);
    const snapshot = record(record(source.outputs)?.snapshot)!;
    return json({projectId, sourceEstimateId: source.id,
      design: record(snapshot.frozenConfiguratorPrice)?.design ?? record(snapshot.customerBrief)?.design,
      marketingOrigin: configuratorMarketingOrigin()});
  } catch { return json({error: 'The configured design could not be loaded.'}, 503); }
}

export async function POST(request: Request, context: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({error: 'JSON required.'}, 415);
  try {
    const projectId = uuidFromAppId((await context.params).projectId, 'proj');
    // Read a bounded stream before forwarding any design or session to marketing.
    const reader = request.body?.getReader();
    if (!reader) return json({error: 'Revision data is required.'}, 422);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 20000) { await reader.cancel(); return json({error: 'Revision data is too large.'}, 413); }
      chunks.push(value);
    }
    const body = record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!body || !['prepare','save'].includes(body.action)) return json({error: 'Invalid revision action.'}, 422);
    const session = await auth.supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return json({error: 'Please sign in again.'}, 401);
    const marketingOrigin = configuratorMarketingOrigin();
    const upstream = await fetch(`${marketingOrigin}/api/staff/configurator-revisions/${body.action}`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: configuratorRevisionHeaders(marketingOrigin, token),
      body: JSON.stringify({projectId, sourceEstimateId: body.sourceEstimateId, design: body.design,
        requestId: body.requestId, preparationHash: body.preparationHash}),
    });
    const result = record(await upstream.json());
    if (!upstream.ok) {
      if (record(result?.error)?.message === 'Protected deployment') {
        return json({error: 'The protected pricing preview is not connected. Please contact an administrator.', code: 'CONFIGURATOR_PREVIEW_AUTH_REQUIRED'}, 503);
      }
      return json({error: typeof result?.error === 'string' ? result.error : typeof result?.reason === 'string' ? result.reason : 'The revision could not be prepared.', code: result?.code}, upstream.status);
    }
    if (body.action === 'prepare') {
      const price = record(record(result?.frozen)?.customerPrice);
      if (result?.status !== 'prepared' || !price) return json({error: 'The revised price could not be confirmed.'}, 503);
      // Deliberately project selling data only. Never send prepared estimates/private costs to the browser.
      return json({status: 'prepared', preparationHash: result.preparationHash,
        price: {amountIncGst: price.amountIncGst, includesGst: price.includesGst, currency: price.currency,
          breakdown: Array.isArray(price.breakdown) ? price.breakdown.map(line => ({label: line.label, amountIncGst: line.amountIncGst})) : []}});
    }
    if (result?.status !== 'saved') return json({error: 'The revision save could not be confirmed.'}, 503);
    return json({status: 'saved', revisionId: result.revisionId, estimateId: result.estimateId, alreadyExisted: result.alreadyExisted});
  } catch { return json({error: 'The revision could not be confirmed. Please retry.'}, 503); }
}
