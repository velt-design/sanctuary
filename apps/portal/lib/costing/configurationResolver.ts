import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyCostingControlConfigV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
  type CostingConfigV1,
} from '@sp/costing';
import { resolvePublishedCostingConfigurationRecordV1 } from '@sp/costing/server';
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
    .select('current_version_id, current_version:costing_configuration_versions(*)')
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

  const joinedVersion = Array.isArray(publication.data?.current_version)
    ? publication.data.current_version[0]
    : publication.data?.current_version;
  if (!joinedVersion || typeof joinedVersion !== 'object') {
    throw new Error('The published costing configuration version could not be loaded.');
  }
  const version = mapCostingConfigurationVersion(joinedVersion);
  if (version.id !== versionId) {
    throw new Error('The published costing configuration version does not match its publication pointer.');
  }
  return resolvePublishedCostingConfigurationRecordV1(version);
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
