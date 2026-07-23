import 'server-only';

import { createHash } from 'node:crypto';
import type { CostingControlConfigV1, CostingControlDiffEntryV1, CostingControlImpactRowV1 } from '@sp/costing';
import type {
  CostingConfigurationVersion,
  CostingConfigurationVersionSummary,
} from './configurationTypes';

export type {
  CostingConfigurationProvenanceV1,
  CostingConfigurationVersion,
  CostingConfigurationVersionSummary,
} from './configurationTypes';

type VersionRow = {
  id: unknown;
  version_number: unknown;
  status: unknown;
  schema_version: unknown;
  base_manifest_version: unknown;
  based_on_version_id: unknown;
  config_json: unknown;
  content_hash: unknown;
  created_at: unknown;
  created_by_email: unknown;
  updated_at: unknown;
  updated_by_email: unknown;
  published_at: unknown;
  published_by_email: unknown;
  publish_note: unknown;
  publication_diff: unknown;
  publication_impact: unknown;
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

export function hashCostingControlConfig(config: CostingControlConfigV1): string {
  return createHash('sha256').update(JSON.stringify(canonicalise(config))).digest('hex');
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Costing configuration row has invalid ${field}.`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function mapCostingConfigurationVersion(row: unknown): CostingConfigurationVersion {
  const value = row as VersionRow;
  const status = value?.status;
  if (status !== 'draft' && status !== 'published') {
    throw new Error('Costing configuration row has invalid status.');
  }
  const versionNumber = Number(value.version_number);
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) {
    throw new Error('Costing configuration row has invalid version_number.');
  }
  if (!value.config_json || typeof value.config_json !== 'object' || Array.isArray(value.config_json)) {
    throw new Error('Costing configuration row has invalid config_json.');
  }

  return {
    id: requiredString(value.id, 'id'),
    versionNumber,
    status,
    schemaVersion: requiredString(value.schema_version, 'schema_version'),
    baseManifestVersion: requiredString(value.base_manifest_version, 'base_manifest_version'),
    basedOnVersionId: nullableString(value.based_on_version_id),
    config: value.config_json as CostingControlConfigV1,
    contentHash: requiredString(value.content_hash, 'content_hash'),
    createdAt: requiredString(value.created_at, 'created_at'),
    createdByEmail: requiredString(value.created_by_email, 'created_by_email'),
    updatedAt: requiredString(value.updated_at, 'updated_at'),
    updatedByEmail: requiredString(value.updated_by_email, 'updated_by_email'),
    publishedAt: nullableString(value.published_at),
    publishedByEmail: nullableString(value.published_by_email),
    publishNote: nullableString(value.publish_note),
    publicationDiff: Array.isArray(value.publication_diff)
      ? value.publication_diff as CostingControlDiffEntryV1[]
      : null,
    publicationImpact: Array.isArray(value.publication_impact)
      ? value.publication_impact as CostingControlImpactRowV1[]
      : null,
  };
}

export function toCostingConfigurationSummary(
  version: CostingConfigurationVersion,
): CostingConfigurationVersionSummary {
  const { config: _config, publicationDiff: _diff, publicationImpact: _impact, ...summary } = version;
  return summary;
}

export function formatCostingDatabaseError(prefix: string, error: unknown): Error {
  const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : 'Unknown database error';
  return new Error(`${prefix}: ${message}`);
}

export function isMissingCostingConfigurationSchema(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown };
  const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';
  return value?.code === '42P01'
    || (message.includes('does not exist') && message.includes('costing_configuration_'));
}
