import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readBoundedJson } from './marketingPublicRequest';
import { parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { buildStaffConfiguratorRevisionEstimate } from './staffConfiguratorRevisionEstimate.server';
import { hashCalculationValue } from './calculationRefCodec.server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Called by the portal server with its staff session, never with browser-supplied prices. */
export async function prepareStaffConfiguratorRevision(request: Request) {
  const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status,
    headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}});
  const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return json({error: 'Staff sign-in required.'}, 401);
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) return json({error: 'Revision preparation is unavailable.'}, 503);
    const supabase = createClient(url, key, {global: {headers: {Authorization: `Bearer ${token}`}},
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
    const identity = await supabase.auth.getUser(token);
    if (identity.error || !identity.data.user) return json({error: 'Staff sign-in required.'}, 401);
    const actorId = identity.data.user.id;
    const role = await supabase.from('portal_users').select('role').eq('user_id', actorId).maybeSingle();
    if (role.error || !['staff', 'admin'].includes(role.data?.role)) return json({error: 'Staff access required.'}, 403);
    if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({error: 'JSON required.'}, 415);
    const body = record(await readBoundedJson(request, 20000).catch(() => null));
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    const sourceEstimateId = typeof body?.sourceEstimateId === 'string' ? body.sourceEstimateId : '';
    const design = parsePreviewDraft(body?.design);
    if (!uuid.test(projectId) || !uuid.test(sourceEstimateId) || !design) return json({error: 'Invalid revision.'}, 422);
    const source = await supabase.from('estimates').select('id,outputs')
      .eq('project_id', projectId).eq('id', sourceEstimateId).maybeSingle();
    if (source.error) return json({error: 'Source estimate could not be checked.'}, 503);
    if (!source.data) return json({error: 'Source estimate not found.'}, 404);
    const snapshot = record(record(source.data.outputs)?.snapshot);
    if (snapshot?.source !== 'marketing_enquiry') return json({error: 'This estimate has no configured enquiry source.'}, 409);
    const approvedVersion = process.env.WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID?.trim();
    if (!approvedVersion) return json({status: 'unavailable', reason: 'An approved configurator pricebook is required.'}, 409);
    const resolved = await getPublishedCostingConfiguration();
    if (resolved.provenance.versionId !== approvedVersion) return json({error: 'The approved pricebook is unavailable.'}, 503);
    const frozen = calculateFrozenConfiguratorPrice(design, resolved);
    if (!frozen) return json({status: 'custom', reason: 'This design needs complete staff costing before a priced revision can be saved.'}, 422);
    // Private costing stays on this authenticated server-to-server boundary.
    // Preparation does not create an estimate, change the original, or send email.
    const estimate = buildStaffConfiguratorRevisionEstimate({projectId, sourceEstimateId, actorId, sourceSnapshot: snapshot, frozen});
    return json({status: 'prepared', projectId, sourceEstimateId, actorId, frozen, estimate,
      preparationHash: hashCalculationValue(estimate)});
  } catch {
    return json({error: 'Revision preparation is unavailable. Please retry.'}, 503);
  }
}
