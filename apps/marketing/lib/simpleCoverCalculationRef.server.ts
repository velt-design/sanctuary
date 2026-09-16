import 'server-only';
import type { PublishedCostingConfigurationProvenanceV1 } from '@sp/costing/server';
import { parseSimpleCoverInput, type SimpleCoverInput } from './simpleCoverCalculator';
import type { FrozenSimpleCoverPricingResult } from './simpleCoverPricing.server';
import { calculationHashesMatch, hashCalculationValue, openCalculationRef, sealCalculationRef,
  parsePublishedCalculationProvenance, validCalculationIssuedAt, type CalculationRefOptions } from './calculationRefCodec.server';

const codec = { prefix: 'sc1.', domain: 'sanctuary.simple-cover-calculation-ref.v1', localSecret: 'local-only.simple-cover-calculation-ref.v1' };

export type SimpleCoverCalculationRefClaims = Readonly<{
  schemaVersion: 'simple-cover-calculation-ref.v1';
  input: SimpleCoverInput;
  costingConfiguration: PublishedCostingConfigurationProvenanceV1;
  issuedAt: number;
  frozenResultHash: string;
}>;

export function hashFrozenSimpleCoverPricingResult(result: FrozenSimpleCoverPricingResult): string {
  return hashCalculationValue(result);
}
export const frozenSimpleCoverHashesMatch = calculationHashesMatch;

export function issueSimpleCoverCalculationRef(result: FrozenSimpleCoverPricingResult, options: CalculationRefOptions = {}): string {
  try { return sealCalculationRef({ schemaVersion: 'simple-cover-calculation-ref.v1', input: result.input,
    costingConfiguration: result.costingConfiguration, issuedAt: Math.floor((options.nowMs ?? Date.now()) / 1000),
    frozenResultHash: hashFrozenSimpleCoverPricingResult(result) }, codec, options); }
  catch { throw new Error('Simple cover calculation continuity is unavailable.'); }
}
export function readSimpleCoverCalculationRef(token: unknown, options: CalculationRefOptions = {}): SimpleCoverCalculationRefClaims | null {
  const value = openCalculationRef(token, codec, options);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>, input = parseSimpleCoverInput(item.input);
  const costingConfiguration = parsePublishedCalculationProvenance(item.costingConfiguration);
  if (item.schemaVersion !== 'simple-cover-calculation-ref.v1' || !input || !costingConfiguration
    || !validCalculationIssuedAt(item.issuedAt, options.nowMs ?? Date.now())
    || typeof item.frozenResultHash !== 'string' || !/^[a-f0-9]{64}$/i.test(item.frozenResultHash)) return null;
  return { schemaVersion: 'simple-cover-calculation-ref.v1', input, costingConfiguration,
    issuedAt: item.issuedAt, frozenResultHash: item.frozenResultHash.toLowerCase() };
}
