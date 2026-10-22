import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabaseService';
import { marketingAbuseKey, readBoundedJson, takeMarketingRateLimit } from '@/lib/marketingPublicRequest';
import { LANDING_EXPERIMENT_PATHS, parseLandingCopies,experimentCookieName } from '../../../lib/landingExperiment';
import { EXPERIMENT_TEMPLATE, readAssignment, requestAssignment, signAssignment,readProbe,PROBE_COOKIE,readProbeReceipt,signProbeReceipt } from '../../../lib/landingExperiment.server';
export const runtime = 'nodejs';
export const maxDuration = 5;
// Shared across the limiter and visit RPC, never two independent waits.
const VISIT_DEADLINE_MS = 1500;
const inputSchema = z.object({ stage: z.enum(['assign','expose','revoke']), path: z.enum(LANDING_EXPERIMENT_PATHS),
  consent: z.boolean(), receipt: z.string().max(1500).optional(),
  display:z.object({mobile:z.boolean(),actionFirst:z.boolean()}).strict().optional(),
  utm: z.object({ utm_source: z.literal('facebook'), utm_medium: z.literal('paid_social'), utm_campaign: z.string().regex(/^[1-9]\d{0,19}$/),
    utm_content: z.string().regex(/^[1-9]\d{0,19}$/), utm_term: z.string().regex(/^[1-9]\d{0,19}$/) }).strict().optional() }).strict();
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(VISIT_DEADLINE_MS)]);
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || new URL(request.url).search) return Response.json({}, { status: 403, headers });
    const input = inputSchema.parse(await readBoundedJson(request, 4000, signal));
    if(input.display&&input.stage!=='expose')throw new Error('Unexpected display receipt');
    const probeHeader=request.headers.get('x-landing-probe'),probe=readProbe(probeHeader);
    if(probeHeader&&(!probe||probe.path!==input.path||new URL(request.url).origin!=='https://www.sanctuarypergolas.co.nz'))throw new Error('Invalid diagnostic');
    // Diagnostic receipts are a different signing purpose. Never reinterpret
    // one as a new genuine assignment or write a real visitor cookie.
    if(input.receipt&&!probe&&!readAssignment(input.receipt))throw new Error('Invalid assignment');
    const previous = input.receipt ? readAssignment(input.receipt) : requestAssignment(request,input.path),cookie=experimentCookieName(input.path);
    if (process.env.SANCTUARY_LANDING_EXPERIMENT_ENABLED !== 'true' && input.stage !== 'revoke') return Response.json({ assignment: null, controlCopies: null }, { headers });
    const db = getServiceSupabase();
    const limit = await takeMarketingRateLimit(db, { scope: 'landing_experiment', keyHash: marketingAbuseKey(request), maxHits: 30, windowSeconds: 60 }, signal);
    if (!limit.ok) return Response.json({}, { status: 429, headers });
    if (input.stage !== 'revoke' && !input.consent) throw new Error('Consent required');
    if (input.stage === 'assign' && !input.utm) throw new Error('Attribution required');
    if(probe){
      if(input.stage==='revoke')throw new Error('Diagnostic stage unavailable');
      const cookies=(request.headers.get('cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(`${PROBE_COOKIE}=`));
      const cookieReceipt=cookies.length===1?cookies[0].slice(PROBE_COOKIE.length+1):null;
      const cookieAccepted=readProbeReceipt(cookieReceipt,probe.probe);
      if(input.stage==='expose'&&(!cookieAccepted||!readProbeReceipt(input.receipt,probe.probe)))throw new Error('Diagnostic cookie unavailable');
      const result=await db.rpc('landing_experiment_probe_visit',{p_probe:probe.probe,p_stage:input.stage,p_path:input.path,p_template:EXPERIMENT_TEMPLATE,p_generation:probe.generation,
        p_candidate:probe.candidateHash,p_mode:probe.mode,p_cookie:cookieAccepted,p_ad:input.utm?.utm_content??null,p_campaign:input.utm?.utm_campaign??null,p_adset:input.utm?.utm_term??null}).abortSignal(signal);
      if(result.error||!result.data?.assignment)throw new Error('Diagnostic serving unavailable');
      const receipt=signProbeReceipt(probe.probe);
      return Response.json({assignment:{...result.data,receipt},controlCopies:null,diagnostic:true},{headers:{...headers,'Set-Cookie':`${PROBE_COOKIE}=${receipt}; Path=/api/landing-experiment; SameSite=Strict; Secure; HttpOnly; Max-Age=120`}});
    }
    if (input.stage !== 'assign' && (!previous || previous.path !== input.path)) throw new Error('Receipt required');
    const assignment = previous?.path === input.path ? previous.assignment : randomUUID();
    const result = await db.rpc('landing_experiment_visit', { p_stage: input.stage, p_id: assignment, p_path: input.path,p_template:EXPERIMENT_TEMPLATE,
      p_display:input.display??null,
      p_ad: input.utm?.utm_content ?? null, p_campaign: input.utm?.utm_campaign ?? null, p_adset: input.utm?.utm_term ?? null }).abortSignal(signal);
    if (result.error) throw new Error('Visit unavailable');
    if (input.stage === 'revoke') return Response.json({}, { headers: { ...headers, 'Set-Cookie': `${cookie}=; Path=/; SameSite=Lax; Secure; Max-Age=0` } });
    if (!result.data?.assignment) return Response.json({ assignment: null, controlCopies: parseLandingCopies(result.data?.control) }, { headers });
    const row = result.data;
    const receipt = signAssignment({ assignment: row.assignment, experiment: row.experiment, path: row.path });
    return Response.json({ assignment: { ...row, receipt }, controlCopies: null }, { headers: { ...headers,
      'Set-Cookie': `${cookie}=${receipt}; Path=/; SameSite=Lax; Secure; Max-Age=2419200` } });
  } catch { return Response.json({ assignment: null, controlCopies: null }, { status: 503, headers }); }
}
