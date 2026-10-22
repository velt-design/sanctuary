import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { identitySchema } from '../metaCredentials/config';
import { creativePolicyHash, validateCreativePolicy } from './policy';
import { CREATIVE_RUNTIME_ENABLED, type CreativeIntent, type CreativePolicy } from './contract';
const now = new Date('2026-06-20T00:00:00Z'), expires = '2026-06-21T00:00:00Z';
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (s: string) => s.repeat(64);
function fixture() {
  const scope = { app: '11001', principal: '11002', business: '11003', account: '11004', page: '11005', campaign: '11006', adset: '11007' };
  const budget = { currency: 'NZD' as const, timezone: 'Pacific/Auckland' as const, dailyAverageMinor: 10000, maximumDayMinor: 17500, weeklyAllowanceMinor: 70000 };
  const preState = { scope, budget, controlAd: '11008', controlSettings: hash('a'), observedAt: now.toISOString() };
  const intent: CreativeIntent = { version: 1, capability: 'creatives', command: uuid(1), experiment: uuid(2), generation: 1, scope,
    expectedPreState: creativePolicyHash(preState), effect: { kind: 'create_paused_variant', controlAd: '11008', assetKey: 'approved_image', copyKey: 'approved_copy', path: '/auckland-outdoor-living' } };
  const policy: CreativePolicy = { scope, generation: 1, stopped: false, budget, controlAd: '11008', controlSettings: hash('a'), preState,
    assets: [{ key: 'approved_image', providerId: '11009', digest: hash('b'), kind: 'image', page: scope.page, paidUseApproved: true, approvalHash: hash('c'), validUntil: expires, path: '/auckland-outdoor-living' }],
    copies: [{ key: 'approved_copy', primary: 'A space for everyday living.', headline: 'Your outdoor space', description: '', action: 'design', claims: ['project_photo'], approvalHash: hash('d'), path: '/auckland-outdoor-living' }],
    allowedClaims: ['project_photo'], approval: { reference: uuid(3), intentHash: '', catalogueHash: '', generator: 'generator_fixture', reviewer: 'independent_fixture', verdict: 'approved', expiresAt: expires },
    reservation: { lane: 'creative', experiment: intent.experiment, generation: 1, status: 'held', expiresAt: expires }, ownedAds: [], activationEvidence: null,
    receipt: { command: intent.command, requestHash: '', state: 'not_dispatched', objectId: null } };
  const seal = () => { policy.approval.intentHash = creativePolicyHash(intent); policy.receipt.requestHash = creativePolicyHash(intent);
    policy.approval.catalogueHash = creativePolicyHash({ assets: policy.assets, copies: policy.copies, allowedClaims: policy.allowedClaims }); };
  seal(); return { intent, policy, seal };
}
describe('disabled creative policy', () => {
  it('validates only a local plan and declares a separate capability without admitting a credential', () => {
    const { intent, policy } = fixture();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ executionEnabled: false, status: 'validated_local_only', disposition: 'not_dispatched' });
    expect(CREATIVE_RUNTIME_ENABLED).toBe(false);
    expect(identitySchema.shape.capability.safeParse('creatives').success).toBe(false);
    for (const capability of ['reports', 'sales']) expect(validateCreativePolicy({ ...intent, capability }, policy, now)).toMatchObject({ status: 'denied', code: 'invalid_contract' });
  });
  it.each(['account', 'page', 'campaign', 'adset', 'app', 'principal', 'business'] as const)('denies wrong %s despite a structurally valid intent', field => {
    const { intent, policy, seal } = fixture(); intent.scope = { ...intent.scope, [field]: '99999' }; seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'denied', code: 'scope' });
  });
  it.each(['budget', 'targeting', 'offer', 'destination', 'status', 'object_story_spec', 'access_token'])('refuses unowned %s fields rather than stripping them', field => {
    const { intent, policy } = fixture();
    expect(validateCreativePolicy({ ...intent, effect: { ...intent.effect, [field]: 'forbidden' } }, policy, now)).toMatchObject({ status: 'denied', code: 'invalid_contract' });
    expect(validateCreativePolicy(intent, { ...policy, preState: { ...policy.preState, [field]: 'forbidden' } }, now)).toMatchObject({ status: 'denied', code: 'invalid_contract' });
  });
  it.each(['set_budget', 'set_targeting', 'create_study', 'send_message', 'publish_page_post'])('has no speculative %s effect', kind => {
    const { intent, policy } = fixture(); expect(validateCreativePolicy({ ...intent, effect: { kind } }, policy, now)).toMatchObject({ status: 'denied' });
  });
  it('binds independent approval to exact intent and catalogue, never a caller copy override', () => {
    const { intent, policy } = fixture(); policy.copies[0]!.headline = 'Unreviewed offer';
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'catalogue' });
    policy.approval.catalogueHash = creativePolicyHash({ assets: policy.assets, copies: policy.copies, allowedClaims: policy.allowedClaims });
    policy.approval.reviewer = policy.approval.generator;
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'approval' });
  });
  it('rejects unknown assets, expired rights and unsupported claims', () => {
    const { intent, policy, seal } = fixture(); intent.effect = { ...intent.effect, assetKey: 'unknown' } as CreativeIntent['effect']; seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'asset' });
    intent.effect = { ...intent.effect, assetKey: 'approved_image' } as CreativeIntent['effect']; policy.assets[0]!.validUntil = now.toISOString(); seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'asset' });
    policy.assets[0]!.validUntil = expires; policy.copies[0]!.claims = ['invented_offer']; seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'copy' });
  });
  it('requires a fresh unchanged budget and immutable control fingerprint', () => {
    const { intent, policy, seal } = fixture(); policy.preState = { ...policy.preState, budget: { ...policy.budget, dailyAverageMinor: 20000 } };
    intent.expectedPreState = creativePolicyHash(policy.preState); seal(); expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'budget' });
    policy.preState.budget = policy.budget; policy.preState.controlSettings = hash('e'); intent.expectedPreState = creativePolicyHash(policy.preState); seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'control_changed' });
    policy.preState.controlSettings = policy.controlSettings; policy.preState.observedAt = '2026-06-19T23:54:59Z'; intent.expectedPreState = creativePolicyHash(policy.preState); seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'pre_state' });
  });
  it('denies another lane, released reservation, stale generation and Stop', () => {
    const { intent, policy } = fixture(); policy.reservation.lane = 'landing'; expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'reservation' });
    policy.reservation.lane = 'creative'; policy.reservation.status = 'released'; expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'reservation' });
    policy.reservation.status = 'held'; policy.reservation.generation++; expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'generation' });
    policy.reservation.generation--; policy.stopped = true; expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'stopped' });
  });
  it('never repeats an uncertain creation or treats a name as provider idempotency', () => {
    const { intent, policy } = fixture(); policy.receipt.state = 'dispatch_uncertain';
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'reconcile_required' });
    policy.receipt.state = 'confirmed'; policy.receipt.objectId = '11010';
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'ownership' });
    policy.ownedAds = [{ ad: '11010', experiment: intent.experiment, createdBy: intent.command, requestHash: policy.receipt.requestHash, status: 'PAUSED', scope: policy.scope }];
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'validated_local_only', disposition: 'already_confirmed', executionEnabled: false });
    policy.receipt.requestHash = hash('f'); expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'command_conflict' });
  });
  it('restricts status intents to registered objects and requires separate activation evidence', () => {
    const { intent, policy, seal } = fixture(); intent.effect = { kind: 'activate_owned_ad', ad: '11010' }; seal();
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'ownership' });
    policy.ownedAds = [{ ad: '11010', experiment: intent.experiment, createdBy: uuid(4), requestHash: hash('e'), status: 'PAUSED', scope: policy.scope }];
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'activation_evidence' });
    policy.activationEvidence = { experiment: intent.experiment, verifiedContractHash: hash('c'), unchangedBudget: true, registryReady: true, endCleanupReady: true, observedAt: now.toISOString() };
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'validated_local_only', executionEnabled: false });
    intent.effect = { kind: 'pause_owned_ad', ad: policy.controlAd }; seal(); expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ code: 'ownership' });
  });
  it.each(['exact', 'hash_conflict', 'scope_conflict', 'experiment_conflict', 'multiple'] as const)('reconciles a registered create with a not-dispatched receipt: %s', conflict => {
    const { intent, policy } = fixture();
    const row = { ad: '11010', experiment: intent.experiment, createdBy: intent.command, requestHash: policy.receipt.requestHash, status: 'PAUSED' as const, scope: { ...policy.scope } };
    if (conflict === 'hash_conflict') row.requestHash = hash('f');
    if (conflict === 'scope_conflict') row.scope.account = '99999';
    if (conflict === 'experiment_conflict') row.experiment = uuid(9);
    policy.ownedAds = conflict === 'multiple' ? [row, { ...row, ad: '11011' }] : [row];
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'denied', code: 'reconcile_required', executionEnabled: false });
    policy.receipt.state = 'confirmed'; policy.receipt.objectId = row.ad;
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject(conflict === 'exact'
      ? { status: 'validated_local_only', disposition: 'already_confirmed', executionEnabled: false }
      : { status: 'denied', code: 'reconcile_required', executionEnabled: false });
  });
  it('requires a confirmed receipt for the same unique object, without blocking an unrelated command', () => {
    const { intent, policy } = fixture();
    policy.ownedAds = [{ ad: '11010', experiment: intent.experiment, createdBy: intent.command, requestHash: policy.receipt.requestHash, status: 'PAUSED', scope: policy.scope }];
    policy.receipt.state = 'confirmed'; policy.receipt.objectId = '11011';
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'denied', code: 'reconcile_required' });
    policy.ownedAds[0]!.createdBy = uuid(8); policy.ownedAds[0]!.requestHash = hash('e');
    policy.receipt.state = 'not_dispatched'; policy.receipt.objectId = null;
    expect(validateCreativePolicy(intent, policy, now)).toMatchObject({ status: 'validated_local_only', disposition: 'not_dispatched', executionEnabled: false });
  });
});
