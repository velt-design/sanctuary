import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CostingControlConfigV1 } from '@sp/costing';
import {
  resolvePublishedCostingConfigurationRecordV1,
  type PublishedCostingConfigurationProvenanceV1,
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

const VERSION_SELECT = 'id, version_number, status, config_json, content_hash, base_manifest_version';

function resolveVersionData(data: unknown): ResolvedPublishedCostingConfigurationV1 {
  if (!data || typeof data !== 'object' || Array.isArray(data)) unavailable();
  const row = data as Record<string, unknown>;
  const versionNumber = Number(row.version_number);
  if (
    typeof row.id !== 'string'
    || !Number.isSafeInteger(versionNumber)
    || versionNumber < 1
    || row.status !== 'published'
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

async function readVersion(
  supabase: SupabaseClient,
  versionId: string,
): Promise<ResolvedPublishedCostingConfigurationV1> {
  const version = await supabase
    .from('costing_configuration_versions')
    .select(VERSION_SELECT)
    .eq('id', versionId)
    .single();
  if (version.error || !version.data) unavailable();
  return resolveVersionData(version.data);
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

  return readVersion(supabase, versionId);
}

/** Resolve the immutable published version named by a server-authenticated reference. */
export async function getPublishedCostingConfigurationByProvenance(
  provenance: PublishedCostingConfigurationProvenanceV1,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ResolvedPublishedCostingConfigurationV1> {
  const resolved = await readVersion(supabase, provenance.versionId);
  if (
    resolved.provenance.versionId !== provenance.versionId
    || resolved.provenance.versionNumber !== provenance.versionNumber
    || resolved.provenance.contentHash !== provenance.contentHash
    || resolved.provenance.baseManifestVersion !== provenance.baseManifestVersion
  ) {
    unavailable();
  }
  return resolved;
}
