import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyCostingControlConfigV1,
  diffCostingControlConfigsV1,
  loadCostingConfigV1,
  previewCostingControlImpactV1,
  snapshotCostingControlConfigV1,
  validateCostingControlConfigV1,
  type CostingControlConfigV1,
  type CostingControlDiffEntryV1,
  type CostingControlImpactRowV1,
} from '@sp/costing';
import {
  formatCostingDatabaseError,
  hashCostingControlConfig,
  mapCostingConfigurationVersion,
  toCostingConfigurationSummary,
  type CostingConfigurationVersion,
  type CostingConfigurationVersionSummary,
} from './configurationShared';
import {
  getCostingConfigurationVersionById,
  resolvePublishedCostingConfiguration,
} from './configurationResolver';
import {
  validateCostingConfigurationMetadata,
  type CostingConfigurationMetadata,
} from './configurationMetadata';

type CostingConfigurationActor = {
  id: string;
  email: string;
};

export type CostingConfigurationComparison = {
  currentVersionId: string | null;
  currentSource: 'published' | 'legacy-overrides';
  baselineConfig: CostingControlConfigV1;
  diff: CostingControlDiffEntryV1[];
  impact: CostingControlImpactRowV1[];
};

export type CostingConfigurationOverview = {
  currentVersionId: string | null;
  currentSource: 'published' | 'legacy-overrides';
  versions: CostingConfigurationVersionSummary[];
};

function actorFields(actor: CostingConfigurationActor) {
  if (!actor.id || !actor.email.trim()) throw new Error('Authenticated admin identity is incomplete.');
  return { id: actor.id, email: actor.email.trim() };
}

function assertValidConfig(config: unknown): CostingControlConfigV1 {
  const result = validateCostingControlConfigV1(config, loadCostingConfigV1());
  if (result.ok) return result.value;
  const error = new Error('Costing configuration validation failed.') as Error & {
    validationIssues?: typeof result.issues;
  };
  error.validationIssues = result.issues;
  throw error;
}

function assertValidMetadata(candidate: Partial<CostingConfigurationMetadata>): CostingConfigurationMetadata {
  const result = validateCostingConfigurationMetadata(candidate);
  if (result.ok) return result.value;
  const error = new Error('Costing configuration details are incomplete.') as Error & {
    metadataIssues?: typeof result.issues;
  };
  error.metadataIssues = result.issues;
  throw error;
}

export function validateCostingConfigurationCandidate(candidate: unknown) {
  return validateCostingControlConfigV1(candidate, loadCostingConfigV1());
}

export async function listCostingConfigurationOverview(
  supabase: SupabaseClient,
): Promise<CostingConfigurationOverview> {
  const [active, versionsResult] = await Promise.all([
    resolvePublishedCostingConfiguration(supabase),
    supabase
      .from('costing_configuration_versions')
      .select('*')
      .order('version_number', { ascending: false })
      .limit(100),
  ]);
  if (versionsResult.error) {
    throw formatCostingDatabaseError('Failed to list costing configuration versions', versionsResult.error);
  }
  return {
    currentVersionId: active.provenance.versionId,
    currentSource: active.provenance.source,
    versions: (versionsResult.data ?? [])
      .map(mapCostingConfigurationVersion)
      .map(toCostingConfigurationSummary),
  };
}

export async function createCostingConfigurationDraft(
  supabase: SupabaseClient,
  actor: CostingConfigurationActor,
  sourceVersionId?: string | null,
  metadata?: Partial<CostingConfigurationMetadata>,
): Promise<CostingConfigurationVersion> {
  const identity = actorFields(actor);
  const details = assertValidMetadata(metadata ?? {});
  let config: CostingControlConfigV1;
  let basedOnVersionId: string | null;

  if (sourceVersionId) {
    const source = await getCostingConfigurationVersionById(sourceVersionId, supabase);
    config = assertValidConfig(source.config);
    basedOnVersionId = source.id;
  } else {
    const active = await resolvePublishedCostingConfiguration(supabase);
    config = snapshotCostingControlConfigV1(active.config);
    basedOnVersionId = active.provenance.versionId;
  }

  const insertResult = await supabase
    .from('costing_configuration_versions')
    .insert({
      status: 'draft',
      name: details.name,
      purpose: details.purpose,
      schema_version: config.schemaVersion,
      base_manifest_version: config.baseManifestVersion,
      based_on_version_id: basedOnVersionId,
      config_json: config,
      content_hash: hashCostingControlConfig(config),
      created_by: identity.id,
      created_by_email: identity.email,
      updated_by: identity.id,
      updated_by_email: identity.email,
    })
    .select('*')
    .single();
  if (insertResult.error) {
    throw formatCostingDatabaseError('Failed to create costing configuration draft', insertResult.error);
  }
  return mapCostingConfigurationVersion(insertResult.data);
}

