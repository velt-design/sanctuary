import {z} from 'zod';
import {EXPERIMENT_TEMPLATE} from '../../../../lib/landingExperiment.server';
import {landingCompatibility} from '../../../../lib/landingCompatibility.server';
import { getServiceSupabase } from '@/lib/supabaseService';
import { readBoundedJson } from '@/lib/marketingPublicRequest';
import {stateSchema,executionPlanSchema} from '../../../../lib/creative-executor/contract';
import { verifyCreativeCommand, validateCreativeIntent, validateCreativeDispatch } from '../../../../lib/creative-executor/authority';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    if (process.env.SANCTUARY_META_CREATIVE_EXECUTOR_ENABLED !== 'true' || request.headers.has('origin') || new URL(request.url).search) throw new Error('Unavailable');
    const raw = await readBoundedJson(request, 16000);
    if (!raw) throw new Error('Body unavailable');
    const command = verifyCreativeCommand(raw, request.headers.get('x-creative-signature'));
    if(command.stage==='prepare' && z.object({plan:executionPlanSchema}).parse(command.payload).plan.landingTemplate!==EXPERIMENT_TEMPLATE)throw new Error('Creative template changed');
    const db = getServiceSupabase(), signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    const args = { p_binding: process.env.SANCTUARY_LANDING_EXPERIMENT_BINDING, p_command: command.command, p_experiment: command.experiment };
    if (command.stage === 'admit'||command.stage==='check') {
      const state = await db.rpc('meta_creative_executor_command', { ...args, p_stage: 'read', p_payload: {} }).abortSignal(signal);
      if (state.error) throw new Error('Read unavailable');
      if(command.stage==='admit')validateCreativeIntent(command.payload, state.data, EXPERIMENT_TEMPLATE);
      else validateCreativeDispatch(command.command,(command.payload as {requestHash:string}).requestHash,state.data,EXPERIMENT_TEMPLATE);
    }
    const result = await db.rpc('meta_creative_executor_command', { ...args, p_stage: command.stage, p_payload: command.payload }).abortSignal(signal);
    if (result.error) throw new Error('Command unavailable');
    if(command.stage==='read'){
      const state=stateSchema.parse(result.data);
      // Authenticated exact state remains readable for existing owned cleanup.
      // It is not authority for a new preparation or non-cleanup effect.
      return Response.json({...state,...(state.template!==EXPERIMENT_TEMPLATE?{compatibility:landingCompatibility(state.template)}:{})},{headers});
    }
    return Response.json(result.data, { headers });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers }); }
}
