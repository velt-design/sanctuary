import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyCostingControlConfigV1,
  loadCostingConfigV1,
  previewCostingControlSiteImpactV1,
} from '@sp/costing';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  type CalculatorInputs,
} from '@/lib/types/calculator';
import {
  getCostingConfigurationVersionById,
  resolvePublishedCostingConfiguration,
} from './configurationResolver';
import { formatCostingDatabaseError } from './configurationShared';
import type {
  CostingEstimateCandidate,
  CostingEstimatePreview,
} from './configurationTypes';

type AnyRecord = Record<string, unknown>;

type EstimateRow = {
  id: string;
  project_id: string;
  version: number | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  inputs?: unknown;
  outputs: unknown;
  costing_config_version_id?: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  quote_ref: string | null;
  site_address: string | null;
};

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRecord
    : null;
}

function calculatorInputs(value: unknown): CalculatorInputs | null {
  if (isCalculatorInputsV2(value)) return value;
  if (isLegacyCalculatorInputsV1(value)) return migrateLegacyCalculatorInputsToV2(value);
  return null;
}

function savedProvenance(outputs: unknown) {
  const versions = record(record(outputs)?.configVersions);
  const provenance = record(versions?.costingControl);
  if (!provenance) return null;
  return {
    source: typeof provenance.source === 'string' ? provenance.source : null,
    versionId: typeof provenance.versionId === 'string' ? provenance.versionId : null,
    versionNumber: typeof provenance.versionNumber === 'number' ? provenance.versionNumber : null,
    contentHash: typeof provenance.contentHash === 'string' ? provenance.contentHash : null,
  };
}

async function projectMapFor(
  supabase: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, ProjectRow>> {
  if (!projectIds.length) return new Map();
  const result = await supabase
    .from('projects')
    .select('id, name, quote_ref, site_address')
    .in('id', projectIds);
  if (result.error) throw formatCostingDatabaseError('Failed to load projects for estimate preview', result.error);
  return new Map(((result.data ?? []) as ProjectRow[]).map((project) => [project.id, project]));
}

function candidateFrom(row: EstimateRow, project: ProjectRow | undefined): CostingEstimateCandidate {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: project?.name?.trim() || 'Unnamed project',
    quoteRef: project?.quote_ref ?? null,
    siteAddress: project?.site_address ?? null,
    version: Number.isSafeInteger(row.version) ? row.version : null,
    status: row.status?.trim() || 'unknown',
    updatedAt: row.updated_at || row.created_at,
    savedCostingVersionId: row.costing_config_version_id ?? savedProvenance(row.outputs)?.versionId ?? null,
  };
}

export async function listCostingEstimateCandidates(
  supabase: SupabaseClient,
  search = '',
): Promise<CostingEstimateCandidate[]> {
  const result = await supabase
    .from('estimates')
    .select('id, project_id, version, status, created_at, updated_at, outputs, costing_config_version_id')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (result.error) throw formatCostingDatabaseError('Failed to load estimates for preview', result.error);
  const rows = (result.data ?? []) as EstimateRow[];
  const projects = await projectMapFor(supabase, [...new Set(rows.map((row) => row.project_id))]);
  const candidates = rows.map((row) => candidateFrom(row, projects.get(row.project_id)));
  const needle = search.trim().toLowerCase();
  if (!needle) return candidates.slice(0, 20);
  return candidates.filter((item) => (
    `${item.projectName} ${item.quoteRef ?? ''} ${item.siteAddress ?? ''} ${item.version ?? ''}`
      .toLowerCase()
      .includes(needle)
  )).slice(0, 20);
}

export async function previewCostingDraftAgainstEstimate(
  supabase: SupabaseClient,
  versionId: string,
  estimateId: string,
  expectedContentHash: string,
): Promise<CostingEstimatePreview> {
  const [draft, active] = await Promise.all([
    getCostingConfigurationVersionById(versionId, supabase),
    resolvePublishedCostingConfiguration(supabase),
  ]);
  if (draft.status !== 'draft') throw new Error('Only a saved draft can be previewed.');
  if (draft.contentHash !== expectedContentHash) {
    throw new Error('The draft changed. Save it and request a fresh estimate preview.');
  }

  const result = await supabase
    .from('estimates')
    .select('id, project_id, version, status, created_at, updated_at, inputs, outputs, costing_config_version_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (result.error) throw formatCostingDatabaseError('Failed to load estimate preview inputs', result.error);
  if (!result.data) throw new Error('Estimate not found.');
  const row = result.data as EstimateRow;
  const inputs = calculatorInputs(row.inputs);
  if (!inputs) throw new Error('This estimate does not contain supported calculator inputs.');

  const projects = await projectMapFor(supabase, [row.project_id]);
  const candidate = candidateFrom(row, projects.get(row.project_id));
  const draftEngineConfig = applyCostingControlConfigV1(loadCostingConfigV1(), draft.config);
  return {
    estimate: {
      ...candidate,
      savedProvenance: savedProvenance(row.outputs),
    },
    impact: previewCostingControlSiteImpactV1(
      row.id,
      `${candidate.projectName}${candidate.version ? ` · estimate v${candidate.version}` : ''}`,
      buildSiteInputsFromCalculatorInputs(inputs),
      active.config,
      draftEngineConfig,
    ),
    draftContentHash: draft.contentHash,
    currentVersionId: active.provenance.versionId,
    generatedAt: new Date().toISOString(),
  };
}
