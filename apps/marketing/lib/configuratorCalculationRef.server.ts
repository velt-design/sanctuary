import 'server-only';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import type { FrozenConfiguratorPrice } from './configuratorPricing.server';
import { hashCalculationValue, openCalculationRef, sealCalculationRef, parsePublishedCalculationProvenance,
  validCalculationIssuedAt, type CalculationRefOptions } from './calculationRefCodec.server';

const codec = { prefix: 'cf1.', domain: 'sanctuary.configurator-calculation-ref.v1', localSecret: 'local-only.configurator-calculation-ref.v1' };
export function hashConfiguratorDesign(design: PreviewDraft) {
  const parsed = parsePreviewDraft(design);
  if (!parsed) throw new Error('Invalid configurator design');
  return hashCalculationValue(parsed);
}
export function issueConfiguratorCalculationRef(frozen: FrozenConfiguratorPrice, options: CalculationRefOptions = {}) {
  return sealCalculationRef({ schemaVersion: 'configurator-calculation-ref.v1', designHash: hashConfiguratorDesign(frozen.design),
    costingConfiguration: frozen.costingConfiguration, frozenResultHash: hashCalculationValue(frozen),
    issuedAt: Math.floor((options.nowMs ?? Date.now()) / 1000) }, codec, options);
}
export function readConfiguratorCalculationRef(token: unknown, options: CalculationRefOptions = {}) {
  const value = openCalculationRef(token, codec, options);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>, costingConfiguration = parsePublishedCalculationProvenance(item.costingConfiguration);
  if (item.schemaVersion !== 'configurator-calculation-ref.v1' || !costingConfiguration
    || !validCalculationIssuedAt(item.issuedAt, options.nowMs ?? Date.now())
    || typeof item.designHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.designHash)
    || typeof item.frozenResultHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.frozenResultHash)) return null;
  return { costingConfiguration, designHash: item.designHash, frozenResultHash: item.frozenResultHash, issuedAt: item.issuedAt };
}
