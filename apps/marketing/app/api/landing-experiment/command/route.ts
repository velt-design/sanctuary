import { getServiceSupabase } from '@/lib/supabaseService';
import { EXPERIMENT_TEMPLATE, experimentHash, verifyExperimentCommand } from '../../../../lib/landingExperiment.server';
import template from '../../../../data/landing-template.generated.json';
import { readBoundedJson } from '@/lib/marketingPublicRequest';
import { LANDING_EXPERIMENT_PATHS,landingControlText,parseLandingCopies } from '../../../../lib/landingExperiment';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    if (process.env.SANCTUARY_LANDING_EXPERIMENT_ENABLED !== 'true' || request.headers.has('origin') || new URL(request.url).search) throw new Error('Disabled');
    // Bounded read before signature verification. No submitted strings are logged.
    const parsed = await readBoundedJson(request, 16000);
    if (!parsed) throw new Error('Body unavailable');
    const body = JSON.stringify(parsed);
    const command = verifyExperimentCommand(body, request.headers.get('x-landing-signature'));
    if (command.stage === 'prepare') {
      const candidate = command.payload as { path:string;copy:string;template:string;evidenceHash:string;candidateHash:string };
      if (candidate.candidateHash !== experimentHash({ path:candidate.path,copy:candidate.copy,template:candidate.template,evidenceHash:candidate.evidenceHash })) throw new Error('Candidate hash differs');
    }
    const result = await getServiceSupabase().rpc('landing_experiment_command', { p_binding: process.env.SANCTUARY_LANDING_EXPERIMENT_BINDING,
      p_command: command.command, p_stage: command.stage, p_experiment: command.experiment, p_payload: command.payload }).abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]));
    if (result.error) throw new Error('Command unavailable');
    if (command.stage === 'read' && result.data?.template !== EXPERIMENT_TEMPLATE) throw new Error('Release changed');
    return Response.json(command.stage === 'read' ? { ...result.data, renderer: template.hash,
      texts:Object.fromEntries(LANDING_EXPERIMENT_PATHS.map(path=>[path,landingControlText(path,parseLandingCopies(result.data.controls[path])??{})])) } : result.data, { headers });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers }); }
}
