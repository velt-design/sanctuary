import {writableVideoEnhancements} from './standard-enhancements';
import {wireAdSettings} from './ad-settings';
import {creativeWithPrimary} from './creative-copy';
import {requireNativeAcceptance} from './native-acceptance';
import { canonicalHash, type EffectKind, type ExecutionPlan, type ExecutorState } from './contract';
export class ExecutorFailure extends Error {
  constructor(readonly code: 'http' | 'shape' | 'timeout' | 'scope' | 'unconfirmed', readonly httpStatus: number | null = null, readonly metaError: { code: number | null; subcode: number | null } = { code: null, subcode: null }) { super('Creative operation unconfirmed.'); }
}
export interface WireEffect { kind: EffectKind; path: string; body: Record<string, string>; target: string | null; requestHash: string; at: number }
const site = 'https://www.sanctuarypergolas.co.nz';
const object = (state: ExecutorState, kind: 'creative' | 'control' | 'challenger' | 'study') => kind==='creative' ? state.creativeReference??state.objects.find(row=>row.kind===kind)?.id : state.objects.find(row => row.kind === kind)?.id;
export function serializeEffect(plan: ExecutionPlan, state: ExecutorState, kind: EffectKind, now = Date.now()): WireEffect {
  let path: string, body: Record<string, string>, target: string | null = null;
  const name = `velt-${plan.experiment}-${kind}`;
  if (plan.control.format==='native_reference') {
    if(plan.purpose!=='paused_capability'||plan.control.sourceAd!==plan.controlAd||!plan.originalAds.includes(plan.controlAd))throw new ExecutorFailure('scope');
    if(kind==='create_control'){
      if(object(state,'control'))throw new ExecutorFailure('scope');
      path=`${plan.controlAd}/copies`;body={adset_id:plan.scope.adset,status_option:'PAUSED'};
    }else if(kind==='pause_control'){
      target=object(state,'control')??null;
      if(!target||plan.originalAds.includes(target))throw new ExecutorFailure('scope');
      path=target;body={status:'PAUSED'};
    }else throw new ExecutorFailure('scope');
  } else if (kind === 'create_creative') {
    if (object(state, 'creative')) throw new ExecutorFailure('scope');
    path = `act_${plan.scope.account}/adcreatives`;
    if (plan.control.format === 'video_assets'||plan.control.format==='video_story') {
      const updated=creativeWithPrimary(plan.control,plan.control.id,plan.challengerPrimary,plan.ownerReview?.edit);
      if(updated.format!=='video_assets'&&updated.format!=='video_story')throw new ExecutorFailure('scope');
      const payload=structuredClone(updated.payload);
      if(payload.degrees_of_freedom_spec!==undefined&&updated.format==='video_story')payload.degrees_of_freedom_spec=writableVideoEnhancements(payload.degrees_of_freedom_spec);
      body = { name, ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])), url_tags: plan.control.urlTags };
    } else {
      body = { name, object_story_spec: JSON.stringify({ page_id: plan.scope.page, link_data: {
        image_hash: plan.control.imageHash, link: site + plan.control.path, message: plan.challengerPrimary,
        name: plan.control.headline, description: plan.control.description,
        call_to_action: { type: plan.control.action, value: { link: site + plan.control.path } },
      } }), url_tags: plan.control.urlTags };
    }
  } else if (kind === 'create_control' || kind === 'create_challenger') {
    const arm = kind === 'create_control' ? 'control' : 'challenger';
    const creative = arm === 'control' && plan.purpose==='formal_experiment' ? plan.control.id : object(state, 'creative');
    if (!creative || object(state, arm)) throw new ExecutorFailure('scope');
    path = `act_${plan.scope.account}/ads`;
    body = { ...wireAdSettings(plan.adSettings), name, adset_id: plan.scope.adset, creative: JSON.stringify({ creative_id: creative }), tracking_specs: JSON.stringify(plan.adTracking), status: 'PAUSED' };
    if(plan.purpose==='formal_experiment'){
      if(plan.start*1000<=now)throw new ExecutorFailure('scope');
      body.ad_schedule_start_time=new Date(plan.start*1000).toISOString();
      body.ad_schedule_end_time=new Date(plan.end*1000).toISOString();
    }
  } else if (kind === 'create_study') {
    const control = object(state, 'control'), challenger = object(state, 'challenger');
    if (plan.purpose !== 'formal_experiment' || !control || !challenger || object(state, 'study') || plan.start * 1000 <= now || plan.end <= plan.start) throw new ExecutorFailure('scope');
    path = `${plan.scope.business}/ad_studies`;
    body = { name, type: 'SPLIT_TEST_V2', objectives: JSON.stringify([plan.nativeObjective]), creative_test_config: JSON.stringify({ daily_budget: plan.studyDailyMinor }),
      cells: JSON.stringify([{ name: 'control', treatment_percentage: 50, ads: [control] }, { name: 'challenger', treatment_percentage: 50, ads: [challenger] }]),
      start_time: String(plan.start), cooldown_start_time: String(plan.start), end_time: String(plan.end), observation_end_time: String(plan.end) };
  } else if (kind === 'activate_control' || kind === 'activate_challenger') {
    const arm=kind==='activate_control'?'control':'challenger';
    target=object(state,arm)??null;
    if(plan.purpose!=='formal_experiment'||!target||plan.originalAds.includes(target)||plan.start*1000<=now||!state.measurementReady||state.state!=='canary_ready'||!state.nativeAcceptance)throw new ExecutorFailure('scope');
    if(state.effects.some(row=>row.kind===kind&&row.state!=='no_effect'))throw new ExecutorFailure('scope');
    requireNativeAcceptance(plan,state.nativeAcceptance,now);
    path=target;body={status:'ACTIVE'};
  } else if (kind === 'end_study') {
    target = object(state, 'study') ?? null; if (!target) throw new ExecutorFailure('scope');
    // Preserve start/cells. Future paired end is verified by readback. A provider
    // rejection remains unknown cleanup, never permission to delete or activate.
    const end = Math.max(plan.start + 60, Math.floor(now / 1000) + 300);
    if (end >= plan.end) throw new ExecutorFailure('scope');
    path = target; body = { end_time: String(end), observation_end_time: String(end) };
  } else {
    target = object(state, kind === 'pause_control' ? 'control' : 'challenger') ?? null;
    if (!target || plan.originalAds.includes(target)) throw new ExecutorFailure('scope');
    path = target; body = { status: 'PAUSED' };
  }
  return { kind, path, body, target, at: now, requestHash: canonicalHash({ experiment: plan.experiment, kind, path, body }) };
}
