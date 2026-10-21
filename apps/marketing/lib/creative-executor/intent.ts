import { canonicalHash, type EffectKind, type ExecutionPlan, type ExecutorState } from './contract';
export class ExecutorFailure extends Error {
  constructor(readonly code: 'http' | 'shape' | 'timeout' | 'scope' | 'unconfirmed') { super('Creative operation unconfirmed.'); }
}
export interface WireEffect { kind: EffectKind; path: string; body: Record<string, string>; target: string | null; requestHash: string; at: number }
const site = 'https://www.sanctuarypergolas.co.nz';
const object = (state: ExecutorState, kind: 'creative' | 'control' | 'challenger' | 'study') => state.objects.find(row => row.kind === kind)?.id;
export function serializeEffect(plan: ExecutionPlan, state: ExecutorState, kind: EffectKind, now = Date.now()): WireEffect {
  let path: string, body: Record<string, string>, target: string | null = null;
  const name = `velt-${plan.experiment}-${kind}`;
  if (kind === 'create_creative') {
    if (object(state, 'creative')) throw new ExecutorFailure('scope');
    path = `act_${plan.scope.account}/adcreatives`;
    body = { name, object_story_spec: JSON.stringify({ page_id: plan.scope.page, link_data: {
      image_hash: plan.control.imageHash, link: site + plan.control.path, message: plan.challengerPrimary,
      name: plan.control.headline, description: plan.control.description,
      call_to_action: { type: plan.control.action, value: { link: site + plan.control.path } },
    } }), url_tags: plan.control.urlTags };
  } else if (kind === 'create_control' || kind === 'create_challenger') {
    const arm = kind === 'create_control' ? 'control' : 'challenger';
    const creative = arm === 'control' ? plan.control.id : object(state, 'creative');
    if (!creative || object(state, arm)) throw new ExecutorFailure('scope');
    path = `act_${plan.scope.account}/ads`;
    body = { name, adset_id: plan.scope.adset, creative: JSON.stringify({ creative_id: creative }), status: 'PAUSED' };
  } else if (kind === 'create_study') {
    const control = object(state, 'control'), challenger = object(state, 'challenger');
    if (!control || !challenger || object(state, 'study') || plan.start * 1000 <= now || plan.end <= plan.start) throw new ExecutorFailure('scope');
    path = `${plan.scope.business}/ad_studies`;
    body = { name, type: 'SPLIT_TEST_V2', creative_test_config: JSON.stringify({ daily_budget: plan.studyDailyMinor }),
      cells: JSON.stringify([{ name: 'control', treatment_percentage: 50, ads: [control] }, { name: 'challenger', treatment_percentage: 50, ads: [challenger] }]),
      start_time: String(plan.start), cooldown_start_time: String(plan.start), end_time: String(plan.end), observation_end_time: String(plan.end) };
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
