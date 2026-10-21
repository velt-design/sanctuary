import { createHash } from 'node:crypto';
import { CREATIVE_RUNTIME_ENABLED, creativeIntentSchema, creativePolicySchema } from './contract';

/** Stable structured identity, never a provider idempotency guarantee. */
export function creativePolicyHash(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : item;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
type PolicyCode = 'invalid_contract' | 'scope' | 'stopped' | 'generation' | 'approval' | 'reservation' | 'pre_state'
  | 'budget' | 'control_changed' | 'catalogue' | 'asset' | 'copy' | 'ownership' | 'activation_evidence' | 'command_conflict' | 'reconcile_required';
type PolicyResult = { executionEnabled: false } & (
  { status: 'denied'; code: PolicyCode } | { status: 'validated_local_only'; requestHash: string; disposition: 'not_dispatched' | 'already_confirmed' });
/** Pure validation of an internal intent against separately supplied source
 * evidence. No token, provider transport, DB command or activation is exposed. */
export function validateCreativePolicy(intentInput: unknown, policyInput: unknown, now = new Date()): PolicyResult {
  const deny = (code: PolicyCode): PolicyResult => ({ executionEnabled: CREATIVE_RUNTIME_ENABLED, status: 'denied', code });
  const intentResult = creativeIntentSchema.safeParse(intentInput), policyResult = creativePolicySchema.safeParse(policyInput);
  if (!intentResult.success || !policyResult.success || !Number.isFinite(now.getTime())) return deny('invalid_contract');
  const intent = intentResult.data, policy = policyResult.data, time = now.getTime(), effect = intent.effect;
  const same = (a: unknown, b: unknown) => creativePolicyHash(a) === creativePolicyHash(b);
  const fresh = (at: string) => time - Date.parse(at) >= 0 && time - Date.parse(at) <= 5 * 60_000;
  if (!same(intent.scope, policy.scope) || !same(policy.preState.scope, policy.scope)) return deny('scope');
  if (policy.stopped) return deny('stopped');
  if (intent.generation !== policy.generation || policy.reservation.generation !== policy.generation) return deny('generation');
  const requestHash = creativePolicyHash(intent);
  if (policy.approval.intentHash !== requestHash || Date.parse(policy.approval.expiresAt) <= time
    || policy.approval.generator === policy.approval.reviewer) return deny('approval');
  if (policy.reservation.lane !== 'creative' || policy.reservation.experiment !== intent.experiment
    || policy.reservation.status !== 'held' || Date.parse(policy.reservation.expiresAt) <= time) return deny('reservation');
  if (!fresh(policy.preState.observedAt) || intent.expectedPreState !== creativePolicyHash(policy.preState)) return deny('pre_state');
  if (!same(policy.budget, policy.preState.budget)) return deny('budget');
  if (policy.controlAd !== policy.preState.controlAd || policy.controlSettings !== policy.preState.controlSettings) return deny('control_changed');
  if (new Set(policy.assets.map(row => row.key)).size !== policy.assets.length || new Set(policy.copies.map(row => row.key)).size !== policy.copies.length
    || new Set(policy.allowedClaims).size !== policy.allowedClaims.length
    || policy.approval.catalogueHash !== creativePolicyHash({ assets: policy.assets, copies: policy.copies, allowedClaims: policy.allowedClaims })) return deny('catalogue');
  if (policy.receipt.command !== intent.command || policy.receipt.requestHash !== requestHash) return deny('command_conflict');
  if (policy.receipt.state === 'dispatch_uncertain') return deny('reconcile_required');
  if ((policy.receipt.state === 'not_dispatched') !== (policy.receipt.objectId === null)) return deny('command_conflict');
  if (new Set(policy.ownedAds.map(row => row.ad)).size !== policy.ownedAds.length) return deny('ownership');
  if (effect.kind === 'create_paused_variant') {
    // Registry evidence of this command cannot be overridden by a missing or
    // stale dispatch receipt. Ambiguous identities require reconciliation.
    const created = policy.ownedAds.filter(row => row.createdBy === intent.command);
    if (created.length && (created.length !== 1 || policy.receipt.state !== 'confirmed'
      || created[0]!.ad !== policy.receipt.objectId || created[0]!.experiment !== intent.experiment
      || created[0]!.requestHash !== requestHash || !same(created[0]!.scope, policy.scope))) return deny('reconcile_required');
    if (effect.controlAd !== policy.controlAd) return deny('control_changed');
    const asset = policy.assets.find(row => row.key === effect.assetKey), copy = policy.copies.find(row => row.key === effect.copyKey);
    if (!asset || asset.page !== policy.scope.page || asset.path !== effect.path || Date.parse(asset.validUntil) <= time) return deny('asset');
    if (!copy || copy.path !== effect.path || new Set(copy.claims).size !== copy.claims.length || copy.claims.some(claim => !policy.allowedClaims.includes(claim))) return deny('copy');
    if (policy.receipt.state === 'not_dispatched' && policy.ownedAds.length >= 2) return deny('ownership');
    if (policy.receipt.state === 'confirmed' && !policy.ownedAds.some(row => row.ad === policy.receipt.objectId && row.experiment === intent.experiment
      && row.createdBy === intent.command && row.requestHash === requestHash && same(row.scope, policy.scope))) return deny('ownership');
  } else {
    const owned = policy.ownedAds.find(row => row.ad === effect.ad);
    if (!owned || owned.experiment !== intent.experiment || !same(owned.scope, policy.scope) || owned.ad === policy.controlAd) return deny('ownership');
    if (policy.receipt.state === 'confirmed' && policy.receipt.objectId !== owned.ad) return deny('command_conflict');
    if (effect.kind === 'activate_owned_ad') {
      const evidence = policy.activationEvidence;
      if (!evidence || evidence.experiment !== intent.experiment || !fresh(evidence.observedAt)) return deny('activation_evidence');
    }
  }
  return { executionEnabled: CREATIVE_RUNTIME_ENABLED, status: 'validated_local_only', requestHash,
    disposition: policy.receipt.state === 'confirmed' ? 'already_confirmed' : 'not_dispatched' };
}
