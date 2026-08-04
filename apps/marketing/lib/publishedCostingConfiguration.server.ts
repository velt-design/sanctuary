import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CostingControlConfigV1 } from '@sp/costing';
import {
  resolvePublishedCostingConfigurationRecordV1,
  type ResolvedPublishedCostingConfigurationV1,
} from '@sp/costing/server';
import { getServiceSupabase } from './supabaseService';

export class PublishedCostingConfigurationUnavailableError extends Error {
  readonly code = 'PUBLISHED_COSTING_UNAVAILABLE';

  constructor() {
    super('Published costing configuration is unavailable.');
    this.name = 'PublishedCostingConfigurationUnavailableError';
  }
}

function unavailable(): never {
  throw new PublishedCostingConfigurationUnavailableError();
}

export async function getPublishedCostingConfiguration(
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ResolvedPublishedCostingConfigurationV1> {
  const publication = await supabase
    .from('costing_configuration_publication')
    .select('current_version_id')
    .eq('singleton', true)
    .maybeSingle();
  if (publication.error) unavailable();

  const versionId = typeof publication.data?.current_version_id === 'string'
    ? publication.data.current_version_id
    : '';
  if (!versionId) unavailable();

  const version = await supabase
    .from('costing_configuration_versions')
    .select('id, version_number, status, config_json, content_hash, base_manifest_version')
    .eq('id', versionId)
    .single();
  if (version.error || !version.data) unavailable();

  const row = version.data as Record<string, unknown>;
  const versionNumber = Number(row.version_number);
  if (
    typeof row.id !== 'string'
    || !Number.isSafeInteger(versionNumber)
    || versionNumber < 1
    || (row.status !== 'draft' && row.status !== 'published')
    || !row.config_json
    || typeof row.config_json !== 'object'
    || Array.isArray(row.config_json)
    || typeof row.content_hash !== 'string'
    || typeof row.base_manifest_version !== 'string'
  ) {
    unavailable();
  }

  try {
    return resolvePublishedCostingConfigurationRecordV1({
      id: row.id,
      versionNumber,
      status: row.status,
      config: row.config_json as CostingControlConfigV1,
      contentHash: row.content_hash,
      baseManifestVersion: row.base_manifest_version,
    });
  } catch {
    unavailable();
  }
}