export async function saveCostingConfigurationDraft(
  supabase: SupabaseClient,
  actor: CostingConfigurationActor,
  versionId: string,
  expectedContentHash: string,
  expectedUpdatedAt: string,
  candidate: unknown,
  metadata: Partial<CostingConfigurationMetadata>,
): Promise<CostingConfigurationVersion> {
  const identity = actorFields(actor);
  const config = assertValidConfig(candidate);
  const details = assertValidMetadata(metadata);
  const updateResult = await supabase
    .from('costing_configuration_versions')
    .update({
      name: details.name,
      purpose: details.purpose,
      config_json: config,
      content_hash: hashCostingControlConfig(config),
      updated_at: new Date().toISOString(),
      updated_by: identity.id,
      updated_by_email: identity.email,
    })
    .eq('id', versionId)
    .eq('status', 'draft')
    .eq('content_hash', expectedContentHash)
    .eq('updated_at', expectedUpdatedAt)
    .select('*')
    .maybeSingle();
  if (updateResult.error) {
    throw formatCostingDatabaseError('Failed to save costing configuration draft', updateResult.error);
  }
  if (!updateResult.data) {
    throw new Error('The draft changed or was published. Refresh before saving again.');
  }
  return mapCostingConfigurationVersion(updateResult.data);
}

async function compareCostingConfigurationDraft(
  supabase: SupabaseClient,
  version: CostingConfigurationVersion,
): Promise<CostingConfigurationComparison> {
  if (version.status !== 'draft') throw new Error('Only draft costing configurations can be compared.');
  const active = await resolvePublishedCostingConfiguration(supabase);
  const candidate = assertValidConfig(version.config);
  const candidateEngineConfig = applyCostingControlConfigV1(loadCostingConfigV1(), candidate);
  const baselineConfig = snapshotCostingControlConfigV1(active.config);
  return {
    currentVersionId: active.provenance.versionId,
    currentSource: active.provenance.source,
    baselineConfig,
    diff: diffCostingControlConfigsV1(
      baselineConfig,
      candidate,
    ),
    impact: previewCostingControlImpactV1(active.config, candidateEngineConfig),
  };
}

export async function getCostingConfigurationEditor(
  supabase: SupabaseClient,
  versionId: string,
): Promise<{
  version: CostingConfigurationVersion;
  comparison: CostingConfigurationComparison | null;
}> {
  const version = await getCostingConfigurationVersionById(versionId, supabase);
  return {
    version,
    comparison: version.status === 'draft'
      ? await compareCostingConfigurationDraft(supabase, version)
      : null,
  };
}

export async function publishCostingConfigurationDraft(
  supabase: SupabaseClient,
  versionId: string,
  expectedContentHash: string,
  expectedCurrentVersionId: string | null,
  publishNote: string,
): Promise<CostingConfigurationVersion> {
  const version = await getCostingConfigurationVersionById(versionId, supabase);
  if (version.contentHash !== expectedContentHash) {
    throw new Error('The draft changed. Refresh its comparison before publishing.');
  }
  const comparison = await compareCostingConfigurationDraft(supabase, version);
  if (comparison.currentVersionId !== expectedCurrentVersionId) {
    throw new Error('The published configuration changed. Refresh the comparison before publishing.');
  }
  if (comparison.diff.length === 0) {
    throw new Error('The draft has no changes to publish.');
  }

  const publishResult = await supabase.rpc('publish_costing_configuration_version', {
    p_version_id: version.id,
    p_expected_current_version_id: expectedCurrentVersionId,
    p_expected_content_hash: version.contentHash,
    p_publish_note: publishNote,
    p_publication_diff: comparison.diff,
    p_publication_impact: comparison.impact,
  });
  if (publishResult.error) {
    throw formatCostingDatabaseError('Failed to publish costing configuration', publishResult.error);
  }
  return mapCostingConfigurationVersion(publishResult.data);
}

export function getCostingConfigurationEditorCatalog() {
  const base = loadCostingConfigV1();
  return {
    materials: base.materials.items.map((item) => {
      const record = item as unknown as Record<string, unknown>;
      const source = record.source && typeof record.source === 'object' && !Array.isArray(record.source)
        ? record.source as Record<string, unknown>
        : null;
      const attributes = record.attributes && typeof record.attributes === 'object' && !Array.isArray(record.attributes)
        ? record.attributes as Record<string, unknown>
        : null;
      const supplier = typeof source?.supplier === 'string'
        ? source.supplier
        : typeof attributes?.supplier === 'string'
          ? attributes.supplier
          : null;
      const product = typeof attributes?.product === 'string'
        ? attributes.product
        : typeof record.name === 'string'
          ? record.name
          : null;
      return {
        id: item.id,
        label: typeof item.name === 'string' && item.name ? item.name : item.id,
        unit: typeof item.unit === 'string' ? item.unit : '',
        category: typeof item.category === 'string' ? item.category : 'Other',
        supplier,
        product,
        note: typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : null,
        assumption: source?.needs_confirmation === true || source?.method === 'assumption',
      };
    }),
    actions: base.installActions.actions.flatMap((action) => (
      action.base_minutes === undefined
        ? []
        : [{
            id: action.id,
            label: typeof action.label === 'string' && action.label ? action.label : action.id,
          }]
    )),
  };
}
