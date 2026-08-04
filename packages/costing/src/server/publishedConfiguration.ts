import { createHash } from 'node:crypto';
import {
  applyCostingControlConfigV1,
  validateCostingControlConfigV1,
  type CostingControlConfigV1,
} from '../controlConfig';
import { loadCostingConfigV1, type CostingConfigV1 } from '../engine/config';

export type PublishedCostingConfigurationRecordV1 = {
  id: string;
  versionNumber: number;
  status: 'draft' | 'published';
  config: CostingControlConfigV1;
  contentHash: string;
  baseManifestVersion: string;
};

export type PublishedCostingConfigurationProvenanceV1 = {
  schemaVersion: 'costing-provenance.v1';
  source: 'published';
  versionId: string;
  versionNumber: number;
  contentHash: string;
  baseManifestVersion: string;
};

export type ResolvedPublishedCostingConfigurationV1 = {
  config: CostingConfigV1;
  provenance: PublishedCostingConfigurationProvenanceV1;
};

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalise(item)]),
  );
}

export function hashCostingControlConfigV1(config: CostingControlConfigV1): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(config))).digest('hex');
}

export function resolvePublishedCostingConfigurationRecordV1(
  record: PublishedCostingConfigurationRecordV1,
): ResolvedPublishedCostingConfigurationV1 {
  if (record.status !== 'published') {
    throw new Error('The current costing configuration pointer does not reference a published version.');
  }

  const base = loadCostingConfigV1();
  const validation = validateCostingControlConfigV1(record.config, base);
  if (!validation.ok) {
    const detail = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    throw new Error(`Published costing configuration ${record.id} is incompatible with this engine: ${detail}`);
  }
  const calculatedHash = hashCostingControlConfigV1(validation.value);
  if (calculatedHash !== record.contentHash) {
    throw new Error(`Published costing configuration ${record.id} failed its content hash check.`);
  }

  return {
    config: applyCostingControlConfigV1(base, validation.value),
    provenance: {
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId: record.id,
      versionNumber: record.versionNumber,
      contentHash: record.contentHash,
      baseManifestVersion: record.baseManifestVersion,
    },
  };
}
