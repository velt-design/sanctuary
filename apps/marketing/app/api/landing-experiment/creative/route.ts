import { getServiceSupabase } from '@/lib/supabaseService';
import { readBoundedJson } from '@/lib/marketingPublicRequest';
import { verifyCreativeCommand, validateCreativeIntent } from '../../../../lib/creative-executor/authority';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    if (process.env.SANCTUARY_META_CREATIVE_EXECUTOR_ENABLED !== 'true' || request.headers.has('origin') || new URL(request.url).search) throw new Error('Unavailable');
    const raw = await readBoundedJson(request, 16000);
    if (!raw) throw new Error('Body unavailable');
    const command = verifyCreativeCommand(raw, request.headers.get('x-creative-signature'));
    const db = getServiceSupabase(), signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    const args = { p_binding: process.env.SANCTUARY_LANDING_EXPERIMENT_BINDING, p_command: command.command, p_experiment: command.experiment };
    if (command.stage === 'admit') {
      const state = await db.rpc('meta_creative_executor_command', { ...args, p_stage: 'read', p_payload: {} }).abortSignal(signal);
      if (state.error) throw new Error('Read unavailable'); validateCreativeIntent(command.payload, state.data);
    }
    const result = await db.rpc('meta_creative_executor_command', { ...args, p_stage: command.stage, p_payload: command.payload }).abortSignal(signal);
    if (result.error) throw new Error('Command unavailable');
    return Response.json(result.data, { headers });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers }); }
}
