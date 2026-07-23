import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyCostingControlConfigV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
  validateCostingControlConfigV1,
  type CostingConfigV1,
} from '@sp/costing';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { getCostingConfigWithOverrides } from './overrides';
import {
  formatCostingDatabaseError,
  hashCostingControlConfig,
  isMissingCostingConfigurationSchema,
  mapCostingConfigurationVersion,
  type CostingConfigurationProvenanceV1,
  type CostingConfigurationVersion,
} from './configurationShared';

type ResolvedCostingConfiguration = {
  config: CostingConfigV1;
  provenance: CostingConfigurationProvenanceV1;
};

async function resolveLegacyConfiguration(client: SupabaseClient): Promise<ResolvedCostingConfiguration> {
  const { config } = await getCostingConfigWithOverrides(client);
  const configSnapshot = snapshotCostingControlConfigV1(config);
  return {
    config,
    provenance: {
      schemaVersion: 'costing-provenance.v1',
      source: 'legacy-overrides',
      versionId: null,
      versionNumber: null,
      contentHash: hashCostingControlConfig(configSnapshot),
      baseManifestVersion: configSnapshot.baseManifestVersion,
      configSnapshot,
    },
  };
}

export async function getCostingConfigurationVersionById(
  versionId: string,
  supabase?: SupabaseClient,
): Promise<CostingConfigurationVersion> {
  const client = supabase ?? await getSupabaseServerAuth();
  const result = await client
    .from('costing_configuration_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (result.error) throw formatCostingDatabaseError('Failed to load costing configuration version', result.error);
  return mapCostingConfigurationVersion(result.data);
}

export async function resolvePublishedCostingConfiguration(
  supabase?: SupabaseClient,
): Promise<ResolvedCostingConfiguration> {
  const client = supabase ?? await getSupabaseServerAuth();
  const publication = await client
    .from('costing_configuration_publication')
    .select('current_version_id')
    .eq('singleton', true)
    .maybeSingle();

  if (publication.error) {
    if (isMissingCostingConfigurationSchema(publication.error)) return resolveLegacyConfiguration(client);
    throw formatCostingDatabaseError('Failed to resolve published costing configuration', publication.error);
  }
  const versionId = typeof publication.data?.current_version_id === 'string'
    ? publication.data.current_version_id
    : null;
  if (!versionId) return resolveLegacyConfiguration(client);

  const version = await getCostingConfigurationVersionById(versionId, client);
  if (version.status !== 'published') {
    throw new Error('The current costing configuration pointer does not reference a published version.');
  }

  const base = loadCostingConfigV1();
  const validation = validateCostingControlConfigV1(version.config, base);
  if (!validation.ok) {
    const detail = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    throw new Error(`Published costing configuration ${version.id} is incompatible with this engine: ${detail}`);
  }
  const calculatedHash = hashCostingControlConfig(validation.value);
  if (calculatedHash !== version.contentHash) {
    throw new Error(`Published costing configuration ${version.id} failed its content hash check.`);
  }

  return {
    config: applyCostingControlConfigV1(base, validation.value),
    provenance: {
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId: version.id,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      baseManifestVersion: version.baseManifestVersion,
    },
  };
}

export async function resolveHistoricalCostingConfiguration(
  provenance: CostingConfigurationProvenanceV1,
  supabase?: SupabaseClient,
): Promise<CostingConfigV1> {
  const base = loadCostingConfigV1();
  if (provenance.source === 'legacy-overrides') {
    const hash = hashCostingControlConfig(provenance.configSnapshot);
    if (hash !== provenance.contentHash) throw new Error('Legacy costing configuration snapshot failed its hash check.');
    return applyCostingControlConfigV1(base, provenance.configSnapshot);
  }

  const version = await getCostingConfigurationVersionById(provenance.versionId, supabase);
  if (version.status !== 'published' || version.contentHash !== provenance.contentHash) {
    throw new Error('Historical costing configuration provenance does not match the immutable published version.');
  }
  return applyCostingControlConfigV1(base, version.config);
}
